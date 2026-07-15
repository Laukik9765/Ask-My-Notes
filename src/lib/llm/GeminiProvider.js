/**
 * GeminiProvider.js — LLM provider for Google Gemini free tier (Section 6.6.3)
 * Uses the Gemini generateContent REST API with streaming (SSE).
 * Requires a free API key from Google AI Studio (no credit card).
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
   * Generate a streamed response via Gemini's SSE endpoint.
   *
   * @param {object} opts
   * @param {string}   opts.prompt   - The full grounded prompt
   * @param {(token: string) => void} opts.onToken - Called per text chunk
   * @returns {Promise<string>}      - Full accumulated response
   */
  async generate({ prompt, onToken }) {
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
