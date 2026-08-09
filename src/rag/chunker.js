/**
 * chunker.js — Context-Aware Semantic Text Chunking
 * Splits text into semantically cohesive, context-rich chunks for embedding.
 * Prevents cutoffs mid-sentence or at random full stops (e.g., abbreviations like Dr., e.g., i.e.).
 * No DOM or window references — fully testable in isolation.
 */

import { cosineSimilarity } from './similarity.js';

const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'etc', 'vs', 'v', 'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr',
  'st', 'inc', 'ltd', 'co', 'corp', 'dept', 'fig', 'figs', 'al', 'approx',
  'no', 'nos', 'vol', 'vols', 'p', 'pp', 'art', 'arts', 'sec', 'secs',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'
]);

/**
 * Split text into discrete semantic sentences and structures, protecting abbreviations,
 * decimal numbers, code blocks, markdown headings, and bulleted lists.
 *
 * @param {string} text
 * @returns {string[]} Array of complete semantic units/sentences
 */
export function splitIntoSemanticSentences(text) {
  if (!text || !text.trim()) return [];

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Preserve Fenced Code Blocks (```...```)
  const codeBlockRegex = /```[\s\S]*?```/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: normalized.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code', content: match[0] });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < normalized.length) {
    blocks.push({ type: 'text', content: normalized.slice(lastIndex) });
  }

  const sentences = [];

  for (const block of blocks) {
    if (block.type === 'code') {
      const trimmed = block.content.trim();
      if (trimmed) sentences.push(trimmed);
      continue;
    }

    // Split by paragraph breaks (double newlines)
    const rawParagraphs = block.content.split(/\n{2,}/);

    for (const para of rawParagraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      // Preserve Markdown headings (# Title) or horizontal rules (---)
      if (/^(#{1,6}\s|---+|\*  \*  \*)/.test(trimmedPara) && trimmedPara.length < 250) {
        sentences.push(trimmedPara);
        continue;
      }

      // Preserve bulleted/numbered lists line-by-line if entire paragraph is a list
      const lines = trimmedPara.split('\n');
      const isList = lines.every((line) => /^\s*([-*+]\s+|\d+\.\s+)/.test(line.trim()) || line.trim() === '');
      if (isList) {
        for (const line of lines) {
          if (line.trim()) sentences.push(line.trim());
        }
        continue;
      }

      // Sentence splitting with abbreviation and number awareness
      const paraSentences = parseSentencesFromParagraph(trimmedPara);
      sentences.push(...paraSentences);
    }
  }

  return sentences;
}

/**
 * Parse a paragraph string into sentences, skipping false split points like abbreviations.
 *
 * @param {string} paragraph
 * @returns {string[]}
 */
function parseSentencesFromParagraph(paragraph) {
  const result = [];
  let currentSentence = '';

  const regex = /([.!?]+)([\s"'\)\]]+|$)/g;
  let lastEnd = 0;
  let match;

  while ((match = regex.exec(paragraph)) !== null) {
    const punct = match[1];
    const trailing = match[2];
    const matchIndex = match.index;

    const segment = paragraph.slice(lastEnd, matchIndex + punct.length);
    currentSentence += segment;
    lastEnd = matchIndex + punct.length + trailing.length;

    const words = currentSentence.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    const wordClean = lastWord.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();

    // False sentence termination checks
    const isAbbreviation = ABBREVIATIONS.has(wordClean);
    const isSingleCap = /^[A-Z]\.$/.test(lastWord);
    const isDecimalOrVer = /^\d+\.\d+$/.test(lastWord.replace(/[!?]/g, ''));
    const isUrl = /(http|https|www|\.com|\.org|\.net|\.io)/i.test(lastWord);

    const trailingHasNewline = trailing.includes('\n');
    const isEndOfString = lastEnd >= paragraph.length;

    if (!isAbbreviation && !isSingleCap && !isDecimalOrVer && !isUrl && (isEndOfString || trailingHasNewline || trailing.length > 0)) {
      if (currentSentence.trim()) {
        result.push(currentSentence.trim());
      }
      currentSentence = '';
    } else {
      currentSentence += trailing;
    }
  }

  const leftover = currentSentence + paragraph.slice(lastEnd);
  if (leftover.trim()) {
    result.push(leftover.trim());
  }

  return result;
}

/**
 * Main chunking entry point.
 * Defaults to 'semantic' context-aware chunking.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.strategy='semantic'] - 'semantic' | 'paragraph'
 * @param {number} [opts.chunkSize=2000]     - Target chunk size in characters
 * @param {number} [opts.overlap=300]        - Overlap between adjacent chunks
 * @returns {string[]}
 */
export function chunkText(text, opts = {}) {
  const { strategy = 'semantic' } = opts;

  if (!text || text.trim().length === 0) return [];

  if (strategy === 'paragraph') {
    return chunkTextParagraph(text, opts);
  }

  return chunkTextSemantic(text, opts);
}

/**
 * Helper to join sentences into a visually formatted string block.
 */
function joinSentences(sentences) {
  if (!sentences || sentences.length === 0) return '';
  let result = sentences[0];

  for (let i = 1; i < sentences.length; i++) {
    const prev = sentences[i - 1];
    const curr = sentences[i];
    const isBlock = /^(#{1,6}\s|```|[-*+]\s+|\d+\.\s+)/.test(curr) || /^(#{1,6}\s|```)/.test(prev);
    const joinChar = isBlock ? '\n' : ' ';
    result += joinChar + curr;
  }
  return result;
}

/**
 * Context-Aware Semantic Chunker.
 * Groups full sentences into contextually coherent chunks up to chunkSize.
 * Ensures sentence overlap (full sentences carried forward) rather than raw character cuts.
 *
 * @param {string} text
 * @param {object} [opts]
 * @returns {string[]}
 */
export function chunkTextSemantic(text, opts = {}) {
  const { chunkSize = 2000, overlap = 300, minChunkSize = 120 } = opts;

  if (!text || text.trim().length === 0) return [];

  const sentences = splitIntoSemanticSentences(text);
  if (sentences.length === 0) return [];

  const chunks = [];
  let currentSentences = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const sentLen = sentence.length;

    // Single sentence larger than chunkSize — hard split cleanly
    if (sentLen > chunkSize) {
      if (currentSentences.length > 0) {
        chunks.push(joinSentences(currentSentences));
        currentSentences = [];
        currentLength = 0;
      }
      const sub = hardSplitSentence(sentence, chunkSize, overlap);
      if (sub.length > 1) {
        chunks.push(...sub.slice(0, -1));
      }
      if (sub.length > 0) {
        const last = sub[sub.length - 1];
        currentSentences = [last];
        currentLength = last.length;
      }
      continue;
    }

    const spaceOffset = currentSentences.length > 0 ? 1 : 0;
    if (currentLength + sentLen + spaceOffset <= chunkSize) {
      currentSentences.push(sentence);
      currentLength += sentLen + spaceOffset;
    } else {
      if (currentSentences.length > 0) {
        chunks.push(joinSentences(currentSentences));

        // Sentence-level overlap
        const overlapSentences = getSentenceOverlap(currentSentences, overlap);
        currentSentences = [...overlapSentences, sentence];
        currentLength = joinSentences(currentSentences).length;
      } else {
        currentSentences = [sentence];
        currentLength = sentLen;
      }
    }
  }

  if (currentSentences.length > 0) {
    const finalChunk = joinSentences(currentSentences);
    if (finalChunk.length < minChunkSize && chunks.length > 0) {
      const lastIdx = chunks.length - 1;
      if (chunks[lastIdx].length + finalChunk.length + 1 <= chunkSize * 1.25) {
        chunks[lastIdx] = joinSentences([chunks[lastIdx], finalChunk]);
      } else {
        chunks.push(finalChunk);
      }
    } else {
      chunks.push(finalChunk);
    }
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Legacy paragraph-aware chunker for backward compatibility.
 */
export function chunkTextParagraph(text, opts = {}) {
  const { chunkSize = 2000, overlap = 300 } = opts;

  if (!text || text.trim().length === 0) return [];

  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
      if (current.length > 0) {
        chunks.push(current);
        current = getOverlapText(current, overlap) + '\n\n' + para;
      } else {
        const subChunks = hardSplit(para, chunkSize, overlap);
        if (subChunks.length > 1) {
          chunks.push(...subChunks.slice(0, -1));
        }
        current = subChunks[subChunks.length - 1] || '';
      }
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Extract complete sentence overlap from sentences array up to targetOverlapChars.
 */
function getSentenceOverlap(sentences, targetOverlapChars) {
  if (!sentences || sentences.length === 0 || targetOverlapChars <= 0) return [];
  const overlap = [];
  let accum = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i];
    if (accum + s.length > targetOverlapChars && overlap.length > 0) {
      break;
    }
    overlap.unshift(s);
    accum += s.length + 1;
    if (accum >= targetOverlapChars) break;
  }
  return overlap;
}

/**
 * Hard split oversized sentences preserving word boundaries.
 */
function hardSplitSentence(text, chunkSize, overlap) {
  const result = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + chunkSize * 0.5) {
        end = lastSpace;
      }
    }
    result.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start < 0 || start >= text.length) break;
  }
  return result.filter((s) => s.length > 0);
}

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

function getOverlapText(text, overlap) {
  if (text.length <= overlap) return text;
  const slice = text.slice(text.length - overlap);
  const spaceIdx = slice.indexOf(' ');
  return spaceIdx > 0 ? slice.slice(spaceIdx + 1) : slice;
}

/**
 * Estimate approximate token count from character count (~4 chars per token).
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokenCount(text) {
  return Math.ceil(text.length / 4);
}
