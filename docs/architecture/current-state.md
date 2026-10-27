# Current state: the rebuild

Updated 2026-10-26. The game is being rebuilt from the ground up on the world
style spec (`docs/style/world-style-spec.md`), one playable, screenshot-checked
piece at a time. The proof of concept it replaces is in `legacy/poc2/` (its
audit is `legacy/poc2/AUDIT.md`).

## Stack

Vite 6 + TypeScript 5.9 (strict) + three.js r170, as the spec's reference
source requires. `npm run build` makes one self-contained `dist/index.html`
(about 0.8 MB) that runs offline. When the game outgrows one file, drop
`vite-plugin-singlefile` for a normal site build; nothing else changes.

## Piece 1 (done): the engine and Mar Farm

- **Engine (`src/engine/`):** the spec's appendix, ported. The files that are
  ported verbatim, with import paths changed: noise, geo, textures, post, mood,
  world, terrain, section, interior, doorway, kit, plus the generic parts of
  foliage, props and sprites.
  - **Removed:** OHMFRONT's own maps, its one-off scenes at fixed coordinates,
    and its lore threads (Garrison stencil, Redbed hand, brass tag, husk).
  - **Written new**, because the appendix uses them without listing them:
    `area.ts` (map types), `buildings.ts` (shared materials `M`, `vines`,
    `windowAt`, and a general `building()` recipe), `fence.ts`, and
    `layout.ts` (`maskAt`).
  - **Completed:** two files the spec cuts short. `ui.ts` stops at `say()`, so
    dialogue and touch controls were written here; `kit.ts` stops inside
    `pendant`.
- **The Span (`src/regions/span/`):**
  - **Moods:** LAMP (evening, warm, long shadows), NIGHT (spec), and WHITE
    (day: bleached, sun overhead, short shadows).
  - **Prop kit:**
    - Plants: fan palm, nopal.
    - Water and machines: water tower, windmill pump.
    - Lighting and power: lantern post, solar panels.
    - Yard life: clothesline, shade sail, water jugs, drum, tires, plastic
      chairs round a spool.
    - Wrecks and markers: car hulk, burial platform, roof letters,
      whitewashed tire kerb, mailbox, cow skull.
    - Surfaces: desert scatter (pebbles, dry tufts), a concrete-block wall
      texture, the desert apron.
  - **Mar Farm (44×32, tier lived_in):**
    - Hero: the water tower.
    - Routine: the windmill pump filling the trough.
    - Signature: the store with MAR on the roof and the lit door.
    - Also: the goat pen, the watered garden, the burial platform with
      Hermana Lupe, and a lantern-lit lane home.
    - Four edge styles, two exits.
- **Runtime (`src/main.ts`):**
  - Camera (spec §3): fixed angle, follows Juno, clamped to the map.
  - Movement: walk 3.1, run 5.0 (Shift, or the stick pushed fully).
  - Light and post: mood lighting with a texel-snapped shadow that follows
    Juno; the tilt-shift band tracks her height on screen.
  - Interaction: talk and inspect.
  - Exits: walking off an exit dissolves the screen. Unbuilt roads turn you
    back with a note.
  - Occluders: overhead things (the sails, the tank) fade when Juno walks
    behind them.
- **Checks:**
  - `npm test` builds both games and playtests Mar Farm at desktop 1080p and
    phone landscape: it builds in all three moods, the door-promise check is
    clean, walking and collision work, Lupe's dialogue works, and an unbuilt
    exit turns you back.
  - Screenshots were reviewed against spec §20 at 1280×720 and 844×340.

## Piece 2 (done): the Span as one region, with rooms

The whole of the region's design is in `docs/design/regions/span.md`. In short:

- **The engine walks a region, not a map** (`src/engine/region.ts`; methodology
  §2.4, option C):
  - **Layout:** sections of 44×32 sit on a grid, each built in its own chunk at
    its offset.
  - **Seams:** ground glyphs read across them (`outside`), and the terrain
    noise uses region coordinates (`origin`, `heightSeed`), so roads and land
    carry across with no cut. A seam side has no edge dressing and stays
    walkable.
  - **Lights:** every built point light goes into one shared pool of ten that
    follows the camera.
  - **Doors:** the door check runs per section.
- **Five sections:** Mar Farm (moved to cell 0,1), the Ramp, the Plaza, the
  East Road and the White Bowl. Each has its hero, routine and signature.
- **Four rooms** behind lit doors: the Mar store, the Chapel, Doña Fina's, and
  Tavo and Nina's.
  - **Getting in and out:** you enter through a pixel dissolve and come back
    out onto the step you went in from.
  - **The door's light says what it is:** a caged bulb, a hung lantern, light
    under the door, or a lit window. Doors you can't use are shut, boarded or
    dark.
- **Night is the default** (`?time=` still picks a light). The Span's night
  has a stronger moon than the engine's, so empty roads read in blue.
- **Checks:**
  - `npm test` builds the Span in all three moods. It checks every door
    promise in every section and room, where each section sits, the walk
    across the farm–Plaza seam, collision, going into the Chapel and back out,
    Lupe's dialogue, and the unbuilt east road turning you back.
  - Screenshots were reviewed at 1280×720 and 844×340, by night and by day.
- **Known gaps:**
  - The region builds all five sections at load (about 2 s on a laptop); real
    streaming waits until regions are bigger.
  - Two rooms have nobody in them yet.
  - The Bowl's crust is near-white by day on purpose, and still needs a
    phone check outdoors.

## Piece 3 (done): the clock

- **The clock** (`src/game/clock.ts`) follows the proof of concept's rules:
  - The phases: Lamp from 6:30 pm, the long night from 8, Shutter from 4:30 am, the white from 6.
  - One game minute per real second.
  - It stops while people talk or the screen changes.
  - It starts at 7:20 pm, as the story does.
- **The light follows it.** The engine got `mixMood` and `moodAt` (a day as
  keyframes) and `Lights.set`, so a scene can be re-lit live. The Span's
  keyframes (`SKY` in `regions/span/moods.ts`):
  - Lamp, then the long night, then Shutter (a new gray mood);
  - then morning, the white, the afternoon, and back to Lamp.

  Sprites take the tint of the moment. Rooms keep their own lamps.
- **Two moments change the town itself.** At Lamp the lanterns are lit, and at
  6 am they're out, with doors and windows to match. The region is rebuilt in
  the other state behind a dissolve, with a tag: "Lamp: the first lanterns are
  lit" or "The white: shutters down". If you're indoors, nothing shows, and the
  town is rebuilt when you step out.
- **URL controls:** `?clock=HH:MM` starts the clock elsewhere.
  `?time=lamp|night|shutter|white|day` holds one light still (screenshots,
  playtests).
- **Not built (held for the owner):** what daylight costs. The legacy rule
  (water burns in the white, faint at zero) and the owner's newer idea (shade
  as cover) are both in `docs/design/held-ideas.md`.
- **Open:** people are out on the Plaza by day as well as by night. The
  methodology's §5.3 proposal ("shutters down, nobody out") would move them
  indoors by day; that waits on the owner.
- **Fixed on the way:** collision in a room you've visited before read the
  wrong collision data, so you could walk through its furniture. Rooms now
  keep their own.

## Piece 4 (done): the Span at the owner's scale

The owner judged the first Span too small (2026-10-26). Their scale: a large
map is the size the whole first region was (132 × 96), a medium is half to two
thirds of that, the town is twice a large map, and the dry lake is a full
large map, reached down a long road map stood on end. The look is South Texas:
brush and bramble, harsh grey-green, no lush trees outdoors, and a village
pieced together from ruins. `docs/design/regions/span.md` has the whole layout.

- **Region engine v2** (`src/engine/region.ts`):
  - **Layout:** maps of any size at any place, joined where a road runs
    through a gap in the brush (an exit whose target is another map in the
    region is a seam: no trigger, no cut).
  - **Between maps:** a tileable brush apron fills the gaps.
  - **Streaming:** maps are built within 26 units and dropped past 44. Builds
    are paced over frames, and the section kit puts its own ground and solids
    back after every pause.
  - **What streams with a map:** people, animals, lamps, swaying plants and
    fading props.
  - **For checks:** `hold` plus `buildAll` builds everything at once (the
    door checks, the overview). `settle` and `prepare` make sure a spawn's map
    exists before you land in it.
- **Batching** (`src/engine/batch.ts`): static scenery marked `batch()` is
  merged per material when a map finishes. Thousands of brush clumps draw in a
  handful of calls.
- **Section kit:**
  - edge style `brush` (walls of bramble);
  - a region's own `flora` for the edges;
  - `seam` exits;
  - paced builds.
- **The Span's kits:**
  - `brush.ts`: mesquite, huisache, cenizo, thicket, yucca, tasajillo, dead
    mesquite, and scatter.
  - `ruins.ts`: patched houses, container homes, salvage fences, yard tanks,
    fire rings, rubble, ruin walls.
  - `fill.ts`: brush mottes and open-ground scatter.
  - Dry asphalt paint, no weeds.
- **Six maps:**
  - the Ramp (medium);
  - Mar Farm, the Plaza, the Colonia (large);
  - the Lake Road (large, on end);
  - the White Bowl (large).

  The East Road map is gone. Its fork, culverts, billboard and Memo are now on
  the Lake Road.
- **Measured headless:**
  - A large map builds in about 2.5 s unpaced, and about 10 s paced (wall
    clock at one or two software-rendered frames a second).
  - Memory peaked at 550 MB walking every map.
  - Real-device hitches still need measuring on a phone.

## Piece 5 (done): Seven Flags, from the owner's map of the town

The owner sent their own top-down map of the town ("SEVEN FLAGS: the
playable town", 192 × 160, built from the real streets of north Laredo) and
asked for the Span to follow it: less linear, more like the real place. The
town is now one map (`src/regions/span/seven-flags.ts`), with the owner's
layout, story places and people. Mar Farm, the Plaza and the Colonia maps are
gone; their contents are in the town. The Ramp now carries the Thirty-Five
north at grade, and the Lake Road joins at Memo's barricade on Del Mar.
`docs/design/regions/span.md` has the details.

- **Engine:**
  - **Ground in tiles:** a map's ground is painted in tiles of at most 64
    units (1024 px textures), so big maps stay within what phones hold. Big
    maps also use half the ground-mesh density.
  - **Turned buildings:** a building can turn to sit square to its street
    (`rot`); door marks and collision follow (`onBuilding`, `footprint`).
  - **Grid:** grid rectangles take fractional corners.
- **Streets on their true lines:** the town paints its streets from their
  centre lines, so diagonals have clean edges. A per-cell list of nearby
  streets keeps the cost down.
- **Checks:** the playtests cover every map's position, walking out of town
  onto the Lake Road, Mar Farm's wall, the chapel in and out, Lupe, the
  unbuilt east road, and the clock. They pass at 1080p.

## Piece 6 (done): the story, as the first version told it

The owner asked (2026-10-27) to build the game out the way the first version
did it, cinematic and all, with a mini map, and pointed out that Papá is dead
by the time the game starts. `docs/design/legacy-breakdown.md` breaks the
first version down beat by beat and rule by rule; this piece ports all of it.

- **Papá** is no longer standing in the lot. He's on the burial platform, and
  he appears only in the old tale.
- **The mini map** (`engine/minimap.ts`) sits top right, north up. M or a tap
  switches between close (about two screens) and far (most of the region).
  - It paints every map's ground with that map's own painter, so streets
    run on their true lines.
  - Buildings and walls are drawn in as each map is built.
  - It shows people, lit doors, Juno's facing and the goal; the goal is
    pinned to the edge when it's out of range.
  - Inside a room it shows where you went in, dimmed.
- **The story runtime** (`src/game/`):
  - `script.ts` runs the first version's `dialogue.json` as written: lines,
    conditions, commands and choices.
  - `hud.ts` holds the status panel (clock, ten drops, tins of white), the
    objective and its marker, toasts, the staybook, and the title, pause
    and end menus.
  - `tale.ts` is the tale's painted panels, ported drawing for drawing.
  - `battle.ts` is the fight, rule for rule.
  - `sound.ts` has every synthesized effect and voice, plus the three
    tracks.
  - `state.ts` is the save (`longnoon.save`, v 1).
- **The mission, "Lamp", on Seven Flags:**
  - title, then the tale by a fire in Mar Farm's lot, then "Many years
    later";
  - the burial (Lupe, the staybook, page 1);
  - the goats and the tank (milk, water, page 3);
  - Chayo at the Plaza (white, page 2);
  - Kit by the flags (Pancha got out);
  - the drain (the Stray and the coyote, page 5, the fight; Kit joins and
    Pancha follows);
  - home before Shutter: the doors seal, the drone crosses the white sky,
    the last page, the end card;
  - free roam.
- **The first version's rules:**
  - daylight away from a roof costs a drop of water every 3.5 s;
  - at none you faint and wake at Mar Farm the next Lamp;
  - thirst takes a drop every 150 s;
  - a Shutter warning;
  - rest and save at the cot inside Mar Farm;
  - saves at every new step.
- **Playtests:** `tests/story.spec.js` plays the title and tale, the home
  chores, the drain fight and the ending. `?step=<step>` starts at a mission
  step with what the steps before it would have given.

## Where this departs from the spec, on purpose

| Spec says | The Long Noon does | Why |
|---|---|---|
| One fixed mood per scene, no clock (§5) | A clock moves the light through Lamp, the long night, Shutter and the white. The town is built twice (lanterns lit, lanterns out). | Settled by `docs/design/world-methodology.md` §5.3: night is the living time and daylight is its own state of the same map. The clock is the legacy game's own rhythm. |
| Prairie ground, lush green as the norm | Desert ground (caliche, sand, old asphalt); green only where water has been | The Span is a desert. The spec's mood line still holds: bleak, with bright life where it's tended. |
| 64px, 8-direction PixelLab sprites (§13), every figure styled on the protagonist | 64px PixelLab figures in the spec's style, styled on Juno (`docs/design/cast.md`). The game plays four directions; animations are made in four (the owner, 2026-10-27). | Juno is the anchor in place of the spec's style character, so the cast is The Long Noon's own; the owner locked the look on 2026-10-27. Anyone not remade yet still uses the old 16×24 sprites. |
| Fixed-angle outdoor maps (no occlusion rule) | Overhead props fade when the player is behind them | Shade sails and the tank would otherwise hide Juno. |
| Every exit lands on its target (§9.4, §20 #12) | Unbuilt targets turn you back with a note | The roads out of the Span (north up the Thirty-Five, east into the brush) lead to regions not built yet. |
| One map per scene, exits between maps (§9) | A region is a web of maps on one ground, walked between with no cut, brush between them | The owner chose option C (methodology §2.4): open regions joined by caravan legs. Each map is still a full spec map and could be split out. |
| Section sizes 40×30 to 58×28 (§9.2) | Large maps are 132×96; the town is two of them | The owner's scale (2026-10-26): the first Span's maps felt too small. |
| Edge trees: cottonwood, mesquite, dead tree (§9.3) | Walls of bramble with mesquite standing out of them; no lush trees outdoors | South Texas brush country (owner, 2026-10-26). |
| A battle stage of its own (§14) | The fight happens where it starts, in the drain, framed by one of six stagings (`STAGINGS` in `main.ts`, `?battle=` or `#fight-<name>`): in place, diorama, over the shoulder, hero shot, face-off, diorama with cuts. Default: in place. | The owner asked to try orientations (2026-10-27). The rules stay the first version's; only the framing changes. **Open:** the owner picks a staging, or a mix. |
| The camera never rotates (§3) | In the ending, the camera tilts up to the sky while the drone crosses | It's a cutscene, as in the first version: "Look up." Play never tilts. |
| (no mini map in the spec) | A mini map, top right | Asked for by the owner, 2026-10-27. |
| Rest at the door (first version) | Rest at the cot inside Mar Farm | The rebuild's Mar Farm has a room behind the door; the door now goes in. |
| No old-world names (§1) | Built on the real Laredo and I-35. Places carry survivors' names; real names appear only as Old Name hints where the sun never reached | Settled by the methodology §0 and §3. **Open:** MAR on the store roof is painted, but paint doesn't survive the sun (§3.3). Proposal: rebuild it as steel letters with the rest of the name fallen away. |

## The world methodology (2026-10-26)

`docs/design/world-methodology.md` is the owner's layout method for regions, maps and roads. It sits above the style
spec: the spec says how a map looks, and the methodology says what maps exist and how they connect. Where they
disagree, the methodology wins for The Long Noon. Open questions for the owner are in its §11. The one that shapes
the engine most is the world model (§2.4): option C, open streamed regions joined by caravan legs, means building a
region as many sections streamed side by side. The ported engine already has the hooks for that (`world.ts`
chunks, `terrain.ts` `setAprons`). The owner chose C on 2026-10-26; the Span (piece 2) is built that way.

## Next pieces (proposed order)

1. **The owner plays the first mission** on a phone and says what's off:
   pacing, the drain, the ending, the sound levels.
2. **What daylight costs**, once the owner decides (`docs/design/held-ideas.md`).
   Until then the first version's rule holds: water burns away from a roof.
3. **The newer story** (the Complete Story File) and the people with no lines
   yet: Lourdes, Inés, Rafa, Goyo, Güero, Mari, Chuy, Don Pepe.
4. **Out of the Span:** the first caravan leg up the Thirty-Five, or the east
   road to the White Bowl, where the drone went.
5. **Sprites:** the cast regenerated in the spec's locked style once a PixelLab
   key is available.
6. **Saves:** export and import.
