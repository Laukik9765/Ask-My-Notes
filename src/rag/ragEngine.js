/**
 * ragEngine.js — Public RAG API (Section 6.2)
 * Exposes: ingestDocument, deleteDocument, rebuildEmbeddings, query
 * This layer orchestrates parsers, chunker, embedding worker, and vector store.
 * No direct DOM manipulation.
 */

import { chunkText, estimateTokenCount } from './chunker.js';
import { topKChunks, scoreToConfidence } from './similarity.js';
import { formatContext, buildGroundedPrompt, FALLBACK_MESSAGE } from './promptBuilder.js';
import {
  saveDocument, getDocument, deleteDocument,
  saveChunks, getChunksByKb, getChunksByDocument,
  deleteChunksByDocument, deleteChunksByKb, getDocumentsByKb,
  saveKnowledgeBase, getAllKnowledgeBases, countChunksByKb, openDB, generateUUID,
} from '../lib/vectorStore.js';
import { getParser } from '../lib/uploadQueue.js';
import { getState } from '../state/store.js';

/* ─── Embedding Worker singleton ─────────────────────────── */

let worker     = null;
let workerBusy = false;

function getWorker() {
  if (!worker) {
    worker = new Worker('/src/workers/embedding.worker.js', { type: 'module' });
  }
  return worker;
}

/**
 * Embed an array of text strings via the Web Worker.
 * Returns an array of number[] vectors (one per chunk).
 *
 * @param {string[]} texts
 * @param {(done: number, total: number) => void} onProgress
 * @returns {Promise<number[][]>}
 */
function embedBatch(texts, onProgress) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const handler = (e) => {
      const { type, payload } = e.data;
      if (type === 'EMBED_PROGRESS') {
        onProgress?.(payload.done, payload.total);
      } else if (type === 'EMBED_RESULT') {
        w.removeEventListener('message', handler);
        resolve(payload.vectors);
      } else if (type === 'EMBED_ERROR') {
        w.removeEventListener('message', handler);
        reject(new Error(payload.message));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'EMBED_BATCH', payload: { chunks: texts } });
  });
}

/**
 * Embed a single query string via the Web Worker.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
function embedQuery(text) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const handler = (e) => {
      const { type, payload } = e.data;
      if (type === 'EMBED_SINGLE_RESULT') {
        w.removeEventListener('message', handler);
        resolve(payload.vector);
      } else if (type === 'EMBED_ERROR') {
        w.removeEventListener('message', handler);
        reject(new Error(payload.message));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'EMBED_SINGLE', payload: { text } });
  });
}

/* ─── Vector cache ───────────────────────────────────────── */
// Per-KB in-memory cache of chunks (populated on first query)
const vectorCache = {};

async function loadVectorCache(kbId) {
  if (!vectorCache[kbId]) {
    vectorCache[kbId] = await getChunksByKb(kbId);
  }
  return vectorCache[kbId];
}

function invalidateCache(kbId) {
  delete vectorCache[kbId];
}

/* ─── Ingest ─────────────────────────────────────────────── */

/**
 * Parse, chunk, embed, and store a document.
 *
 * @param {File}   file
 * @param {string} kbId
 * @param {(stage: string, pct: number) => void} [onProgress]
 */
export async function ingestDocument(file, kbId, onProgress) {
  await openDB();
  const { settings } = getState();

  // 1. Parse
  onProgress?.('Parsing', 0);
  const parser  = await getParser(file.name);
  const parsed  = await parser(file);

  if (!parsed.text || parsed.text.trim().length === 0) {
    throw new Error('No readable text found. The file may be scanned/image-only.');
  }

  // 2. Save document record (raw text retained for rebuilding)
  const docId = generateUUID();
  const doc = {
    id:           docId,
    kbId,
    name:         file.name,
    title:        parsed.title,
    type:         file.name.split('.').pop().toLowerCase(),
    size:         file.size,
    rawText:      parsed.text,      // retained for rebuild
    pageCount:    parsed.pageCount || null,
    uploadedAt:   Date.now(),
    status:       'indexing',
    chunkCount:   0,
  };
  await saveDocument(doc);

  // 3. Chunk
  onProgress?.('Chunking', 10);
  const chunkTexts = chunkText(parsed.text, {
    chunkSize: settings.chunkSize,
    overlap:   settings.chunkOverlap,
  });

  if (chunkTexts.length === 0) {
    throw new Error('Document produced no chunks after splitting.');
  }

  // 4. Embed via Worker
  onProgress?.('Embedding', 20);
  const vectors = await embedBatch(chunkTexts, (done, total) => {
    const pct = 20 + Math.round((done / total) * 70);
    onProgress?.('Embedding', pct);
  });

  // 5. Store chunks
  onProgress?.('Saving', 95);
  const chunks = chunkTexts.map((text, i) => ({
    id:             generateUUID(),
    kbId,
    documentId:     docId,
    chunkIndex:     i,
    text,
    vector:         vectors[i], // plain number[] — serialisable
    tokenCount:     estimateTokenCount(text),
    sourceFileName: file.name,
    createdAt:      Date.now(),
  }));

  await saveChunks(chunks);

  // 6. Update document status
  await saveDocument({ ...doc, status: 'ready', chunkCount: chunks.length });

  // 7. Update KB document count
  const kbs   = await getAllKnowledgeBases();
  const kb    = kbs.find((k) => k.id === kbId);
  if (kb) {
    const docCount = (await getDocumentsByKb(kbId)).length;
    await saveKnowledgeBase({ ...kb, documentCount: docCount, updatedAt: Date.now() });
  }

  invalidateCache(kbId);
  onProgress?.('Done', 100);

  return { docId, chunkCount: chunks.length };
}

/* ─── Delete ─────────────────────────────────────────────── */

/**
 * Remove a document and all its chunks.
 * @param {string} docId
 */
export async function deleteDocumentById(docId) {
  await openDB();
  const doc = await getDocument(docId);
  if (!doc) return;

  await deleteChunksByDocument(docId);
  await deleteDocument(docId);

  // Update KB count
  const kbs = await getAllKnowledgeBases();
  const kb  = kbs.find((k) => k.id === doc.kbId);
  if (kb) {
    const docCount = (await getDocumentsByKb(doc.kbId)).length;
    await saveKnowledgeBase({ ...kb, documentCount: docCount, updatedAt: Date.now() });
  }

  invalidateCache(doc.kbId);
}

/**
 * Clear all documents and chunks from a KB.
 * @param {string} kbId
 */
export async function clearKnowledgeBase(kbId) {
  await openDB();
  const docs = await getDocumentsByKb(kbId);
  for (const doc of docs) {
    await deleteChunksByDocument(doc.id);
    await deleteDocument(doc.id);
  }
  const kbs = await getAllKnowledgeBases();
  const kb  = kbs.find((k) => k.id === kbId);
  if (kb) {
    await saveKnowledgeBase({ ...kb, documentCount: 0, updatedAt: Date.now() });
  }
  invalidateCache(kbId);
}

/* ─── Rebuild ────────────────────────────────────────────── */

/**
 * Re-embed all chunks for a single document using the current chunk settings.
 * @param {string} docId
 * @param {(stage: string, pct: number) => void} [onProgress]
 */
export async function rebuildDocumentEmbeddings(docId, onProgress) {
  await openDB();
  const { settings } = getState();
  const doc = await getDocument(docId);
  if (!doc || !doc.rawText) throw new Error('Document not found or missing raw text.');

  // Delete old chunks
  await deleteChunksByDocument(docId);

  // Re-chunk
  const chunkTexts = chunkText(doc.rawText, {
    chunkSize: settings.chunkSize,
    overlap:   settings.chunkOverlap,
  });

  // Re-embed
  const vectors = await embedBatch(chunkTexts, (done, total) => {
    const pct = Math.round((done / total) * 90);
    onProgress?.('Embedding', pct);
  });

  // Save new chunks
  const chunks = chunkTexts.map((text, i) => ({
    id:             generateUUID(),
    kbId:           doc.kbId,
    documentId:     docId,
    chunkIndex:     i,
    text,
    vector:         vectors[i],
    tokenCount:     estimateTokenCount(text),
    sourceFileName: doc.name,
    createdAt:      Date.now(),
  }));

  await saveChunks(chunks);
  await saveDocument({ ...doc, chunkCount: chunks.length, status: 'ready' });
  invalidateCache(doc.kbId);
  onProgress?.('Done', 100);
}

/* ─── Query ──────────────────────────────────────────────── */

/**
 * Full RAG query pipeline.
 *
 * @param {string} question
 * @param {string} kbId
 * @param {object} callbacks
 * @param {(token: string) => void} callbacks.onToken  - Called per streaming token
 * @param {(results: any[]) => void} callbacks.onChunks - Called with retrieved chunks
 * @returns {Promise<{ answer: string, confidence: object, chunks: any[] }>}
 */
export async function query(question, kbId, callbacks = {}) {
  await openDB();
  const { settings } = getState();
  const { onToken, onChunks } = callbacks;

  console.log(`[RAG Engine] Querying: "${question}" in KB: "${kbId}"`);

  // 1. Embed query
  const queryVec = await embedQuery(question);

  // 2. Load chunks (from cache or DB)
  const allChunks = await loadVectorCache(kbId);
  console.log(`[RAG Engine] Total chunks loaded from database for this KB: ${allChunks.length}`);

  if (allChunks.length === 0) {
    const fallback = "No documents found in this Knowledge Base. Please upload some notes first.";
    onToken?.(fallback);
    return { answer: fallback, confidence: { label: 'Low', level: 'low' }, chunks: [] };
  }

  console.log(`[RAG Engine] Matching using settings threshold: ${settings.threshold}, Top-K: ${settings.topK}`);

  // 3. Similarity search
  const results = topKChunks(queryVec, allChunks, {
    topK:      settings.topK,
    threshold: settings.threshold,
  });

  const topScore = results.length > 0 ? results[0].score : 0;
  const confidence = scoreToConfidence(topScore);

  console.log(`[RAG Engine] Cosine similarity top score: ${topScore.toFixed(4)}`);
  if (results.length > 0) {
    console.log(`[RAG Engine] Top matching chunk details:`, {
      source: results[0].chunk.sourceFileName,
      index: results[0].chunk.chunkIndex + 1,
      text: results[0].chunk.text.slice(0, 100) + "..."
    });
  }

  // 4. Threshold gate — skip LLM if nothing relevant
  if (results.length === 0 || topScore < settings.threshold) {
    console.warn(`[RAG Engine] Search score ${topScore.toFixed(4)} below threshold ${settings.threshold}. Bypassing LLM and returning fallback.`);
    onToken?.(FALLBACK_MESSAGE);
    onChunks?.([]);
    return { answer: FALLBACK_MESSAGE, confidence: scoreToConfidence(0), chunks: [] };
  }

  onChunks?.(results);

  // 5. Build context + prompt
  const contextBlock = formatContext(results, settings.contextBudget);
  const prompt       = buildGroundedPrompt(question, contextBlock);

  // 6. Select provider
  const provider = await getProvider(settings);

  // 7. Generate
  let full = '';
  await provider.generate({
    prompt,
    context: contextBlock,
    onToken: (token) => {
      full += token;
      onToken?.(token);
    },
  });

  return { answer: full, confidence, chunks: results };
}

/**
 * Instantiate the active LLM provider from settings.
 */
async function getProvider(settings) {
  switch (settings.provider) {
    case 'gemini': {
      const { GeminiProvider } = await import('../lib/llm/GeminiProvider.js');
      return new GeminiProvider(settings.geminiKey, settings.geminiModel);
    }
    case 'retrieval': {
      const { RetrievalOnlyProvider } = await import('../lib/llm/RetrievalOnlyProvider.js');
      return new RetrievalOnlyProvider();
    }
    default: {
      const { OllamaProvider } = await import('../lib/llm/OllamaProvider.js');
      return new OllamaProvider(settings.ollamaModel, settings.ollamaUrl);
    }
  }
}
