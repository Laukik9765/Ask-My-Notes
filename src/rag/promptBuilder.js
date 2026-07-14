/**
 * promptBuilder.js — Builds the grounded prompt template (Section 6.6.2)
 * No DOM or window references.
 */

/**
 * Format retrieved chunks into a labeled context block.
 *
 * @param {Array<{chunk: object, score: number}>} results - from topKChunks()
 * @param {number} [contextBudget=6000] - max total characters for context
 * @returns {string}
 */
export function formatContext(results, contextBudget = 6000) {
  let total = 0;
  const parts = [];

  for (const { chunk, score } of results) {
    const label  = `[Source: ${chunk.sourceFileName}, chunk ${chunk.chunkIndex + 1}]`;
    const entry  = `${label}\n${chunk.text}`;
    if (total + entry.length > contextBudget) {
      // Truncate to fit budget
      const remaining = contextBudget - total - label.length - 5;
      if (remaining > 50) {
        parts.push(`${label}\n${chunk.text.slice(0, remaining)}…`);
      }
      break;
    }
    parts.push(entry);
    total += entry.length + 2; // +2 for separator
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Build the full grounded prompt ready to send to an LLM provider.
 *
 * @param {string} question
 * @param {string} contextBlock - from formatContext()
 * @returns {string}
 */
export function buildGroundedPrompt(question, contextBlock) {
  return `You are a strict retrieval-based assistant. You must answer the user's question using ONLY the information inside the <context> block below. Do not use any outside knowledge. Do not guess or infer beyond what is written. If the answer is not contained in the context, reply exactly with:
"I couldn't find this information in the uploaded notes."
Always mention which source(s) you used by their bracketed label, e.g. [Source: filename.pdf, chunk 3].

<context>
${contextBlock}
</context>

USER QUESTION:
${question}`;
}

/**
 * The fixed fallback message shown when similarity is below threshold.
 */
export const FALLBACK_MESSAGE =
  "I couldn't find this information in the uploaded notes.";
