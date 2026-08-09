/**
 * promptBuilder.js — Builds grounded, intelligent prompt templates
 * Formats context blocks and creates robust, helpful LLM instructions.
 * No DOM or window references.
 */

/**
 * Format retrieved chunks into a labeled context block.
 *
 * @param {Array<{chunk: object, score: number}>} results - from topKChunks() / rerankChunks()
 * @param {number} [contextBudget=6000] - max total characters for context
 * @returns {string}
 */
export function formatContext(results, contextBudget = 6000) {
  let total = 0;
  const parts = [];

  for (const item of results) {
    const chunk = item.chunk || item;
    const label  = `[Source: ${chunk.sourceFileName || 'Note'}, chunk ${(chunk.chunkIndex || 0) + 1}]`;
    const entry  = `${label}\n${chunk.text}`;

    if (total + entry.length > contextBudget) {
      const remaining = contextBudget - total - label.length - 5;
      if (remaining > 50) {
        parts.push(`${label}\n${chunk.text.slice(0, remaining)}…`);
      }
      break;
    }
    parts.push(entry);
    total += entry.length + 2;
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Build a robust, grounded prompt for the LLM provider.
 * Instructs the LLM to synthesize, explain, and cite context intelligently without robotic fallbacks.
 *
 * @param {string} question
 * @param {string} contextBlock - from formatContext()
 * @returns {string}
 */
export function buildGroundedPrompt(question, contextBlock) {
  return `You are an intelligent, highly helpful AI assistant for Ask-My-Notes.
Your goal is to answer the user's question clearly, thoroughly, and accurately using the context excerpts provided below.

INSTRUCTIONS:
1. Base your response primarily on the knowledge provided in the <context> block.
2. Synthesize facts across excerpts, explain concepts clearly, and present information in well-formatted Markdown (use bullet points, bold key terms, and code blocks where applicable).
3. Clean Output: Do NOT insert inline bracket tags (such as [Source: filename.pdf, chunk 1]) inside the body of your response text. If needed, you may list the source document names cleanly ONCE at the very bottom of your response.
4. If the context covers related or partial information, provide a comprehensive answer using the available notes.

<context>
${contextBlock}
</context>

USER QUESTION:
${question}`;
}

/**
 * Fallback message when KB is empty.
 */
export const FALLBACK_MESSAGE =
  "No relevant notes were found in this Knowledge Base. Please upload some notes or documents to get started.";
