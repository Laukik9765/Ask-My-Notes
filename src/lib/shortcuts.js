/**
 * shortcuts.js — Global keyboard shortcuts (Section 8.18)
 * Single keydown listener dispatching to router/state.
 * Ignores shortcuts when focus is inside a text field (except Enter/Shift+Enter).
 */

import { navigate } from '../router.js';

let handlers = {};

/**
 * Initialise keyboard shortcut handling.
 * @param {object} callbacks
 * @param {() => void} callbacks.openSearch   - Open command palette (Ctrl+K)
 * @param {() => void} callbacks.newChat      - New chat (Ctrl+N)
 * @param {() => void} callbacks.toggleSidebar- Toggle sidebar (Ctrl+\)
 * @param {() => void} callbacks.closeAll     - Close dialogs/panels (Esc)
 */
export function initShortcuts(callbacks = {}) {
  handlers = callbacks;

  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  const target = e.target;
  const isTyping = (
    target.tagName === 'INPUT'    ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'   ||
    target.isContentEditable
  );

  const mod = e.ctrlKey || e.metaKey;

  // Ctrl/Cmd+K — Search (works even in text fields)
  if (mod && e.key === 'k') {
    e.preventDefault();
    handlers.openSearch?.();
    return;
  }

  // Escape — close panels (works everywhere)
  if (e.key === 'Escape') {
    handlers.closeAll?.();
    return;
  }

  // Shortcuts below ignore text field focus
  if (isTyping) return;

  // Ctrl/Cmd+N — New chat
  if (mod && e.key === 'n') {
    e.preventDefault();
    handlers.newChat?.();
    return;
  }

  // Ctrl/Cmd+U — Upload
  if (mod && e.key === 'u') {
    e.preventDefault();
    navigate('/upload');
    return;
  }

  // Ctrl/Cmd+\ — Toggle sidebar
  if (mod && e.key === '\\') {
    e.preventDefault();
    handlers.toggleSidebar?.();
    return;
  }
}

export function removeShortcuts() {
  document.removeEventListener('keydown', handleKeydown);
}
