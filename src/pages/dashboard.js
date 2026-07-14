/**
 * dashboard.js — Dashboard page (Section 7.4)
 * Displays all Knowledge Bases and recent chats with CRUD options.
 */

import { getState, setState, subscribe } from '../state/store.js';
import { navigate } from '../router.js';
import {
  getAllKnowledgeBases, saveKnowledgeBase, deleteKnowledgeBase,
  deleteChatsByKb, getDocumentsByKb, countChunksByKb, getChatsByKb,
} from '../lib/vectorStore.js';
import { clearKnowledgeBase } from '../rag/ragEngine.js';
import { confirm } from '../components/ConfirmDialog.js';
import { toast } from '../components/Toast.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-container">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
        <p class="text-secondary" style="margin-top:4px">Your Knowledge Bases at a glance</p>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar" id="stats-bar">
        <div class="stat-card">
          <div class="stat-value" id="stat-kbs">—</div>
          <div class="stat-label">Knowledge Bases</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-docs">—</div>
          <div class="stat-label">Documents</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-chunks">—</div>
          <div class="stat-label">Indexed Chunks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-chats">—</div>
          <div class="stat-label">Conversations</div>
        </div>
      </div>

      <!-- KB Grid header -->
      <div class="kb-grid-header">
        <h2>Knowledge Bases</h2>
        <button class="btn btn-primary" id="new-kb-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          New Knowledge Base
        </button>
      </div>

      <!-- New KB form (hidden by default) -->
      <div id="new-kb-form" style="display:none;margin-bottom:var(--space-5);background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:var(--space-5)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-4)">Create Knowledge Base</h3>
        <div style="display:flex;gap:var(--space-3);align-items:flex-end">
          <div style="flex:1">
            <label for="new-kb-name" style="display:block;font-size:var(--text-sm);font-weight:var(--weight-medium);margin-bottom:var(--space-2)">Name</label>
            <input id="new-kb-name" type="text" placeholder="e.g. University Notes, Work Docs…"
              style="width:100%;padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;" />
          </div>
          <button class="btn btn-primary" id="create-kb-btn">Create</button>
          <button class="btn btn-secondary" id="cancel-kb-btn">Cancel</button>
        </div>
      </div>

      <!-- KB Grid -->
      <div id="kb-grid" class="grid-cards"></div>
    </div>
  `;

  await loadDashboard(container);

  // New KB button
  const newKbBtn  = container.querySelector('#new-kb-btn');
  const newKbForm = container.querySelector('#new-kb-form');

  newKbBtn.addEventListener('click', () => {
    newKbForm.style.display = 'block';
    container.querySelector('#new-kb-name').focus();
  });

  container.querySelector('#cancel-kb-btn').addEventListener('click', () => {
    newKbForm.style.display = 'none';
  });

  container.querySelector('#create-kb-btn').addEventListener('click', () => createKb(container));
  container.querySelector('#new-kb-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createKb(container);
  });

  // Subscribe to state updates
  const unsub = subscribe(() => loadDashboard(container));
  // Cleanup on navigation
  container._cleanup = unsub;
}

async function loadDashboard(container) {
  const kbs = await getAllKnowledgeBases();
  setState({ knowledgeBases: kbs });

  // Compute aggregate stats
  let totalDocs = 0, totalChunks = 0, totalChats = 0;
  for (const kb of kbs) {
    const docs  = await getDocumentsByKb(kb.id);
    const chunks = await countChunksByKb(kb.id);
    const chats  = await getChatsByKb(kb.id);
    totalDocs   += docs.length;
    totalChunks += chunks;
    totalChats  += chats.length;
    kb._docCount   = docs.length;
    kb._chunkCount = chunks;
    kb._chatCount  = chats.length;
  }

  // Update stats
  const q = (id) => container.querySelector(id);
  if (q('#stat-kbs'))     q('#stat-kbs').textContent     = kbs.length;
  if (q('#stat-docs'))    q('#stat-docs').textContent    = totalDocs;
  if (q('#stat-chunks'))  q('#stat-chunks').textContent  = totalChunks.toLocaleString();
  if (q('#stat-chats'))   q('#stat-chats').textContent   = totalChats;

  renderKbGrid(container, kbs);
}

function renderKbGrid(container, kbs) {
  const grid = container.querySelector('#kb-grid');
  if (!grid) return;

  if (kbs.length === 0) {
    grid.innerHTML = `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        </div>
        <h2>No Knowledge Bases yet</h2>
        <p>Create a Knowledge Base and upload your notes to get started.</p>
        <button class="btn btn-primary" id="empty-new-kb-btn">
          Create your first Knowledge Base →
        </button>
      </div>
    `;
    grid.querySelector('#empty-new-kb-btn')?.addEventListener('click', () => {
      const form = container.querySelector('#new-kb-form');
      form.style.display = 'block';
      container.querySelector('#new-kb-name').focus();
    });
    return;
  }

  grid.innerHTML = kbs.map((kb) => `
    <div class="card card-clickable kb-card" data-kb-id="${kb.id}">
      <div class="kb-card-actions">
        <button class="btn btn-ghost btn-icon-sm" data-action="delete-kb" data-kb-id="${kb.id}" title="Delete Knowledge Base" aria-label="Delete ${kb.name}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="kb-card-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      </div>
      <div class="card-header" style="margin-bottom:var(--space-2)">
        <div>
          <div class="card-title">${escHtml(kb.name)}</div>
          <div class="card-subtitle">Created ${formatDate(kb.createdAt)}</div>
        </div>
      </div>
      <div class="kb-card-meta">
        <span>${kb._docCount || 0} docs</span>
        <span>·</span>
        <span>${(kb._chunkCount || 0).toLocaleString()} chunks</span>
        <span>·</span>
        <span>${kb._chatCount || 0} chats</span>
      </div>
    </div>
  `).join('');

  // Card click → open chat
  grid.querySelectorAll('.kb-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return; // don't nav if action btn clicked
      const kbId = card.dataset.kbId;
      setState({ activeKbId: kbId });
      localStorage.setItem('activeKbId', kbId);
      navigate('/chat');
    });
  });

  // Delete KB buttons
  grid.querySelectorAll('[data-action="delete-kb"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const kbId = btn.dataset.kbId;
      const kb   = kbs.find((k) => k.id === kbId);
      const ok   = await confirm({
        title:       'Delete Knowledge Base',
        message:     `<p>This will permanently delete <strong>${escHtml(kb?.name)}</strong> and all its documents, chunks, and chat history.</p><p style="margin-top:8px;color:var(--danger)">This cannot be undone.</p>`,
        confirmText: 'Delete',
        dangerous:   true,
      });
      if (!ok) return;
      await clearKnowledgeBase(kbId);
      await deleteChatsByKb(kbId);
      await deleteKnowledgeBase(kbId);
      const { activeKbId } = getState();
      if (activeKbId === kbId) {
        setState({ activeKbId: null });
        localStorage.removeItem('activeKbId');
      }
      toast.success('Deleted', `"${kb?.name}" has been removed.`);
      loadDashboard(container);
    });
  });
}

async function createKb(container) {
  const input = container.querySelector('#new-kb-name');
  const name  = input.value.trim();
  if (!name) { input.focus(); return; }

  const kb = {
    id:            crypto.randomUUID(),
    name,
    documentCount: 0,
    createdAt:     Date.now(),
    updatedAt:     Date.now(),
  };

  await saveKnowledgeBase(kb);
  setState({ activeKbId: kb.id });
  localStorage.setItem('activeKbId', kb.id);

  input.value = '';
  container.querySelector('#new-kb-form').style.display = 'none';

  toast.success('Created', `Knowledge Base "${name}" is ready.`);
  await loadDashboard(container);
}

function formatDate(ts) {
  if (!ts) return 'unknown';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
