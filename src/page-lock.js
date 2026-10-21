// Stops the page itself from moving while painting: no scroll, rubber-band, pull-to-refresh,
// pinch or double-tap zoom, long-press menu or text selection. CSS does most of it (style.css);
// this covers what iPhone Safari ignores in CSS.

export function lockPage() {
  // iOS Safari ignores user-scalable=no for pinch; block its gesture events directly.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  // Block scrolling and pull-to-refresh by touch, except on sliders (they need to drag)
  // and the parts that scroll on purpose: the color row, the palette sheet, the postmark screen, the error log.
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('input[type="range"], #swatches, .sheet-scroll, .screen-scroll, #errors')) return;
    e.preventDefault();
  }, { passive: false });

  // No long-press menu ("Save image", "Copy") on the painting.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}
