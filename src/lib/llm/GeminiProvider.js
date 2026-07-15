/**
 * GeminiProvider.js — LLM provider for Google Gemini free tier
 * Proxies requests through Vercel serverless function to hide API key,
 * with direct client-side fallback for local development.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider {
  /**
   * @param {string} apiKey - Free Gemini API key from aistudio.google.com
   * @param {string} model  - Model name (default 'gemini-1.5-flash')
   */
  constructor(apiKey, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model  = model;
  }

  /**
   * Generate a streamed response.
   *
   * @param {object} opts
   * @param {string}   opts.prompt   - The full grounded prompt
   * @param {(token: string) => void} opts.onToken - Called per text chunk
   * @returns {Promise<string>}      - Full accumulated response
   */
  async generate({ prompt, onToken }) {
    // 1. Try Vercel Serverless Function Proxy first (for Vercel hosting, hides API Key)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (res.ok) {
        return await this._streamResponse(res, onToken);
      } else if (res.status !== 404) {
        // If the proxy is active but failed with an error, parse and throw
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
    } catch (err) {
      // If it's a real serverless error (not a 404), bubble it up
      if (err.message && !err.message.includes('404')) {
        throw err;
      }
    }

    // 2. Client-side Fallback (for local development via http-server)
    if (!this.apiKey) {
      throw new Error('No Gemini API key set. Please add your key in Settings.');
    }

    const url = `${GEMINI_BASE}/${this.model}:streamGenerateContent?alt=sse`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,   // Low temperature for factual, grounded answers
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `Gemini error ${res.status}: ${err.error?.message || res.statusText}`
      );
    }

    return await this._streamResponse(res, onToken);
  }

  /**
   * Stream utility
   */
  async _streamResponse(res, onToken) {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json  = JSON.parse(data);
            const parts = json.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.text) {
                full += part.text;
                onToken(part.text);
              }
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }

    return full;
  }
}
