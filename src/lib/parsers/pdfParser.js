/**
 * pdfParser.js — Client-side PDF text extraction via pdf.js (Section 5.2)
 * Returns normalised plain text plus metadata.
 */

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.3.136/build/pdf.min.mjs';
const WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.3.136/build/pdf.worker.min.mjs';

let pdfjsLib = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import(PDFJS_CDN);
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
  }
  return pdfjsLib;
}

/**
 * Parse a PDF File object into plain text.
 *
 * @param {File} file
 * @returns {Promise<{ text: string, pageCount: number, title: string, sourceFileName: string }>}
 */
export async function parsePdf(file) {
  const lib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

  const pageCount = pdf.numPages;
  const pageTexts = [];

  for (let i = 1; i <= pageCount; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pageTexts.push(pageText);
  }

  // Try extracting title from metadata
  let title = file.name;
  try {
    const meta = await pdf.getMetadata();
    if (meta?.info?.Title) title = meta.info.Title;
  } catch {
    // ignore
  }

  return {
    text: pageTexts.join('\n\n'),
    pageCount,
    title,
    sourceFileName: file.name,
  };
}
