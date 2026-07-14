/**
 * exportChat.js — Client-side chat export (Section 8.13)
 * Generates Markdown or JSON downloads without server involvement.
 */

/**
 * Export a chat conversation as a Markdown file.
 *
 * @param {object} chat      - Chat metadata ({ id, title, kbId })
 * @param {Array}  messages  - Message array
 */
export function exportChatAsMarkdown(chat, messages) {
  const lines = [
    `# ${chat.title || 'Chat Export'}`,
    `*Exported from NotesMind on ${new Date().toLocaleString()}*`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const role = msg.role === 'user' ? '**You**' : '**NotesMind**';
    lines.push(`### ${role}`);
    lines.push(msg.content);
    if (msg.citations?.length) {
      lines.push('');
      lines.push('*Sources:* ' + msg.citations.map((c) => `[${c.sourceFileName}, chunk ${c.chunkIndex + 1}]`).join(', '));
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const md = lines.join('\n');
  downloadBlob(md, `notesmind-${sanitizeFilename(chat.title)}.md`, 'text/markdown');
}

/**
 * Export a chat conversation as a JSON file.
 *
 * @param {object} chat
 * @param {Array}  messages
 */
export function exportChatAsJson(chat, messages) {
  const data = {
    exportedAt: new Date().toISOString(),
    chat,
    messages,
  };
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, `notesmind-${sanitizeFilename(chat.title)}.json`, 'application/json');
}

/**
 * Trigger a browser download.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Sanitize a string for use as a filename.
 */
function sanitizeFilename(str = 'chat') {
  return str.replace(/[^a-z0-9\-_]/gi, '-').slice(0, 50) || 'chat';
}
