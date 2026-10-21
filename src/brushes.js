// The five brushes. Sizes are a share of the stamp's on-screen width, so they feel the same
// on any phone; the engine takes them as CSS pixels.

export const BRUSHES = {
  small:  { size: 0.05, taper: 1.5 },
  medium: { size: 0.10, taper: 1.5 },
  large:  { size: 0.18, taper: 1.5 },
  // Thin, little water and so little spread (in the engine, water drives spread).
  detail: { size: 0.018, taper: 1.5, maxWater: 0.1 },
  // Clear water: softens and blends, adds no colour.
  wet:    { size: 0.12, taper: 1.5, wet: true },
};

const MIN_SIZE_PX = 3;

// The engine brush settings for a brush, at the current stamp width, water and colour.
export function brushSettings(name, { stampWidth, water, color }) {
  const b = BRUSHES[name];
  return {
    size: Math.max(MIN_SIZE_PX, Math.round(b.size * stampWidth)),
    taper: b.taper,
    wet: !!b.wet,
    water: b.maxWater !== undefined ? Math.min(water, b.maxWater) : water,
    color,
  };
}
