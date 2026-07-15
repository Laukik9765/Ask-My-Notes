/**
 * upload.js — Upload screen page (Section 7.3)
 * Handles drag-and-drop, file validation, pipeline progress display.
 */

import { getState, setState } from '../state/store.js';
import { navigate } from '../router.js';
import { validateFile, UploadQueue } from '../lib/uploadQueue.js';
import { getAllKnowledgeBases, saveKnowledgeBase, generateUUID } from '../lib/vectorStore.js';
import { toast } from '../components/Toast.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-container">
      <div style="max-width:640px;margin:0 auto">
        <div style="margin-bottom:var(--space-6)">
          <h1>Upload Documents</h1>
          <p class="text-secondary" style="margin-top:4px">Add notes to a Knowledge Base for RAG-powered chat.</p>
        </div>

        <!-- KB Selector -->
        <div style="margin-bottom:var(--space-6);background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:var(--space-5)">
          <label for="upload-kb-select" style="display:block;font-size:var(--text-sm);font-weight:var(--weight-medium);margin-bottom:var(--space-3)">Knowledge Base</label>
          <div style="display:flex;gap:var(--space-3);align-items:center">
            <select id="upload-kb-select" style="flex:1;padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;cursor:pointer">
              <option value="">— Select a Knowledge Base —</option>
            </select>
            <button class="btn btn-secondary btn-sm" id="new-kb-quick-btn" title="Create a new KB">+ New KB</button>
          </div>
          <div id="quick-kb-form" style="display:none;margin-top:var(--space-3);display:none">
            <div style="display:flex;gap:var(--space-2)">
              <input id="quick-kb-name" type="text" placeholder="Knowledge Base name…"
                style="flex:1;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;" />
              <button class="btn btn-primary btn-sm" id="quick-create-btn">Create</button>
            </div>
          </div>
        </div>

        <!-- Dropzone -->
        <div id="dropzone-area" class="dropzone-area" role="button" tabindex="0" aria-label="Upload documents by dragging files here or clicking to browse" aria-describedby="dropzone-formats">
          <input type="file" id="file-input" class="dropzone-input" multiple accept=".pdf,.docx,.txt,.md" aria-hidden="true" />
          <div class="dropzone-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </div>
          <div class="dropzone-title">Drag &amp; drop your notes here</div>
          <div class="dropzone-subtitle">or <button class="btn btn-ghost" style="padding:0;color:var(--accent);display:inline" id="browse-btn">click to browse</button></div>
          <div class="format-badges" id="dropzone-formats" aria-label="Accepted formats">
            <span class="format-badge">PDF</span>
            <span class="format-badge">DOCX</span>
            <span class="format-badge">TXT</span>
            <span class="format-badge">MD</span>
          </div>
        </div>

        <!-- File queue -->
        <div id="file-queue" class="file-queue"></div>

        <!-- Action buttons -->
        <div id="upload-actions" style="display:none;margin-top:var(--space-5);display:flex;gap:var(--space-3);justify-content:flex-end">
          <button class="btn btn-secondary" id="upload-more-btn">Upload More</button>
          <button class="btn btn-primary" id="start-chat-btn">Start Chatting →</button>
        </div>
      </div>
    </div>
  `;

  // Hide actions initially
  container.querySelector('#upload-actions').style.display = 'none';

  await loadKbs(container);
  setupDropzone(container);
  setupKbSelector(container);
}

async function loadKbs(container) {
  const kbs    = await getAllKnowledgeBases();
  setState({ knowledgeBases: kbs });
  const sel    = container.querySelector('#upload-kb-select');
  const active = getState().activeKbId;

  sel.innerHTML = '<option value="">— Select a Knowledge Base —</option>';
  kbs.forEach((kb) => {
    const opt   = document.createElement('option');
    opt.value   = kb.id;
    opt.textContent = kb.name;
    if (kb.id === active) opt.selected = true;
    sel.appendChild(opt);
  });

  // If none selected but there's an active KB, pre-select it
  if (active && !sel.value) sel.value = active;
}

function setupKbSelector(container) {
  const newBtn  = container.querySelector('#new-kb-quick-btn');
  const form    = container.querySelector('#quick-kb-form');
  const nameInp = container.querySelector('#quick-kb-name');
  const createBtn = container.querySelector('#quick-create-btn');

  newBtn.addEventListener('click', () => {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    nameInp.focus();
  });

  const createKb = async () => {
    const name = nameInp.value.trim();
    if (!name) return;
    const kb = {
      id:            generateUUID(),
      name,
      documentCount: 0,
      createdAt:     Date.now(),
      updatedAt:     Date.now(),
    };
    await saveKnowledgeBase(kb);
    setState({ activeKbId: kb.id });
    localStorage.setItem('activeKbId', kb.id);
    nameInp.value = '';
    form.style.display = 'none';
    await loadKbs(container);
    container.querySelector('#upload-kb-select').value = kb.id;
    toast.success('Created', `Knowledge Base "${name}" ready.`);
  };

  createBtn.addEventListener('click', createKb);
  nameInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') createKb(); });
}

function setupDropzone(container) {
  const zone    = container.querySelector('#dropzone-area');
  const input   = container.querySelector('#file-input');
  const browseBtn = container.querySelector('#browse-btn');
  const queue   = new UploadQueue();

  // Click to browse
  browseBtn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });

  // File input change
  input.addEventListener('change', () => {
    processFiles(Array.from(input.files), container, queue);
    input.value = '';
  });

  // Drag events
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    processFiles(Array.from(e.dataTransfer.files), container, queue);
  });

  // Actions
  container.querySelector('#upload-more-btn')?.addEventListener('click', () => {
    container.querySelector('#upload-actions').style.display = 'none';
    input.click();
  });

  container.querySelector('#start-chat-btn')?.addEventListener('click', () => {
    navigate('/chat');
  });
}

function processFiles(files, container, queue) {
  const kbId = container.querySelector('#upload-kb-select').value;
  if (!kbId) {
    toast.warning('Select a Knowledge Base', 'Please select or create a Knowledge Base first.');
    return;
  }

  const { settings } = getState();

  files.forEach((file) => {
    const { valid, error } = validateFile(file, settings.maxFileSize);
    if (!valid) {
      addFileItem(container, file, 'error', error);
      return;
    }
    const item = addFileItem(container, file, 'queued', 'Queued');
    queue.enqueue(file, kbId,
      {
        onProgress: (stage, pct) => updateFileItem(item, stage, pct),
        onDone:     ()           => finishFileItem(item, container),
        onError:    (err)        => errorFileItem(item, err),
      }
    );
  });
}

function addFileItem(container, file, status, label) {
  const queue = container.querySelector('#file-queue');
  const ext   = file.name.split('.').pop().toUpperCase();
  const item  = document.createElement('div');
  item.className = 'file-queue-item';
  item.innerHTML = `
    <div class="file-icon">${ext}</div>
    <div class="file-info">
      <div class="file-name">${escHtml(file.name)}</div>
      <div class="file-size">${formatBytes(file.size)}</div>
      <div class="file-progress"><div class="file-progress-fill" style="width:0%"></div></div>
      <div class="file-stage-label">${escHtml(label)}</div>
    </div>
    <div class="status-icon pending">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </div>
  `;
  if (status === 'error') {
    item.classList.add('error');
    item.querySelector('.file-stage-label').textContent = label;
    item.querySelector('.status-icon').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
    item.querySelector('.status-icon').className = 'status-icon error';
  }
  queue.appendChild(item);
  return item;
}

function updateFileItem(item, stage, pct) {
  const fill  = item.querySelector('.file-progress-fill');
  const label = item.querySelector('.file-stage-label');
  if (fill)  fill.style.width  = pct + '%';
  if (label) label.textContent = `${stage}… ${pct}%`;
}

function finishFileItem(item, container) {
  const fill    = item.querySelector('.file-progress-fill');
  const label   = item.querySelector('.file-stage-label');
  const icon    = item.querySelector('.status-icon');
  if (fill)  fill.style.width  = '100%';
  if (label) label.textContent = '✓ Indexed';
  if (icon) {
    icon.className = 'status-icon success';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;
  }
  item.classList.add('success');
  toast.success('Indexed', item.querySelector('.file-name').textContent);
  container.querySelector('#upload-actions').style.display = 'flex';
}

function errorFileItem(item, err) {
  item.classList.add('error');
  const label = item.querySelector('.file-stage-label');
  const icon  = item.querySelector('.status-icon');
  if (label) label.textContent = err?.message || 'Failed';
  if (icon) {
    icon.className = 'status-icon error';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
  }
  toast.error('Failed', err?.message);
}

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
