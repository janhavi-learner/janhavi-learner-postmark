// Painting screen: fits the stamp on screen, starts the watercolor engine and wires up the tools.
import { createEngine } from '../engine/engine/src/engine.js';
import { lockPage } from './page-lock.js';
import { keepScreenAwake } from './wake-lock.js';
import { brushSettings } from './brushes.js';
import { loadCurrentPalette, saveCurrentPalette } from './palettes.js';
import { createPaletteSheet } from './palette-sheet.js';
import { locationPermission, getPosition, describePlace, savePlace } from './place.js';
import { setupZoom } from './zoom.js';
import { renderPainting } from './postmark-art.js';
import { createPostmarkScreen } from './postmark-screen.js';
import { loadSaved, forgetSaved, startAutosave } from './autosave.js';

const STAMP_ASPECT = 4 / 5; // width / height

// The engine's tuning sliders are for development only: add ?tune to the URL to see them.
const TUNE = new URLSearchParams(location.search).has('tune');

const stage = document.getElementById('stage');
const canvas = document.getElementById('stamp');
const brushButtons = [...document.querySelectorAll('#brushes button')];
const swatchRow = document.getElementById('swatches');
const paletteButton = document.getElementById('palette-button');
const sheetRoot = document.getElementById('palette-sheet');
const waterSlider = document.getElementById('water');
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');
const clearButton = document.getElementById('clear');
const clearDialog = document.getElementById('confirm-clear');
const errorBox = document.getElementById('errors');
const overview = document.getElementById('overview');
const detailDot = document.getElementById('detail-dot');
const doneButton = document.getElementById('done');

// Last brush, water and color, so coming back feels like you never left.
const PREFS_KEY = 'postmark.prefs';
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ brush: state.brush, water: state.water, colorIndex: state.colorIndex }));
  } catch {
    // Not saved; defaults next time.
  }
}

const prefs = loadPrefs();
const state = {
  brush: prefs.brush || 'medium',
  palette: loadCurrentPalette(),
  colorIndex: 0,
  get color() { return this.palette.colors[this.colorIndex]; },
  water: prefs.water ?? Number(waterSlider.value),
  stampWidth: 0,
};
state.colorIndex = Math.min(prefs.colorIndex || 0, state.palette.colors.length - 1);
waterSlider.value = state.water;

function showError(message) {
  console.error(message);
  errorBox.hidden = false;
  errorBox.textContent += (errorBox.textContent ? '\n\n' : '') + message;
}
window.addEventListener('error', (e) => showError(`JS error: ${e.message}\n  at ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => showError(`Unhandled: ${e.reason?.stack || e.reason}`));

// Largest 4:5 stamp that fits the stage (inside its padding).
function fitStamp() {
  const style = getComputedStyle(stage);
  const availW = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availH = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const w = Math.max(0, Math.floor(Math.min(availW, availH * STAMP_ASPECT)));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${Math.round(w / STAMP_ASPECT)}px`;
  state.stampWidth = w;
}

function buildSwatches() {
  swatchRow.replaceChildren(...state.palette.colors.map((color, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `Color ${i + 1}`);
    b.dataset.index = i;
    b.style.setProperty('--swatch-color', color);
    return b;
  }));
}

function showSelection() {
  for (const b of brushButtons) b.setAttribute('aria-checked', String(b.dataset.brush === state.brush));
  for (const b of swatchRow.children) b.setAttribute('aria-checked', String(Number(b.dataset.index) === state.colorIndex));
  document.body.classList.toggle('wet-brush', state.brush === 'wet');
}

async function start() {
  lockPage();
  keepScreenAwake();
  buildSwatches();
  showSelection();
  fitStamp();

  let engine;
  try {
    engine = await createEngine(canvas, { tune: TUNE, onError: showError });
  } catch (e) {
    canvas.hidden = true;
    const msg = document.getElementById('engine-message');
    msg.hidden = false;
    msg.textContent = 'This browser can’t run the watercolor paint. Try an up-to-date Safari or Chrome.';
    showError(e.message);
    return;
  }

  const applyBrush = () => {
    engine.setBrush(brushSettings(state.brush, state));
    savePrefs();
  };
  applyBrush();

  // The stamp keeps its 4:5 shape when the screen changes size (rotation, browser bars).
  new ResizeObserver(() => {
    fitStamp();
    engine.resize();
    applyBrush();
  }).observe(stage);

  for (const b of brushButtons) {
    b.addEventListener('click', () => {
      state.brush = b.dataset.brush;
      showSelection();
      applyBrush();
    });
  }
  swatchRow.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.colorIndex = Number(b.dataset.index);
    // Picking a colour while on the wet brush means you want to paint: go back to medium.
    if (state.brush === 'wet') state.brush = 'medium';
    showSelection();
    applyBrush();
  });
  // Palettes can change at any time; the painting is untouched. The same color slot stays
  // selected when the new palette has it.
  const sheet = createPaletteSheet(sheetRoot, {
    getCurrent: () => state.palette,
    onUse(palette) {
      state.palette = palette;
      state.colorIndex = Math.min(state.colorIndex, palette.colors.length - 1);
      saveCurrentPalette(palette);
      buildSwatches();
      showSelection();
      applyBrush();
    },
    onLocate: locate,
  });
  paletteButton.addEventListener('click', () => sheet.open());

  // Location: asked once at the start, only to suggest a palette (and later fill the postmark).
  async function locate() {
    sheet.setLocation({ status: 'busy' });
    let position;
    try {
      position = await getPosition();
    } catch (e) {
      sheet.setLocation({ status: e.denied ? 'denied' : 'unclear' });
      return;
    }
    const place = await describePlace(position);
    savePlace(position, place);
    if (place.offline) sheet.setLocation({ status: 'offline' });
    else sheet.setLocation({ status: place.type ? 'found' : 'unclear', ...place });
  }

  // The palette sheet opens at the start, over the tools, with the stamp still in view.
  // A painting in progress from last time comes back as it was, wet paint still drying.
  let blank = true;     // nothing painted since the start or the last Clear
  let clearing = false; // the next change is a Clear
  const saved = await loadSaved();
  if (saved?.painting) {
    try {
      await engine.load(saved.painting);
      blank = saved.blank;
    } catch (e) {
      // From an older engine format or damaged: start a fresh stamp instead.
      console.warn('Saved painting not restored:', e.message);
      forgetSaved();
    }
  }
  engine.onChange(() => {
    blank = clearing;
    clearing = false;
  });
  startAutosave(engine, { isBlank: () => blank, onError: showError });

  // A new stamp starts with the palette sheet (and the location question). Coming back to a
  // painting skips it: the palette and place from its start are kept.
  if (blank) {
    sheet.open();
    const permission = await locationPermission();
    if (permission === 'granted') locate(); // already allowed before: no need to ask again
    else if (permission === 'denied' || !('geolocation' in navigator)) sheet.setLocation({ status: 'denied' });
  }

  const zoom = setupZoom({ engine, canvas, stage, overview });

  // Detail brush: a small dot marks exactly where paint lands, above the finger.
  engine.onPointer(({ x, y, down }) => {
    zoom.avoid(x, y);
    const show = down && state.brush === 'detail';
    detailDot.hidden = !show;
    if (show) detailDot.style.transform = `translate(${x}px, ${y}px)`;
  });

  // Done: the painting finishes drying, then the postmark screen opens with it.
  const postmark = createPostmarkScreen(document.getElementById('postmark-screen'), {
    onBack: () => engine.setInputEnabled(true),
  });
  doneButton.addEventListener('click', async () => {
    sheet.close();
    engine.setInputEnabled(false);
    doneButton.disabled = true;
    doneButton.textContent = 'Drying…';
    try {
      await engine.finishDrying({ durationMs: 1500 });
      postmark.open(renderPainting(engine));
    } finally {
      doneButton.disabled = false;
      doneButton.textContent = 'Done';
    }
  });

  waterSlider.addEventListener('input', () => {
    state.water = Number(waterSlider.value);
    applyBrush();
  });

  undoButton.addEventListener('click', () => engine.undo());
  redoButton.addEventListener('click', () => engine.redo());
  engine.onHistoryChange(({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  });

  clearButton.addEventListener('click', () => clearDialog.showModal());
  clearDialog.addEventListener('close', () => {
    if (clearDialog.returnValue !== 'clear') return;
    clearing = true;
    engine.clear();
  });

  // Tools sink out of the way while a stroke is on the paper, and come back after lifting.
  let restoreTimer = 0;
  canvas.addEventListener('pointerdown', () => {
    sheet.close(); // starting to paint means the current palette is fine
    clearTimeout(restoreTimer);
    document.body.classList.add('painting');
  });
  const lift = () => {
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => document.body.classList.remove('painting'), 250);
  };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);
}

// Offline support, in the built site only. Browsers refuse it on a self-signed certificate
// (the Wi-Fi dev server), so offline is tested on the real HTTPS site.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Offline support unavailable:', e.message));
}

start();
