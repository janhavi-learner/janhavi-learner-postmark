// Keeps the painting in progress on the phone (IndexedDB), so a call, the lock screen or closing
// the tab never loses it. Saved after every change (stroke, undo, redo, clear, drying) and when
// the page goes into the background, so wet paint carries on drying from where it was.

const DB_NAME = 'postmark';
const STORE = 'paintings';
const KEY = 'current';

function openDb() {
  return new Promise((done, fail) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => done(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((done, fail) => {
      const tx = db.transaction(STORE, mode);
      const req = action(tx.objectStore(STORE));
      tx.oncomplete = () => done(req.result);
      tx.onerror = () => fail(tx.error);
    });
  } finally {
    db.close();
  }
}

// { painting: Blob, blank: boolean, savedAt } or null.
export async function loadSaved() {
  try {
    return (await run('readonly', (store) => store.get(KEY))) || null;
  } catch {
    return null; // storage unavailable (private mode): start fresh
  }
}

export const forgetSaved = () => run('readwrite', (store) => store.delete(KEY)).catch(() => {});

// Saves whenever the painting changes. If a save is still running, one more follows it,
// so the last change is always the one kept. `isBlank()` tells whether the stamp was cleared.
export function startAutosave(engine, { isBlank, onError }) {
  let saving = false;
  let pending = false;

  async function save() {
    if (saving) {
      pending = true;
      return;
    }
    saving = true;
    try {
      do {
        pending = false;
        const painting = await engine.save();
        await run('readwrite', (store) => store.put({ painting, blank: isBlank(), savedAt: Date.now() }, KEY));
      } while (pending);
    } catch (e) {
      onError(`Auto-save failed: ${e.message || e}`);
    } finally {
      saving = false;
    }
  }

  engine.onChange(save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });

  // Ask the browser not to clear our storage when space runs low (helps most on iPhone).
  navigator.storage?.persist?.().catch(() => {});
  return { save };
}
