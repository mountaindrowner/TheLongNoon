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

## Where this departs from the spec, on purpose

| Spec says | The Long Noon does | Why |
|---|---|---|
| One fixed mood per scene, no clock (§5) | A state per phase: Night (the default, designed first), Lamp and Shutter (gray hours), White (day, rare and lethal) | Settled by `docs/design/world-methodology.md` §5.3: night is the living time and daylight is its own state of the same map. The clock that moves between them is still to build. |
| Prairie ground, lush green as the norm | Desert ground (caliche, sand, old asphalt); green only where water has been | The Span is a desert. The spec's mood line still holds: bleak, with bright life where it's tended. |
| 64px, 8-direction PixelLab sprites (§13) | The proof of concept's 16×24, 4-direction sprites, sized by measurement to 1.65 units | Generating new sprites needs a PixelLab API key and its per-figure cost. The engine's `RotHero` already plays 8-direction sprites when they exist. |
| Fixed-angle outdoor maps (no occlusion rule) | Overhead props fade when the player is behind them | Shade sails and the tank would otherwise hide Juno. |
| Every exit lands on its target (§9.4, §20 #12) | Unbuilt targets turn you back with a note | The roads out of the Span (north up the Thirty-Five, east into the brush) lead to regions not built yet. |
| One map per scene, exits between maps (§9) | A region is several sections walked between with no cut | The owner chose option C (methodology §2.4): open regions joined by caravan legs. Each section is still a full spec map and could be split out. |
| No old-world names (§1) | Built on the real Laredo and I-35. Places carry survivors' names; real names appear only as Old Name hints where the sun never reached | Settled by the methodology §0 and §3. **Open:** MAR on the store roof is painted, but paint doesn't survive the sun (§3.3). Proposal: rebuild it as steel letters with the rest of the name fallen away. |

## The world methodology (2026-10-26)

`docs/design/world-methodology.md` is the owner's layout method for regions, maps and roads. It sits above the style
spec: the spec says how a map looks, and the methodology says what maps exist and how they connect. Where they
disagree, the methodology wins for The Long Noon. Open questions for the owner are in its §11. The one that shapes
the engine most is the world model (§2.4): option C, open streamed regions joined by caravan legs, means building a
region as many sections streamed side by side. The ported engine already has the hooks for that (`world.ts`
chunks, `terrain.ts` `setAprons`). The owner chose C on 2026-10-26; the Span (piece 2) is built that way.

## Next pieces (proposed order)

1. **Clock and moods.** Time moves; light blends Lamp → Night → Shutter → White;
   the HUD clock is live; shelter and water rules apply.
2. **Out of the Span:** the first caravan leg up the Thirty-Five, or the east loop and the drain under the road.
3. **Story runtime:** the legacy dialogue and quest data (`legacy/poc2/src/data`)
   brought across: conditional dialogue, quest steps, the staybook.
4. **Saves:** versioned from the start, with export and import.
5. **Battle stage** in the spec's language (§14): local ground for panels, not a grid.
6. **Sprites:** the cast regenerated in the spec's locked style once a PixelLab
   key is available.
7. **Sound:** the legacy synthesized effects and the three music tracks.
