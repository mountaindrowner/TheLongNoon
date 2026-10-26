/**
 * The clock (legacy 10-game-state, 16-exploration): minutes after midnight,
 * one game minute per real second, stopped while people talk. The phases are
 * the proof of concept's, and they are the game's rhythm: Lamp, the long
 * night, Shutter, the white.
 */
export type Phase = 'Lamp' | 'Long night' | 'Shutter' | 'Day';

const wrap = (m: number): number => ((m % 1440) + 1440) % 1440;

export function phaseOf(minute: number): Phase {
  const m = wrap(minute);
  if (m >= 1110 && m < 1200) return 'Lamp';
  if (m >= 1200 || m < 270) return 'Long night';
  if (m < 360) return 'Shutter';
  return 'Day';
}

/** Lanterns are lit from Lamp until the white (the town is built one way or the other). */
export const litAt = (minute: number): boolean => phaseOf(minute) !== 'Day';

export function fmtTime(minute: number): string {
  const m = Math.floor(wrap(minute));
  let h = Math.floor(m / 60);
  const mm = m % 60, ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, '0')} ${ap}`;
}

/** "19:20" or "7:20" → minutes; null if it doesn't parse. */
export function parseClock(s: string | null): number | null {
  const r = s?.match(/^(\d{1,2}):(\d{2})$/);
  return r ? wrap(Number(r[1]) * 60 + Number(r[2])) : null;
}

export class Clock {
  /** Minutes after midnight. */
  minute: number;
  day = 1;
  /** A frozen clock holds its light (screenshots, playtests: `?time=`). */
  frozen: boolean;
  constructor(start: number, frozen = false) { this.minute = wrap(start); this.frozen = frozen; }
  /** Advance by `dt` real seconds (one game minute each). */
  tick(dt: number): void {
    if (this.frozen) return;
    this.minute += dt;
    if (this.minute >= 1440) { this.minute -= 1440; this.day++; }
  }
  set(minute: number): void { this.minute = wrap(minute); }
  get phase(): Phase { return phaseOf(this.minute); }
  get lit(): boolean { return litAt(this.minute); }
}
