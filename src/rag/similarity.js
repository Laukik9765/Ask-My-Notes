/**
 * similarity.js — Hybrid Search Engine (Vector + BM25 Keyword Search + RRF Fusion)
 * Performs semantic vector search, BM25 exact keyword search, and Reciprocal Rank Fusion.
 * No DOM or window references — fully testable in isolation.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'the', 'this', 'but', 'they', 'have', 'had', 'what', 'when', 'where',
  'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should'
]);

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
 * Tokenize text into lowercased terms, preserving technical symbols, identifiers, and numbers.
 *
 * @param {string} text
 * @param {boolean} [filterStopwords=true]
 * @returns {string[]}
 */
export function tokenizeText(text, filterStopwords = true) {
  if (!text) return [];
  const rawTokens = text.toLowerCase().match(/[a-z0-9_\-\.\:\/]+/g) || [];
  if (!filterStopwords) return rawTokens;
  return rawTokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Calculate BM25 scores for chunks given a raw search query text.
 *
 * @param {string} queryText
 * @param {Array<{id: string, text: string, [key: string]: any}>} chunks
 * @param {object} [opts]
 * @param {number} [opts.k1=1.5]
 * @param {number} [opts.b=0.75]
 * @returns {Map<string, number>} Map of chunk id -> raw BM25 score
 */
export function computeBM25Scores(queryText, chunks, opts = {}) {
  const { k1 = 1.5, b = 0.75 } = opts;
  const scores = new Map();
  if (!queryText || !chunks || chunks.length === 0) return scores;

  const queryTokens = tokenizeText(queryText, true);
  if (queryTokens.length === 0) return scores;

  const N = chunks.length;
  let totalLen = 0;
  const docTokensMap = new Map();
  const docFreqs = new Map();

  for (const chunk of chunks) {
    const docId = chunk.id;
    const tokens = tokenizeText(chunk.text, false);
    totalLen += tokens.length;
    docTokensMap.set(docId, tokens);

    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      docFreqs.set(token, (docFreqs.get(token) || 0) + 1);
    }
  }

  const avgdl = N > 0 ? totalLen / N : 1;
  const rawQueryLower = queryText.trim().toLowerCase();

  for (const chunk of chunks) {
    const docId = chunk.id;
    const tokens = docTokensMap.get(docId) || [];
    const docLen = tokens.length;

    // Count term frequencies in this document
    const termFreqMap = new Map();
    for (const t of tokens) {
      termFreqMap.set(t, (termFreqMap.get(t) || 0) + 1);
    }

    let bm25Score = 0;
    for (const qToken of queryTokens) {
      const tf = termFreqMap.get(qToken) || 0;
      if (tf === 0) continue;

      const df = docFreqs.get(qToken) || 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const num = tf * (k1 + 1);
      const denom = tf + k1 * (1 - b + b * (docLen / avgdl));
      bm25Score += idf * (num / denom);
    }

    // Exact phrase / exact code symbol substring match bonus
    const chunkLower = chunk.text.toLowerCase();
    if (rawQueryLower.length > 3 && chunkLower.includes(rawQueryLower)) {
      bm25Score += 2.5; // Significant boost for exact substring matches
    }

    scores.set(docId, Math.max(0, bm25Score));
  }

  return scores;
}

/**
 * Top-K Chunk Selection supporting Hybrid Search (Vector + Keyword BM25 + RRF Fusion).
 *
 * @param {Float32Array|number[]} queryVector - Dense query embedding
 * @param {Array<{id: string, vector: Float32Array|number[], text: string, [key: string]: any}>} chunks
 * @param {object} [opts]
 * @param {number} [opts.topK=5]            - Number of results to return
 * @param {number} [opts.threshold=0.20]    - Minimum score threshold
 * @param {string} [opts.searchMode='hybrid']- 'hybrid' | 'vector' | 'keyword'
 * @param {string} [opts.queryText='']      - Raw user query string for keyword match
 * @returns {Array<{chunk: object, score: number, vectorScore?: number, keywordScore?: number}>}
 */
export function topKChunks(queryVector, chunks, opts = {}) {
  const { topK = 5, threshold = 0.20, searchMode = 'hybrid', queryText = '' } = opts;

  if (!chunks || chunks.length === 0) return [];

  // Compute Vector Scores (Cosine Similarity)
  const vectorScored = chunks.map((chunk) => {
    let score = 0;
    if (queryVector && chunk.vector) {
      const vec = chunk.vector instanceof Float32Array ? chunk.vector : new Float32Array(chunk.vector);
      score = cosineSimilarity(queryVector, vec);
    }
    return { chunk, vectorScore: score };
  });

  if (searchMode === 'vector') {
    return vectorScored
      .map((item) => ({ chunk: item.chunk, score: item.vectorScore, vectorScore: item.vectorScore }))
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // Compute Keyword Scores (BM25)
  const bm25Map = computeBM25Scores(queryText, chunks);

  if (searchMode === 'keyword') {
    const maxBm25 = Math.max(...Array.from(bm25Map.values()), 1);
    return chunks
      .map((chunk) => {
        const rawKw = bm25Map.get(chunk.id) || 0;
        const normKw = rawKw / maxBm25;
        return { chunk, score: normKw, keywordScore: normKw };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // SearchMode === 'hybrid' -> Reciprocal Rank Fusion (RRF) + Composite Score
  // 1. Sort by vector rank
  const vectorRanked = [...vectorScored].sort((a, b) => b.vectorScore - a.vectorScore);
  const vectorRankMap = new Map();
  vectorRanked.forEach((item, index) => {
    vectorRankMap.set(item.chunk.id, index + 1);
  });

  // 2. Sort by keyword rank
  const keywordRanked = [...chunks]
    .map((c) => ({ chunk: c, keywordScore: bm25Map.get(c.id) || 0 }))
    .sort((a, b) => b.keywordScore - a.keywordScore);
  const keywordRankMap = new Map();
  keywordRanked.forEach((item, index) => {
    keywordRankMap.set(item.chunk.id, index + 1);
  });

  // 3. RRF Constant k = 60
  const RRF_K = 60;
  const maxKwScore = Math.max(...Array.from(bm25Map.values()), 1);

  const hybridScored = vectorScored.map((item) => {
    const docId = item.chunk.id;
    const vRank = vectorRankMap.get(docId) || chunks.length;
    const kRank = keywordRankMap.get(docId) || chunks.length;

    const rrfScore = (1 / (RRF_K + vRank)) + (1 / (RRF_K + kRank));
    const rawKw = bm25Map.get(docId) || 0;
    const normKw = rawKw / maxKwScore;

    // Blended score for thresholding and display (50% vector, 50% BM25 keyword score)
    const compositeScore = 0.55 * Math.max(0, item.vectorScore) + 0.45 * normKw;

    return {
      chunk: item.chunk,
      score: compositeScore,
      vectorScore: item.vectorScore,
      keywordScore: normKw,
      rrfScore,
    };
  });

  let results = hybridScored
    .filter((item) => item.score >= threshold || item.keywordScore > 0.05 || item.vectorScore > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fallback: If strict filtering produced 0 chunks, return the top-K best available chunks in the KB
  if (results.length === 0 && chunks.length > 0) {
    results = hybridScored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  return results;
}

/**
 * Map a similarity score to a confidence label and CSS class.
 *
 * @param {number} score
 * @returns {{ label: string, level: 'high'|'medium'|'low' }}
 */
export function scoreToConfidence(score) {
  if (score >= 0.35) return { label: 'High',   level: 'high' };
  if (score >= 0.15) return { label: 'Medium', level: 'medium' };
  return              { label: 'Low',    level: 'low' };
}
