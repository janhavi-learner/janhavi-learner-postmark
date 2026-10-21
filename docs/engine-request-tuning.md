Please make these the engine's fixed defaults (`TUNING_DEFAULTS` in `engine/src/engine.js`). The tuning panel should still start from them with `tune: true`.

| Setting | Value |
| --- | --- |
| pressure | 0.07 |
| darkPace | 4 |
| unevenness | 0.32 |
| granulation | 0.49 |
| dryingTime | 24 |
| spread | 0.65 |
| edgeStrength | 2.3 |
| edgeWidth | 20 |
| grainSize | 0.37 |
| grainContrast | 0.6 |

Brush taper stays at 1.5 (the app sets it through `setBrush`).

Edge width 20 is the top of the slider's range. If a wider rim might look better, please raise the slider maximum so it can be tuned further.
