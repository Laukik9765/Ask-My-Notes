/**
 * uploadQueue.js — Sequential file processing queue (Section 8.1)
 * Validates files, then processes them through the RAG pipeline one at a time.
 * Emits progress events back to the Upload UI.
 */

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);

/**
 * Validate a file before processing.
 *
 * @param {File} file
 * @param {number} maxSize - Max allowed size in bytes
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file, maxSize = 26214400) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Unsupported file type: ${ext}. Accepted: PDF, DOCX, TXT, MD` };
  }

  if (file.size > maxSize) {
    const mb = (maxSize / 1024 / 1024).toFixed(0);
    return { valid: false, error: `File too large (max ${mb}MB)` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}

/**
 * Get the appropriate parser for a file extension.
 *
 * @param {string} filename
 * @returns {Promise<Function>} - Parser function
 */
export async function getParser(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf':
      return (await import('./parsers/pdfParser.js')).parsePdf;
    case 'docx':
      return (await import('./parsers/docxParser.js')).parseDocx;
    case 'txt':
      return (await import('./parsers/txtParser.js')).parseTxt;
    case 'md':
      return (await import('./parsers/markdownParser.js')).parseMarkdown;
    default:
      throw new Error(`No parser for .${ext}`);
  }
}

/**
 * A simple sequential processing queue.
 * Processes items one at a time, calling onItem for each.
 */
export class UploadQueue {
  constructor() {
    this._queue   = [];
    this._running = false;
  }

  /**
   * Add a file to the queue.
   * @param {File} file
   * @param {string} kbId
   * @param {object} callbacks
   * @param {(stage: string, pct: number) => void} callbacks.onProgress
   * @param {(result: object) => void} callbacks.onDone
   * @param {(err: Error) => void} callbacks.onError
   */
  enqueue(file, kbId, callbacks) {
    this._queue.push({ file, kbId, ...callbacks });
    this._drain();
  }

  async _drain() {
    if (this._running) return;
    this._running = true;
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      await this._processItem(item);
    }
    this._running = false;
  }

  async _processItem({ file, kbId, onProgress, onDone, onError }) {
    const { ingestDocument } = await import('../rag/ragEngine.js');
    try {
      await ingestDocument(file, kbId, onProgress);
      onDone?.();
    } catch (err) {
      onError?.(err);
    }
  }
}
