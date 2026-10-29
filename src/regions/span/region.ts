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
import { marHome, chapel, finaHouse, kidsHouse, churchHall, mallCourt, mallShop } from './rooms';
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

/** Each map's place in the region (its top-left corner, world units). */
export const PLACE: Record<string, [number, number]> = {
  ramp: [40, 0],
  'seven-flags': [0, 64],
  'lake-road': [192, 128],
  'white-bowl': [156, 260],
  trail: [192, 48],
  church: [208, -48],
  mall: [-40, 224],
};
/** Where a new game starts: the lot in front of Mar Farm, by the platform where Papá lies. */
export const START: Spot = { x: 137, z: 64 + 122.5, face: 'N' };

export function spanRegion(mood: Mood, night: boolean, start: Spot = START): RegionSpec {
  resetSpan();
  const shifted = new Map<number, string>(); // occluder index → the map that made it
  let seen = 0;
  return {
    id: SPAN,
    title: 'Seven Flags',
    sub: 'A town that stayed',
    mood,
    heightSeed: 41,
    start,
    apron: spanApron(),
    lights: 10,
    pieces: [
      { at: PLACE.ramp!, spec: ramp(night) },
      { at: PLACE['seven-flags']!, spec: sevenFlagsTown(night) },
      { at: PLACE['lake-road']!, spec: lakeRoad(night) },
      { at: PLACE['white-bowl']!, spec: whiteBowl(night) },
      { at: PLACE.trail!, spec: trailNorth(night) },
      { at: PLACE.church!, spec: churchOnTheHill(night) },
      { at: PLACE.mall!, spec: abandonedMall(night) },
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
    'mar-home': marHome({ to: SPAN, spawn: 'seven-flags:home', night }),
    chapel: chapel({ to: SPAN, spawn: 'seven-flags:chapel', night }),
    'fina-house': finaHouse({ to: SPAN, spawn: 'seven-flags:fina', night }),
    'kids-house': kidsHouse({ to: SPAN, spawn: 'seven-flags:kids', night }),
    'church-hall': churchHall({ to: SPAN, spawn: 'church:door', night }),
    'mall-court': mallCourt({ to: SPAN, spawn: 'mall:court', night }),
    'mall-shop': mallShop({ to: 'mall-court', spawn: 'grille', night }),
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
