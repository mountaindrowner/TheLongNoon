/**
 * How strongly a ground glyph covers (x, z), 0..1, smoothed over about a cell,
 * so the height field can flatten under roads and dip under water without
 * stepping at cell edges. (section.ts imports this from the spec's
 * field/layout module, which the appendix doesn't list.)
 */
export function maskAt(get: (x: number, z: number) => string, glyph: string, x: number, z: number): number {
  let best = Infinity;
  const cx = Math.floor(x), cz = Math.floor(z);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      const gx = cx + dx, gz = cz + dz;
      if (get(gx, gz) !== glyph) continue;
      // distance from (x, z) to that cell's square
      const ex = Math.max(gx - x, 0, x - (gx + 1)), ez = Math.max(gz - z, 0, z - (gz + 1));
      best = Math.min(best, Math.hypot(ex, ez));
    }
  if (best === Infinity) return 0;
  const t = Math.min(1, best / 1.1);
  return 1 - t * t * (3 - 2 * t);
}
