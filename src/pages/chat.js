/**
 * chat.js — Chat page (Section 7.5)
 * Full conversational UI: sidebar, composer, streaming bubbles,
 * citations, confidence badges, context viewer, and chat history.
 */

import { getState, setState } from '../state/store.js';
import { navigate } from '../router.js';
import {
  saveChat, getChat, getChatsByKb, saveMessage, getMessagesByChat,
  deleteChat, deleteMessagesByChat, getAllKnowledgeBases, generateUUID,
} from '../lib/vectorStore.js';
import { query } from '../rag/ragEngine.js';
import { scoreToConfidence } from '../rag/similarity.js';
import { sanitizeHtml } from '../lib/sanitizer.js';
import { exportChatAsMarkdown, exportChatAsJson } from '../lib/exportChat.js';
import { toast } from '../components/Toast.js';
import { confirm } from '../components/ConfirmDialog.js';

// lazy-load marked + highlight.js
let markedLoaded = false;
async function getMarked() {
  if (!markedLoaded) {
    await import('https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js');
    markedLoaded = true;
    window.marked.setOptions({ breaks: true, gfm: true });
  }
  return window.marked;
}

let hljsInstance = null;
async function getHljs() {
  if (!hljsInstance) {
    const mod = await import('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/+esm');
    hljsInstance = mod.default;
  }
  return hljsInstance;
}

let currentKbId   = null;
let currentChatId = null;
let contextChunks = [];

export async function render(container) {
  const { activeKbId } = getState();
  currentKbId = activeKbId;

  // Check for ?new=1 or ?id=xxx query params
  const params = new URLSearchParams(location.search);
  const forceNew = params.get('new') === '1';
  const chatIdParam = params.get('id');

  container.innerHTML = `
    <div class="chat-page" style="height:calc(100vh - 64px);overflow:hidden;display:flex">
      <!-- Chat sidebar -->
      <aside id="chat-sidebar" class="chat-sidebar" aria-label="Chat history">
        <div class="chat-sidebar-header">
          <span class="section-title">Chats</span>
          <button class="btn btn-ghost btn-icon-sm" id="new-chat-btn" title="New chat (⌘N)" aria-label="New chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          </button>
        </div>
        <div class="chat-list" id="chat-list" role="listbox" aria-label="Previous chats"></div>
      </aside>

      <!-- Main chat area -->
      <div class="content-col" style="display:flex;flex-direction:column;overflow:hidden">
        <!-- Chat topbar -->
        <div class="chat-topbar">
          <div class="chat-title-area">
            <button class="btn btn-ghost btn-icon-sm" id="toggle-chat-sidebar" aria-label="Toggle chat sidebar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <span id="chat-kb-name" class="chat-kb-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              <span id="chat-kb-name-text">No KB selected</span>
            </span>
          </div>
          <div class="chat-topbar-actions">
            <!-- Context viewer toggle -->
            <button class="btn btn-ghost btn-icon-sm" id="context-viewer-btn" title="View retrieved context" aria-label="Toggle context viewer">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <!-- Export -->
            <div style="position:relative" id="export-menu-wrapper">
              <button class="btn btn-ghost btn-icon-sm" id="export-btn" title="Export chat" aria-label="Export chat" aria-haspopup="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              </button>
            </div>
            <!-- Delete chat -->
            <button class="btn btn-ghost btn-icon-sm" id="delete-chat-btn" title="Delete this chat" aria-label="Delete chat">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <!-- Message list -->
        <div id="message-list" class="message-list" role="log" aria-live="polite" aria-label="Chat messages"></div>

        <!-- Composer -->
        <div class="chat-composer">
          <div class="composer-wrapper">
            <textarea id="composer-input" class="composer-textarea" placeholder="Ask something about your notes…"
              rows="1" aria-label="Message composer" aria-multiline="true"></textarea>
            <button id="send-btn" class="composer-send-btn" aria-label="Send message" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div class="composer-hint">Enter to send · Shift+Enter for newline</div>
        </div>
      </div>

      <!-- Context viewer panel -->
      <div id="context-panel" class="context-panel" role="complementary" aria-label="Retrieved context">
        <div class="context-panel-header">
          <span style="font-size:var(--text-sm);font-weight:var(--weight-semi)">Retrieved Context</span>
          <button class="btn btn-ghost btn-icon-sm" id="close-context-panel" aria-label="Close context panel">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div id="context-panel-body" class="context-panel-body">
          <p class="text-secondary text-sm">Ask a question to see the retrieved chunks that informed the answer.</p>
        </div>
      </div>
    </div>
  `;

  // Load KB name
  await updateKbName(container);

  // Load chat history sidebar
  await loadChatSidebar(container);

  // Start a new chat or load existing
  if (chatIdParam) {
    await loadChat(container, chatIdParam);
  } else if (forceNew || !currentChatId) {
    await createNewChat(container);
  }

  // Wire up controls
  wireComposer(container);
  wireActions(container);
}

async function updateKbName(container) {
  if (!currentKbId) {
    container.querySelector('#chat-kb-name-text').textContent = 'No KB selected';
    return;
  }
  const kbs = await getAllKnowledgeBases();
  setState({ knowledgeBases: kbs });
  const kb  = kbs.find((k) => k.id === currentKbId);
  if (kb) {
    container.querySelector('#chat-kb-name-text').textContent = kb.name;
  }
}

async function loadChatSidebar(container) {
  const list = container.querySelector('#chat-list');
  if (!list || !currentKbId) {
    if (list) list.innerHTML = '<div style="padding:var(--space-4);font-size:var(--text-xs);color:var(--text-tertiary)">No Knowledge Base selected</div>';
    return;
  }

  const chats = await getChatsByKb(currentKbId);

  if (chats.length === 0) {
    list.innerHTML = '<div style="padding:var(--space-4);font-size:var(--text-xs);color:var(--text-tertiary)">No chats yet. Start a new one!</div>';
    return;
  }

  list.innerHTML = chats.map((chat) => `
    <div class="chat-list-item ${chat.id === currentChatId ? 'active' : ''}"
         data-chat-id="${chat.id}" role="option" tabindex="0"
         aria-selected="${chat.id === currentChatId}"
         aria-label="${escHtml(chat.title)}">
      <div class="chat-list-item-title">${escHtml(chat.title || 'Untitled chat')}</div>
      <div class="chat-item-actions">
        <button class="btn btn-ghost btn-icon-sm" data-action="delete-chat" data-chat-id="${chat.id}" aria-label="Delete chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.chat-list-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      loadChat(container, item.dataset.chatId);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadChat(container, item.dataset.chatId);
    });
  });

  list.querySelectorAll('[data-action="delete-chat"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chatId = btn.dataset.chatId;
      const ok = await confirm({ title: 'Delete chat?', message: 'This removes the chat and all its messages.', confirmText: 'Delete', dangerous: true });
      if (!ok) return;
      await deleteMessagesByChat(chatId);
      await deleteChat(chatId);
      if (currentChatId === chatId) await createNewChat(container);
      await loadChatSidebar(container);
    });
  });
}

async function createNewChat(container) {
  if (!currentKbId) return;
  const chat = {
    id:        generateUUID(),
    kbId:      currentKbId,
    title:     'New chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveChat(chat);
  currentChatId = chat.id;
  setState({ activeChatId: chat.id });
  showEmptyState(container);
  await loadChatSidebar(container);
}

async function loadChat(container, chatId) {
  currentChatId = chatId;
  setState({ activeChatId: chatId });

  const messages = await getMessagesByChat(chatId);
  const list = container.querySelector('#message-list');
  list.innerHTML = '';

  if (messages.length === 0) {
    showEmptyState(container);
    return;
  }

  for (const msg of messages) {
    await renderMessageBubble(list, msg);
  }

  list.scrollTop = list.scrollHeight;
  await loadChatSidebar(container);
}

function showEmptyState(container) {
  const list = container.querySelector('#message-list');
  if (!list) return;

  if (!currentKbId) {
    list.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        </div>
        <h2>No Knowledge Base selected</h2>
        <p>Go to the Dashboard and select or create a Knowledge Base first.</p>
        <button class="btn btn-primary" data-route="/">Go to Dashboard</button>
      </div>`;
    return;
  }

  list.innerHTML = `
    <div class="chat-empty-state">
      <div class="chat-empty-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <h2>Ask your notes anything</h2>
      <p>Your question is matched against your uploaded documents using semantic search — grounded, cited answers only.</p>
      <div class="prompt-chips">
        <button class="prompt-chip" data-prompt="Summarize the main topics in my notes">Summarize main topics</button>
        <button class="prompt-chip" data-prompt="What are the key concepts covered?">Key concepts covered</button>
        <button class="prompt-chip" data-prompt="List the most important definitions">Important definitions</button>
        <button class="prompt-chip" data-prompt="What does the document say about the introduction?">Introduction overview</button>
      </div>
    </div>`;

  list.querySelectorAll('.prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const composer = container.querySelector('#composer-input');
      if (composer) {
        composer.value = chip.dataset.prompt;
        composer.dispatchEvent(new Event('input'));
        sendMessage(container);
      }
    });
  });
}

function wireComposer(container) {
  const composer = container.querySelector('#composer-input');
  const sendBtn  = container.querySelector('#send-btn');

  if (!composer || !sendBtn) return;

  // Auto-resize textarea
  composer.addEventListener('input', () => {
    composer.style.height = 'auto';
    composer.style.height = Math.min(composer.scrollHeight, 180) + 'px';
    sendBtn.disabled = composer.value.trim().length === 0;
  });

  // Enter to send, Shift+Enter for newline
  composer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage(container);
    }
  });

  sendBtn.addEventListener('click', () => sendMessage(container));
}

async function sendMessage(container) {
  const composer = container.querySelector('#composer-input');
  const sendBtn  = container.querySelector('#send-btn');
  const list     = container.querySelector('#message-list');

  const question = composer.value.trim();
  if (!question || !currentKbId || !currentChatId) return;

  // Clear empty state
  const emptyState = list.querySelector('.chat-empty-state');
  if (emptyState) emptyState.remove();

  // Disable input while generating
  composer.value = '';
  composer.style.height = 'auto';
  sendBtn.disabled = true;

  // User message
  const userMsg = {
    id:        generateUUID(),
    chatId:    currentChatId,
    role:      'user',
    content:   question,
    createdAt: Date.now(),
  };
  await saveMessage(userMsg);
  await renderMessageBubble(list, userMsg);
  list.scrollTop = list.scrollHeight;

  // Update chat title on first message
  const existingChat = await getChat(currentChatId);
  if (existingChat?.title === 'New chat') {
    const title = question.slice(0, 60);
    await saveChat({ ...existingChat, title, updatedAt: Date.now() });
    await loadChatSidebar(container);
  }

  // Show typing indicator
  const typingGroup = document.createElement('div');
  typingGroup.className = 'message-group fade-in';
  typingGroup.innerHTML = `
    <div class="message-row">
      <div class="message-avatar assistant-avatar" aria-hidden="true">N</div>
      <div>
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:var(--space-1)" id="retrieval-status-text">Searching documents…</div>
        <div class="typing-indicator" aria-label="Assistant is thinking">
          <div class="typing-dot" aria-hidden="true"></div>
          <div class="typing-dot" aria-hidden="true"></div>
          <div class="typing-dot" aria-hidden="true"></div>
        </div>
      </div>
    </div>`;
  list.appendChild(typingGroup);
  list.scrollTop = list.scrollHeight;

  // Run query
  let assistantContent = '';
  let finalChunks      = [];
  let confidence       = null;
  let errorOccurred    = null;

  try {
    const result = await query(question, currentKbId, {
      onToken: (token) => {
        if (!assistantContent) {
          // Replace typing indicator with streaming bubble
          typingGroup.innerHTML = `
            <div class="message-row">
              <div class="message-avatar assistant-avatar" aria-hidden="true">N</div>
              <div class="chat-bubble assistant-bubble" id="streaming-bubble" aria-live="polite" aria-atomic="false"></div>
            </div>`;
        }
        assistantContent += token;
        const bubble = typingGroup.querySelector('#streaming-bubble');
        if (bubble) bubble.textContent = assistantContent;
        list.scrollTop = list.scrollHeight;
      },
      onChunks: (chunks) => {
        finalChunks = chunks;
        const statusEl = typingGroup.querySelector('#retrieval-status-text');
        if (statusEl) statusEl.textContent = `Searching ${chunks.length} chunks…`;
      },
    });

    confidence = result.confidence;
    finalChunks = result.chunks.length ? result.chunks : finalChunks;

  } catch (err) {
    errorOccurred = err;
    assistantContent = '';
  }

  // Remove typing/streaming group
  typingGroup.remove();

  // Build final assistant message
  const assistantMsg = {
    id:         generateUUID(),
    chatId:     currentChatId,
    role:       'assistant',
    content:    assistantContent,
    citations:  finalChunks.map((r) => ({
      sourceFileName: r.chunk.sourceFileName,
      chunkIndex:     r.chunk.chunkIndex,
      score:          r.score,
      text:           r.chunk.text,
    })),
    confidence: confidence,
    error:      errorOccurred?.message || null,
    createdAt:  Date.now(),
  };

  await saveMessage(assistantMsg);
  contextChunks = assistantMsg.citations;

  await renderMessageBubble(list, assistantMsg);
  list.scrollTop = list.scrollHeight;

  // Re-enable composer
  sendBtn.disabled = false;
  composer.focus();
}

async function renderMessageBubble(list, msg) {
  const group = document.createElement('div');
  group.className = 'message-group';

  const isUser = msg.role === 'user';
  const time   = new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    group.innerHTML = `
      <div class="message-row user-row">
        <div class="message-avatar user-avatar" aria-hidden="true">U</div>
        <div class="chat-bubble user-bubble">${escHtml(msg.content)}</div>
      </div>
      <div class="message-meta user-meta">
        <span class="message-time">${time}</span>
      </div>`;
  } else {
    let bubbleContent = '';

    if (msg.error) {
      bubbleContent = `
        <div class="bubble-error-card">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
          <div class="error-text">
            <strong>Generation failed:</strong> ${escHtml(msg.error)}
            <br><a href="/settings" data-route="/settings" style="font-size:var(--text-xs);margin-top:4px;display:inline-block">Fix in Settings →</a>
          </div>
        </div>`;
    } else if (msg.content) {
      // Render markdown asynchronously
      const parsed = await renderMarkdown(msg.content);
      bubbleContent = parsed;
    } else {
      bubbleContent = '<em style="color:var(--text-secondary)">No response generated.</em>';
    }

    // Citations
    const citationsHtml = msg.citations?.length ? `
      <div class="citations-row" aria-label="Sources">
        ${msg.citations.map((c, i) => `
          <button class="citation-chip" data-chunk-idx="${i}" aria-label="View source: ${escHtml(c.sourceFileName)}">
            📄 ${escHtml(c.sourceFileName)} · chunk ${c.chunkIndex + 1}
          </button>`).join('')}
      </div>` : '';

    // Confidence badge
    const conf = msg.confidence;
    const confHtml = conf ? `
      <span class="confidence-badge confidence-${conf.level}" title="Based on how closely your notes matched this question">
        <span class="confidence-dot" aria-hidden="true"></span>
        ${escHtml(conf.label)} confidence
      </span>` : '';

    group.innerHTML = `
      <div class="message-row">
        <div class="message-avatar assistant-avatar" aria-hidden="true">N</div>
        <div class="chat-bubble assistant-bubble" aria-label="Assistant response">${bubbleContent}</div>
      </div>
      ${citationsHtml}
      <div class="message-meta">
        <span class="message-time">${time}</span>
        ${confHtml}
      </div>`;

    // Wire citation chip clicks
    group.querySelectorAll('.citation-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.dataset.chunkIdx, 10);
        openContextPanel(document.body, msg.citations, idx);
      });
    });

    // Apply syntax highlighting
    setTimeout(async () => {
      const hljs = await getHljs().catch(() => null);
      if (hljs) {
        group.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
      }
      // Add copy buttons to code blocks
      group.querySelectorAll('pre').forEach(addCopyButton);
    }, 50);
  }

  list.appendChild(group);
}

async function renderMarkdown(text) {
  const marked = await getMarked().catch(() => null);
  if (!marked) return `<p>${escHtml(text)}</p>`;
  const raw = marked.parse(text);
  return sanitizeHtml(raw);
}

function openContextPanel(root, citations, highlightIdx = 0) {
  const panel = document.getElementById('context-panel');
  const body  = document.getElementById('context-panel-body');
  if (!panel || !body) return;

  body.innerHTML = '';

  if (!citations || citations.length === 0) {
    body.innerHTML = '<p class="text-secondary text-sm">No chunks retrieved for this answer.</p>';
  } else {
    citations.forEach((c, i) => {
      const chunk = document.createElement('div');
      chunk.className = 'context-chunk' + (i === highlightIdx ? ' fade-in' : '');
      chunk.innerHTML = `
        <div class="context-chunk-header">
          <span class="context-chunk-source">📄 ${escHtml(c.sourceFileName)}, chunk ${c.chunkIndex + 1}</span>
          <span class="context-chunk-score">${(c.score * 100).toFixed(0)}% match</span>
        </div>
        <div class="context-chunk-text">${escHtml(c.text)}</div>`;
      body.appendChild(chunk);
    });
  }

  panel.classList.add('open');
  // Highlight scroll
  if (citations[highlightIdx]) {
    setTimeout(() => {
      const el = body.children[highlightIdx];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

function wireActions(container) {
  // New chat
  container.querySelector('#new-chat-btn')?.addEventListener('click', () => createNewChat(container));

  // Toggle sidebar
  container.querySelector('#toggle-chat-sidebar')?.addEventListener('click', () => {
    const sidebar = container.querySelector('#chat-sidebar');
    sidebar?.classList.toggle('hidden');
  });

  // Context viewer toggle
  container.querySelector('#context-viewer-btn')?.addEventListener('click', () => {
    openContextPanel(container, contextChunks);
  });

  // Close context panel
  container.querySelector('#close-context-panel')?.addEventListener('click', () => {
    document.getElementById('context-panel')?.classList.remove('open');
  });

  // Export menu
  const exportBtn = container.querySelector('#export-btn');
  const exportWrapper = container.querySelector('#export-menu-wrapper');
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = exportWrapper.querySelector('.export-menu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.className = 'export-menu';
    menu.innerHTML = `
      <button class="export-menu-item" id="exp-md">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        Export as Markdown
      </button>
      <button class="export-menu-item" id="exp-json">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        Export as JSON
      </button>`;
    exportWrapper.appendChild(menu);
    document.addEventListener('click', () => menu.remove(), { once: true });

    menu.querySelector('#exp-md').addEventListener('click', async () => {
      if (!currentChatId) return;
      const chat = await getChat(currentChatId);
      const msgs = await getMessagesByChat(currentChatId);
      exportChatAsMarkdown(chat, msgs);
      toast.success('Exported', 'Chat saved as Markdown');
    });

    menu.querySelector('#exp-json').addEventListener('click', async () => {
      if (!currentChatId) return;
      const chat = await getChat(currentChatId);
      const msgs = await getMessagesByChat(currentChatId);
      exportChatAsJson(chat, msgs);
      toast.success('Exported', 'Chat saved as JSON');
    });
  });

  // Delete current chat
  container.querySelector('#delete-chat-btn')?.addEventListener('click', async () => {
    if (!currentChatId) return;
    const ok = await confirm({ title: 'Delete chat?', message: 'All messages will be permanently removed.', confirmText: 'Delete', dangerous: true });
    if (!ok) return;
    await deleteMessagesByChat(currentChatId);
    await deleteChat(currentChatId);
    await createNewChat(container);
    toast.success('Deleted', 'Chat removed.');
  });
}

function addCopyButton(pre) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-icon-sm code-copy-btn';
  btn.title = 'Copy code';
  btn.setAttribute('aria-label', 'Copy code to clipboard');
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  pre.style.position = 'relative';
  pre.appendChild(btn);
  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.textContent || pre.textContent;
    await navigator.clipboard.writeText(code).catch(() => {});
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>';
    setTimeout(() => { btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`; }, 1500);
  });
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
