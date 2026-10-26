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

## Where this departs from the spec, on purpose

| Spec says | The Long Noon does | Why |
|---|---|---|
| One fixed mood per scene, no clock (§5) | A state per phase: Night (the default, designed first), Lamp and Shutter (gray hours), White (day, rare and lethal) | Settled by `docs/design/world-methodology.md` §5.3: night is the living time and daylight is its own state of the same map. The clock that moves between them is still to build. |
| Prairie ground, lush green as the norm | Desert ground (caliche, sand, old asphalt); green only where water has been | The Span is a desert. The spec's mood line still holds: bleak, with bright life where it's tended. |
| 64px, 8-direction PixelLab sprites (§13) | The proof of concept's 16×24, 4-direction sprites, sized by measurement to 1.65 units | Generating new sprites needs a PixelLab API key and its per-figure cost. The engine's `RotHero` already plays 8-direction sprites when they exist. |
| Fixed-angle outdoor maps (no occlusion rule) | Overhead props fade when the player is behind them | Shade sails and the tank would otherwise hide Juno. |
| Every exit lands on its target (§9.4, §20 #12) | Unbuilt targets turn you back with a note | Only one map exists so far. |
| No old-world names (§1) | Built on the real Laredo and I-35. Places carry survivors' names; real names appear only as Old Name hints where the sun never reached | Settled by the methodology §0 and §3. **Open:** MAR on the store roof is painted, but paint doesn't survive the sun (§3.3). Proposal: rebuild it as steel letters with the rest of the name fallen away. |

## The world methodology (2026-10-26)

`docs/design/world-methodology.md` is the owner's layout method for regions, maps and roads. It sits above the style
spec: the spec says how a map looks, and the methodology says what maps exist and how they connect. Where they
disagree, the methodology wins for The Long Noon. Open questions for the owner are in its §11. The one that shapes
the engine most is the world model (§2.4): option C, open streamed regions joined by caravan legs, means building a
region as many sections streamed side by side. The ported engine already has the hooks for that (`world.ts`
chunks, `terrain.ts` `setAprons`), but streaming isn't written yet. Mar Farm is built today as a standalone section.

## Next pieces (proposed order)

1. **Clock and moods.** Time moves; light blends Lamp → Night → Shutter → White;
   the HUD clock is live; shelter and water rules apply.
2. **The second map:** the road out (`long-road`) or the night market
   (`del-mar-park`), with real exits between them.
3. **Story runtime:** the legacy dialogue and quest data (`legacy/poc2/src/data`)
   brought across: conditional dialogue, quest steps, the staybook.
4. **Saves:** versioned from the start, with export and import.
5. **Battle stage** in the spec's language (§14): local ground for panels, not a grid.
6. **Sprites:** the cast regenerated in the spec's locked style once a PixelLab
   key is available.
7. **Sound:** the legacy synthesized effects and the three music tracks.
