/**
 * markdownParser.js — Markdown file parser
 * Strips markdown syntax to produce clean plain text for embedding,
 * while preserving structure via paragraph breaks.
 */

/**
 * @param {File} file
 * @returns {Promise<{ text: string, title: string, sourceFileName: string }>}
 */
export async function parseMarkdown(file) {
  const raw = await file.text();

  // Extract title from first H1 if present
  const h1Match = raw.match(/^#\s+(.+)/m);
  const title   = h1Match ? h1Match[1].trim() : file.name.replace(/\.[^/.]+$/, '');

  // Strip markdown syntax to get plain text suitable for embedding
  const text = stripMarkdown(raw);

  return {
    text: text.trim(),
    title,
    sourceFileName: file.name,
  };
}

/**
 * Remove common markdown syntax while preserving paragraph structure.
 * This is intentionally lightweight — we keep the semantic content.
 *
 * @param {string} md
 * @returns {string}
 */
function stripMarkdown(md) {
  return md
    // Remove code blocks (keep content)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*/g, '').trim())
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove headings marker but keep text
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove links but keep link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Collapse excess whitespace within lines
    .replace(/[ \t]+/g, ' ')
    // Preserve paragraph breaks (double newlines)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
