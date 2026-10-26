import { setApronTexture } from '../../engine/terrain';
import type { RegionSpec } from '../../engine/region';
import type { Mood } from '../../engine/mood';
import type { Spot, AreaBuilder } from '../../engine/area';
import { attached } from '../../engine/foliage';
import { spanApron, occluders, resetSpan, pruneSpan } from './props';
import { marFarm } from './mar-farm';
import { plaza } from './plaza';
import { colonia } from './colonia';
import { ramp } from './ramp';
import { lakeRoad } from './lake-road';
import { whiteBowl } from './white-bowl';
import { marHome, chapel, finaHouse, kidsHouse } from './rooms';

/**
 * THE SPAN: the first region (methodology §2.3: "A town that stayed, and
 * can't keep everyone"). A web of maps on one ground, walked between with no
 * cut (option C), brush between them, roads where they meet. Sizes (owner,
 * 2026-10-26): large 132×96, medium about two thirds of that, the town twice
 * a large map, the lake road a large map stood on end.
 *
 *   x:   0          88  132         264         396   492
 *   z:0  ┌────────┐
 *        │  RAMP  │ M                                    north: the Thirty-Five (next region)
 *   z:64 ├────────┴──┬───────────┬───────────┬──────┐
 *        │ MAR FARM  │ THE PLAZA │THE COLONIA│ LAKE │  east: the brush (not built)
 *        │    L      │  L (town) │  L (town) │ ROAD │
 *  z:160 └───────────┴───────────┴───────────┤ L,   │
 *                                       ┌────┴portr.┤ z:196
 *                                       │ WHITE BOWL│
 *                                       │     L     │
 *                                       └───────────┘ z:292
 *
 * The boulevard runs from the store at Mar Farm east through the Plaza and
 * the Colonia to the fork on the lake road; the lake road turns south, the
 * drain beside it, to the dry lake southeast of town. The Ramp climbs north
 * from the farm to the Thirty-Five. From the Plaza a lane runs north into
 * the brush (the Old Trail) and a road south to the river (the Dead River):
 * both still to build. Real ground (methodology §3): north Laredo, the I-35
 * west and north, the creek channel east of town, the lake southeast.
 * Real names never show; the one Old Name is under the fallen sign.
 */

export const SPAN = 'span';

/** Each map's place in the region (its top-left corner, world units). */
export const PLACE: Record<string, [number, number]> = {
  ramp: [0, 0],
  'mar-farm': [0, 64],
  plaza: [132, 64],
  colonia: [264, 64],
  'lake-road': [396, 64],
  'white-bowl': [360, 196],
};
/** Where a new game starts: Mar Farm's yard, by the lane. */
export const START: Spot = { x: 26, z: 64 + 50, face: 'N' };

export function spanRegion(mood: Mood, night: boolean, start: Spot = START): RegionSpec {
  resetSpan();
  const shifted = new Map<number, string>(); // occluder index → the map that made it
  let seen = 0;
  return {
    id: SPAN,
    title: 'The Span',
    sub: 'A town that stayed',
    mood,
    heightSeed: 41,
    start,
    apron: spanApron(),
    lights: 10,
    pieces: [
      { at: PLACE.ramp!, spec: ramp(night) },
      { at: PLACE['mar-farm']!, spec: marFarm(night) },
      { at: PLACE.plaza!, spec: plaza(night) },
      { at: PLACE.colonia!, spec: colonia(night) },
      { at: PLACE['lake-road']!, spec: lakeRoad(night) },
      { at: PLACE['white-bowl']!, spec: whiteBowl(night) },
    ],
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
    'mar-home': marHome({ to: SPAN, spawn: 'mar-farm:home', night }),
    chapel: chapel({ to: SPAN, spawn: 'plaza:chapel', night }),
    'fina-house': finaHouse({ to: SPAN, spawn: 'plaza:fina', night }),
    'kids-house': kidsHouse({ to: SPAN, spawn: 'plaza:kids', night }),
  };
}

/** Roads out of the Span's built maps that lead to maps not built yet: what the edge says when you reach it. */
export const UNBUILT: Record<string, string> = {
  'thirty-five': 'The Thirty-Five runs north from here, toward the Gate. The caravan isn’t ready to leave.',
  'east-loop': 'The east road runs on into the brush. Not tonight.',
  'old-trail': 'The lane goes on north into the brush, toward the Old Trail. Not tonight.',
  'dead-river': 'The road runs on south, down to the Dead River. Not tonight.',
};

export function useSpanApron(): void { setApronTexture(spanApron()); }
