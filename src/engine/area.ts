import type * as THREE from 'three';
import type { Mood } from './mood';

/**
 * What a built map hands the game: where you can walk, what you can talk to
 * or inspect, where its exits go, and a per-frame update for its routines.
 * Section builders (section.ts) and interiors (interior.ts) both return one.
 * (The style spec's appendix uses these types without listing them; this is
 * the minimal shape its builders need.)
 */

export type SectionKind = 'home' | 'town' | 'road' | 'side' | 'dungeon' | 'travel';
export type Face = 'N' | 'S' | 'E' | 'W';

export interface Spot { x: number; z: number; face?: Face }

/** The travel card shown between regions (ui.ts `travel`). */
export interface Travel { img: string; box: [number, number, number, number]; path: Array<[number, number]>; line: string; ms?: number }

export interface Go { to: string; spawn: string; travel?: Travel }

/** A rectangle that fires when the player walks into it (exits, scripted spots). */
export interface Trigger { x0: number; z0: number; x1: number; z1: number; go?: Go; script?: string; /** Only while this condition holds (the game reads it). */ when?: string }

/** Something to inspect or use: describes, never interprets (spec §11.3). */
export interface Thing { x: number; z: number; label: string; r?: number; lines?: string[]; script?: string; go?: Go; /** Only there while this condition holds (the game reads it). */ when?: string }

/**
 * A line a person holds across a way out: Juno can't cross it while they stand there. Stepping onto it, they
 * talk (`lines` the first time, `again` after) and she walks back to `back`. Map coordinates, like the NPC.
 */
export interface Guard { x0: number; z0: number; x1: number; z1: number; back: [number, number]; lines: string[]; again?: string[]; /** The line lifts while this condition holds. */ unless?: string }

/** A person. Outdoors they go in at Shutter and stay in by day, unless `allDay` (a lookout under wraps). */
export interface NPC { id: string; name: string; sprite: string; x: number; z: number; face?: Face; lines?: string[]; script?: string; wander?: [number, number, number, number]; guard?: Guard; allDay?: boolean; /** Only there while this condition holds: a person in one beat of the story. */ when?: string }

export interface Roamer { sprite: string; frames: string[]; x: number; z: number; area: [number, number, number, number]; speed: number; height: number }

export interface Area {
  id: string;
  title: string;
  sub: string;
  kind: SectionKind;
  region?: string;
  mood: Mood;
  /** Outdoors (true) or under a roof. */
  sky: boolean;
  /** Camera target clamp, so the map's edge never shows a void. */
  cam: { x0: number; x1: number; z0: number; z1: number };
  blocked(x: number, z: number, r: number): boolean;
  water?(x: number, z: number): boolean;
  ground(x: number, z: number): number;
  wild?(x: number, z: number): boolean;
  zone?: string;
  spawns: Record<string, Spot>;
  triggers: Trigger[];
  things: Thing[];
  npcs: NPC[];
  roamers?: Roamer[];
  update(t: number, focus: THREE.Vector3, camT: THREE.Vector3): void;
}

export type AreaBuilder = (scene: THREE.Scene, night: boolean) => Promise<Area>;
