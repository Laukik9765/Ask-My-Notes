/**
 * queryOptimizer.js — Input Query Optimizer & Expansion Engine
 * Cleans conversational noise, expands technical acronyms and domain synonyms,
 * and generates multi-variant search queries to improve retrieval accuracy.
 * No DOM or window references — fully testable in isolation.
 */

const FILLER_WORDS = /^(hey|hi|hello|assistant|ai|can you|could you|please|tell me|show me|explain|find|search|get|help me|i want to know|i need to know|how do i|how to|what is|where is|about)\s+/gi;

const SYNONYM_DICTIONARY = {
  db: ['database', 'sql', 'postgresql', 'table', 'query'],
  auth: ['authentication', 'login', 'jwt', 'token', 'security', 'password'],
  err: ['error', 'exception', 'failure', 'crash', 'issue', 'bug', 'fault'],
  errors: ['error', 'exception', 'failure', 'crash', 'issue', 'bug'],
  ml: ['machine learning', 'ai', 'model', 'neural network', 'training'],
  js: ['javascript', 'node', 'es6'],
  py: ['python', 'script'],
  api: ['endpoint', 'rest', 'http', 'request', 'response', 'fetch'],
  doc: ['document', 'pdf', 'notes', 'text', 'file'],
  docs: ['documents', 'pdf', 'notes', 'text', 'files'],
  ui: ['frontend', 'component', 'interface', 'css', 'react', 'element'],
  config: ['configuration', 'settings', 'options', 'parameters', 'env'],
  req: ['request', 'requirement'],
  res: ['response', 'result'],
};

/**
 * Remove conversational filler phrases and noise from user input query.
 *
 * @param {string} queryText
 * @returns {string} Cleaned core query
 */
export function cleanQuery(queryText) {
  if (!queryText) return '';
  let cleaned = queryText.trim();

  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(FILLER_WORDS, '').trim();
  }

  cleaned = cleaned.replace(/^[?\!\.,\s]+|[?\!\.,\s]+$/g, '');

  return cleaned || queryText.trim();
}

/**
 * Expand technical acronyms and domain terms with relevant synonyms.
 *
 * @param {string} queryText
 * @returns {string} Synonym-enriched text string
 */
export function expandQueryKeywords(queryText) {
  if (!queryText) return '';
  const tokens = queryText.toLowerCase().split(/\s+/);
  const expansions = new Set(tokens);

  for (const token of tokens) {
    const cleanToken = token.replace(/[^a-z0-9]/g, '');
    if (SYNONYM_DICTIONARY[cleanToken]) {
      SYNONYM_DICTIONARY[cleanToken].forEach((exp) => expansions.add(exp));
    }
  }

  return Array.from(expansions).join(' ');
}

/**
 * Main entry point: Optimize input query into structured representations.
 *
 * @param {string} rawQuery
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true]
 * @returns {{ raw: string, cleaned: string, expanded: string, searchText: string }}
 */
export function optimizeQuery(rawQuery, opts = {}) {
  const { enabled = true } = opts;
  if (!rawQuery || !rawQuery.trim()) {
    return { raw: '', cleaned: '', expanded: '', searchText: '' };
  }

  const raw = rawQuery.trim();
  if (!enabled) {
    return { raw, cleaned: raw, expanded: raw, searchText: raw };
  }

  const cleaned = cleanQuery(raw);
  const expanded = expandQueryKeywords(cleaned || raw);

  const searchText = Array.from(new Set([...cleaned.split(/\s+/), ...expanded.split(/\s+/)]))
    .join(' ')
    .trim();

  return {
    raw,
    cleaned: cleaned || raw,
    expanded: expanded || raw,
    searchText: searchText || raw,
  };
}
