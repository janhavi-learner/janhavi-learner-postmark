// The five brushes. Sizes are a share of the stamp's unzoomed on-screen width, so they feel the same
// on any phone. The engine takes them as screen pixels, so they stay the same size on screen when
// zoomed in and paint finer lines on the paper.

export const BRUSHES = {
  small:  { size: 0.05, taper: 1.5 },
  medium: { size: 0.10, taper: 1.5 },
  large:  { size: 0.18, taper: 1.5 },
  // Thin, little water and so little spread (in the engine, water drives spread).
  // Paint lands above the finger so you can see it, and the path is smoothed a little.
  detail: { size: 0.018, taper: 1.5, maxWater: 0.1, offsetPx: 40, offsetRampPx: 30, smoothing: 0.5 },
  // Clear water: softens and blends, adds no color.
  wet:    { size: 0.12, taper: 1.5, wet: true },
};

const MIN_SIZE_PX = 3;

// The engine brush settings for a brush, at the current stamp width, water and color.
export function brushSettings(name, { stampWidth, water, color }) {
  const b = BRUSHES[name];
  return {
    size: Math.max(MIN_SIZE_PX, Math.round(b.size * stampWidth)),
    taper: b.taper,
    wet: !!b.wet,
    water: b.maxWater !== undefined ? Math.min(water, b.maxWater) : water,
    color,
    offsetPx: b.offsetPx || 0,
    offsetRampPx: b.offsetRampPx || 0,
    smoothing: b.smoothing || 0,
  };
}
