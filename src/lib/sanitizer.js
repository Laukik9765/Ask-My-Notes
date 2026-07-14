/**
 * sanitizer.js — Minimal HTML allow-list sanitizer (Section 10.3)
 * Used before inserting rendered Markdown into the DOM to prevent XSS.
 * No DOM references to external resources — purely text processing.
 */

/** Tags that are safe to render in chat bubbles */
const ALLOWED_TAGS = new Set([
  'p', 'strong', 'em', 'u', 's', 'del',
  'ul', 'ol', 'li',
  'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'a', 'blockquote',
  'h1', 'h2', 'h3', 'h4',
  'br', 'hr',
  'span', 'div',
]);

/** Attributes allowed per tag */
const ALLOWED_ATTRS = {
  a:    new Set(['href', 'title', 'target', 'rel']),
  code: new Set(['class']),  // for highlight.js language class
  pre:  new Set(['class']),
  th:   new Set(['scope']),
  td:   new Set(['colspan', 'rowspan']),
  '*':  new Set([]),         // no other attrs by default
};

/**
 * Sanitize an HTML string by removing disallowed tags and attributes.
 * Uses DOMParser to handle the HTML safely (no eval/innerHTML on raw string).
 *
 * @param {string} html - Raw HTML (e.g. output of marked.parse)
 * @returns {string}    - Sanitized HTML string
 */
export function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html'
  );

  sanitizeNode(doc.body);

  return doc.body.innerHTML;
}

/**
 * Recursively sanitize a DOM node in place.
 * @param {Element} node
 */
function sanitizeNode(node) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Text nodes are safe
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      // Comments, processing instructions, etc. — remove
      node.removeChild(child);
      continue;
    }

    const tagName = child.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      // Replace disallowed element with its text content
      const text = document.createTextNode(child.textContent);
      node.replaceChild(text, child);
      continue;
    }

    // Sanitize attributes
    const allowedForTag = ALLOWED_ATTRS[tagName] || ALLOWED_ATTRS['*'];
    const attrs = Array.from(child.attributes);
    for (const attr of attrs) {
      const attrName = attr.name.toLowerCase();
      if (!allowedForTag.has(attrName)) {
        child.removeAttribute(attrName);
      } else if (attrName === 'href' || attrName === 'src') {
        // Block javascript: and data: URIs
        const val = attr.value.trim().toLowerCase();
        if (val.startsWith('javascript:') || val.startsWith('data:')) {
          child.removeAttribute(attrName);
        }
      }
    }

    // Force external links to open safely
    if (tagName === 'a') {
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noopener noreferrer');
    }

    // Recurse
    sanitizeNode(child);
  }
}
