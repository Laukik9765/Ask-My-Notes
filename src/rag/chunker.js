/**
 * chunker.js — Paragraph-aware text chunking (Section 5.3)
 * Splits plain text into overlapping chunks for embedding.
 * No DOM or window references — fully testable in isolation.
 */

/**
 * Split text into overlapping chunks.
 * Strategy: paragraph-aware greedy packing, hard-split only when necessary.
 *
 * @param {string} text        - Raw plain text to chunk
 * @param {object} [opts]
 * @param {number} [opts.chunkSize=2000]   - Target chunk size in characters
 * @param {number} [opts.overlap=300]      - Overlap between adjacent chunks
 * @returns {string[]}         - Array of chunk texts
 */
export function chunkText(text, opts = {}) {
  const { chunkSize = 2000, overlap = 300 } = opts;

  if (!text || text.trim().length === 0) return [];

  // Normalise line endings
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on double newlines (paragraph boundaries)
  const paragraphs = normalised
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return [];

  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;

    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      // Flush current chunk if we have something
      if (current.length > 0) {
        chunks.push(current);
        // Start next chunk with overlap from the end of the previous one
        current = getOverlapText(current, overlap) + '\n\n' + para;
      } else {
        // Single paragraph is larger than chunkSize — hard-split it
        const subChunks = hardSplit(para, chunkSize, overlap);
        // Add all but the last as complete chunks; carry forward the last
        if (subChunks.length > 1) {
          chunks.push(...subChunks.slice(0, -1));
        }
        current = subChunks[subChunks.length - 1] || '';
      }
    }
  }

  // Flush final chunk
  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Hard-split a single string into chunks with overlap.
 * Used as a last resort when a paragraph exceeds chunkSize.
 *
 * @param {string} text
 * @param {number} chunkSize
 * @param {number} overlap
 * @returns {string[]}
 */
function hardSplit(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

/**
 * Extract the last `overlap` characters from text, breaking at a word boundary.
 */
function getOverlapText(text, overlap) {
  if (text.length <= overlap) return text;
  const slice = text.slice(text.length - overlap);
  // Try to break at word boundary
  const spaceIdx = slice.indexOf(' ');
  return spaceIdx > 0 ? slice.slice(spaceIdx + 1) : slice;
}

/**
 * Estimate approximate token count from character count.
 * Rough heuristic: ~4 chars per token for English text.
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokenCount(text) {
  return Math.ceil(text.length / 4);
}
