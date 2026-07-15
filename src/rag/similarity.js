/**
 * similarity.js — Cosine similarity + top-k chunk selection (Section 5.6)
 * No DOM or window references — fully testable in isolation.
 */

/**
 * Compute cosine similarity between two Float32Arrays (or plain number arrays).
 * Returns a value in [-1, 1]. Returns 0 for zero-magnitude vectors.
 *
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the top-k most similar chunks to a query vector.
 * Performs a linear scan — fast enough for tens of thousands of 384-dim vectors.
 *
 * @param {Float32Array}  queryVector   - 384-dim query embedding
 * @param {Array<{id: string, vector: Float32Array, text: string, [key: string]: any}>} chunks
 * @param {object} [opts]
 * @param {number} [opts.topK=5]        - Number of results to return
 * @param {number} [opts.threshold=0.35]- Minimum similarity to include
 * @returns {Array<{chunk: object, score: number}>}  - Sorted descending by score
 */
export function topKChunks(queryVector, chunks, opts = {}) {
  const { topK = 5, threshold = 0.20 } = opts;

  if (!chunks || chunks.length === 0) return [];

  const scored = chunks
    .map((chunk) => {
      const vec = chunk.vector instanceof Float32Array
        ? chunk.vector
        : new Float32Array(chunk.vector); // deserialise if stored as plain array
      return { chunk, score: cosineSimilarity(queryVector, vec) };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Map a similarity score to a confidence label and CSS class.
 *
 * @param {number} score
 * @returns {{ label: string, level: 'high'|'medium'|'low' }}
 */
export function scoreToConfidence(score) {
  if (score >= 0.50) return { label: 'High',   level: 'high' };
  if (score >= 0.25) return { label: 'Medium', level: 'medium' };
  return              { label: 'Low',    level: 'low' };
}
