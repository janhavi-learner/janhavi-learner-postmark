// Palettes: the five presets, custom palettes saved on this device, and the one in use.

export const MAX_COLORS = 12;

// Six colors each, no white: white is the paper.
export const PRESETS = [
  { id: 'preset:mountains', type: 'mountains', name: 'Mountains', colors: ['#2f4a6d', '#6f9fc8', '#3e5e45', '#6b6660', '#7a5a3c', '#8e7aa0'] },
  { id: 'preset:beach',     type: 'beach',     name: 'Beach',     colors: ['#2e5c8a', '#3aa3a3', '#8cc3de', '#d9b77a', '#e07a5f', '#8a7560'] },
  { id: 'preset:city',      type: 'city',      name: 'City',      colors: ['#4a4e5a', '#a14a3a', '#5a6f8c', '#c9a24a', '#6a8a4a', '#8c847a'] },
  { id: 'preset:forest',    type: 'forest',    name: 'Forest',    colors: ['#5b7f4a', '#2f5a3a', '#7d7a3a', '#b5b04a', '#5e4430', '#3d4f5e'] },
  { id: 'preset:desert',    type: 'desert',    name: 'Desert',    colors: ['#c98a4a', '#a8553a', '#d9a94a', '#7fb0d6', '#8f9a6a', '#7a5a7a'] },
];

export const presetForType = (type) => PRESETS.find((p) => p.type === type);

// The engine paints any color this close to white as opaque white, and white is the paper,
// so palettes don't take it.
export function isNearWhite(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].every((v) => v >= 235);
}

// Saved on the device. Storage can be unavailable (private mode), so every access is guarded.
const CUSTOM_KEY = 'postmark.palettes';
const CURRENT_KEY = 'postmark.currentPalette';

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the app keeps working for this visit.
  }
}

export const loadCustomPalettes = () => read(CUSTOM_KEY, []);

// Saves a custom palette (new, or replacing one with the same id) and returns it.
export function saveCustomPalette({ id, name, colors }) {
  const list = loadCustomPalettes();
  const palette = { id: id?.startsWith('custom:') ? id : `custom:${Date.now()}`, name, colors };
  const at = list.findIndex((p) => p.id === palette.id);
  if (at >= 0) list[at] = palette;
  else list.push(palette);
  write(CUSTOM_KEY, list);
  return palette;
}

export function deleteCustomPalette(id) {
  write(CUSTOM_KEY, loadCustomPalettes().filter((p) => p.id !== id));
}

export const loadCurrentPalette = () => read(CURRENT_KEY, null) || PRESETS[0];
export const saveCurrentPalette = (palette) => write(CURRENT_KEY, palette);
