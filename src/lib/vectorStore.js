/**
 * vectorStore.js — IndexedDB wrapper for all persistent data (Section 6.5)
 * Manages: knowledgeBases, documents, chunks, chats, messages, settings
 * No DOM references. Fully async.
 */

const DB_NAME = 'notesmind-db';
const DB_VERSION = 1;

let db = null;

/* ─── Open / Upgrade ─────────────────────────────────── */

export function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const idb = e.target.result;

      // knowledgeBases
      if (!idb.objectStoreNames.contains('knowledgeBases')) {
        const kbs = idb.createObjectStore('knowledgeBases', { keyPath: 'id' });
        kbs.createIndex('name', 'name', { unique: false });
      }

      // documents
      if (!idb.objectStoreNames.contains('documents')) {
        const docs = idb.createObjectStore('documents', { keyPath: 'id' });
        docs.createIndex('kbId', 'kbId', { unique: false });
      }

      // chunks (text + vector)
      if (!idb.objectStoreNames.contains('chunks')) {
        const chunks = idb.createObjectStore('chunks', { keyPath: 'id' });
        chunks.createIndex('kbId', 'kbId', { unique: false });
        chunks.createIndex('documentId', 'documentId', { unique: false });
      }

      // chats
      if (!idb.objectStoreNames.contains('chats')) {
        const chats = idb.createObjectStore('chats', { keyPath: 'id' });
        chats.createIndex('kbId', 'kbId', { unique: false });
      }

      // messages
      if (!idb.objectStoreNames.contains('messages')) {
        const msgs = idb.createObjectStore('messages', { keyPath: 'id' });
        msgs.createIndex('chatId', 'chatId', { unique: false });
      }

      // settings (key-value)
      if (!idb.objectStoreNames.contains('settings')) {
        idb.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ─── Generic helpers ────────────────────────────────── */

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function wrap(req) {
  return new Promise((res, rej) => {
    req.onsuccess = (e) => res(e.target.result);
    req.onerror   = (e) => rej(e.target.error);
  });
}

function getAllByIndex(storeName, indexName, value) {
  const store = tx(storeName);
  const idx   = store.index(indexName);
  return wrap(idx.getAll(value));
}

/* ─── Knowledge Bases ─────────────────────────────────── */

export async function saveKnowledgeBase(kb) {
  await openDB();
  return wrap(tx('knowledgeBases', 'readwrite').put(kb));
}

export async function getAllKnowledgeBases() {
  await openDB();
  return wrap(tx('knowledgeBases').getAll());
}

export async function deleteKnowledgeBase(id) {
  await openDB();
  return wrap(tx('knowledgeBases', 'readwrite').delete(id));
}

/* ─── Documents ───────────────────────────────────────── */

export async function saveDocument(doc) {
  await openDB();
  return wrap(tx('documents', 'readwrite').put(doc));
}

export async function getDocumentsByKb(kbId) {
  await openDB();
  return getAllByIndex('documents', 'kbId', kbId);
}

export async function getDocument(id) {
  await openDB();
  return wrap(tx('documents').get(id));
}

export async function deleteDocument(id) {
  await openDB();
  return wrap(tx('documents', 'readwrite').delete(id));
}

/* ─── Chunks ──────────────────────────────────────────── */

export async function saveChunks(chunks) {
  await openDB();
  const store = tx('chunks', 'readwrite');
  return Promise.all(chunks.map((c) => wrap(store.put(c))));
}

export async function getChunksByKb(kbId) {
  await openDB();
  return getAllByIndex('chunks', 'kbId', kbId);
}

export async function getChunksByDocument(documentId) {
  await openDB();
  return getAllByIndex('chunks', 'documentId', documentId);
}

export async function deleteChunksByDocument(documentId) {
  await openDB();
  const chunks = await getChunksByDocument(documentId);
  const store  = tx('chunks', 'readwrite');
  return Promise.all(chunks.map((c) => wrap(store.delete(c.id))));
}

export async function deleteChunksByKb(kbId) {
  await openDB();
  const chunks = await getChunksByKb(kbId);
  const store  = tx('chunks', 'readwrite');
  return Promise.all(chunks.map((c) => wrap(store.delete(c.id))));
}

/* ─── Chats ───────────────────────────────────────────── */

export async function saveChat(chat) {
  await openDB();
  return wrap(tx('chats', 'readwrite').put(chat));
}

export async function getChatsByKb(kbId) {
  await openDB();
  const chats = await getAllByIndex('chats', 'kbId', kbId);
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getChat(id) {
  await openDB();
  return wrap(tx('chats').get(id));
}

export async function deleteChat(id) {
  await openDB();
  return wrap(tx('chats', 'readwrite').delete(id));
}

export async function deleteChatsByKb(kbId) {
  await openDB();
  const chats = await getChatsByKb(kbId);
  const store = tx('chats', 'readwrite');
  return Promise.all(chats.map((c) => wrap(store.delete(c.id))));
}

/* ─── Messages ────────────────────────────────────────── */

export async function saveMessage(msg) {
  await openDB();
  return wrap(tx('messages', 'readwrite').put(msg));
}

export async function getMessagesByChat(chatId) {
  await openDB();
  const msgs = await getAllByIndex('messages', 'chatId', chatId);
  return msgs.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteMessagesByChat(chatId) {
  await openDB();
  const msgs  = await getMessagesByChat(chatId);
  const store = tx('messages', 'readwrite');
  return Promise.all(msgs.map((m) => wrap(store.delete(m.id))));
}

/* ─── Settings ────────────────────────────────────────── */

export async function saveSetting(key, value) {
  await openDB();
  return wrap(tx('settings', 'readwrite').put({ key, value }));
}

export async function getSetting(key) {
  await openDB();
  const row = await wrap(tx('settings').get(key));
  return row ? row.value : undefined;
}

export async function getAllSettings() {
  await openDB();
  const rows = await wrap(tx('settings').getAll());
  const result = {};
  rows.forEach((r) => { result[r.key] = r.value; });
  return result;
}

/* ─── Count helpers ───────────────────────────────────── */

export async function countChunksByKb(kbId) {
  await openDB();
  const chunks = await getChunksByKb(kbId);
  return chunks.length;
}

export async function countDocumentsByKb(kbId) {
  await openDB();
  const docs = await getDocumentsByKb(kbId);
  return docs.length;
}
