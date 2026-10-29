/**
 * The game's state: everything a save holds. The shape is the first
 * version's (legacy/poc2 10-game-state.js, `v: 1`), plus where Juno stands
 * in the rebuild (a world id, since rooms are their own worlds).
 *
 * CLAUDE.md rule 8: any change to this shape needs a version bump and a
 * migration in `load`.
 *
 * - v2 (2026-10-28): `conds` (what the white did to Juno, until she sleeps) and `sunTime` (seconds of daylight
 *   today). A v1 save comes in clean of both.
 */

export interface GameState {
  v: 2;
  step: string;
  flags: Record<string, boolean | number>;
  /** Minutes after midnight. */
  clock: number;
  day: number;
  /** Drops, 0 to 10. */
  water: number;
  /** Tins of white. */
  white: number;
  items: Record<string, number>;
  pages: string[];
  party: { juno: { hp: number; dur: number }; kit: { hp: number } };
  joined: string[];
  where: { world: string; x: number; z: number; face: 'N' | 'S' | 'E' | 'W' };
  /** Conditions from the white (game/sun.ts), until Juno sleeps. */
  conds: Array<'burn' | 'blind' | 'heat'>;
  /** Seconds of daylight today, shade at half. */
  sunTime: number;
}

export const SAVE_KEY = 'longnoon.save';

export const ITEM_NAMES: Record<string, string> = { staybook: 'The staybook', milk: 'Goat milk', scrap: 'Scrap metal', cell: 'Dead solar cell', bearings: 'Ball bearings', flour: 'Sack of mesquite flour', jug: 'Rubén\'s jug', bell: 'The church bell', cloud: 'Stuffed cloud' };

export function newState(start: GameState['where']): GameState {
  return {
    v: 2, step: 'burial', flags: {}, clock: 19 * 60 + 20, day: 1, water: 6, white: 0, items: {}, pages: [],
    party: { juno: { hp: 42, dur: 12 }, kit: { hp: 26 } }, joined: [], where: start, conds: [], sunTime: 0,
  };
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

/** Write the state; false when the browser won't keep it. */
export function save(s: GameState): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function load(): GameState | null {
  let s: unknown = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { return null; }
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  // v1 → v2: nothing from the white yet
  if (o.v === 1) { o.v = 2; o.conds = []; o.sunTime = 0; }
  if (o.v !== 2) return null;
  return o as unknown as GameState;
}
