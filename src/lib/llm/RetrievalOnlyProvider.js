/**
 * RetrievalOnlyProvider.js — Intelligent In-Browser Local RAG Synthesizer
 * Converts retrieved note excerpts into beautifully structured, formatted Markdown answers
 * with zero network calls, zero rate limits, high speed, and complete privacy.
 */

export class RetrievalOnlyProvider {
  /**
   * Intelligently format retrieved context into clean, structured Markdown.
   *
   * @param {object} opts
   * @param {string}   opts.context  - The formatted context block
   * @param {(token: string) => void} opts.onToken
   * @returns {Promise<string>}
   */
  async generate({ context, onToken }) {
    if (!context) {
      const fallback = "No relevant notes were found in this Knowledge Base. Please upload some notes to get started.";
      onToken?.(fallback);
      return fallback;
    }

    // Split context into chunks by separator
    const rawChunks = context.split(/\n\n---\n\n/);
    const sections = [];

    sections.push(`### 📌 Knowledge Base Synthesis\n`);

    for (let i = 0; i < rawChunks.length; i++) {
      const block = rawChunks[i].trim();
      if (!block) continue;

      // Extract source filename label
      const match = block.match(/^\[Source:\s*([^\]]+)\]\s*([\s\S]*)$/i);
      const sourceName = match ? match[1].trim() : `Source Excerpt ${i + 1}`;
      const bodyText   = match ? match[2].trim() : block;

      const formattedBody = formatExcerptToMarkdown(bodyText);

      sections.push(`#### 📄 From ${sourceName}\n${formattedBody}\n`);
    }

    const fullMarkdown = sections.join('\n');

    // Rapid, instant streaming typeout (micro-batches for high speed)
    const tokens = fullMarkdown.split(/(\s+)/);
    let full = '';
    for (let i = 0; i < tokens.length; i++) {
      full += tokens[i];
      onToken?.(tokens[i]);
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 2));
      }
    }

    return full;
  }
}

/**
 * Transforms raw unstructured note text into clean, structured Markdown.
 * Adds bolding for key terms, bullet points for lists, and proper paragraph breaks.
 */
function formatExcerptToMarkdown(rawText) {
  if (!rawText) return '';

  let text = rawText.trim();

  // 1. Replace special list symbols (≡, •, ▪, >) with clean Markdown bullets
  text = text.replace(/[≡•▪]\s*/g, '\n- ');

  // 2. Bold key structural headers and QA terms
  text = text
    .replace(/(Q\d+:?|Question \d+:?|Answer Threat:?|Threat:?|Vulnerability:?|Risk:?|Countermeasures:?|Definition:?|Note:?|Characteristics of [^:\n]+:?)/gi, '\n- **$1**')
    .replace(/([A-Z][A-Za-z0-9\s]{2,25}\s+Definition)/g, '\n### 💡 $1\n');

  // 3. Clean up multiple linebreaks and bullet formatting
  text = text
    .replace(/(\n\s*-\s*){2,}/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n');

  // 4. Group text lines into clean block paragraphs or bullet lists
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const formattedLines = [];

  for (const line of lines) {
    if (line.startsWith('-') || line.startsWith('#') || line.startsWith('>')) {
      formattedLines.push(line);
    } else {
      formattedLines.push(line);
    }
  }

  return formattedLines.join('\n');
}
