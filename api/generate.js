/**
 * api/generate.js — Vercel Serverless Function Proxy
 * Acts as a secure proxy to Google's Gemini API.
 * Cascades automatically through free tier models (gemini-2.5-flash -> gemini-2.0-flash -> gemini-2.0-flash-lite)
 * if rate limits (429) are encountered.
 */

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Gemini API key is not configured on the Vercel server. Please add GEMINI_API_KEY to your Vercel Environment Variables.' 
    });
  }

  let lastErrorText = '';

  for (const modelName of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        lastErrorText = await response.text();
        // If 429 rate limited or 404, try next model in cascade
        if (response.status === 429 || response.status === 404) {
          console.warn(`[Proxy] Model ${modelName} returned status ${response.status}. Trying next fallback model...`);
          continue;
        }
        return res.status(response.status).json({ error: lastErrorText });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          let trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) trimmed = trimmed.slice(6).trim();

          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              const obj = Array.isArray(parsed) ? parsed[0] : parsed;
              const parts = obj?.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                }
              }
            } catch {
              // Partial buffer fragment
            }
          }
        }
      }

      res.write('data: [DONE]\n\n');
      return res.end();

    } catch (err) {
      console.error(`[API Proxy] Error on model ${modelName}:`, err);
      lastErrorText = err.message;
    }
  }

  return res.status(429).json({ error: lastErrorText || 'All Gemini API models are currently rate limited.' });
}
