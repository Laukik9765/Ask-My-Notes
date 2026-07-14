/**
 * CommandPalette.js — Ctrl+K command palette / search (Section 8.4)
 * Uses the native <dialog> with keyboard navigation.
 */

import { navigate } from '../router.js';
import { getState } from '../state/store.js';
import { getMessagesByChat, getChatsByKb } from '../lib/vectorStore.js';

const DIALOG_ID = 'command-palette-dialog';
const INPUT_ID  = 'cmd-search-input';
const RESULTS_ID= 'cmd-results';

let isOpen = false;

export function openCommandPalette() {
  const dialog = document.getElementById(DIALOG_ID);
  if (!dialog || isOpen) return;

  isOpen = true;
  dialog.showModal();

  const input   = document.getElementById(INPUT_ID);
  const results = document.getElementById(RESULTS_ID);

  input.value = '';
  renderResults(results, getDefaultCommands());
  input.focus();

  // Keyboard navigation
  let focused = -1;

  const getItems = () => Array.from(results.querySelectorAll('.cmd-result-item'));

  input.addEventListener('input', debounce(async () => {
    focused = -1;
    const q = input.value.trim().toLowerCase();
    const items = await searchAll(q);
    renderResults(results, items);
  }, 150));

  input.addEventListener('keydown', (e) => {
    const items = getItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focused = Math.min(focused + 1, items.length - 1);
      updateFocus(items, focused);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focused = Math.max(focused - 1, -1);
      updateFocus(items, focused);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focused >= 0 && items[focused]) {
        items[focused].click();
      }
    }
  });

  dialog.addEventListener('close', () => {
    isOpen = false;
    input.removeEventListener('input', () => {});
  }, { once: true });

  // Close on backdrop click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

export function closeCommandPalette() {
  const dialog = document.getElementById(DIALOG_ID);
  if (dialog && isOpen) dialog.close();
}

function renderResults(container, items) {
  if (items.length === 0) {
    container.innerHTML = '<div class="cmd-empty">No results found</div>';
    return;
  }
  container.innerHTML = items.map((item, i) => `
    <div class="cmd-result-item" role="option" tabindex="-1" data-action="${escHtml(item.action)}" data-param="${escHtml(item.param || '')}">
      <div class="result-icon">${item.icon}</div>
      <div>
        <div class="cmd-result-title">${escHtml(item.title)}</div>
        ${item.sub ? `<div class="cmd-result-sub">${escHtml(item.sub)}</div>` : ''}
      </div>
      ${item.kbd ? `<div class="cmd-kbd">${item.kbd}</div>` : ''}
    </div>
  `).join('');

  container.querySelectorAll('.cmd-result-item').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      const param  = el.dataset.param;
      executeAction(action, param);
      document.getElementById(DIALOG_ID)?.close();
    });
  });
}

function updateFocus(items, idx) {
  items.forEach((el, i) => el.classList.toggle('focused', i === idx));
  if (idx >= 0) items[idx]?.scrollIntoView({ block: 'nearest' });
}

function executeAction(action, param) {
  switch (action) {
    case 'navigate': navigate(param); break;
    case 'new-chat': navigate('/chat?new=1'); break;
    case 'open-chat': navigate(`/chat?id=${param}`); break;
  }
}

function getDefaultCommands() {
  return [
    {
      icon: svgIcon('layout-dashboard'),
      title: 'Go to Dashboard',
      action: 'navigate',
      param: '/',
      kbd: '<kbd class="kbd">D</kbd>',
    },
    {
      icon: svgIcon('message-circle'),
      title: 'New Chat',
      action: 'new-chat',
      kbd: '<kbd class="kbd">⌘N</kbd>',
    },
    {
      icon: svgIcon('upload'),
      title: 'Upload Documents',
      action: 'navigate',
      param: '/upload',
      kbd: '<kbd class="kbd">⌘U</kbd>',
    },
    {
      icon: svgIcon('book-open'),
      title: 'Knowledge Base Manager',
      action: 'navigate',
      param: '/kb',
    },
    {
      icon: svgIcon('settings'),
      title: 'Settings',
      action: 'navigate',
      param: '/settings',
    },
  ];
}

async function searchAll(query) {
  if (!query) return getDefaultCommands();

  const results = [];
  const { knowledgeBases, activeKbId } = getState();

  // Search chats in active KB
  if (activeKbId) {
    try {
      const chats = await getChatsByKb(activeKbId);
      for (const chat of chats) {
        if (chat.title.toLowerCase().includes(query)) {
          results.push({
            icon: svgIcon('message-circle'),
            title: chat.title,
            sub: 'Chat',
            action: 'open-chat',
            param: chat.id,
          });
        }
      }
    } catch { /* ignore */ }
  }

  // Search commands
  const commands = getDefaultCommands().filter((c) =>
    c.title.toLowerCase().includes(query)
  );

  return [...results, ...commands];
}

const svgIcons = {
  'layout-dashboard': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
  'message-circle':   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  'upload':           `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
  'book-open':        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  'settings':         `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

function svgIcon(name) {
  return svgIcons[name] || '';
}

function escHtml(str = '') {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
