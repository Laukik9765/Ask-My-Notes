/**
 * OllamaProvider.js — LLM provider for local Ollama (Section 6.6.3)
 * Calls the Ollama REST API running on the user's machine.
 * Streams tokens via NDJSON.
 */

export class OllamaProvider {
  /**
   * @param {string} model  - Ollama model name (e.g. 'llama3.2:3b')
   * @param {string} url    - Ollama base URL (default http://localhost:11434)
   */
  constructor(model = 'llama3.2:3b', url = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = url;
  }

  /**
   * Generate a streamed response.
   *
   * @param {object} opts
   * @param {string}   opts.prompt   - The full grounded prompt
   * @param {string}   [opts.context]- Raw context (unused; included in prompt)
   * @param {(token: string) => void} opts.onToken - Called per token
   * @returns {Promise<string>}      - The full accumulated response
   */
  async generate({ prompt, onToken }) {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.response) {
            full += json.response;
            onToken(json.response);
          }
          if (json.done) break;
        } catch {
          // Ignore malformed NDJSON lines
        }
      }
    }

    return full;
  }

  /**
   * Test connectivity to Ollama.
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available Ollama models.
   * @returns {Promise<string[]>}
   */
  async listModels() {
    try {
      const res  = await fetch(`${this.baseUrl}/api/tags`);
      const json = await res.json();
      return (json.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }
}
