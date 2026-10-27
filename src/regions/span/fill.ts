import { rng, fbm } from '../../engine/noise';
import { insideSolid } from '../../engine/world';
import type { Dress } from '../../engine/section';
import { thicket, mesquite, huisache, deadMesquite, cenizo, yucca, brushScatter } from './brush';
import { desertScatter } from './props';

/**
 * Filling a big map: the brush mottes drawn as '#' on the grid get their
 * plants (thick enough that the ground reads as a wall of thorn), the open
 * ground gets its scatter of single shrubs, pebbles and dry tufts.
 */

/** Plants on every '#' cell at least `edge` in from the map's border (the border is the edge kit's). */
export function brushFill(d: Dress, seed: number, k = 1, edge = 3, keep: (x: number, z: number) => boolean = () => true): void {
  const g = d.grid, r = rng(seed);
  for (let z = edge; z < g.rows - edge; z++) for (let x = edge; x < g.cols - edge; x++) {
    if (g.get(x, z) !== '#' || r() > 0.4 * k || !keep(x, z)) continue;
    const px = x + r(), pz = z + r(), t = r(), s = 0.85 + r() * 0.5, sd = seed * 10000 + z * 300 + x;
    // the outer cells of a motte are lower stuff, the middle has trees standing out of it
    const inner = ['#'].includes(g.get(x - 2, z)) && g.get(x + 2, z) === '#' && g.get(x, z - 2) === '#' && g.get(x, z + 2) === '#';
    d.scene.add(t < 0.55 ? thicket(px, pz, s, sd) : inner && t < 0.75 ? mesquite(px, pz, s * 1.1, sd) : inner && t < 0.82 ? huisache(px, pz, s, sd)
      : t < 0.88 ? deadMesquite(px, pz, s, sd) : t < 0.95 ? cenizo(px, pz, s, sd) : yucca(px, pz, s, sd));
  }
}

/** Single shrubs, pebbles and dry tufts over open ground: on these glyphs, off solids, off anything `keep` says. */
export function openScatter(d: Dress, seed: number, glyphs: string[], k = 1, keep: (x: number, z: number) => boolean = () => true): void {
  const g = d.grid;
  const ok = (x: number, z: number): boolean => glyphs.includes(g.get(Math.floor(x), Math.floor(z))) && !insideSolid(x, z, 0.6) && keep(x, z);
  brushScatter(d.scene, 2, 2, g.cols - 2, g.rows - 2, k, seed, ok);
  desertScatter(d.scene, g.cols, g.rows, seed + 1, ok);
}

/** A ragged motte of brush on the grid ('#' over ground that isn't road or yard). */
export function motte(g: Dress['grid'], cx: number, cz: number, rx: number, rz: number, seed: number, over = ['x', 's']): void {
  g.blob(cx, cz, rx, rz, '#', seed, (q) => over.includes(q));
}

/** Is (x, z) well clear of a polyline? (keeps brush off a road's shoulders) */
export function clearOf(pts: Array<[number, number]>, w: number): (x: number, z: number) => boolean {
  return (x, z) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
      const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
      if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < w) return false;
    }
    return true;
  };
}
export { fbm };
