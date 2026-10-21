Please add a small JavaScript API to the engine so the Postmark app can use it as a module. Right now `src/main.js` runs a whole page by itself when it's imported: it looks up `#stamp`, `#undo` and `#redo` by id, sizes the canvas from the window, and always shows Tweakpane. Its settings live in a private `params` object.

Please keep the current demo page working, but drive it through the new API. The app will copy `engine/` without changes.

### Needed now (painting screen)

```js
import { createEngine } from './engine/src/engine.js';
const engine = await createEngine(canvas, { tune: false }); // tune: true shows Tweakpane
```

- The app sets the canvas size with CSS, and `engine.resize()` re-reads it. Please don't look up any element ids and don't size from `window`.
- `engine.setBrush({ color, water, size, wet })`: `size` is the diameter in CSS pixels on screen. `wet: true` is the current water brush. The new values apply from the next stroke.
- Per-brush `spread` (and ideally `taper`) in `setBrush`, so a "Detail" brush can be thin, use little water and spread less. If spread can only be global, please tell me.
- `engine.undo()`, `engine.redo()`, `engine.clear()` (Clear is one undo step), and `engine.onHistoryChange(({ canUndo, canRedo }) => …)`. Please keep at least 20 steps.
- Tweakpane is only created when `tune: true`.

### Needed next (zoom and thin lines), so please plan for these now

- Zoom/pan: the app will scale and move the canvas (`engine.setView({ scale, x, y })`, or a CSS transform). Brush size stays fixed in screen pixels, so zooming in paints finer lines on the paper. Paint resolution needs to hold up at about 4× zoom.
- `engine.cancelStroke()`: when a second finger lands, the app starts a pinch. The stroke the first finger began must vanish without paint or an undo step.
- `setBrush({ offsetPx, smoothing })`: paint lands `offsetPx` above the finger. The app ramps this value smoothly. It also needs `engine.onPointer((p) => …)` to report where paint is landing, so it can draw a dot there. `smoothing` (0..1) is only used by the Detail brush.
- A way to draw the current painting into a small 2D canvas each frame for a corner preview, for example `engine.drawPreview(ctx2d)`.

### Needed later (export and auto-save)

- `await engine.finishDrying()`: fast-forwards until all paint is dry.
- `engine.render({ width })` returns a canvas or ImageBitmap of the painting on paper, at least 1200×1500 (long side ≥ 1500px).
- `engine.onStrokeEnd(cb)`, `await engine.save()` returning a Blob or ArrayBuffer of the current painting (dry and wet layers, plus enough for drying to continue), and `await engine.load(data)`. This runs after every stroke, so it needs to be quick on a phone. Undo history doesn't need saving.

Mobile memory is tight: 20 undo steps at a higher paint resolution could get large. Please pick whatever trade-off you think is right and tell me what it is.
