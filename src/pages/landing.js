/**
 * landing.js — Landing page (Section 7.2)
 * Static marketing page with hero, features, and CTA.
 */

import { navigate } from '../router.js';

export function render(container) {
  container.innerHTML = `
<div class="landing-page">
  <!-- Sticky nav -->
  <nav class="landing-nav" aria-label="Landing navigation">
    <a href="/" class="landing-nav-logo" aria-label="NotesMind Home">
      <div class="logo-mark" aria-hidden="true">N</div>
      <span>NotesMind</span>
    </a>
    <div class="landing-nav-links" role="list">
      <a href="#features" class="landing-nav-link" role="listitem">Features</a>
      <a href="#how-it-works" class="landing-nav-link" role="listitem">How it works</a>
      <a href="/about" class="landing-nav-link" data-route="/about" role="listitem">About</a>
    </div>
    <div class="landing-nav-actions">
      <button id="landing-theme-btn" class="btn btn-ghost btn-icon" aria-label="Toggle theme" title="Toggle theme">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      </button>
      <button class="btn btn-primary" id="landing-cta-btn">Get Started →</button>
    </div>
  </nav>

  <!-- Hero -->
  <section class="hero" aria-labelledby="hero-heading">
    <div class="hero-bg" aria-hidden="true">
      <div class="hero-glow hero-glow-1"></div>
      <div class="hero-glow hero-glow-2"></div>
      <div class="hero-glow hero-glow-3"></div>
    </div>
    <div class="hero-content">
      <div class="hero-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10"/><path d="m9 11 3 3L22 4"/></svg>
        100% Free · No server · Complete privacy
      </div>
      <h1 class="hero-title" id="hero-heading">
        Chat with your notes.<br>
        <span class="hero-title-accent">Not the internet.</span>
      </h1>
      <p class="hero-subtitle">
        NotesMind is a private, local-first RAG chatbot that answers questions exclusively from documents you've uploaded — with verifiable source citations for every answer.
      </p>
      <div class="hero-cta-row">
        <button class="btn btn-primary btn-lg" id="hero-cta-btn">
          Start for free →
        </button>
        <a href="#how-it-works" class="btn btn-secondary btn-lg">See how it works</a>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section id="features" class="features-section" aria-labelledby="features-heading">
    <div class="section-label">Why NotesMind</div>
    <h2 class="section-title-center" id="features-heading">Built different, by design</h2>
    <p class="section-desc">Every AI assistant makes promises. We make guarantees — encoded in the architecture, not the marketing.</p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3>Private by design</h3>
        <p>Your documents never leave your device. All embeddings run in-browser, all generation runs locally via Ollama. Zero telemetry, zero server, zero trust required.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
        </div>
        <h3>Real citations, every time</h3>
        <p>Every answer shows exactly which document and chunk it came from. Click any source to see the raw excerpt the model read — no black box, ever.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="1" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h3>₹0 forever</h3>
        <p>Transformers.js for free local embeddings, Ollama for free local generation, IndexedDB for free local storage. Total cost to you: exactly zero.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <h3>Multiple Knowledge Bases</h3>
        <p>Separate "University Notes" from "Work Docs" from "Research Papers." Each KB has fully isolated documents, vectors, and chat history.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <h3>Anti-hallucination by default</h3>
        <p>A similarity threshold gate means the LLM is never called if nothing relevant was retrieved. If we can't find it, we tell you — we don't guess.</p>
      </div>
      <div class="feature-card">
        <div class="feature-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
        </div>
        <h3>Works offline</h3>
        <p>After first load, the full ingestion and retrieval pipeline works with no internet. Upload, chunk, embed, retrieve, and generate — all without a connection.</p>
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section id="how-it-works" class="how-section" aria-labelledby="how-heading">
    <div class="section-label">How it works</div>
    <h2 class="section-title-center" id="how-heading">Your notes, your answers</h2>
    <p class="section-desc">Retrieval-Augmented Generation — the same pattern used by enterprise AI — at zero cost.</p>
    <div class="steps-list">
      <div class="step-item">
        <div class="step-number" aria-hidden="true">1</div>
        <div class="step-content">
          <h4>Upload your documents</h4>
          <p>Drag and drop PDF, DOCX, TXT, or Markdown files. Parsed client-side — files never leave your browser.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number" aria-hidden="true">2</div>
        <div class="step-content">
          <h4>Automatic chunking &amp; embedding</h4>
          <p>Text is split into overlapping chunks and converted into 384-dimensional vectors by <code>all-MiniLM-L6-v2</code> running in a Web Worker — main thread stays responsive.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number" aria-hidden="true">3</div>
        <div class="step-content">
          <h4>Ask anything</h4>
          <p>Your question is embedded, matched against stored vectors via cosine similarity, and the top matching chunks are sent to your local LLM as grounded context.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number" aria-hidden="true">4</div>
        <div class="step-content">
          <h4>Get cited, grounded answers</h4>
          <p>The answer streams in token by token, with source citations you can click to inspect the raw text the model saw. Confidence score shows retrieval quality.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta-section" aria-labelledby="cta-heading">
    <h2 id="cta-heading">Your notes deserve better than keyword search.</h2>
    <p class="section-desc" style="margin-top:var(--space-3)">No account. No subscription. No server. Just your notes — answering back.</p>
    <div style="margin-top:var(--space-8)">
      <button class="btn btn-primary btn-lg" id="cta-bottom-btn">Get started free →</button>
    </div>
  </section>
</div>
  `;

  // Wire CTA buttons
  const goToApp = () => navigate('/');
  container.querySelector('#landing-cta-btn')?.addEventListener('click', goToApp);
  container.querySelector('#hero-cta-btn')?.addEventListener('click', goToApp);
  container.querySelector('#cta-bottom-btn')?.addEventListener('click', goToApp);

  // Scroll reveal
  initScrollReveal(container);

  // Anchor nav smooth scroll
  container.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      target?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function initScrollReveal(container) {
  if (!('IntersectionObserver' in window)) return;

  const els = container.querySelectorAll('.feature-card, .step-item, .stat-card');
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  els.forEach((el) => obs.observe(el));
}
