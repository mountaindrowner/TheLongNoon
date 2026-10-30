/**
 * The player's options: volumes, text speed, the picture. Kept on the device, apart from the saves (they aren't
 * part of a playthrough, so changing them never touches a save's shape).
 */

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type Resolution = 'sharp' | 'balanced' | 'fast';

export interface Settings {
  /** Volumes, 0–10. */
  master: number;
  music: number;
  sfx: number;
  voices: number;
  text: TextSpeed;
  /** The tilt-shift blur above and below Juno (the diorama look). */
  blur: boolean;
  /** How many pixels the picture is drawn with: sharp (up to 1.5 per screen pixel), balanced (1), fast (0.75). */
  resolution: Resolution;
  /** The frame-rate readout in the corner (`?perf` turns it on too). */
  perf: boolean;
}

export const DEFAULT_SETTINGS: Settings = { master: 8, music: 7, sfx: 8, voices: 8, text: 'normal', blur: true, resolution: 'sharp', perf: false };

/** How long each character waits against normal, by text speed. */
export const TEXT_PACE: Record<TextSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5, instant: 0 };
/** Pixels drawn per screen pixel, by resolution (sharp is capped by the screen's own). */
export const PIXEL_RATIO: Record<Resolution, number> = { sharp: 1.5, balanced: 1, fast: 0.75 };

const KEY = 'longnoon.settings';

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    const s = { ...DEFAULT_SETTINGS, ...raw };
    for (const k of ['master', 'music', 'sfx', 'voices'] as const) s[k] = Math.max(0, Math.min(10, Math.round(Number(s[k]) || 0)));
    if (!(s.text in TEXT_PACE)) s.text = DEFAULT_SETTINGS.text;
    if (!(s.resolution in PIXEL_RATIO)) s.resolution = DEFAULT_SETTINGS.resolution;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* a private window: they last the session */ }
}
