/**
 * reranker.js — Two-Stage Document Routing & Chunk Reranking Engine
 * Evaluates document-level relevance and reranks candidate chunks so multi-document
 * queries retrieve context from the exact matching document.
 * No DOM or window references — fully testable in isolation.
 */

import { cosineSimilarity, tokenizeText, computeBM25Scores } from './similarity.js';

/**
 * Score relevance of each document in a KB given a query.
 * Combines title/filename matches and aggregate top chunk scores per document.
 *
 * @param {string} queryText
 * @param {Float32Array|number[]} [queryVector]
 * @param {Array<{id: string, documentId: string, sourceFileName?: string, text: string, vector?: any}>} chunks
 * @returns {Map<string, number>} Map of documentId -> relevance score
 */
export function scoreDocumentsForQuery(queryText, queryVector, chunks) {
  const docScores = new Map();
  if (!queryText || !chunks || chunks.length === 0) return docScores;

  const queryLower = queryText.trim().toLowerCase();
  const queryTokens = tokenizeText(queryText, true);

  // Group chunks by documentId / sourceFileName
  const docChunksMap = new Map();
  for (const chunk of chunks) {
    const docId = chunk.documentId || chunk.sourceFileName || 'default';
    if (!docChunksMap.has(docId)) {
      docChunksMap.set(docId, []);
    }
    docChunksMap.get(docId).push(chunk);
  }

  // Pre-calculate BM25 scores for chunks
  const bm25Map = computeBM25Scores(queryText, chunks);

  for (const [docId, docChunks] of docChunksMap.entries()) {
    // 1. Filename / Document Title Match Score
    let titleScore = 0;
    const sampleChunk = docChunks[0];
    const docName = (sampleChunk?.sourceFileName || docId).toLowerCase();

    for (const qToken of queryTokens) {
      if (docName.includes(qToken)) {
        titleScore += 1.5;
      }
    }
    if (queryLower.length > 3 && docName.includes(queryLower)) {
      titleScore += 3.0; // Strong boost if query explicitly mentions document name/title
    }

    // 2. Aggregate Top-3 Chunks Score for this Document
    const chunkScores = docChunks.map((chunk) => {
      let vScore = 0;
      if (queryVector && chunk.vector) {
        const vec = chunk.vector instanceof Float32Array ? chunk.vector : new Float32Array(chunk.vector);
        vScore = cosineSimilarity(queryVector, vec);
      }
      const rawKw = bm25Map.get(chunk.id) || 0;
      return 0.6 * Math.max(0, vScore) + 0.4 * Math.min(1, rawKw / 3);
    });

    chunkScores.sort((a, b) => b - a);
    const top3Avg = chunkScores.slice(0, 3).reduce((sum, s) => sum + s, 0) / Math.max(1, Math.min(3, chunkScores.length));

    const totalDocScore = titleScore + top3Avg;
    docScores.set(docId, totalDocScore);
  }

  return docScores;
}

/**
 * Two-Stage Rerank function.
 * Takes candidate chunks retrieved across all documents and reranks them,
 * boosting chunks from the primary matching document(s).
 *
 * @param {string} queryText
 * @param {Float32Array|number[]} queryVector
 * @param {Array<object>} candidateChunks - Initial retrieved candidate chunks
 * @param {object} [opts]
 * @param {number} [opts.topK=5]
 * @param {boolean} [opts.useReranker=true]
 * @param {Array<object>} [opts.allKbChunks] - All chunks in KB for doc relevance scoring
 * @returns {Array<{chunk: object, score: number, rerankScore: number, isTargetDoc: boolean, targetDocName: string}>}
 */
export function rerankChunks(queryText, queryVector, candidateChunks, opts = {}) {
  const { topK = 5, useReranker = true, allKbChunks = [] } = opts;

  if (!candidateChunks || candidateChunks.length === 0) return [];
  if (!useReranker) {
    return candidateChunks.slice(0, topK).map((c) => ({
      ...c,
      rerankScore: c.score,
      isTargetDoc: false,
      targetDocName: c.chunk?.sourceFileName || c.sourceFileName || '',
    }));
  }

  // Step 1: Score Document Relevance across the KB
  const scoringPool = allKbChunks.length > 0 ? allKbChunks : candidateChunks.map((item) => item.chunk || item);
  const docScores = scoreDocumentsForQuery(queryText, queryVector, scoringPool);

  // Identify highest scoring target document
  let topDocId = null;
  let maxDocScore = -1;
  for (const [docId, score] of docScores.entries()) {
    if (score > maxDocScore) {
      maxDocScore = score;
      topDocId = docId;
    }
  }

  // Step 2: Rescore Candidates with Document Affinity Boost & Keyword Density
  const reranked = candidateChunks.map((item) => {
    const chunk = item.chunk || item;
    const docId = chunk.documentId || chunk.sourceFileName || 'default';
    const baseScore = item.score !== undefined ? item.score : 0.5;

    const isTargetDoc = docId === topDocId && maxDocScore > 0.3;
    const docBoost = isTargetDoc ? 0.35 : 0.0;

    // Exact term density bonus in chunk text
    const textLower = (chunk.text || '').toLowerCase();
    const queryLower = (queryText || '').toLowerCase();
    let termDensityBonus = 0;

    if (queryLower.length > 3 && textLower.includes(queryLower)) {
      termDensityBonus += 0.25;
    }

    const finalRerankScore = baseScore + docBoost + termDensityBonus;

    return {
      ...item,
      chunk,
      score: finalRerankScore,
      baseScore,
      rerankScore: finalRerankScore,
      isTargetDoc,
      targetDocName: chunk.sourceFileName || docId,
    };
  });

  return reranked
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}
