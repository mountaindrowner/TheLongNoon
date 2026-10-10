# Current state of The Long Noon (Phase 0 audit)

Audited 2026-10-10 against `src/` as unpacked from `The-Long-Noon-offline_2.html`.
This describes the game **as it is**, not as the research brief proposes. Section
numbers like §5.4 refer to [`docs/research/engineering-brief.md`](../research/engineering-brief.md).

## How the game is built today

- **Source of truth until now:** a single HTML file edited in Claude chat sessions.
  From here on, `src/` is the source and the HTML file is a build output:
  `tools/unpack.py` splits an HTML build into `src/`, and `tools/build.py` reverses it
  **byte for byte** (verified with `cmp`).
- **No package manager, no dependencies, no module system.** three.js r128 is loaded as a
  global script (`src/vendor/three.min.js`). Python 3 is the only build tool.
- **Game code:** one 117 KB IIFE (immediately invoked function) split into 25 files
  `src/js/00-…24-*.js` at its own section banners. These files share closure variables
  and only work when concatenated in `src/js/ORDER`.
- **Content:** six JSON blobs, unpacked to `src/data/*.json`, read at boot from
  `<script type="application/json">` tags.
- **Assets:** five hand-packed PNG atlases, with frame coordinates stored in
  `data/manifest.json`. Four woff2 fonts. Three MP3 tracks make up **9.1 MB of the
  10.1 MB file**. All sound effects are synthesized in `22-audio.js`.
- **Debug:** loading the page with `#debug` shows text instantly and exposes `window.__LN`
  (`tp`, `setStep`, `setClock`, `runScript`, `save`, `loadGame`, live state).

## Systems, and how close they already are to the brief

| System | What exists | Brief's recommendation | Gap |
|---|---|---|---|
| Rendering (`01–04`, `06`, `09`) | HD-2D sprites in three.js, 3 quality tiers, tilt-shift, bloom, grade, shadows, day/night presets | Keep three.js (§2.2) | None; protect it |
| World (`06`) | One 128×64 map, 32×32 chunks streamed by distance, static meshes merged per chunk, procedural outer ring | Regions loaded on demand (§5.1–5.3) | Only one map; no transitions or interiors |
| Events (`12` `doCmd`) | 22 commands: `wait item take white water page step flag sfx checkHome hint choice rest ending cam spawnEnemies battle join salvage lookUp tale waitDrone` | Small command vocabulary, FFVI-style (§3.6, §5.5) | **Already this model.** Some commands are mission-specific (`checkHome`, `salvage`, `lookUp`, `waitDrone`) |
| Dialogue selection (`12` `resolveDlg`) | Per NPC/object: a list of lines, or an object keyed by conditions like `home&!fed`, with `*` as fallback | State-driven candidates, Stardew-style (§3.7) | **Already this model.** Conditions are untyped strings and nothing validates them |
| Quests (`14`, `quests.json`) | One mission, 7 linear steps (`burial → home → market → kit → pancha → home2 → free`), each with an objective and a marker | Declarative quests (§5.7) | No multiple or side quests; no reward transactions |
| Battle (`17`, `08`, `battles.json`) | Charge-time initiative, part targeting (soft and armor), eye break stuns, timed-ring parry (window 78–122% of 900 ms, 1200 ms the first time), brace, drink water, flee threshold, pipe durability, separate arena scene | Preserve, then split rules from presentation (§5.8) | Rules and animation are interleaved; enemy AI is chosen by enemy ID in code |
| Staybook (`13`) | 5 pages, unlocked by commands | — | — |
| Saves (`20`) | `localStorage['longnoon.poc2.save']` holds the whole `ST` object (`v:1`), a small domain object with no renderer state. Saves on step change and rest | Versioned save, migrations, export/import (§5.10) | Any save that isn't `v:1` is rejected. No migrations, no export, one slot |
| Flags | `fed tank drainStarted drainDone qteSeen armorHint shutterWarn`, created freely at runtime | Registry of declared flags (§5.4) | No registry. `shutterWarn` holds a day number, not a true/false value |
| Tests | None. A headless Chromium boot works (≈3 s, no console errors) and baseline screenshots are in `docs/baseline/` | Playwright and CI (§6.8, §8) | Need a committed harness and CI |

## Mission-specific code that blocks a second mission

- `16-exploration.js:17`: "sheltered" means within 3.4 units of (13, 27), which is only Mar Farm's door.
- `17-battle.js:88`: the battle intro line is hard-coded: "A Stray and a coyote block the drain!"
- `17-battle.js:63` onward: coyote and Stray AI are picked by `f.id`; the Stray's eye light and sounds are tied to the `'stray'` ID.
- `12-dialogue.js:41`: the `join` command always shows "Kit joined the party". Party slots assume Juno plus Kit.
- `10-game-state.js` `makeWreck`, plus `drainDone` checks in `applyState`, `update` and `exploreUpdate`, are drain-battle aftermath written into the engine.
- `18-rest-faint-ending.js`: fainting, the ending and `continueAfterEnding` contain Mar Farm coordinates and mission 1 values.
- `ITEM_NAMES` (`10`) and `PAGE_ORDER` (`13`) are lists in code, not content.

## ID conventions

- Short bare IDs (`kit`, `stray`, `milk`, `drain`), no namespaces.
- **Display names are used as keys.** Dialogue speakers are written as display names (`"Hermana Lupe"`), and `PORTRAIT` (`12`) and `VOICES` (`22`) map those names to sprites and voices. The brief warns against exactly this (§4.4).
- Map props are positional arrays (`[kind, x, z, scale, flagIndex, y]`) with no IDs.

**Opinion, differing from the brief:** the brief says never to rename persistent IDs. That
is right once players have saves. Today nobody but the owner has a save, so this is the
cheapest time the IDs will ever be to fix. Do it once, early, with a v1→v2 save migration
so the migration path gets exercised.

## Brief recommendations, sorted

**Already implemented:** keeping three.js; content separated from code; a command-based
event interpreter; condition-driven dialogue; a save that holds domain state only; chunk
streaming; quality tiers; synthesized sound effects.

**Missing but important (do soon):** a module build with a dev server (Vite); an automated
playthrough plus CI; a save version, migrations and export/import; content schemas with a
validator; generalizing the mission-specific code listed above; stable namespaced IDs;
multiple maps with transitions.

**Optional, pilot when a need appears:** Ink, once dialogue actually branches heavily (it is
nearly linear today); Tiled or LDtk for maps (a small in-browser editor that writes our own
JSON may fit better); CSV balance tables, once there are more than two enemies; TypeScript,
gradually; Aseprite exports.

**Not appropriate yet:** IndexedDB/Dexie (a save is about 1 KB, so localStorage plus
export/import is enough); localization string keys (they move text out of the scene,
which makes writing harder for the owner; add them only when a translation is planned);
splitting work across multiple agent roles; a Three.js upgrade.

## Proposed first three changes (each small, each checked against the baselines)

1. **Module build.** Move `src/js/*` to real ES modules under Vite, with behavior unchanged.
   Builds produce (a) a website build for the full game and (b) the current
   single-file demo. Success means the baseline screenshots and smoke run still match.
2. **Test harness, CI and play link.** Playwright smoke tests (boot, continue into each
   baseline scene, reach the drain fight, no console errors), run by GitHub Actions on
   every pull request, plus automatic deployment to GitHub Pages so every merged change
   is playable from a phone.
3. **Save v2.** An explicit save schema with `schemaVersion`, a v1→v2 migration with saved
   test files, Export/Import save buttons in the pause menu, and a declared flag registry.

After these: content schemas plus `validate` (Phase 2 in the brief), then generalizing the
mission-specific code, driven by what mission 2, "The White Bowl", needs.
