# The Long Noon

A browser RPG shipped as one self-contained HTML file (~10 MB). This repo holds the
unpacked source, so every part can be read, diffed and edited on its own.

```
python3 tools/build.py                 # src/ -> dist/The-Long-Noon.html
python3 tools/unpack.py some.html src  # a single-file build -> src/
```

`build.py` re-inlines everything, and `unpack` followed by `build` reproduces the
original file byte for byte. If you keep iterating on the single file elsewhere, run
`unpack.py` on each new version and commit; `git diff` then shows exactly what changed.

## What's in the file

| Part | Size | Unpacked to |
|---|---|---|
| Music: 3 MP3 tracks (`intro`, `explore`, `combat`) | 9.1 MB of base64 | `src/assets/music/` |
| three.js r128 (stock, minified) | 600 KB | `src/vendor/three.min.js` |
| Fonts: VT323, Permanent Marker, Caveat 500/700 (woff2) | 200 KB | `src/assets/fonts/`, `src/css/fonts.css` |
| Game code: one IIFE, ~1,000 dense lines | 117 KB | `src/js/00-…24-*.js` |
| 5 PNG sprite atlases + frame table | 70 KB | `src/assets/img/`, `src/data/manifest.json` |
| Content: map, dialogue, quests, staybook pages, battles | 30 KB | `src/data/*.json` |
| UI stylesheet | 20 KB | `src/css/style.css` |
| HTML skeleton: HUD, dialog, battle, menus, touch controls | 5 KB | `src/index.html` |

Nearly everything is music. The game itself is about 250 KB.

The files in `src/js/` are cut at the code's own `/* ==== section ==== */` banners. They
are pieces of a single closure, not modules: they share variables and only work when
joined in the order in `js/ORDER`.

## How the game works

**Data-driven.** The code reads its content from `<script type="application/json">` tags
(`J('data-map')` and so on). Writing new dialogue, NPCs, props, quest steps or a battle
mostly means editing JSON and leaving the engine alone.

**Rendering (`01`–`04`, `06`, `09`).** three.js with a tilted perspective camera
(`camera` FOV 32, sprites tilted by `TILT=-0.38`), which gives the HD-2D look: flat pixel
sprites standing in a lit 3D world. Sprites are quads using `MeshLambertMaterial` with an
emissive map, so they react to light without going black at night. Post-processing has
three quality levels:
- **high**: tilt-shift blur around a focus band, bloom, chromatic fringe, color grade,
  vignette, film grain, heat shimmer by day, and PCF soft shadows
- **medium**: color grade only
- **low**: direct render

**World (`06`).** The map is 128×64 tiles, cut into 32×32 chunks that stream in and out
around the camera. Each chunk paints its ground tiles to one canvas texture and merges
static props that share a material into a single mesh, which keeps draw calls low. One ring
of procedurally generated "outer" chunks (brush, berms, ruins, wrecks, all seeded by
`hash2`) surrounds the playable area so the map never visibly ends. Collision is simple
circles and boxes per chunk.

**Clock and light (`03`).** There's an in-game clock in minutes (1 real second = 1 game
minute). `envAt()` blends sky, fog, hemisphere and moon light and the grade between
presets `night → gray → day → dusk → lamp → night`. Phases: *Lamp* 6:30–8 pm,
*Long night*, *Shutter* 4:30–6 am, then *Day*. Being outside in daylight drains water,
and at zero water you faint and wake at home. The 6 nearest lanterns or fires get the
real point lights, with flicker.

**Dialogue and scripting (`12`).** `data/dialogue.json` entries are lists of
`["Speaker", "line"]` pairs and `{"do": …}` commands (`item`, `step`, `flag`, `page`,
`choice`, `battle`, `join`, `cam`, `tale`, …), run by `runScript()`. An entry can be an
object keyed by conditions such as `"kit&!fed"` (quest step names or flags, `!` negates,
`*` is the fallback), so NPCs say different things as the story moves. Typewriter text,
blinking portraits, and a per-character synthesized "voice" blip (`VOICES` in `22`).

**Quest (`14`, `data/quests.json`).** A linear chain of steps for mission 1, "Lamp":
`burial → home → market → kit → pancha → home2 → free`. Each step has an objective and a
marker target (an NPC, an interactable or coordinates).

**Battle (`17`, `08`, `data/battles.json`).** A scripted `battle` command wipes to a
separate arena scene themed to where the fight started. Turn order is charge-time (CT): speed fills a
meter and whoever reaches 100 acts. Enemies have targetable parts: soft parts take bonus
damage, armor reduces it, and breaking the Stray's sensor eye stuns it and doubles damage
to its armor. When an enemy attacks, a timing ring appears and pressing at the right moment
parries for 80% less damage. Juno's pipe loses durability and eventually bends. You can
drink water to heal. Losing lets you retry or load your save.

**Intro (`19`).** A campfire scene at Mar Farm with a storybook canvas (`#tale`, 320×150)
whose panels (`rain`, `machines`, `veil`, `white`, `below`, `circling`) are drawn
procedurally with Canvas2D, all silhouettes and firelight.

**Audio (`22`).** Music is three looping `<audio>` tracks routed through WebAudio and
crossfaded. Every sound effect is synthesized live: footsteps filtered per ground tile, goat
bleats, coyote howls, metal clangs from inharmonic partials, crickets at night, the drone's
rumble. There are no sound-effect files.

**Saves (`20`).** `localStorage` key `longnoon.poc2.save` (version 1) holds the whole
`ST` state object. Settings are stored under `longnoon.poc2.settings`.

**Debug.** Open the page with `#debug` on the URL to make text appear instantly and expose
`window.__LN`, with `tp(x,z)`, `setStep()`, `setClock()`, `runScript()` and live state. The
pause menu can show chunk outlines and a frame and draw-call counter.

## Controls

WASD or arrow keys to move · E, Space, Z or Enter to act · B or Tab for the staybook ·
Esc or Q for the menu · F toggles the frame counter. On touch devices: a virtual stick
plus A, book and menu buttons.
