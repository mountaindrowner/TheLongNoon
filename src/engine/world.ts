/**
 * The active area's ground + collision. Builders (buildings, props, terrain)
 * read heights and register solid footprints here, so the same hand-modeled
 * pieces can be placed in any area. `setWorld` is called once per area load,
 * before anything is built.
 */

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface TileWorld {
  cols: number;
  rows: number;
  /** Ground glyph at a cell: g prairie · T tall grass · d road · w water · # wall/scrub · . floor */
  cell(x: number, z: number): string;
  height(x: number, z: number): number;
  /** Gaps in the edge apron where a road runs off the map (x0..x1 runs along the edge: x on n/s, z on e/w). */
  openings?: Array<{ side: 'n' | 's' | 'e' | 'w'; x0: number; x1: number }>;
  /** Tint override for grass blades (silvered Static patches…). */
  grassTint?(x: number, z: number): string | undefined;
  /** Painted road centre-line test (world units). */
  centerLine?(x: number, z: number): boolean;
  seed?: number;
  /** Paint a ground glyph the shared painter doesn't know (rail ballast, gravel…); return undefined to fall through. */
  paint?(glyph: string, x: number, z: number, fine: number): [number, number, number] | undefined;
}

/** One map's ground + collision. The overworld holds several side by side;
 *  queries run against whichever chunk is active (see useChunk). */
export interface Chunk { w: TileWorld; solids: Rect[] }
const resets: Array<() => void> = [];
let cur: Chunk = { w: { cols: 1, rows: 1, cell: () => '#', height: () => 0 }, solids: [] };

/** Start building a map: a fresh chunk becomes active. */
export function setWorld(w: TileWorld): void {
  cur = { w, solids: [] };
}
/** Clear per-area module state (tree sway lists…) before a new area — or a whole overworld — is built. */
export function beginArea(): void { for (const r of resets) r(); }
export const currentChunk = (): Chunk => cur;
export function useChunk(c: Chunk): void { cur = c; }
export const world = (): TileWorld => cur.w;
export const cell = (x: number, z: number): string => (x >= 0 && z >= 0 && x < cur.w.cols && z < cur.w.rows ? cur.w.cell(x, z) : '#');
export const heightAt = (x: number, z: number): number => cur.w.height(x, z);

/** Register module state to clear whenever a new area loads. */
export function onWorldReset(fn: () => void): void { resets.push(fn); }

export function addSolid(x0: number, z0: number, x1: number, z1: number): void {
  cur.solids.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
}
export function solidRects(): readonly Rect[] { return cur.solids; }
export function hitsSolid(x: number, z: number, r: number): boolean {
  for (const s of cur.solids) if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) return true;
  return false;
}
export function insideSolid(x: number, z: number, pad = 0.1): boolean {
  for (const s of cur.solids) if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad) return true;
  return false;
}
