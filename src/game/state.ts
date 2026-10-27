/**
 * The game's state: everything a save holds. The shape is the first
 * version's (legacy/poc2 10-game-state.js, `v: 1`), plus where Juno stands
 * in the rebuild (a world id, since rooms are their own worlds).
 *
 * CLAUDE.md rule 8: any change to this shape needs a version bump and a
 * migration in `load`.
 */

export interface GameState {
  v: 1;
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
}

export const SAVE_KEY = 'longnoon.save';

export const ITEM_NAMES: Record<string, string> = { staybook: 'The staybook', milk: 'Goat milk', scrap: 'Scrap metal', cell: 'Dead solar cell', bearings: 'Ball bearings' };

export function newState(start: GameState['where']): GameState {
  return {
    v: 1, step: 'burial', flags: {}, clock: 19 * 60 + 20, day: 1, water: 6, white: 0, items: {}, pages: [],
    party: { juno: { hp: 42, dur: 12 }, kit: { hp: 26 } }, joined: [], where: start,
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
  if (!s || typeof s !== 'object' || (s as { v?: unknown }).v !== 1) return null;
  return s as GameState;
}
