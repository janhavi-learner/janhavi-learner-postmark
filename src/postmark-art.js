// Draws the exports at full resolution with Canvas 2D:
//   Stamp:    painting on stamp paper with perforated edges, a postmark circle and wavy cancel lines
//   Sticker:  painting with a thick white die-cut border and a soft shadow
//   Painting: just the painting on its paper
// Every size is in export pixels for a 1200 × 1500 painting.

export const PAINTING_W = 1200;
export const PAINTING_H = 1500;

// Look of the stamp. Change these to restyle the export.
const STAMP = {
  margin: 96,             // paper around the painting, including the perforations
  holeRadius: 20,         // perforation holes
  holeSpacing: 54,        // roughly; adjusted so holes land exactly on the corners
  paper: '#fbf8f1',
  frame: 'rgb(0 0 0 / 0.12)',
  ink: 'rgb(28 30 38 / 0.85)',
  font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  valueFont: 'Georgia, "Times New Roman", serif',
};
const STICKER = {
  border: 72,
  radius: 28,             // corner rounding of the painting inside the border
  shadowPad: 64,
  shadow: 'rgb(0 0 0 / 0.28)',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// "21 OCT 2026"
export const postmarkDate = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// The engine draws the whole painting, unzoomed, at the size of the canvas it's given.
export function renderPainting(engine) {
  const c = canvas2d(PAINTING_W, PAINTING_H);
  engine.drawPreview(c.getContext('2d'));
  return c;
}

// --- Stamp -------------------------------------------------------------------------------------

// The stamp's outline: a rectangle with half-circle bites along every edge.
function perforatedOutline(w, h) {
  const { holeRadius: r, holeSpacing } = STAMP;
  const path = new Path2D();
  path.rect(0, 0, w, h);
  // Holes overlapping would cancel each other out (even-odd), so each corner hole is added once:
  // top and bottom edges include the corners, the side edges skip them.
  const along = (length, fn, { corners }) => {
    const n = Math.round(length / holeSpacing);
    for (let i = corners ? 0 : 1; i <= (corners ? n : n - 1); i++) fn((i * length) / n);
  };
  const hole = (x, y) => { path.moveTo(x + r, y); path.arc(x, y, r, 0, Math.PI * 2); };
  along(w, (x) => { hole(x, 0); hole(x, h); }, { corners: true });
  along(h, (y) => { hole(0, y); hole(w, y); }, { corners: false });
  return path;
}

// Text along a circle, centred at the top (reading clockwise) or bottom (reading left to right).
// Shrinks the font until the text fits within `maxAngle`.
function arcText(ctx, text, cx, cy, radius, { bottom = false, fontPx, maxAngle }) {
  if (!text) return;
  let size = fontPx;
  let spacing;
  let widths;
  let total;
  do {
    ctx.font = `600 ${size}px ${STAMP.font}`;
    spacing = size * 0.12;
    widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
    total = widths.reduce((a, b) => a + b, 0) / radius;
    size -= 2;
  } while (total > maxAngle && size > 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let angle = bottom ? Math.PI / 2 + total / 2 : -Math.PI / 2 - total / 2;
  [...text].forEach((ch, i) => {
    const step = widths[i] / radius;
    const a = bottom ? angle - step / 2 : angle + step / 2;
    ctx.save();
    ctx.translate(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
    ctx.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle = bottom ? angle - step : angle + step;
  });
}

// Fills `text` centred at (x, y), shrinking the font until it fits `maxWidth`.
function fittedText(ctx, text, x, y, { fontPx, maxWidth, weight = 700, family = STAMP.font }) {
  let size = fontPx;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 14);
  ctx.fillText(text, x, y);
}

// A worn, hand-stamped look: knock tiny specks out of the ink. Seeded, so the preview doesn't flicker.
function wearInk(ctx, w, h) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) {
    ctx.globalAlpha = 0.3 + rand() * 0.6;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 1 + rand() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The postmark (circle, place, date, wavy lines) on its own transparent layer.
function drawPostmark(w, h, { place, date }) {
  const layer = canvas2d(w, h);
  const ctx = layer.getContext('2d');
  ctx.strokeStyle = ctx.fillStyle = STAMP.ink;
  ctx.lineCap = 'round';

  // Circle over the top-right of the painting; the wavy lines run off across the corner.
  const R = 215;
  const cx = w - STAMP.margin - 330;
  const cy = STAMP.margin + 200;
  const inner = R - 64;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.stroke();

  // Place: "Manali, Himachal Pradesh" -> MANALI around the top, HIMACHAL PRADESH around the bottom.
  const [top, ...rest] = (place || '').toUpperCase().split(',').map((s) => s.trim());
  const textRadius = (R + inner) / 2;
  arcText(ctx, top, cx, cy, textRadius, { fontPx: 44, maxAngle: Math.PI * 0.85 });
  arcText(ctx, rest.join(', '), cx, cy, textRadius, { bottom: true, fontPx: 34, maxAngle: Math.PI * 0.75 });

  // Date across the middle, between two short rules.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fittedText(ctx, (date || '').toUpperCase(), cx, cy, { fontPx: 50, maxWidth: inner * 2 - 40 });
  ctx.lineWidth = 4;
  for (const dy of [-46, 46]) {
    ctx.beginPath(); ctx.moveTo(cx - inner * 0.62, cy + dy); ctx.lineTo(cx + inner * 0.62, cy + dy); ctx.stroke();
  }

  // Wavy cancel lines from the circle out across the corner and off the edge.
  ctx.lineWidth = 9;
  const startX = cx + R + 24;
  for (let i = 0; i < 5; i++) {
    const y0 = cy + (i - 2) * 38;
    ctx.beginPath();
    for (let x = startX; x <= w + 20; x += 4) {
      const y = y0 + Math.sin(((x - startX) / 92) * Math.PI * 2) * 11;
      if (x === startX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  wearInk(ctx, w, h);
  return layer;
}

export function stamp(painting, { place, date, value }) {
  const m = STAMP.margin;
  const w = painting.width + m * 2;
  const h = painting.height + m * 2;
  const out = canvas2d(w, h);
  const ctx = out.getContext('2d');

  // Everything is cut to the perforated outline; outside it stays transparent.
  ctx.save();
  ctx.clip(perforatedOutline(w, h), 'evenodd');
  ctx.fillStyle = STAMP.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(painting, m, m);
  ctx.strokeStyle = STAMP.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(m - 1, m - 1, painting.width + 2, painting.height + 2);

  // Value, printed on the stamp at the bottom left, with a paper-coloured halo so it reads over paint.
  if (value) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 120px ${STAMP.valueFont}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgb(251 248 241 / 0.75)';
    ctx.strokeText(value, m + 48, h - m - 52);
    ctx.fillStyle = 'rgb(30 30 34 / 0.9)';
    ctx.fillText(value, m + 48, h - m - 52);
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(drawPostmark(w, h, { place, date }), 0, 0);
  ctx.restore();
  return out;
}

// --- Sticker -----------------------------------------------------------------------------------

export function sticker(painting) {
  const { border: b, radius, shadowPad: pad, shadow } = STICKER;
  const w = painting.width + (b + pad) * 2;
  const h = painting.height + (b + pad) * 2;
  const out = canvas2d(w, h);
  const ctx = out.getContext('2d');

  // White die-cut shape with a soft shadow under it.
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(pad, pad, painting.width + b * 2, painting.height + b * 2, radius + b);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad + b, pad + b, painting.width, painting.height, radius);
  ctx.clip();
  ctx.drawImage(painting, pad + b, pad + b);
  ctx.restore();
  return out;
}
