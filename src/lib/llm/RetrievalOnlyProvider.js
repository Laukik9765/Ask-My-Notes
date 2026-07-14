/**
 * RetrievalOnlyProvider.js — No-LLM fallback provider (Section 6.6.3)
 * "Types out" the top retrieved chunk verbatim when no LLM is configured.
 * Zero network calls. Instant, always available.
 */

export class RetrievalOnlyProvider {
  /**
   * Generate a response by echoing the top retrieved chunk.
   *
   * @param {object} opts
   * @param {string}   opts.context  - The formatted context block
   * @param {(token: string) => void} opts.onToken
   * @returns {Promise<string>}
   */
  async generate({ context, onToken }) {
    const response = context
      ? `Here are the most relevant excerpts from your notes:\n\n${context}`
      : "I couldn't find this information in the uploaded notes.";

    // Simulate a typeout effect in small word-sized chunks
    const words = response.split(/(\s+)/);
    let full = '';
    for (const word of words) {
      full += word;
      onToken(word);
      // Small async yield so the caller can render incrementally
      await new Promise((r) => setTimeout(r, 8));
    }

    return full;
  }
}
