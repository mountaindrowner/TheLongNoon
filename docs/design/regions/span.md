# The Span (region 1)

The first region: the town the game starts in, and the first stretch of road
before the highway.
- **First built:** 2026-10-26, as the first test of the world methodology.
- **Rebuilt the same day at the owner's scale.** The first version was five
  maps of 44 × 32; the owner judged that too small.
- **Real place:** north Laredo (the Del Mar boulevard, Lake Casa Blanca, the
  I-35 on-ramp) under survivor names.

Everything here follows `docs/design/world-methodology.md` and the style spec.
Items marked **[ASK]** are my guesses and need the owner's sign-off.

## Scale (owner, 2026-10-26)

| Size | Units | In the Span |
|---|---|---|
| **Large** | 132 × 96, or 96 × 132 stood on end | Mar Farm, the Plaza, the Colonia, the White Bowl; the Lake Road stood on end |
| **Medium** | half to two thirds of large (about 88 × 64) | the Ramp |
| **Small** | a room, or one or two 44 × 32 squares | side spots to come |
| **The town** | twice a large map: two of them side by side, open between | the Plaza and the Colonia, 264 × 96 |

A large map is 43 s to walk across, 26 s running. The whole region is
492 × 292 units.

## Layout

```
  x:   0          88  132         264         396   492
  z:0  ┌────────┐
       │  RAMP  │ M                                    north: the Thirty-Five (next region)
  z:64 ├────────┴──┬───────────┬───────────┬──────┐
       │ MAR FARM  │ THE PLAZA │THE COLONIA│ LAKE │  east: the brush (not built)
       │    L      │  L (town) │  L (town) │ ROAD │
 z:160 └───────────┴───────────┴───────────┤ L,   │
                                      ┌────┴portr.┤ z:196
                                      │ WHITE BOWL│
                                      │     L     │
                                      └───────────┘ z:292
```

- **The boulevard** runs from the store at Mar Farm east through the Plaza and
  the Colonia to the fork on the Lake Road. From the fork it goes on east into
  the brush, which is not built.
- **The Lake Road** turns south at the fork, with the drain running beside it,
  down to the dry lake southeast of town.
- **The Ramp** climbs north from the farm to the Thirty-Five.
- **From the Plaza,** a lane runs north into the brush toward the Old Trail.
  Tavo says it's north. A road also runs south to the Dead River. Neither is
  built yet.

The region from straight above, as built (regenerate with
`npm run build && node tools/overview.mjs`):

![The Span from above](overview/span-day.webp)

## How it's built

- **A web of maps on one ground** (methodology §2.4, option C). Maps can be
  any size and sit anywhere.
  - **Between them:** thorn brush you can't walk.
  - **Where they meet:** a road runs through a gap in the brush, and you walk
    straight on with no cut.
  - **The town's halves** share a whole side, open its whole length.
- **Streaming:** only the maps near you exist.
  - A map is built when you come within 26 units of it, its work spread over
    a few frames, and taken down past 44.
  - People, animals, lamps and fading props come and go with their map.
- **Plants:** the Span's own brush kit (`brush.ts`): thorny mesquite and
  huisache, silver cenizo, yucca, tasajillo, dead mesquite, and bramble
  thickets. Maps are framed in walls of bramble (edge style `brush`). Every
  static plant is merged per map, so a map's brush draws in a few calls.
- **Homes:** the ruins kit (`ruins.ts`).
  - Houses patched from block, tin, plywood and stucco, with tarps on the
    roofs held down by tires and lean-to porches.
  - Shipping containers lived in.
  - Yards closed with salvage fences of tin, pallets, car hoods and old doors.
  - Yard tanks, fire rings, ruin walls and rubble.
- **Lights:** many lamps, few lights. Ten real lights follow the camera.
- **Rooms:** separate small scenes behind lit doors, entered with a pixel
  dissolve. You come back out onto the step you went in from.

## Maps

| Map | Size, kind | Hero | Routine | Signature |
|---|---|---|---|---|
| **The Ramp** | medium; road leg, ruined | Where the highway stops: the four-lane embankment sheared, the slab tipped into the dirt | The checkpoint gantry over the ramp, still sweeping, its lamp saying STOP | The green sign face-down. Underneath, out of the sun, it kept its letters: the region's **one Old Name** |
| **Mar Farm** | large; hold, lived-in | The water tower | The windmill pump filling the trough | The old store with MAR on the roof; its door lit by a caged bulb |
| **The Plaza** | large (town, west); hold, cluttered market, lived-in edges | The seven flags | The Lawnkeeper mowing the dust of a square it remembers | The night market: twelve stalls under strung bulbs |
| **The Colonia** | large (town, east); hold, lived-in | The mast: a radio mast with its dishes gone, a lantern on top somebody climbs up to light every night (the Vigil) | A wind turbine made from a car's fan on a pole | The salvage walls closing every yard |
| **The Lake Road** | large, stood on end; road leg, ruined | The billboard, peeled to nothing | The traffic light cycling for nobody | The drain: under the boulevard at black culverts, then south beside the road all the way to the lake |
| **The White Bowl** | large; landmark, ruined, empty on purpose | The intake tower, the old waterline banded on it | A buoy on its side, still blinking for boats | The white crust, nearly the whole map wide |

**What else is in each:**
- **Mar Farm:**
  - Around the store: the family yard, the goat pen, and the garden. Green
    grows only where water spills.
  - The burial platform with Hermana Lupe.
  - Three neighbours' houses south of the boulevard.
  - The old fields gone to stubble, and a dry wash across the north.
- **The Plaza:**
  - The chapel at the head of the square, with houses round it.
  - South of the road, the long kitchen: tables under a tin roof, enough
    benches for everybody if everybody squeezes.
- **The Colonia:** about twenty lots off crooked lanes. A few are ruins left
  by the people who went. One old warehouse wall is picked to the bones.
- **The Lake Road:**
  - The fork at the boulevard, and Memo at the bus shelter.
  - The salvage yard, where the town's fences come from.
  - A ruined motor court, and the six-wheeled tracks coming up out of the drain.
- **The White Bowl:**
  - The boat ramps, the shore lot and the picnic ground.
  - The dam along the west side, and dead trees on the old shore.
  - The drain spilling onto the bed, and the big tread tracks crossing it.

## The door language as built

Every door you can open shows a light. A door with no light is not a way in.
The playtests build every map and every room and assert this (`checkDoors`).

| Light | Means | Where |
|---|---|---|
| **Caged bulb** over the door (old tech, on the panels) | Home. Come in. | The Mar store |
| **Lantern** hung at the door, the door ajar | Open to anyone | The chapel |
| **Light under the door** | Someone's up; knock | Doña Fina's |
| **Lit window** beside the door | Someone's home | Tavo and Nina's |
| Shut, no light | Out, or asleep | Most houses in the Plaza and every house in the Colonia; the restroom at the Ramp |
| Boarded | Nobody, not for a long time | A shed at the farm; several houses |
| Dark mouth, dead bulb | A way in that needs your own light | The culverts under the boulevard (the drains, a dungeon to come) |

## Rooms

| Room | Behind | Who's there |
|---|---|---|
| **Mar Farm** (inside the store) | The caged-bulb door | Nobody yet. Curtained corners, one bed made that nobody sleeps in, the staybook open on the table. |
| **The Chapel** | The lantern door | Abuela Toña |
| **Doña Fina's** | The light under the door | Doña Fina |
| **Tavo and Nina's** | The lit window | Nobody yet; the kids are out on the Plaza |

## People placed (lines from `legacy/poc2`)

| Map | People |
|---|---|
| Mar Farm | Hermana Lupe; goats, chickens |
| The Plaza | Chayo and Beto at their stalls, Rubén and Kit by the flags, Tavo and Nina at the well, Nacho on his bench; chickens |
| The Colonia | Chickens in the yards (see the open question on people) |
| The Lake Road | Memo |
| Inside | Abuela Toña (the Chapel), Doña Fina (her house) |

## Ways out of the region (not built yet)

Walking to these edges turns you back with a line instead of breaking the game.

- **North up the Thirty-Five,** from the Ramp, toward the Gate.
- **East on the boulevard,** past the fork on the Lake Road.
- **North from the Plaza** toward the Old Trail.
- **South from the Plaza** to the Dead River.

## Open for the owner

1. **[ASK] Names.** I named the new maps the Colonia (the east half of town,
   after the South Texas word for settlements like it) and the Lake Road.
   Correct anything that doesn't sound like a tired local.
2. **[ASK] Things I added that aren't in the story files.** Each is a hook for
   later; keep or cut each:
   - the Lawnkeeper;
   - the checkpoint gantry;
   - the six-wheeled and big tread tracks;
   - the mast with its lantern;
   - the turbine;
   - the long kitchen;
   - the salvage yard.
3. **[ASK] People.** The town is laid out for 50 to 60 people (about 35 homes),
   but the sprite sheet has 15 faces, all already placed. More people need new
   sprites; the PixelLab key is still open from the rebuild plan. Until then,
   the town's life shows in its yards: laundry, fires, tanks, chickens,
   lanterns.
4. **[ASK] MAR on the roof.** Paint wouldn't survive the sun (methodology
   §3.3). My proposal: steel letters, with the rest of the name fallen away.
5. **[ASK] Rooms with nobody home.** The Mar store and Tavo and Nina's.
6. **Streaming hitches.** A large map takes a few frames to build as you
   approach it. That needs measuring on a real phone.
