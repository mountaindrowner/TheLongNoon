/**
 * What the white costs (the owner, 2026-10-28): a night runs about eight minutes of play, and staying out past it
 * costs water, then health, and leaves conditions that last until Juno sleeps. Shade, real shadow cast by whatever
 * stands between her and the sun, slows all of it ("shade only slows the drain", the Complete Story File).
 *
 * Every number here is a first guess for the owner to tune.
 */
import type { GameState } from './state';

export const SUN = {
  /** Seconds of open daylight per drop of water. */
  dropEvery: 3.5,
  /** In shade, everything below runs this much slower. */
  shadeSlows: 2,
  /** With no water left: seconds per hit to health, and how much. */
  hurtEvery: 3.5,
  hurt: 3,
  /** Seconds of daylight (this day, shade counted at half) before each condition sets in. */
  burnAfter: 20,
  blindAfter: 45,
  /** Health Juno wakes with after fainting, as a share of her most. */
  faintHp: 0.5,
};

export type Condition = 'burn' | 'blind' | 'heat';

/** Conditions: each lasts until Juno sleeps at the cot. */
export const CONDITIONS: Record<Condition, { name: string; what: string }> = {
  burn: { name: 'Sunburned', what: 'Her most health is a quarter lower.' },
  blind: { name: 'Noonblind', what: 'The world swims white at the edges. A quarter of her blows miss.' },
  heat: { name: 'Heat-sick', what: 'No running. She walks and fights slower.' },
};

const BASE_HP = 42;

export const has = (s: GameState, c: Condition): boolean => s.conds.includes(c);

/** Juno's most health right now. */
export const maxHp = (s: GameState): number => Math.round(BASE_HP * (has(s, 'burn') ? 0.75 : 1));

/** Give Juno a condition; true if it's new. */
export function afflict(s: GameState, c: Condition): boolean {
  if (has(s, c)) return false;
  s.conds.push(c);
  if (c === 'burn') s.party.juno.hp = Math.min(s.party.juno.hp, maxHp(s));
  return true;
}

/** A night's sleep: conditions gone, health back to full. */
export function sleepOff(s: GameState): void {
  s.conds = [];
  s.sunTime = 0;
  s.party.juno.hp = maxHp(s);
  s.party.kit.hp = 26;
}
