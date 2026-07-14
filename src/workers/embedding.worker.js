/**
 * embedding.worker.js — Web Worker for Transformers.js embeddings (Section 6.4)
 * Runs entirely off the main thread.
 * Message protocol:
 *   IN:  { type: 'EMBED_BATCH', payload: { chunks: string[] } }
 *   OUT: { type: 'EMBED_PROGRESS', payload: { done: number, total: number } }
 *   OUT: { type: 'EMBED_RESULT',   payload: { vectors: number[][] } }
 *   OUT: { type: 'EMBED_ERROR',    payload: { message: string } }
 *   IN:  { type: 'EMBED_SINGLE',   payload: { text: string } }
 *   OUT: { type: 'EMBED_SINGLE_RESULT', payload: { vector: number[] } }
 */

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

// Use the CDN-hosted WASM and model files
env.allowRemoteModels = true;
env.useBrowserCache   = true;

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }
    );
  }
  return embedder;
}

/**
 * Embed a single text string and return a plain number[].
 */
async function embedText(text) {
  const model  = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  // output.data is a Float32Array — convert to plain array for structured clone
  return Array.from(output.data);
}

self.addEventListener('message', async (e) => {
  const { type, payload } = e.data;

  if (type === 'EMBED_BATCH') {
    const { chunks } = payload;
    try {
      const vectors = [];
      for (let i = 0; i < chunks.length; i++) {
        const vec = await embedText(chunks[i]);
        vectors.push(vec);
        self.postMessage({
          type: 'EMBED_PROGRESS',
          payload: { done: i + 1, total: chunks.length },
        });
      }
      self.postMessage({ type: 'EMBED_RESULT', payload: { vectors } });
    } catch (err) {
      self.postMessage({ type: 'EMBED_ERROR', payload: { message: err.message } });
    }
  }

  if (type === 'EMBED_SINGLE') {
    try {
      const vector = await embedText(payload.text);
      self.postMessage({ type: 'EMBED_SINGLE_RESULT', payload: { vector } });
    } catch (err) {
      self.postMessage({ type: 'EMBED_ERROR', payload: { message: err.message } });
    }
  }
});
