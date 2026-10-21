Thanks for the zoom update, it's working in the app. This is the last round: finishing a painting, and auto-save.

## 1. Finish drying (when the user taps Done)

`await engine.finishDrying({ durationMs = 1500 })`
- Runs the drying faster, so all wet paint settles within about `durationMs` and the user sees edges darken and texture set.
- Resolves when nothing is wet.
- No new stroke can start while it runs.
- The result should match natural drying.

## 2. Full-resolution export: please confirm

The app exports by calling `engine.drawPreview(ctx)` on a 1200×1500 2D canvas. That gives the whole painting on paper, unzoomed, at the stored resolution. Is this the intended way? If a direct route would be faster or more exact, for example `engine.render()` returning an ImageBitmap without the readPixels round trip, please add it and tell me.

## 3. Auto-save (after every change)

- `engine.onChange(cb)`: called after a stroke ends, and after undo, redo and clear. Returns an unsubscribe function.
- `await engine.save()` returns a Blob or ArrayBuffer of the painting, including wet paint and how far it has dried.
- `await engine.load(data)` restores it into a freshly created engine with the same canvas shape, and drying carries on. Undo history starts empty after loading.
- The app stores the result in IndexedDB after every change, so it needs to be quick on a phone: ideally under ~100 ms and a few MB. For example, save only painted tiles, and use 8- or 16-bit where it doesn't show. Please choose the format and tell me the typical size.
- Please put a format version in the data, so `load` can reject an old or broken save cleanly with an error, not a broken painting.
