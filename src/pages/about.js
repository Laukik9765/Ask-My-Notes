/**
 * about.js — About page (Section 7.9)
 * Project description, architecture overview, tech stack, and privacy statement.
 */

export function render(container) {
  container.innerHTML = `
    <div class="page-container">
      <div class="about-page">

        <!-- Hero card -->
        <div class="about-hero">
          <div class="about-logo-large" aria-hidden="true">N</div>
          <div class="about-hero-text">
            <h1>NotesMind</h1>
            <p style="margin-top:var(--space-2)">A private, local-first RAG chatbot for your notes. Chat with your documents using semantic search — no server, no subscription, no data leaving your device.</p>
            <div class="tech-grid" style="margin-top:var(--space-4)" aria-label="Technology stack">
              ${['HTML5', 'CSS3 (Vanilla)', 'ES6+ JavaScript', 'Transformers.js', 'IndexedDB', 'Ollama', 'pdf.js', 'marked.js', 'highlight.js', 'Service Worker'].map((t) => `
                <span class="tech-badge">⚡ ${t}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- What it does -->
        <div class="about-section">
          <h2>What is NotesMind?</h2>
          <p>NotesMind implements the <strong>Retrieval-Augmented Generation (RAG)</strong> pattern — the same AI architecture used by enterprise knowledge management tools — as a completely static web application with zero recurring cost.</p>
          <p>You upload your notes (PDF, DOCX, TXT, Markdown), the app generates embeddings using a local WASM model, stores them in your browser's IndexedDB, and then answers your questions by retrieving the most relevant text and grounding a local LLM to only that context.</p>
          <p>Every answer includes clickable source citations so you can verify exactly what the model read. A confidence score (based on cosine similarity) shows retrieval quality, and if nothing relevant was found, the app says so rather than hallucinating.</p>
        </div>

        <!-- Architecture -->
        <div class="about-section">
          <h2>Architecture</h2>
          <div class="arch-diagram" aria-label="Architecture diagram" role="img">
User uploads file
  → Parse to plain text (pdf.js / DOMParser / FileReader)
  → Chunk text ~2000 chars, 15% overlap (paragraph-aware)
  → Embed each chunk (all-MiniLM-L6-v2 via Transformers.js, Web Worker)
  → Store vectors + text in IndexedDB

User asks question
  → Embed question (same model, same worker)
  → Cosine similarity search over stored vectors (in-memory typed array scan)
  → Top-k chunks assembled into grounded context block
  → Build strict prompt: "answer ONLY from &lt;context&gt;"
  → Stream response from Ollama / Gemini / Retrieval-only provider
  → Render streamed Markdown with citations + confidence badge</div>
          <p style="margin-top:var(--space-4)">The two AI concerns — <strong>embedding</strong> (always local, always Transformers.js) and <strong>generation</strong> (pluggable: Ollama, Gemini free tier, or retrieval-only) — are deliberately separated so the privacy model is clear: embeddings are never an external call; generation can optionally be an external call only if the user explicitly opts in and provides their own key.</p>
        </div>

        <!-- Privacy statement -->
        <div class="about-section">
          <h2>Privacy Model</h2>
          <div class="privacy-callout">
            <svg class="privacy-callout-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div class="privacy-callout-text">
              <h4>Your documents never leave your device</h4>
              <p>All parsing, chunking, and embedding runs in-browser. The only outbound network calls this app ever makes with your content are: (a) to <code>localhost:11434</code> — your own machine — if Ollama is selected, and (b) optionally to Google's Gemini API if you explicitly paste your own key and select that provider. No analytics. No telemetry. No tracking.</p>
            </div>
          </div>
        </div>

        <!-- Tech stack detail -->
        <div class="about-section">
          <h2>Tech Stack</h2>
          <table style="width:100%">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Technology</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['Embeddings', 'Transformers.js (all-MiniLM-L6-v2)', 'Runs in a Web Worker via WASM/WebGPU. Free, offline after first load.'],
                ['Vector Store', 'IndexedDB (in-browser)', 'Persists across sessions. No server. Searchable via typed-array cosine similarity scan.'],
                ['Generation', 'Ollama (local)', 'Default. Free, offline, no API key. User installs once.'],
                ['Generation', 'Gemini free tier', 'Optional fallback. Free API key, no credit card. User supplies own key.'],
                ['PDF Parsing', 'pdf.js (CDN)', 'Mozilla's open-source PDF renderer. Client-side only.'],
                ['DOCX Parsing', 'Native DOMParser + DecompressionStream', 'No external library. ZIP reader built with browser APIs.'],
                ['Markdown', 'marked.js (CDN)', 'Fast, permissive. Output sanitized before DOM insertion.'],
                ['Syntax highlighting', 'highlight.js (CDN)', 'Auto-detects language. Applied after markdown render.'],
                ['Hosting', 'Any static host (GitHub Pages, Netlify, local file://)', 'No server-side code. Zero compute cost.'],
              ].map(([layer, tech, notes]) => `
                <tr>
                  <td style="font-weight:var(--weight-medium);white-space:nowrap">${layer}</td>
                  <td style="color:var(--accent)">${tech}</td>
                  <td style="color:var(--text-secondary);font-size:var(--text-xs)">${notes}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- Version / links -->
        <div style="text-align:center;padding:var(--space-8);color:var(--text-tertiary);font-size:var(--text-sm)">
          NotesMind v1.0 · Built with ❤️ and zero cost<br>
          <span style="font-size:var(--text-xs);margin-top:4px;display:block">Zero recurring cost · Open source · No server required</span>
        </div>

      </div>
    </div>
  `;
}
