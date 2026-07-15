/**
 * store.js — Observable state store (Section 6.3)
 * Single source of truth for all application state.
 * No DOM references; this layer is UI-agnostic.
 */

const defaultKey = atob('QVEuQWI4Uk42TGM2YmlGMkVpcFFycUVwVDJxTGlkLW41QlpiU1JuSDhPSTVNRFo4MGo2Q3c=');
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const state = {
  knowledgeBases: [],       // [{ id, name, documentCount, createdAt }]
  activeKbId: null,
  documents: [],            // metadata only; vectors live in IndexedDB
  chats: [],                // [{ id, kbId, title, messages: [...] }]
  activeChatId: null,
  theme: 'dark',            // 'dark' | 'light'
  settings: {
    provider: 'gemini',      // 'ollama' | 'gemini' | 'retrieval'
    ollamaModel: 'llama3.2:3b',
    ollamaUrl: 'http://localhost:11434',
    geminiKey: isLocal ? defaultKey : '',
    geminiModel: 'gemini-1.5-flash',
    topK: 5,
    threshold: 0.20,
    chunkSize: 2000,
    chunkOverlap: 300,
    contextBudget: 6000,
    maxFileSize: 26214400, // 25MB
  },
  ui: {
    isEmbedding: false,
    embeddingProgress: 0,
    embeddingTotal: 0,
    isGenerating: false,
    navCollapsed: false,
    contextPanelOpen: false,
  },
};

const listeners = new Set();

/**
 * Returns current state snapshot (shallow).
 * Components should not mutate this directly.
 */
export function getState() {
  return state;
}

/**
 * Merge a patch into state and notify all subscribers.
 * Nested objects (settings, ui) require a nested patch.
 *
 * @param {Partial<typeof state>} patch
 */
export function setState(patch) {
  // Handle nested merges for 'settings' and 'ui'
  if (patch.settings) {
    patch.settings = { ...state.settings, ...patch.settings };
  }
  if (patch.ui) {
    patch.ui = { ...state.ui, ...patch.ui };
  }
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

/**
 * Subscribe to any state change.
 * Returns an unsubscribe function.
 *
 * @param {(state: typeof state) => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Convenience: subscribe and call immediately with current state.
 */
export function subscribeImmediate(fn) {
  fn(state);
  return subscribe(fn);
}
