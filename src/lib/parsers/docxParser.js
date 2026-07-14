/**
 * docxParser.js — Vanilla JS DOCX parser (Section 5.2)
 * Uses the browser's native DecompressionStream + DOMParser.
 * No Node.js, no external unzip library required.
 */

/**
 * Parse a .docx File object into plain text.
 * DOCX files are ZIP archives containing word/document.xml.
 *
 * @param {File} file
 * @returns {Promise<{ text: string, title: string, sourceFileName: string }>}
 */
export async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const entries     = await unzip(arrayBuffer);

  // The main document content lives in word/document.xml
  const docXml = entries['word/document.xml'];
  if (!docXml) {
    throw new Error('Could not find word/document.xml inside the .docx file.');
  }

  const parser  = new DOMParser();
  const xmlDoc  = parser.parseFromString(docXml, 'application/xml');

  // Extract text from <w:p> (paragraph) elements
  const paragraphs = xmlDoc.querySelectorAll('p');
  const textParts  = [];

  paragraphs.forEach((para) => {
    // Get all text runs within the paragraph
    const runs = para.querySelectorAll('t');
    const line = Array.from(runs)
      .map((r) => r.textContent)
      .join('')
      .trim();
    if (line) textParts.push(line);
  });

  // Try to get title from core.xml
  let title = file.name;
  const coreXml = entries['docProps/core.xml'];
  if (coreXml) {
    try {
      const coreDoc = parser.parseFromString(coreXml, 'application/xml');
      const titleEl = coreDoc.querySelector('title');
      if (titleEl?.textContent) title = titleEl.textContent;
    } catch {
      // ignore
    }
  }

  return {
    text: textParts.join('\n\n'),
    title,
    sourceFileName: file.name,
  };
}

/**
 * Minimal ZIP reader using browser-native APIs.
 * Returns a map of { filePath: fileContentString }.
 * Only decodes text files (UTF-8).
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<Record<string, string>>}
 */
async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const entries = {};

  // ZIP local file header signature: PK\x03\x04
  let offset = 0;
  const view  = new DataView(buffer);

  while (offset < bytes.length - 4) {
    // Look for local file header signature
    if (
      view.getUint8(offset)     === 0x50 && // P
      view.getUint8(offset + 1) === 0x4B && // K
      view.getUint8(offset + 2) === 0x03 &&
      view.getUint8(offset + 3) === 0x04
    ) {
      const compression     = view.getUint16(offset + 8, true);
      const compressedSize  = view.getUint32(offset + 18, true);
      const filenameLength  = view.getUint16(offset + 26, true);
      const extraLength     = view.getUint16(offset + 28, true);

      const filenameStart = offset + 30;
      const filename      = new TextDecoder().decode(bytes.slice(filenameStart, filenameStart + filenameLength));

      const dataStart = filenameStart + filenameLength + extraLength;
      const dataEnd   = dataStart + compressedSize;
      const compressedData = bytes.slice(dataStart, dataEnd);

      // Only parse text-relevant XML files
      if (filename.endsWith('.xml') || filename.endsWith('.rels')) {
        let text;
        if (compression === 0) {
          // No compression (stored)
          text = new TextDecoder('utf-8', { fatal: false }).decode(compressedData);
        } else if (compression === 8) {
          // DEFLATE compression — use DecompressionStream
          try {
            const ds     = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();
            writer.write(compressedData);
            writer.close();

            const chunks = [];
            let result;
            while (!(result = await reader.read()).done) {
              chunks.push(result.value);
            }
            const merged = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
            let pos = 0;
            for (const chunk of chunks) { merged.set(chunk, pos); pos += chunk.length; }
            text = new TextDecoder('utf-8', { fatal: false }).decode(merged);
          } catch (e) {
            text = '';
          }
        }
        if (text) entries[filename] = text;
      }

      offset = dataEnd;
    } else {
      offset++;
    }
  }

  return entries;
}
