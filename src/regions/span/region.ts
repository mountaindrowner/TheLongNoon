import { setApronTexture } from '../../engine/terrain';
import type { RegionSpec } from '../../engine/region';
import type { Mood } from '../../engine/mood';
import type { AreaBuilder } from '../../engine/area';
import { spanApron, occluders, resetSpan } from './props';
import { marFarm } from './mar-farm';
import { plaza } from './plaza';
import { ramp } from './ramp';
import { eastRoad } from './east-road';
import { whiteBowl } from './white-bowl';
import { marHome, chapel, finaHouse, kidsHouse } from './rooms';

/**
 * THE SPAN: the first region (methodology §2.3: "A town that stayed, and
 * can't keep everyone"). Five sections on a grid, walked between with no
 * cut (option C), each still its own map with its own hero, routine and
 * signature, so any of them can be split out later:
 *
 *              x: 0          1             2
 *   z: 0   [ The Ramp ]
 *      1   [ Mar Farm ] [ The Plaza ] [ The East Road ]
 *      2                              [ The White Bowl ]
 *
 * Mar Farm sits at the west end of the boulevard; the boulevard runs east
 * through the Plaza and out past the drain; the Ramp climbs north to the
 * Thirty-Five; the fork south runs down to the dry lake. The real ground
 * under it (methodology §3): north Laredo, the I-35 to the west and north,
 * the creek channel east of town, Lake Casa Blanca to the east, compressed
 * hard. Real names never show; the one Old Name is under the fallen sign.
 */

export const SPAN = 'span';
const CELL: [number, number] = [44, 32];

export function spanRegion(mood: Mood, night: boolean): RegionSpec {
  resetSpan();
  let seen = 0;
  return {
    id: SPAN,
    title: 'The Span',
    sub: 'A town that stayed',
    mood,
    cell: CELL,
    heightSeed: 41,
    start: { x: 21.5, z: 32 + 21, face: 'N' }, // Mar Farm's yard, by the lane
    apron: spanApron(),
    lights: 10,
    pieces: [
      { at: [0, 0], spec: ramp(night) },
      { at: [0, 1], spec: marFarm(night) },
      { at: [1, 1], spec: plaza(night) },
      { at: [2, 1], spec: eastRoad(night) },
      { at: [2, 2], spec: whiteBowl() },
    ],
    afterPiece(p) {
      // the Span's fading overhead props were registered in section space; move them into region space
      for (; seen < occluders.length; seen++) {
        const r = occluders[seen]!.rect;
        r[0] += p.ox; r[2] += p.ox; r[1] += p.oz; r[3] += p.oz;
      }
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

/** Roads out of the Span that lead to pieces not built yet: what the edge says when you reach it. */
export const UNBUILT: Record<string, string> = {
  'thirty-five': 'The Thirty-Five runs north from here, toward the Gate. The caravan isn’t ready to leave.',
  'east-loop': 'The east road runs on into the brush. Not tonight.',
};

export function useSpanApron(): void { setApronTexture(spanApron()); }
