// Zoom and pan: two fingers pinch and move the stamp, one finger paints.
// While zoomed in, a small live preview of the whole stamp sits in a corner of the stage, moves
// to another corner when a finger comes near it, and zooms back out when tapped.
// On a computer: ctrl + scroll (or a trackpad pinch) zooms, scroll pans.

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const PREVIEW_FPS = 10;
const AVOID_PX = 56;        // how close a finger may get to the preview before it moves away
const ZOOM_OUT_MS = 220;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function setupZoom({ engine, canvas, stage, overview }) {
  const thumb = overview.querySelector('canvas');
  const viewBox = overview.querySelector('.view-box');
  const thumbCtx = thumb.getContext('2d');
  let corner = 'top-left';
  let previewTimer = 0;

  const rect = () => canvas.getBoundingClientRect();
  // A screen point -> 0..1 across the canvas element.
  const onCanvas = (p, r) => ({ x: (p.x - r.left) / r.width, y: (p.y - r.top) / r.height });
  // The painting point (0..1, y down) under a 0..1 canvas point, in a given view.
  const toPainting = (n, v) => ({ x: v.x + (n.x - 0.5) / v.scale, y: v.y + (n.y - 0.5) / v.scale });

  function setView(next) {
    engine.setView(next);
    showOverview();
  }

  // --- Preview ---------------------------------------------------------------------------------
  function drawOverview() {
    const v = engine.getView();
    engine.drawPreview(thumbCtx);
    // The frame shows which part of the stamp is on screen.
    viewBox.style.left = `${(v.x - 0.5 / v.scale) * 100}%`;
    viewBox.style.top = `${(v.y - 0.5 / v.scale) * 100}%`;
    viewBox.style.width = viewBox.style.height = `${100 / v.scale}%`;
  }

  function showOverview() {
    const zoomed = engine.getView().scale > 1.01;
    if (zoomed && overview.hidden) {
      overview.hidden = false;
      overview.dataset.corner = corner;
      // Match the preview's pixels to the screen so it stays crisp.
      const dpr = window.devicePixelRatio || 1;
      thumb.width = Math.round(overview.clientWidth * dpr) || 1;
      thumb.height = Math.round(overview.clientWidth * (canvas.clientHeight / canvas.clientWidth) * dpr) || 1;
      previewTimer = setInterval(drawOverview, 1000 / PREVIEW_FPS);
    } else if (!zoomed && !overview.hidden) {
      overview.hidden = true;
      clearInterval(previewTimer);
    }
    if (zoomed) drawOverview();
  }

  // Move the preview to the corner farthest from the finger when the finger gets close.
  function avoid(x, y) {
    if (overview.hidden) return;
    const r = overview.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    if (Math.hypot(dx, dy) > AVOID_PX) return;
    const s = stage.getBoundingClientRect();
    const right = x < s.left + s.width / 2;   // finger on the left half -> go right
    const bottom = y < s.top + s.height / 2;  // finger in the top half -> go down
    corner = `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`;
    overview.dataset.corner = corner;
  }

  function zoomOut() {
    const from = engine.getView();
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / ZOOM_OUT_MS, 0, 1);
      const e = 1 - (1 - t) ** 3; // ease out
      setView({ scale: from.scale + (1 - from.scale) * e, x: from.x + (0.5 - from.x) * e, y: from.y + (0.5 - from.y) * e });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  overview.addEventListener('click', zoomOut);

  // --- Two-finger pinch and pan ----------------------------------------------------------------
  const touches = new Map(); // pointerId -> { x, y }
  let pinch = null;          // { scale, dist, anchor }: the view and finger spread when the pinch began

  function fingers() {
    const [a, b] = [...touches.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1) };
  }

  function startPinch() {
    // The first finger already started a stroke: take it back, and paint nothing until all fingers lift.
    engine.cancelStroke();
    engine.setInputEnabled(false);
    const v = engine.getView();
    const { mid, dist } = fingers();
    // The painting point between the fingers stays between the fingers.
    pinch = { scale: v.scale, dist, anchor: toPainting(onCanvas(mid, rect()), v) };
  }

  function movePinch() {
    const { mid, dist } = fingers();
    const n = onCanvas(mid, rect());
    const scale = clamp(pinch.scale * (dist / pinch.dist), MIN_SCALE, MAX_SCALE);
    setView({ scale, x: pinch.anchor.x - (n.x - 0.5) / scale, y: pinch.anchor.y - (n.y - 0.5) / scale });
  }

  stage.addEventListener('pointerdown', (e) => {
    avoid(e.clientX, e.clientY);
    if (e.pointerType !== 'touch' || overview.contains(e.target)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) startPinch();
  });

  window.addEventListener('pointermove', (e) => {
    if (e.buttons || e.pointerType === 'touch') avoid(e.clientX, e.clientY);
    const t = touches.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (pinch && touches.size >= 2) movePinch();
  });

  const lift = (e) => {
    if (!touches.delete(e.pointerId)) return;
    if (touches.size < 2) pinch = null;
    if (touches.size === 0) engine.setInputEnabled(true);
  };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);

  // --- Computer: trackpad pinch / ctrl + scroll zooms around the pointer, scroll pans ----------
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = rect();
    const v = engine.getView();
    if (e.ctrlKey) {
      const n = onCanvas({ x: e.clientX, y: e.clientY }, r);
      const anchor = toPainting(n, v);
      const scale = clamp(v.scale * Math.exp(-e.deltaY * 0.01), MIN_SCALE, MAX_SCALE);
      setView({ scale, x: anchor.x - (n.x - 0.5) / scale, y: anchor.y - (n.y - 0.5) / scale });
    } else {
      setView({ x: v.x + e.deltaX / (r.width * v.scale), y: v.y + e.deltaY / (r.height * v.scale) });
    }
  }, { passive: false });

  return {
    // Follows the paint point too, so the Detail brush's dot also pushes the preview away.
    avoid,
    zoomOut,
  };
}
