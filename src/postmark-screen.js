// The postmark screen, after Done: a preview of the export, the format (Stamp, Sticker,
// Painting only), the postmark text (place, date, value) and Save.
import { stamp, sticker, postmarkDate } from './postmark-art.js';
import { loadPlace, formatCoords, lookupPlaceName } from './place.js';

const FORMATS = { stamp, sticker, painting: (painting) => painting };
const RENDER_DELAY_MS = 150; // wait for typing to pause before redrawing

// "Manali, Himachal Pradesh" + today -> postmark-manali-2026-10-21.png
function fileName(place, day = new Date()) {
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const town = /\d/.test(place) ? '' : (place || '').split(',')[0]; // coordinates make a poor file name
  const slug = town.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `postmark-${slug ? `${slug}-` : ''}${iso}.png`;
}

// Phones get the share sheet ("Save Image", WhatsApp); computers get a normal download.
// Returns false if the user closed the share sheet without saving or sharing.
async function saveFile(file) {
  const phone = matchMedia('(pointer: coarse)').matches;
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // closing the share sheet is fine
      throw e;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return true;
}

export function createPostmarkScreen(root, { onBack, onNewStamp }) {
  const preview = root.querySelector('#pm-canvas');
  const formatButtons = [...root.querySelectorAll('[data-format]')];
  const fields = root.querySelector('#pm-fields');
  const placeInput = root.querySelector('#pm-place');
  const dateInput = root.querySelector('#pm-date');
  const valueInput = root.querySelector('#pm-value');
  const saveButton = root.querySelector('#pm-save');
  const status = root.querySelector('#pm-status');
  const title = root.querySelector('#pm-title');
  const doneButton = document.getElementById('done');
  const newDialog = document.getElementById('confirm-new');

  let painting = null;
  let format = 'stamp';
  let file = null;          // the export, ready before Save is tapped (the share sheet needs that)
  let renderId = 0;
  let renderTimer = 0;
  let placeEdited = false;  // once the user types a place, never replace it
  let waitingForName = null; // saved coordinates still waiting for a place name
  let saved = false;         // this stamp was saved or shared at least once

  dateInput.value = postmarkDate();

  function render() {
    const id = ++renderId;
    file = null;
    saveButton.disabled = true;
    status.textContent = 'Preparing image…';
    const out = FORMATS[format](painting, { place: placeInput.value.trim(), date: dateInput.value.trim(), value: valueInput.value.trim() });
    preview.width = out.width;
    preview.height = out.height;
    preview.getContext('2d').drawImage(out, 0, 0);
    out.toBlob((blob) => {
      if (id !== renderId || !blob) return; // a newer render took over
      file = new File([blob], fileName(placeInput.value.trim()), { type: 'image/png' });
      saveButton.disabled = false;
      status.textContent = '';
    }, 'image/png');
  }
  const renderSoon = () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, RENDER_DELAY_MS);
  };

  function showFormat() {
    for (const b of formatButtons) b.setAttribute('aria-pressed', String(b.dataset.format === format));
    fields.hidden = format !== 'stamp'; // only the stamp carries a postmark
  }

  // No signal at the start: coordinates now, the town name as soon as the phone is online.
  async function fillPlaceName() {
    if (!waitingForName || placeEdited || !navigator.onLine) return;
    try {
      const name = await lookupPlaceName(waitingForName);
      if (!name || placeEdited) return;
      waitingForName = null;
      placeInput.value = name;
      render();
    } catch {
      // Still offline in practice; try again when the phone says it's back online.
    }
  }
  window.addEventListener('online', fillPlaceName);

  // The place taken at the start fills the field once; after that it's the user's.
  // If the location wasn't in yet, the next Done tries again.
  let placeFilled = false;
  function fillPlace() {
    if (placeFilled || placeEdited) return;
    const saved = loadPlace();
    placeFilled = !!saved;
    if (saved?.name) placeInput.value = saved.name;
    else if (saved?.lat !== undefined) {
      placeInput.value = formatCoords(saved);
      waitingForName = saved;
      fillPlaceName();
    }
    // Location denied or never asked: the field stays empty for the user to type.
  }

  for (const b of formatButtons) {
    b.addEventListener('click', () => {
      format = b.dataset.format;
      showFormat();
      render();
    });
  }
  placeInput.addEventListener('input', () => { placeEdited = true; renderSoon(); });
  dateInput.addEventListener('input', renderSoon);
  valueInput.addEventListener('input', renderSoon);
  saveButton.addEventListener('click', async () => {
    if (!file) return;
    try {
      if (await saveFile(file)) saved = true;
    } catch (e) {
      console.error(e);
      status.textContent = 'Couldn’t save the image. Try again.';
    }
  });
  root.querySelector('#pm-back').addEventListener('click', () => {
    root.hidden = true;
    onBack();
    doneButton.focus();
  });

  // New stamp: asks first only if this one hasn't been saved yet.
  function startNew() {
    root.hidden = true;
    // Everything about the last stamp's postmark goes; the next one gets its own place and date.
    placeInput.value = '';
    valueInput.value = '';
    dateInput.value = postmarkDate();
    placeEdited = false;
    placeFilled = false;
    waitingForName = null;
    format = 'stamp';
    onNewStamp();
  }
  root.querySelector('#pm-new').addEventListener('click', () => {
    if (saved) startNew();
    else newDialog.showModal();
  });
  newDialog.addEventListener('close', () => {
    if (newDialog.returnValue === 'new') startNew();
  });

  return {
    open(paintingCanvas) {
      painting = paintingCanvas;
      saved = false; // the painting may have changed since the last save
      fillPlace();
      showFormat();
      root.hidden = false;
      title.focus(); // screen readers start at the top of the new screen
      render();
    },
  };
}
