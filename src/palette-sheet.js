// The palette sheet: slides up over the tools. Two views:
//   list:   location suggestion, presets, saved palettes, "New palette"
//   editor: change, remove or add colors (up to 12), name it, save it on the device
import {
  PRESETS, MAX_COLORS, presetForType, isNearWhite,
  loadCustomPalettes, saveCustomPalette, deleteCustomPalette,
} from './palettes.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const chips = (colors) => colors.map((c) => `<span class="chip" style="--chip:${c}"></span>`).join('');
const ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" class="line"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" class="line"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" class="line"/></svg>';
const ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" class="line"/><circle cx="12" cy="10" r="2.2" class="line"/></svg>';

export function createPaletteSheet(root, { getCurrent, onUse, onLocate }) {
  let view = 'list';
  let draft = null; // palette being edited: { id, name, colors }
  let location = { status: 'ask' }; // ask | busy | found | unclear | offline | denied | unsupported

  function locationCard() {
    const preset = location.type && presetForType(location.type);
    const where = location.name ? ` near <b>${esc(location.name)}</b>` : '';
    switch (location.status) {
      case 'ask':
        return `<div class="locate">${ICON_PIN}<p>Use your location <span>to suggest colors for where you are</span></p>
          <button type="button" class="pill" data-action="locate">Use location</button></div>`;
      case 'busy':
        return `<div class="locate">${ICON_PIN}<p>Looking at where you are…</p></div>`;
      case 'found':
        return `<div class="locate">${ICON_PIN}<p>Looks like ${esc(preset.name.toLowerCase())}${where}</p>
          <button type="button" class="pill" data-action="use" data-id="${preset.id}">Use ${esc(preset.name)}</button></div>`;
      case 'unclear':
        return `<div class="locate">${ICON_PIN}<p>Couldn’t tell what kind of place this is${where}. <span>Pick a palette below.</span></p></div>`;
      case 'offline':
        return `<div class="locate">${ICON_PIN}<p>No signal. <span>Pick a palette below.</span></p></div>`;
      default: // denied or unsupported: no card, just the presets
        return '';
    }
  }

  function row(p, { suggested = false } = {}) {
    const current = getCurrent().id === p.id;
    return `<li class="${current ? 'current' : ''}">
      <button type="button" class="palette-row" data-action="use" data-id="${p.id}">
        <span class="row-name">${esc(p.name)}${suggested ? ' <em>Suggested</em>' : ''}${current ? ' <em>In use</em>' : ''}</span>
        <span class="chips">${chips(p.colors)}</span>
      </button>
      <button type="button" class="icon" data-action="edit" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">${ICON_EDIT}</button>
    </li>`;
  }

  function listView() {
    const custom = loadCustomPalettes();
    const suggested = location.status === 'found' ? presetForType(location.type)?.id : null;
    return `<header class="sheet-head">
        <h2>Colors</h2>
        <button type="button" class="icon" data-action="close" aria-label="Close">${ICON_CLOSE}</button>
      </header>
      ${locationCard()}
      <h3>Presets</h3>
      <ul class="palette-list">${PRESETS.map((p) => row(p, { suggested: p.id === suggested })).join('')}</ul>
      ${custom.length ? `<h3>Your palettes</h3><ul class="palette-list">${custom.map((p) => row(p)).join('')}</ul>` : ''}
      <button type="button" class="pill wide" data-action="new">+ New palette</button>`;
  }

  function editorView() {
    const isCustom = draft.id?.startsWith('custom:');
    const full = draft.colors.length >= MAX_COLORS;
    return `<header class="sheet-head">
        <button type="button" class="icon" data-action="back" aria-label="Back">${ICON_BACK}</button>
        <input class="name-field" data-field="name" value="${esc(draft.name)}" maxlength="24" aria-label="Palette name" placeholder="Palette name">
      </header>
      <div class="edit-colors">
        ${draft.colors.map((c, i) => `<div class="edit-color">
          <label class="chip big" style="--chip:${c}">
            <input type="color" value="${c}" data-index="${i}" aria-label="Change color ${i + 1}">
          </label>
          <button type="button" class="remove" data-action="remove" data-index="${i}" aria-label="Remove color ${i + 1}">${ICON_CLOSE}</button>
        </div>`).join('')}
        ${full ? '' : `<button type="button" class="chip big add" data-action="add" aria-label="Add a color">+</button>`}
      </div>
      <p class="hint" data-hint>Tap a color to change it. Up to ${MAX_COLORS} colors. White is the paper.</p>
      <footer class="sheet-foot">
        ${isCustom ? '<button type="button" class="pill quiet" data-action="delete">Delete</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="pill" data-action="save" ${draft.colors.length ? '' : 'disabled'}>Save</button>
        <button type="button" class="pill strong" data-action="use-draft" ${draft.colors.length ? '' : 'disabled'}>Use</button>
      </footer>`;
  }

  function render() {
    root.innerHTML = `<div class="sheet-scroll">${view === 'list' ? listView() : editorView()}</div>`;
  }

  const findPalette = (id) => [...PRESETS, ...loadCustomPalettes()].find((p) => p.id === id);

  function edit(palette) {
    const isCustom = palette.id?.startsWith('custom:');
    draft = { id: palette.id, name: isCustom ? palette.name : `My ${palette.name}`, colors: [...palette.colors] };
    view = 'editor';
    render();
  }

  function flashHint(text) {
    const hint = root.querySelector('[data-hint]');
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('warn');
  }

  function use(palette) {
    onUse(palette);
    close();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const { action, id, index } = b.dataset;
    if (action === 'close') close();
    else if (action === 'locate') onLocate();
    else if (action === 'use') use(findPalette(id));
    else if (action === 'edit') edit(findPalette(id));
    else if (action === 'new') edit({ id: null, name: 'Palette', colors: [] });
    else if (action === 'back') { view = 'list'; render(); }
    else if (action === 'remove') { draft.colors.splice(Number(index), 1); render(); }
    else if (action === 'add') {
      draft.colors.push(draft.colors.at(-1) || '#7a8a9a');
      render();
      // Open the color picker for the new color straight away (still inside the tap).
      root.querySelector(`input[data-index="${draft.colors.length - 1}"]`)?.click();
    } else if (action === 'save' || action === 'use-draft') {
      const name = draft.name.trim() || 'My palette';
      if (action === 'save') {
        const saved = saveCustomPalette({ ...draft, name });
        use(saved);
      } else {
        // Used without saving: kept for this painting only.
        use({ id: draft.id?.startsWith('custom:') ? draft.id : `draft:${Date.now()}`, name, colors: [...draft.colors] });
      }
    } else if (action === 'delete') {
      deleteCustomPalette(draft.id);
      view = 'list';
      render();
    }
  });

  // Typing the name and picking colors update the draft without redrawing (keeps focus and the picker).
  root.addEventListener('input', (e) => {
    const input = e.target;
    if (input.dataset.field === 'name') draft.name = input.value;
    if (input.type !== 'color') return;
    input.closest('.chip').style.setProperty('--chip', input.value); // live while picking
    if (!isNearWhite(input.value)) draft.colors[Number(input.dataset.index)] = input.value;
  });
  // When the picker closes on white, go back to the last allowed color.
  root.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'color' || !isNearWhite(input.value)) return;
    input.value = draft.colors[Number(input.dataset.index)];
    input.closest('.chip').style.setProperty('--chip', input.value);
    flashHint('White is the paper: leave those parts unpainted instead.');
  });

  function open(startView = 'list') {
    if (startView === 'editor') edit(getCurrent());
    else { view = 'list'; render(); }
    root.hidden = false;
    document.body.classList.add('sheet-open');
  }
  function close() {
    root.hidden = true;
    document.body.classList.remove('sheet-open');
  }

  return {
    open,
    close,
    get isOpen() { return !root.hidden; },
    setLocation(next) {
      location = next;
      if (!root.hidden && view === 'list') render();
    },
  };
}
