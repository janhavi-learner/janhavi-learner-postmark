Thanks for the createEngine API, the app now uses it. Next round, two parts.

## 1. Lock the tuning values

Please make these the fixed defaults in `TUNING_DEFAULTS`. `tune: true` should still start from them.

pressure 0.07 · darkPace 4 · unevenness 0.32 · granulation 0.49 · dryingTime 24 · spread 0.65 · edgeStrength 2.3 · edgeWidth 20 · grainSize 0.37 · grainContrast 0.6

(Brush taper stays at 1.5; the app sets it.) Edge width 20 is the top of the slider. If a wider rim might look better, please raise the slider maximum.

## 2. Zoom and fine lines (the app's next phase)

Two fingers pinch and pan the stamp, one finger paints. Brush size stays fixed in screen pixels, so zooming in paints finer lines on the paper.

1. **`engine.setView({ scale, x, y })`**: the canvas element stays the same size on screen, and the engine draws the zoomed-in part at full screen sharpness. `scale` is 1–5. `x, y` is the painting point (0..1) at the centre of the view. Touches map through the view. `size` stays in screen pixels, so at scale 4 a 6px brush is 1.5px on the paper. (A CSS transform on the canvas doesn't work for this: the canvas is only rendered at its normal size, so zoomed paint looks blurry.)
2. **Paint resolution**: needs to hold up at 4× zoom. The current 1.5×, capped at 720px wide, is too soft. At least 1200×1500 would also cover the PRD's export size. Please pick the memory and undo trade-off you think is right and tell me what it is.
3. **`engine.cancelStroke()`**: the app calls this when a second finger lands. The stroke in progress disappears completely: no paint, no wet paint already merged behind the brush, no undo step. The engine then ignores that finger until it lifts. Please also add **`engine.setInputEnabled(bool)`**, so no new stroke can start while a pinch is going.
4. **Painting above the finger**, for the Detail brush only: `setBrush({ offsetPx, offsetRampPx, smoothing })`.
   - Paint lands `offsetPx` (screen px) above the finger.
   - The offset starts at 0 when the finger lands. It grows smoothly to `offsetPx` over the first `offsetRampPx` of movement, so the paint point never jumps.
   - `smoothing` (0..1) smooths the stroke path. 0 means off, which is what the other brushes use.
5. **`engine.onPointer((p) => …)`**: called on every move while painting, and once on lift. `p` is `{ x, y, down }` in client (screen) coordinates of where paint is landing. The app draws a small dot there.
6. **`engine.drawPreview(ctx2d)`**: draws the whole painting, unzoomed, into a small 2D canvas. The app calls it about 10× a second for a corner thumbnail while zoomed.
