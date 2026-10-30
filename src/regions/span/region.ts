import { setApronTexture } from '../../engine/terrain';
import type { RegionSpec } from '../../engine/region';
import type { Mood } from '../../engine/mood';
import type { Spot, AreaBuilder } from '../../engine/area';
import { attached } from '../../engine/foliage';
import { spanApron, occluders, resetSpan, pruneSpan } from './props';
import { sevenFlagsTown } from './seven-flags';
import { ramp } from './ramp';
import { lakeRoad } from './lake-road';
import { whiteBowl } from './white-bowl';
import { marHome, chapel, finaHouse, kidsHouse, churchHall, mallCourt, mallShop, cellar, bigStore, fuselage } from './rooms';
import { abandonedMall } from './mall';
import { trailNorth } from './trail';
import { churchOnTheHill } from './church';

/**
 * THE SPAN: the first region (methodology §2.3: "A town that stayed, and
 * can't keep everyone"). The town is Seven Flags, laid out from the owner's
 * map of the real streets of north Laredo (2026-10-27); around it, the road
 * out north, the long road down to the dry lake, the Old Trail north-east to
 * the church on the rise, and the side street south-west to the dead mall
 * (2026-10-28). A web of maps on one ground, walked between with no cut
 * (option C), brush between them.
 *
 *   x: -40  0   40       128   192 208   288 328
 *   z:-48                            ┌──────────┐
 *                                    │  CHURCH  │ the Open Door, 120×96
 *   z:0         ┌────────┐           │          │
 *               │  RAMP  │           └──┬───────┘
 *   z:48        │ 88×64  │           ┌──┴────┐
 *   z:64     ┌──┴─┬──────┴───────┐───┤ TRAIL │ the Trail North, 88×72
 *            │    SEVEN FLAGS    │   │       │
 *            │   the town, 192×160   └───────┘
 *   z:128    │                   ├──────┐
 *            │                   │ LAKE │
 *   z:224 ┌──┴──────┬────────────┤ ROAD │
 *         │  MALL   │            │96×132│
 *         │ 132×96  │      ┌─────┴──────┤
 *   z:320 └─────────┘      │ WHITE BOWL │ 132×96
 *   z:356                  └────────────┘
 *
 * Real names never show; the one Old Name is under the fallen sign on the Ramp.
 */

export const SPAN = 'span';
/**
 * The Span as hub and spokes (the owner, 2026-10-29: "regions that have main hubs and have connections, but you
 * load into separate maps"). Seven Flags is the hub. Each spoke is its own place, loaded on its own through a
 * transition at its edge:
 * - north up the highway to the Ramp;
 * - east down the boulevard to the Lake Road, and on down to the White Bowl;
 * - the trail gate north-east to the Trail North, and on up to the church on the hill;
 * - the underpass south-west to the mall.
 * Every map is a place of its own, and only one is ever built at a time.
 */
export const NORTH = 'northroad';
export const LAKE = 'lakeside';
export const BOWL = 'bowl';
export const TRAIL = 'oldtrail';
export const HILL = 'hill';
export const MALLSIDE = 'mallside';

/** Each map's place (its top-left corner, world units). One coordinate frame for every region, so a point says
 *  which region it's in and story markers can point across. */
export const PLACE: Record<string, [number, number]> = {
  ramp: [40, 0],
  'seven-flags': [0, 64],
  'lake-road': [192, 128],
  'white-bowl': [156, 260],
  trail: [192, 48],
  church: [208, -48],
  mall: [-40, 224],
};
const SIZE: Record<string, [number, number]> = {
  ramp: [88, 64], 'seven-flags': [192, 160], 'lake-road': [96, 132], 'white-bowl': [132, 96], trail: [88, 72], church: [120, 96], mall: [132, 96],
};
/** Where a new game starts: the lot in front of Mar Farm, by the platform where Papá lies. */
export const START: Spot = { x: 137, z: 64 + 122.5, face: 'N' };

/** The outdoor regions: their maps, their names, and where you arrive if nothing says otherwise. */
export const REGIONS: Record<string, { title: string; sub: string; pieces: string[]; start: Spot }> = {
  [SPAN]: { title: 'Seven Flags', sub: 'A town that stayed', pieces: ['seven-flags'], start: START },
  [NORTH]: { title: 'The Ramp', sub: 'The road to the Thirty-Five', pieces: ['ramp'], start: { x: 50, z: 61.6, face: 'N' } },
  [LAKE]: { title: 'The Lake Road', sub: 'East to the White Bowl', pieces: ['lake-road'], start: { x: 194.4, z: 188, face: 'E' } },
  [BOWL]: { title: 'The White Bowl', sub: 'Where the lake was', pieces: ['white-bowl'], start: { x: 236, z: 262.6, face: 'S' } },
  [TRAIL]: { title: 'The Trail North', sub: 'Lanterns toward the hill', pieces: ['trail'], start: { x: 196.4, z: 85, face: 'E' } },
  [HILL]: { title: 'The Open Door', sub: 'A church on the rise', pieces: ['church'], start: { x: 244, z: 45.4, face: 'N' } },
  [MALLSIDE]: { title: 'The Mall', sub: 'Under the long roof', pieces: ['mall'], start: { x: 56, z: 228.2, face: 'S' } },
};
/** The region a map belongs to. */
export const regionOf = (piece: string): string | null => Object.keys(REGIONS).find((r) => REGIONS[r]!.pieces.includes(piece)) ?? null;
/** The region a point lies in (null between maps). */
export function regionAt(x: number, z: number): string | null {
  for (const [id, [px, pz]] of Object.entries(PLACE)) {
    const [w, h] = SIZE[id]!;
    if (x >= px && x < px + w && z >= pz && z < pz + h) return regionOf(id);
  }
  return null;
}
/** The ways between places: a point just inside each side's edge. */
const LINKS: Array<[string, [number, number], string, [number, number]]> = [
  [SPAN, [50, 65.6], NORTH, [50, 62.4]],
  [SPAN, [190.4, 188], LAKE, [193.6, 188]],
  [SPAN, [189.6, 85], TRAIL, [194.4, 85]],
  [LAKE, [236, 258.6], BOWL, [236, 261.4]],
  [TRAIL, [244, 49.4], HILL, [244, 46.6]],
  [SPAN, [56.3, 222.6], MALLSIDE, [56, 225.6]],
];
/** Where, in region `from`, the way toward region `to` starts (through the hub if they don't touch): for markers
 *  pointing at a place somewhere else. */
export function gateTo(from: string, to: string): [number, number] | null {
  const next = new Map<string, [number, number]>(), seen = new Set([from]), q: string[] = [from];
  for (let h = 0; h < q.length; h++) {
    const here = q[h]!;
    for (const [a, pa, b, pb] of LINKS) for (const [x, px, y] of [[a, pa, b], [b, pb, a]] as Array<[string, [number, number], string]>) {
      if (x !== here || seen.has(y)) continue;
      seen.add(y); q.push(y);
      next.set(y, here === from ? px : next.get(here)!);
    }
  }
  return next.get(to) ?? null;
}

const BUILDERS: Record<string, (night: boolean) => import('../../engine/section').SectionSpec> = {
  ramp, 'seven-flags': sevenFlagsTown, 'lake-road': lakeRoad, 'white-bowl': whiteBowl, trail: trailNorth, church: churchOnTheHill, mall: abandonedMall,
};

export function spanRegion(mood: Mood, night: boolean, start?: Spot, id = SPAN): RegionSpec {
  resetSpan();
  const shifted = new Map<number, string>(); // occluder index → the map that made it
  let seen = 0;
  const R = REGIONS[id]!;
  return {
    id,
    title: R.title,
    sub: R.sub,
    mood,
    heightSeed: 41,
    start: start ?? R.start,
    apron: spanApron(),
    lights: 10,
    pieces: R.pieces.map((p) => ({ at: PLACE[p]!, spec: BUILDERS[p]!(night) })),
    afterPiece(p) {
      // the Span's fading overhead props were registered in map space; move them into region space
      for (; seen < occluders.length; seen++) {
        const r = occluders[seen]!.rect;
        r[0] += p.ox; r[2] += p.ox; r[1] += p.oz; r[3] += p.oz;
        shifted.set(seen, p.id);
      }
    },
    dropPiece(p) {
      const keep = occluders.filter((_, i) => shifted.get(i) !== p.id);
      const ids = occluders.map((_, i) => shifted.get(i)).filter((id) => id !== p.id);
      occluders.length = 0;
      occluders.push(...keep);
      shifted.clear();
      ids.forEach((id, i) => { if (id) shifted.set(i, id); });
      seen = occluders.length;
      pruneSpan(attached);
    },
  };
}

/** The rooms behind the Span's lit doors, and where each one lets you back out. */
export function spanRooms(night: boolean): Record<string, AreaBuilder> {
  return {
    'mar-home': marHome({ to: SPAN, spawn: 'seven-flags:home', night }),
    chapel: chapel({ to: SPAN, spawn: 'seven-flags:chapel', night }),
    'fina-house': finaHouse({ to: SPAN, spawn: 'seven-flags:fina', night }),
    'kids-house': kidsHouse({ to: SPAN, spawn: 'seven-flags:kids', night }),
    'church-hall': churchHall({ to: HILL, spawn: 'church:door', night }),
    'mall-court': mallCourt({ to: MALLSIDE, spawn: 'mall:court', night }),
    'mall-shop': mallShop({ to: 'mall-court', spawn: 'grille', night }),
    cellar: cellar({ to: SPAN, spawn: 'seven-flags:hatch', night }),
    'big-store': bigStore({ to: SPAN, spawn: 'seven-flags:dock', night }),
    fuselage: fuselage({ to: BOWL, spawn: 'white-bowl:wreck', night }),
  };
}

/** Roads out of the Span's built maps that lead to maps not built yet: what the edge says when you reach it. */
export const UNBUILT: Record<string, string> = {
  'thirty-five': 'The Thirty-Five runs north from here, toward the Gate. The caravan isn’t ready to leave.',
  'east-loop': 'The east road runs on into the brush. Not tonight.',
  'dead-river': 'The boulevard runs on west under the Thirty-Five, down to the Dead River. Not tonight.',
  'south-road': 'The road runs on south, out of town. Not tonight.',
};

export function useSpanApron(): void { setApronTexture(spanApron()); }
