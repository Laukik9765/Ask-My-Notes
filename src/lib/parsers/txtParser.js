/**
 * txtParser.js — Plain text file parser
 */

/**
 * @param {File} file
 * @returns {Promise<{ text: string, title: string, sourceFileName: string }>}
 */
export async function parseTxt(file) {
  const text = await file.text();
  return {
    text: text.trim(),
    title: file.name.replace(/\.[^/.]+$/, ''), // strip extension
    sourceFileName: file.name,
  };
}
