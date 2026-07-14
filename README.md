# NotesMind

**A private, local-first RAG chatbot for your notes.**  
Zero cost · No server · Complete privacy · Fully offline after first load.

---

## What is NotesMind?

NotesMind implements **Retrieval-Augmented Generation (RAG)** as a completely static web application — the same AI architecture used by enterprise knowledge tools, but running entirely in your browser at zero cost.

You upload your notes → it generates embeddings locally using Transformers.js → stores vectors in your browser's IndexedDB → answers your questions by retrieving the most relevant text and grounding a local LLM to only that context.

**Every answer shows clickable source citations. If the answer isn't in your notes, it says so — it never guesses.**

---

## Features

- 🔒 **Private by design** — documents never leave your device (with Ollama)
- 📄 **PDF, DOCX, TXT, Markdown** — all parsed client-side
- 🧠 **Semantic search** — 384-dim embeddings via `all-MiniLM-L6-v2`
- ⚡ **Multiple Knowledge Bases** — isolated document/vector/chat namespaces
- 💬 **Streaming answers** — token-by-token from Ollama or Gemini free tier
- 📎 **Source citations** — every answer cites its sources; click to inspect raw chunks
- 📊 **Confidence score** — based on cosine similarity of top retrieved chunk
- 🎨 **Dark/Light theme** — with smooth transitions
- ⌨️ **Keyboard shortcuts** — Ctrl+K, Ctrl+N, Ctrl+U, etc.
- 📱 **Mobile responsive** — bottom tab nav, drawer sidebar
- 🔧 **PWA installable** — works offline after first load
- 0️⃣ **Zero cost forever** — free hosting, free embeddings, free generation

---

## Quick Start

### Option 1: Open directly

```bash
# Clone or download the project
git clone <repo-url>
cd notesmind

# Serve it (any static server works)
npx serve .
# OR
python -m http.server 8080
# OR just open index.html in Chrome/Firefox
```

> ⚠️ **Important:** The embedding worker requires ES Module support. Open via a local server (not `file://`) for best results, especially for the Web Worker to load Transformers.js.

### Option 2: Deploy to GitHub Pages / Netlify / Vercel

Drop the project folder as-is — it's 100% static files. No build step required.

---

## Setting Up a Local LLM (Ollama — Recommended)

NotesMind defaults to Ollama for free, private, offline generation.

### 1. Install Ollama

Download from [https://ollama.ai](https://ollama.ai) and install the desktop app.

### 2. Pull a model

```bash
# Recommended (small, fast, good quality):
ollama pull llama3.2:3b

# Alternatives:
ollama pull phi3          # Microsoft Phi-3 (very fast)
ollama pull qwen2.5:3b    # Alibaba Qwen (multilingual)
ollama pull mistral       # 7B parameter, higher quality
```

### 3. Start Ollama

Ollama runs automatically after install. Verify it's running:
```bash
curl http://localhost:11434/api/tags
```

### 4. Configure in NotesMind

Go to **Settings → Model Provider → Ollama** and click **Test Connection**.

---

## Using the Gemini Free Tier (Optional Fallback)

If you don't have a machine capable of running Ollama:

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create a free API key (no credit card required)
3. In NotesMind → **Settings → Model Provider → Gemini API**
4. Paste your key

> The free tier uses `gemini-1.5-flash` with generous daily quotas.

---

## Usage

### Upload Documents
1. Go to **Upload** (or press `Ctrl+U`)
2. Select or create a Knowledge Base
3. Drag & drop your PDF/DOCX/TXT/MD files
4. Watch them parse → chunk → embed in real-time

### Chat
1. Go to **Chat** (or press `Ctrl+N` for a new chat)
2. Type your question — press Enter to send
3. See streaming answer with source citations
4. Click any citation chip to inspect the exact text the model read

### Knowledge Base Manager
- View all documents with chunk counts and status
- Search documents by name
- Delete individual documents (removes their vectors)
- Rebuild embeddings after changing chunk settings

---

## Architecture

```
User uploads file
  → Parse to plain text (pdf.js / DOMParser / FileReader)
  → Chunk text ~2000 chars, 15% overlap (paragraph-aware)
  → Embed each chunk (all-MiniLM-L6-v2 via Transformers.js, Web Worker)
  → Store vectors + text in IndexedDB

User asks question
  → Embed question (same model, same worker)
  → Cosine similarity search over stored vectors
  → Top-k chunks assembled into grounded context
  → Strict prompt: "answer ONLY from <context>"
  → Stream response from Ollama / Gemini / Retrieval-only
  → Render Markdown with citations + confidence badge
```

### Module Structure

```
index.html                 ← App shell entry point
service-worker.js          ← Offline caching
manifest.webmanifest       ← PWA manifest

styles/
  tokens.css               ← Design tokens (colors, spacing, typography)
  base.css                 ← Reset + global styles
  layout.css               ← App shell layout primitives
  components/              ← Per-component CSS
  pages/                   ← Per-page CSS

src/
  main.js                  ← Bootstrap: state, router, theme, shortcuts
  router.js                ← Minimal History-API router
  state/store.js           ← Observable state store (pub/sub)
  
  pages/                   ← Route controllers (lazy-loaded)
    dashboard.js
    chat.js
    upload.js
    kbManager.js
    settings.js
    about.js
  
  components/              ← Reusable UI components
    Toast.js
    ConfirmDialog.js
    CommandPalette.js
  
  rag/                     ← RAG pipeline (no DOM refs)
    ragEngine.js           ← Public API: ingest, delete, query
    chunker.js             ← Paragraph-aware chunking
    similarity.js          ← Cosine similarity + top-k
    promptBuilder.js       ← Grounded prompt assembly
  
  lib/
    vectorStore.js         ← IndexedDB wrapper
    uploadQueue.js         ← Sequential processing queue
    sanitizer.js           ← HTML allow-list sanitizer
    exportChat.js          ← Client-side Markdown/JSON export
    shortcuts.js           ← Global keyboard shortcuts
    parsers/               ← PDF, DOCX, TXT, MD parsers
    llm/                   ← OllamaProvider, GeminiProvider, RetrievalOnlyProvider
  
  workers/
    embedding.worker.js    ← Transformers.js (off main thread)

tests/
  chunker.test.js
  similarity.test.js
  vectorStore.test.js
  parsers.test.js
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Embeddings | Transformers.js (`all-MiniLM-L6-v2`) | In-browser WASM, Web Worker, free after first download |
| Vector Store | IndexedDB | Persists across sessions, no server |
| Generation | Ollama (default) | Free, offline, no API key |
| Generation | Gemini free tier | Optional, user supplies own free key |
| PDF parsing | pdf.js (Mozilla CDN) | Client-side only |
| DOCX parsing | Native DOMParser + DecompressionStream | No external library |
| Markdown | marked.js (CDN) | + XSS sanitizer before DOM insertion |
| Syntax highlighting | highlight.js (CDN) | Auto-detects language |
| Styling | Vanilla CSS with custom properties | No Tailwind, no preprocessor |
| JS | ES Modules, no bundler | Works from file:// after local serve |
| Hosting | Any static host | GitHub Pages, Netlify, Vercel, local |

---

## Privacy

- **All parsing, chunking, and embedding runs client-side in your browser**
- The only outbound network calls with your content are:
  - `localhost:11434` (your own machine) — if Ollama is selected
  - `generativelanguage.googleapis.com` — only if you opt into Gemini
- No analytics. No telemetry. No tracking. No backend. No accounts.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘/Ctrl + K` | Open search / command palette |
| `⌘/Ctrl + N` | New chat |
| `⌘/Ctrl + U` | Open Upload screen |
| `⌘/Ctrl + \` | Toggle sidebar |
| `Enter` | Send message |
| `Shift + Enter` | Newline in composer |
| `Esc` | Close any open dialog / panel |

---

## Performance Notes

- **Embedding model:** `all-MiniLM-L6-v2` quantized (~25MB, downloaded once, then cached by Service Worker)
- **Vector search:** In-memory cosine similarity scan — fast for up to ~50,000 chunks
- **Streaming:** Token-by-token via `ReadableStream` with `requestAnimationFrame` batching
- **Lazy loading:** Page modules loaded dynamically on navigation; heavy libs (pdf.js, Transformers.js) only imported when needed

---

## License

MIT — use, modify, and share freely.
#   A s k - M y - N o t e s  
 