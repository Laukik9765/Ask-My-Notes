/**
 * settings.js — Settings page (Section 7.8 / Section 8.6)
 * Provider selection, advanced RAG params, theme, data management, shortcuts.
 */

import { getState, setState } from '../state/store.js';
import { saveSetting, getAllSettings, openDB } from '../lib/vectorStore.js';
import { OllamaProvider } from '../lib/llm/OllamaProvider.js';
import { toast } from '../components/Toast.js';
import { confirm } from '../components/ConfirmDialog.js';

export async function render(container) {
  const { settings, theme } = getState();

  container.innerHTML = `
    <div class="page-container">
      <div style="margin-bottom:var(--space-8)">
        <h1>Settings</h1>
        <p class="text-secondary" style="margin-top:4px">Configure your AI provider, RAG parameters, and appearance.</p>
      </div>

      <div class="settings-layout">
        <!-- Settings nav -->
        <nav class="settings-nav" aria-label="Settings sections">
          <button class="settings-nav-item active" data-section="provider">Model Provider</button>
          <button class="settings-nav-item" data-section="appearance">Appearance</button>
          <button class="settings-nav-item" data-section="rag">Advanced RAG</button>
          <button class="settings-nav-item" data-section="data">Data &amp; Privacy</button>
          <button class="settings-nav-item" data-section="shortcuts">Shortcuts</button>
        </nav>

        <!-- Settings content -->
        <div class="settings-content" id="settings-sections">

          <!-- Model Provider -->
          <section id="section-provider" class="settings-section" aria-labelledby="provider-heading">
            <div class="settings-section-header">
              <div class="settings-section-title" id="provider-heading">Model Provider</div>
              <div class="settings-section-desc">Choose how answers are generated. Embeddings always run locally.</div>
            </div>
            <div class="radio-card-group" role="radiogroup" aria-label="Model provider">

              <label class="radio-card ${settings.provider === 'ollama' ? 'selected' : ''}" id="radio-ollama">
                <input type="radio" name="provider" value="ollama" ${settings.provider === 'ollama' ? 'checked' : ''} />
                <div class="radio-dot" aria-hidden="true"></div>
                <div class="radio-info">
                  <h4>Ollama (Local) — Recommended</h4>
                  <p>Run LLMs completely on your machine. Zero cost, zero latency to the internet, full privacy. Requires Ollama desktop app.</p>
                </div>
              </label>

              <label class="radio-card ${settings.provider === 'gemini' ? 'selected' : ''}" id="radio-gemini">
                <input type="radio" name="provider" value="gemini" ${settings.provider === 'gemini' ? 'checked' : ''} />
                <div class="radio-dot" aria-hidden="true"></div>
                <div class="radio-info">
                  <h4>Gemini API (Free Tier)</h4>
                  <p>Use Google's Gemini free tier. Requires a free API key from <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">Google AI Studio</a> — no credit card.</p>
                </div>
              </label>

              <label class="radio-card ${settings.provider === 'retrieval' ? 'selected' : ''}" id="radio-retrieval">
                <input type="radio" name="provider" value="retrieval" ${settings.provider === 'retrieval' ? 'checked' : ''} />
                <div class="radio-dot" aria-hidden="true"></div>
                <div class="radio-info">
                  <h4>Retrieval Only (No LLM)</h4>
                  <p>Show raw retrieved chunks as the answer. Works with zero setup — great for quick lookups without any model.</p>
                </div>
              </label>

            </div>

            <!-- Ollama config -->
            <div id="ollama-config" class="settings-field" style="flex-direction:column;align-items:stretch;${settings.provider !== 'ollama' ? 'display:none' : ''}">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
                <div>
                  <label for="ollama-url" style="display:block;font-size:var(--text-sm);font-weight:var(--weight-medium);margin-bottom:var(--space-2)">Ollama URL</label>
                  <input id="ollama-url" type="url" value="${escHtml(settings.ollamaUrl)}"
                    style="width:100%;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;" />
                </div>
                <div>
                  <label for="ollama-model" style="display:block;font-size:var(--text-sm);font-weight:var(--weight-medium);margin-bottom:var(--space-2)">Model</label>
                  <input id="ollama-model" type="text" value="${escHtml(settings.ollamaModel)}" placeholder="e.g. llama3.2:3b"
                    style="width:100%;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;" />
                </div>
              </div>
              <div class="connection-test-row" style="margin-top:var(--space-4)">
                <button class="btn btn-secondary btn-sm" id="test-ollama-btn">Test Connection</button>
                <div id="ollama-status" class="status-pill" style="display:none"></div>
                <span class="saved-flash" id="ollama-saved">Saved</span>
              </div>
            </div>

            <!-- Gemini config -->
            <div id="gemini-config" class="settings-field" style="flex-direction:column;align-items:stretch;${settings.provider !== 'gemini' ? 'display:none' : ''}">
              <label for="gemini-key" style="display:block;font-size:var(--text-sm);font-weight:var(--weight-medium);margin-bottom:var(--space-2)">
                Gemini API Key
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="font-size:var(--text-xs);font-weight:var(--weight-normal);margin-left:8px">Get free key →</a>
              </label>
              <input id="gemini-key" type="password" value="${escHtml(settings.geminiKey)}" placeholder="AIza…"
                style="width:100%;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;" />
              <span class="saved-flash" id="gemini-saved" style="margin-top:6px">Saved</span>
            </div>
          </section>

          <!-- Appearance -->
          <section id="section-appearance" class="settings-section" style="display:none" aria-labelledby="appearance-heading">
            <div class="settings-section-header">
              <div class="settings-section-title" id="appearance-heading">Appearance</div>
            </div>
            <div class="settings-field">
              <div class="settings-field-label">
                <h4>Theme</h4>
                <p>Choose dark, light, or follow system preference.</p>
              </div>
              <div class="settings-field-control" role="radiogroup" aria-label="Theme">
                <select id="theme-select" style="padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--bg-surface-raised);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:var(--text-sm);font-family:inherit;outline:none;cursor:pointer">
                  <option value="dark"   ${theme === 'dark'   ? 'selected' : ''}>🌙 Dark</option>
                  <option value="light"  ${theme === 'light'  ? 'selected' : ''}>☀️ Light</option>
                  <option value="system" ${theme === 'system' ? 'selected' : ''}>💻 System</option>
                </select>
              </div>
            </div>
          </section>

          <!-- Advanced RAG -->
          <section id="section-rag" class="settings-section" style="display:none" aria-labelledby="rag-heading">
            <div class="settings-section-header">
              <div class="settings-section-title" id="rag-heading">Advanced RAG</div>
              <div class="settings-section-desc">Tune chunking and retrieval parameters. Changes take effect on next upload or rebuild.</div>
            </div>

            ${sliderField('Top-K Results', 'top-k', settings.topK, 1, 20, 1,
              'Number of chunks retrieved per query.')}
            ${sliderField('Similarity Threshold', 'threshold', settings.threshold, 0.1, 0.9, 0.05,
              'Minimum cosine similarity to include a chunk. Below this, the LLM is not called.')}
            ${sliderField('Chunk Size (chars)', 'chunk-size', settings.chunkSize, 500, 8000, 100,
              'Target size per text chunk in characters (~500 chars ≈ 125 tokens).')}
            ${sliderField('Chunk Overlap (chars)', 'chunk-overlap', settings.chunkOverlap, 0, 1000, 50,
              'Character overlap between adjacent chunks to preserve context at boundaries.')}
            ${sliderField('Context Budget (chars)', 'context-budget', settings.contextBudget, 1000, 16000, 500,
              'Maximum characters of retrieved context injected into the prompt.')}

            <div class="settings-field" style="justify-content:flex-end">
              <button class="btn btn-secondary btn-sm" id="reset-rag-btn">Reset to defaults</button>
            </div>
          </section>

          <!-- Data & Privacy -->
          <section id="section-data" class="settings-section" style="display:none" aria-labelledby="data-heading">
            <div class="settings-section-header">
              <div class="settings-section-title" id="data-heading">Data &amp; Privacy</div>
              <div class="settings-section-desc">Your data never leaves this device unless you use the Gemini provider.</div>
            </div>
            <div class="settings-field">
              <div class="settings-field-label">
                <h4>Export all data</h4>
                <p>Download a JSON backup of all Knowledge Bases, documents, and chat history.</p>
              </div>
              <button class="btn btn-secondary btn-sm" id="export-data-btn">Export JSON</button>
            </div>
            <div class="settings-field">
              <div class="settings-field-label">
                <h4>Clear all local data</h4>
                <p style="color:var(--danger)">Permanently removes everything: KBs, documents, chunks, vectors, and chat history.</p>
              </div>
              <button class="btn btn-danger-ghost btn-sm" id="clear-all-btn">Clear everything</button>
            </div>
          </section>

          <!-- Shortcuts -->
          <section id="section-shortcuts" class="settings-section" style="display:none" aria-labelledby="shortcuts-heading">
            <div class="settings-section-header">
              <div class="settings-section-title" id="shortcuts-heading">Keyboard Shortcuts</div>
            </div>
            <div class="shortcuts-table" role="table" aria-label="Keyboard shortcuts">
              ${[
                ['⌘/Ctrl + K', 'Open search / command palette'],
                ['⌘/Ctrl + N', 'New chat'],
                ['⌘/Ctrl + U', 'Open Upload screen'],
                ['⌘/Ctrl + \\', 'Toggle sidebar'],
                ['Enter', 'Send message'],
                ['Shift + Enter', 'Newline in composer'],
                ['Esc', 'Close any open dialog / panel'],
              ].map(([keys, desc]) => `
                <div class="shortcut-row" role="row">
                  <span class="shortcut-desc" role="cell">${desc}</span>
                  <div class="shortcut-keys" role="cell">
                    ${keys.split(' + ').map((k) => `<kbd class="kbd">${k}</kbd>`).join('<span style="color:var(--text-tertiary)">+</span>')}
                  </div>
                </div>`).join('')}
            </div>
          </section>

        </div><!-- /settings-content -->
      </div>
    </div>
  `;

  wireSettings(container);
}

function sliderField(label, id, value, min, max, step, hint) {
  return `
    <div class="settings-field slider-field" style="flex-direction:column;align-items:stretch;gap:0">
      <div class="slider-header">
        <div>
          <h4 style="font-size:var(--text-sm);font-weight:var(--weight-medium)">${label}</h4>
          <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">${hint}</p>
        </div>
        <span id="${id}-val" style="font-size:var(--text-sm);font-weight:var(--weight-semi);color:var(--accent);min-width:40px;text-align:right">${value}</span>
      </div>
      <input type="range" id="${id}-slider" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}" />
    </div>`;
}

function wireSettings(container) {
  // Section nav
  container.querySelectorAll('.settings-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.settings-nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelectorAll('.settings-section').forEach((s) => s.style.display = 'none');
      container.querySelector(`#section-${btn.dataset.section}`).style.display = 'block';
    });
  });

  // Provider radio cards
  container.querySelectorAll('input[name="provider"]').forEach((radio) => {
    radio.addEventListener('change', async () => {
      const val = radio.value;
      setState({ settings: { provider: val } });
      await saveSetting('provider', val);
      container.querySelectorAll('.radio-card').forEach((c) => c.classList.remove('selected'));
      radio.closest('.radio-card').classList.add('selected');
      container.querySelector('#ollama-config').style.display = val === 'ollama' ? 'flex' : 'none';
      container.querySelector('#gemini-config').style.display = val === 'gemini' ? 'flex' : 'none';
      flashSaved(container, 'provider-section');
    });
  });

  // Ollama URL & model
  const savedFlash = (id) => {
    const el = container.querySelector(`#${id}`);
    if (!el) return;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 2000);
  };

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  container.querySelector('#ollama-url')?.addEventListener('input', debounce(async (e) => {
    setState({ settings: { ollamaUrl: e.target.value } });
    await saveSetting('ollamaUrl', e.target.value);
    savedFlash('ollama-saved');
  }, 500));

  container.querySelector('#ollama-model')?.addEventListener('input', debounce(async (e) => {
    setState({ settings: { ollamaModel: e.target.value } });
    await saveSetting('ollamaModel', e.target.value);
    savedFlash('ollama-saved');
  }, 500));

  // Test Ollama connection
  container.querySelector('#test-ollama-btn')?.addEventListener('click', async () => {
    const { settings } = getState();
    const status = container.querySelector('#ollama-status');
    status.style.display = 'flex';
    status.className = 'status-pill status-pill-checking';
    status.innerHTML = '<div class="status-ping"></div>Checking…';
    try {
      const p   = new OllamaProvider(settings.ollamaModel, settings.ollamaUrl);
      const ok  = await p.ping();
      status.className = ok ? 'status-pill status-pill-online' : 'status-pill status-pill-offline';
      status.innerHTML = ok
        ? '<div class="status-ping"></div>Connected'
        : '<div class="status-ping" style="animation:none"></div>Unreachable';
    } catch {
      status.className = 'status-pill status-pill-offline';
      status.innerHTML = '<div class="status-ping" style="animation:none"></div>Error';
    }
  });

  // Gemini key
  container.querySelector('#gemini-key')?.addEventListener('input', debounce(async (e) => {
    setState({ settings: { geminiKey: e.target.value } });
    await saveSetting('geminiKey', e.target.value);
    savedFlash('gemini-saved');
  }, 500));

  // Theme select
  container.querySelector('#theme-select')?.addEventListener('change', (e) => {
    applyTheme(e.target.value, container);
  });

  // RAG sliders
  const ragMappings = {
    'top-k-slider':         { key: 'topK',          parse: parseInt },
    'threshold-slider':     { key: 'threshold',      parse: parseFloat },
    'chunk-size-slider':    { key: 'chunkSize',      parse: parseInt },
    'chunk-overlap-slider': { key: 'chunkOverlap',   parse: parseInt },
    'context-budget-slider':{ key: 'contextBudget',  parse: parseInt },
  };

  Object.entries(ragMappings).forEach(([id, { key, parse }]) => {
    const slider = container.querySelector(`#${id}`);
    const valEl  = container.querySelector(`#${id.replace('-slider', '-val')}`);
    slider?.addEventListener('input', debounce(async () => {
      const val = parse(slider.value);
      if (valEl) valEl.textContent = val;
      slider.setAttribute('aria-valuenow', val);
      setState({ settings: { [key]: val } });
      await saveSetting(key, val);
    }, 200));
  });

  // Reset RAG
  container.querySelector('#reset-rag-btn')?.addEventListener('click', async () => {
    const defaults = { topK: 5, threshold: 0.20, chunkSize: 2000, chunkOverlap: 300, contextBudget: 6000 };
    setState({ settings: defaults });
    for (const [k, v] of Object.entries(defaults)) await saveSetting(k, v);
    toast.success('Reset', 'RAG parameters restored to defaults.');
    // Re-render section
    const sec = container.querySelector('#section-rag');
    if (sec) {
      Object.entries(ragMappings).forEach(([id, { key, parse }]) => {
        const slider = container.querySelector(`#${id}`);
        const valEl  = container.querySelector(`#${id.replace('-slider', '-val')}`);
        if (slider) slider.value = defaults[key];
        if (valEl)  valEl.textContent = defaults[key];
      });
    }
  });

  // Export data
  container.querySelector('#export-data-btn')?.addEventListener('click', async () => {
    try {
      await openDB();
      const { getAllKnowledgeBases, getDocumentsByKb, getChatsByKb, getMessagesByChat, getChunksByKb } = await import('../lib/vectorStore.js');
      const kbs   = await getAllKnowledgeBases();
      const exportData = { exportedAt: new Date().toISOString(), knowledgeBases: [] };
      for (const kb of kbs) {
        const docs   = await getDocumentsByKb(kb.id);
        const chats  = await getChatsByKb(kb.id);
        const msgs   = [];
        for (const chat of chats) {
          const chatMsgs = await getMessagesByChat(chat.id);
          msgs.push(...chatMsgs);
        }
        exportData.knowledgeBases.push({ ...kb, documents: docs.map(d => ({...d, rawText: undefined})), chats, messages: msgs });
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `notesmind-export-${Date.now()}.json` });
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      toast.success('Exported', 'All data downloaded as JSON.');
    } catch (err) {
      toast.error('Export failed', err?.message);
    }
  });

  // Clear all data
  container.querySelector('#clear-all-btn')?.addEventListener('click', async () => {
    const ok = await confirm({
      title:       'Clear All Data',
      message:     '<p><strong style="color:var(--danger)">This permanently deletes everything:</strong> all Knowledge Bases, documents, vectors, and chat history.</p><p style="margin-top:8px">This cannot be undone.</p>',
      confirmText: 'Delete everything',
      dangerous:   true,
    });
    if (!ok) return;
    try {
      indexedDB.deleteDatabase('notesmind-db');
      localStorage.clear();
      toast.success('Cleared', 'All data removed. Reloading…');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      toast.error('Failed', err?.message);
    }
  });
}

function applyTheme(value, container) {
  const effectiveTheme = value === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : value;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  setState({ theme: value });
  localStorage.setItem('theme', value);
  updateThemeIcons(effectiveTheme);
  toast.success('Theme updated');
}

function updateThemeIcons(effective) {
  const dark  = document.getElementById('theme-icon-dark');
  const light = document.getElementById('theme-icon-light');
  const label = document.getElementById('theme-label');
  if (dark)  dark.style.display  = effective === 'dark'  ? 'block' : 'none';
  if (light) light.style.display = effective === 'light' ? 'block' : 'none';
  if (label) label.textContent   = effective === 'dark'  ? 'Light mode' : 'Dark mode';
}

function flashSaved(container, _) {
  // Generic save flash (not per-section for simplicity)
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
