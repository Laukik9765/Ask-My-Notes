/**
 * kbManager.js — Knowledge Base Manager page (Section 7.7)
 * Document table with search, delete, rebuild, and KB stats.
 */

import { getState, setState } from '../state/store.js';
import { navigate } from '../router.js';
import {
  getDocumentsByKb, getAllKnowledgeBases, countChunksByKb,
} from '../lib/vectorStore.js';
import {
  deleteDocumentById, rebuildDocumentEmbeddings, clearKnowledgeBase,
} from '../rag/ragEngine.js';
import { confirm } from '../components/ConfirmDialog.js';
import { toast } from '../components/Toast.js';

let _allDocs = [];
let _kbId    = null;

export async function render(container) {
  _kbId = getState().activeKbId;

  container.innerHTML = `
    <div class="page-container">
      <div class="kb-manager-header">
        <div class="kb-manager-title-area">
          <h1>Knowledge Base</h1>
          <p class="text-secondary" style="margin-top:4px">Manage your documents and indexed chunks.</p>
        </div>
        <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
          <select id="kb-manager-select" style="padding:8px 12px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;cursor:pointer">
            <option value="">— Select KB —</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="clear-kb-btn" title="Clear all documents">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Clear KB
          </button>
          <button class="btn btn-primary btn-sm" id="add-docs-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            Add Documents
          </button>
        </div>
      </div>

      <!-- KB info bar -->
      <div class="kb-info-bar" id="kb-info-bar" style="display:none">
        <div class="kb-info-stat">
          <div class="kb-info-stat-value" id="info-docs">0</div>
          <div class="kb-info-stat-label">Documents</div>
        </div>
        <div class="kb-info-divider" aria-hidden="true"></div>
        <div class="kb-info-stat">
          <div class="kb-info-stat-value" id="info-chunks">0</div>
          <div class="kb-info-stat-label">Indexed Chunks</div>
        </div>
        <div class="kb-info-divider" aria-hidden="true"></div>
        <div class="kb-info-stat">
          <div class="kb-info-stat-value" id="info-size">—</div>
          <div class="kb-info-stat-label">Total size</div>
        </div>
      </div>

      <!-- Rebuild progress banner (hidden by default) -->
      <div id="rebuild-banner" style="display:none" class="rebuild-progress-banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span id="rebuild-status">Rebuilding embeddings…</span>
        <div class="rebuild-progress-bar">
          <div class="rebuild-progress-fill" id="rebuild-fill" style="width:0%"></div>
        </div>
      </div>

      <!-- Table toolbar -->
      <div class="table-toolbar">
        <div class="table-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--text-tertiary)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="doc-search" placeholder="Search documents…" aria-label="Search documents" />
        </div>
      </div>

      <!-- Document table -->
      <div class="data-table-wrapper" id="doc-table-wrapper">
        <div class="table-empty" id="table-empty">Select a Knowledge Base to view documents.</div>
      </div>
    </div>
  `;

  await loadKbSelect(container);
  wireActions(container);
}

async function loadKbSelect(container) {
  const sel  = container.querySelector('#kb-manager-select');
  const kbs  = await getAllKnowledgeBases();

  sel.innerHTML = '<option value="">— Select KB —</option>';
  kbs.forEach((kb) => {
    const opt = document.createElement('option');
    opt.value = kb.id;
    opt.textContent = kb.name;
    if (kb.id === _kbId) opt.selected = true;
    sel.appendChild(opt);
  });

  if (_kbId) await loadDocuments(container, _kbId);
}

async function loadDocuments(container, kbId) {
  _kbId = kbId;
  _allDocs = await getDocumentsByKb(kbId);

  const chunks = await countChunksByKb(kbId);
  const totalSize = _allDocs.reduce((a, d) => a + (d.size || 0), 0);

  const infoBar = container.querySelector('#kb-info-bar');
  if (infoBar) {
    infoBar.style.display = 'flex';
    container.querySelector('#info-docs').textContent   = _allDocs.length;
    container.querySelector('#info-chunks').textContent = chunks.toLocaleString();
    container.querySelector('#info-size').textContent   = formatBytes(totalSize);
  }

  renderTable(container, _allDocs);
}

function renderTable(container, docs, highlight = '') {
  const wrapper = container.querySelector('#doc-table-wrapper');

  if (!_kbId) {
    wrapper.innerHTML = '<div class="table-empty">Select a Knowledge Base to view documents.</div>';
    return;
  }

  if (docs.length === 0) {
    wrapper.innerHTML = '<div class="table-empty">No documents uploaded yet. <a data-route="/upload" href="/upload" style="color:var(--accent)">Upload some →</a></div>';
    return;
  }

  wrapper.innerHTML = `
    <table class="data-table" aria-label="Documents table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Size</th>
          <th>Chunks</th>
          <th>Status</th>
          <th>Uploaded</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody id="doc-tbody">
        ${docs.map((doc) => `
          <tr data-doc-id="${doc.id}">
            <td style="font-weight:var(--weight-medium);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(doc.name)}">
              ${highlight ? highlightText(doc.name, highlight) : escHtml(doc.name)}
            </td>
            <td><span class="file-type-badge ${doc.type}">${doc.type?.toUpperCase()}</span></td>
            <td>${formatBytes(doc.size)}</td>
            <td>${doc.chunkCount || 0}</td>
            <td>
              <span class="doc-status-badge ${doc.status || 'ready'}">${doc.status || 'ready'}</span>
            </td>
            <td style="color:var(--text-secondary)">${formatDate(doc.uploadedAt)}</td>
            <td>
              <div class="table-actions">
                <button class="btn btn-ghost btn-icon-sm" data-action="rebuild" data-doc-id="${doc.id}" title="Rebuild embeddings" aria-label="Rebuild embeddings for ${escHtml(doc.name)}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                </button>
                <button class="btn btn-ghost btn-icon-sm" data-action="delete-doc" data-doc-id="${doc.id}" title="Delete document" aria-label="Delete ${escHtml(doc.name)}" style="color:var(--danger)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  // Wire action buttons
  wrapper.querySelectorAll('[data-action="delete-doc"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.docId;
      const doc   = _allDocs.find((d) => d.id === docId);
      const ok    = await confirm({
        title:       'Delete Document',
        message:     `Delete <strong>${escHtml(doc?.name)}</strong>? This removes all its ${doc?.chunkCount || 0} chunks.`,
        confirmText: 'Delete',
        dangerous:   true,
      });
      if (!ok) return;
      await deleteDocumentById(docId);
      toast.success('Deleted', doc?.name);
      await loadDocuments(container, _kbId);
    });
  });

  wrapper.querySelectorAll('[data-action="rebuild"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.docId;
      const doc   = _allDocs.find((d) => d.id === docId);
      const banner   = container.querySelector('#rebuild-banner');
      const fill     = container.querySelector('#rebuild-fill');
      const statusEl = container.querySelector('#rebuild-status');
      banner.style.display = 'flex';
      try {
        await rebuildDocumentEmbeddings(docId, (stage, pct) => {
          if (fill)  fill.style.width = pct + '%';
          if (statusEl) statusEl.textContent = `${stage}… ${pct}%`;
        });
        toast.success('Rebuilt', `${doc?.name} re-indexed.`);
      } catch (err) {
        toast.error('Rebuild failed', err?.message);
      } finally {
        banner.style.display = 'none';
        await loadDocuments(container, _kbId);
      }
    });
  });
}

function wireActions(container) {
  // KB selector
  container.querySelector('#kb-manager-select')?.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    setState({ activeKbId: e.target.value });
    localStorage.setItem('activeKbId', e.target.value);
    await loadDocuments(container, e.target.value);
  });

  // Search
  let searchTimer;
  container.querySelector('#doc-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q     = e.target.value.trim().toLowerCase();
      const filtered = q ? _allDocs.filter((d) => d.name.toLowerCase().includes(q)) : _allDocs;
      renderTable(container, filtered, q);
    }, 150);
  });

  // Clear KB
  container.querySelector('#clear-kb-btn')?.addEventListener('click', async () => {
    if (!_kbId) return;
    const docs    = await getDocumentsByKb(_kbId);
    const chunks  = await countChunksByKb(_kbId);
    const ok = await confirm({
      title:       'Clear Knowledge Base',
      message:     `This will delete <strong>${docs.length} documents</strong> and <strong>${chunks.toLocaleString()} chunks</strong>. This cannot be undone.`,
      confirmText: 'Clear everything',
      dangerous:   true,
    });
    if (!ok) return;
    await clearKnowledgeBase(_kbId);
    toast.success('Cleared', 'Knowledge Base is now empty.');
    await loadDocuments(container, _kbId);
  });

  // Add docs
  container.querySelector('#add-docs-btn')?.addEventListener('click', () => navigate('/upload'));
}

function highlightText(text, q) {
  const escaped = escHtml(text);
  const regex   = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="highlight">$1</mark>');
}

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024)     return b + ' B';
  if (b < 1048576)  return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
