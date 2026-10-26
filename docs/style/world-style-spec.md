# OHMFRONT: World Style Spec

**Audience: an AI (or person) who must recreate this game's world, at the
same style and quality, possibly without access to our repository.**

It covers how the world looks, how it is built, how full and how empty it
is, how the pixel sprites are made, and how quality is checked. It does not
cover story or character personalities.

*Written 2026-10-26. Branch `claude/hd2d` of mountaindrowner/NextGame. The
appendix holds the reference source, copied verbatim, so every recipe here
can be reproduced exactly. Regenerate it with `node tools/style-doc.mjs`.*

---

## 0. How to use this document

- **MUST** means a hard rule; breaking it breaks the style. **SHOULD** means
  the default; deviate only with a reason. Numbers are the values in use. If
  you change one, change it everywhere and say so.
- **Reproduce, don't reinterpret.** The appendix has the exact code for the
  renderer, post-processing, lighting presets, textures, ground, foliage,
  props, doors, map kit and sprites. Port it as-is first. Improve only after
  your output matches §20's checks.
- **Build in the order of §19.** Each step has a visible result you can
  compare against the description.
- **Prove it by looking.** Render, screenshot, compare with §20. Never call a
  map done without screenshots and a walk of every exit.
- **Glossary of the setting** (you'll see these words):
  - **Ohms:** living machine creatures. Household and farm machines that woke
    up with a will of their own.
  - **The Garrison:** the militarists who "clear" Ohms.
  - **Redbed:** a raider colony.
  - **Eli, "Grandpa":** the player's grandfather, a mechanic.
  - **PERSISTENCE / the Static:** an AI whose signal spreads silver-grey
    grass.
  - **The world:** about 500 years after a collapse, in plains and cattle
    country. Never a real place.

---

## 1. The target

**A miniature diorama of a broken world that life is taking back.** You look
down at a small, sharp, hand-made place. It is **bleak and melancholy,
overgrown by bright, lush life** (the creator's mood line, the master rule
for color).

- **HD-2D:** a 3D world (Three.js) with **2D pixel-art characters** standing
  in it, one fixed camera, always-on tilt-shift blur.
- **Hard world, hopeful heart:** rust, dead husks, chained doors, slurs
  against Ohms. Against that: one green field someone still waters, a kid
  naming every machine, a pump filling a trough for nobody.
- **A smooth, Western, futuristic post-apocalypse:** plains, ranches, rail,
  dead highways, grain elevators.
- **The old world is forgotten.** MUST NOT show any real place, brand, or
  old-world name or history. Only one hint exists in the whole game: a worn
  plaque at the finale tower's foot reading "…UNION…".
- **Everything means something.** Every map has a reason to exist, a machine
  still doing its old job, and lore that is seen but never explained.

### Never do

- Lore dumps, explaining signs, text that interprets ("Grandpa fixed this").
- Filler roads; maps walled in by trees on all four sides; empty screens.
- A neon game-board look anywhere (battle grids included).
- A visual promise the game doesn't keep (a lit door that won't open).
- Real-world names. Try-hard names (rejected examples: *the Wide, the
  Upstairs, Dead Air, the Merge*).

---

## 2. Units and scale (MUST)

| Thing | Size |
|---|---|
| **1 world unit** | 1 map cell = **16 texels** of texture (`TEXEL_PER_UNIT = 16`) |
| Player character (SAL) and people | **1.65 units** tall (drawn figure height) |
| Roaming wild Ohm | 1.2 units tall |
| The Ohm following the player | 0.85 units tall |
| Ohm in battle | 0.98 units tall |
| Barn (reference building) | walls 5 × 3.2 footprint, 2.4 tall; gambrel ridge at 4.05 |
| Door opening (reference) | 1.9 wide × 1.95 tall |
| Cottonwood | trunk 1.7 tall; crown of 6 blobs of radius 0.62–1.0 |
| Grass clump | 3 blades; scaled 0.55–1.0 tall in tall grass and scrub, 0.22–0.42 on prairie (instanced) |
| Road (2-lane) | 3–4 cells wide |
| Exit gap in a map edge | 3 cells (default) |
| Section (one map) | 22×14 up to 58×28 or 36×64 cells (see §9.2) |

**The single most important consistency rule:** every textured surface MUST
use **world-unit UVs**, so every texture tiles at exactly 16 px per unit on
every object, whatever its size. That's what makes the scene read as one
crafted model instead of mismatched assets (`geo.ts`: `boxGeo`, `cylGeo`,
`planeGeo`; textures set `repeat = 16 / textureSize`).

---

## 3. Renderer and camera (MUST)

```ts
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 220);
const CAM_OFFSET = new THREE.Vector3(0, 12.5, 14.5); // ≈ 41° down, looking north (−z)
// every frame:
camTarget.lerp(desired /* player pos, y = 0.8, clamped to the map */, 1 - Math.exp(-dt * 4.5));
camera.position.copy(camTarget).add(CAM_OFFSET);
camera.lookAt(camTarget);
```

- **One fixed angle. The camera never rotates.** North is up-screen. Design
  every prop and sign for this single view.
- The camera clamps so the map's edge never shows a void. Beyond each edge
  sits an **apron**: 40 units of scrub texture, level with the edge berm, with
  roads continuing out of frame (§6.5).
- Pixel textures use `NearestFilter` for magnification (crisp pixels) and
  mipmaps for minification.
- Player movement: walk **3.1 units/s**, run **5.0**. The following Ohm trails
  **1.1 units** back along a breadcrumb trail of the player's path.

---

## 4. Post-processing (MUST, always on)

Pass order: **RenderPass → UnrealBloom → Grade → TiltShift (horizontal) →
TiltShift (vertical) → OutputPass.** Half-float render target, 4× MSAA.
Full shaders are in the appendix (`post.ts`).

| Pass | Purpose | Parameters |
|---|---|---|
| **Bloom** | lamps, sunlit edges, glows | per mood (§5); default 0.45 / radius 0.55 / threshold 0.82 |
| **Grade** | "bleak but lush" | HSV-based. **Low-saturation colors get duller** (`s = pow(s, dull)`, dull 1.35). **Greens gain saturation** (hue 0.14–0.5 band, ×`lush` 1.2). Shadows tinted cool (0.9, 0.97, 1.08), highlights warm (1.07, 1.0, 0.9), a small blue lift in the darks, vignette 0.42, film grain 0.018. |
| **Tilt-shift** | the miniature look | Separable 13-tap Gaussian. Sharp band of ±0.10 screen height, ramping over 0.34, up to 7 px blur. **The band's center tracks the player's screen height** (smoothed at rate 6/s), so the player stays sharp even when the camera clamps. |

**Why the grade works this way:** the mood line asks for bleak *and* lush.
Instead of painting two palettes, the grade pushes them apart. Rust, dirt and
ruin drain toward grey; anything alive pops. Every leaf reads as life winning
without extra work.

---

## 5. Light and mood presets (MUST)

A **mood** is a complete lighting preset. Each scene has exactly one, fixed.
**No day/night cycle. No weather** except in special scenes.

| Mood | Sun (color, intensity, from) | Hemisphere sky / ground / intensity | Fog (color, density) | Exposure | Bloom (str, rad, thr) | Sprite tint |
|---|---|---|---|---|---|---|
| **DAY** | `#ffd09a`, 3.4, (−13, 10.5, 6.5) | `#a9c2d8` / `#5a5232` / 1.05 | `#cdb895`, 0.016 | 1.05 | 0.42, 0.55, 0.85 | (1.1, 1.05, 0.98) |
| **NIGHT** | `#8aa6d8`, 0.85, (−8, 14, 5) | `#22365a` / `#0b0d12` / 0.55 | `#101a2c`, 0.03 | 1.15 | 0.9, 0.6, 0.6 | (0.6, 0.68, 0.95) |
| **UNDER** (bunker) | `#a8b8d0`, 0.5, (−5, 14, 7) | `#5a6070` / `#2a231b` / 1.35 | `#07080b`, 0.014 | 1.25 | 0.7, 0.6, 0.7 | (0.9, 0.84, 0.8) |
| **CISTERN** (water vaults) | `#9fd0c8`, 0.55, (−4, 14, 6) | `#6a8a84` / `#2a3a32` / 2.1 | `#06100f`, 0.012 | 1.45 | 0.75, 0.6, 0.68 | (0.86, 0.9, 0.86) |
| **INSIDE** (dungeons) | `#ffd8a0`, 0.9, (−6, 14, 5) | `#9a8a70` / `#3a2e22` / 2.1 | `#0c0906`, 0.012 | 1.42 | 0.7, 0.6, 0.7 | (0.95, 0.88, 0.8) |

Grade overrides per mood (dull, lush, vignette): DAY 1.35/1.2/0.42 · NIGHT
1.25/1.1/0.55 · UNDER 1.25/1.2/0.58 · CISTERN 1.2/1.25/0.56 · INSIDE
1.25/1.1/0.58.

- **The day sun is low, from the west-southwest, over the viewer's left
  shoulder.** Building fronts (facing the camera) catch light; long shadows
  fall north-east, away from the viewer. Don't change this direction.
- **Shadows:** one directional shadow map, 2048², frustum ±15 units, centered
  on the player and **snapped to shadow texels** so edges don't shimmer.
  Bias −0.0004, normalBias 0.025.
- **Fog is FogExp2 and doubles as the background color** (no skybox; the
  camera never sees the horizon).
- **Sprites are not lit by the 3D lights.** They use the mood's flat sprite
  tint (multiplying `MeshBasicMaterial`) plus a soft blob shadow. Pixel art
  stays crisp and still sits in the scene's light.
- **Many lamps, few lights.** Underground and indoors, a pool of 10–12 real
  point lights is moved every frame to the lamps nearest the camera
  (`LightPool`). A map can have dozens of lamps.
- **Glow is language** (§12): emissive materials and point lights appear only
  where they promise something.

---

## 6. Materials and the painted ground

### 6.1 The texture system (MUST)

- Every texture is **painted procedurally, pixel by pixel**, into a small
  RGBA buffer (`Pix`), usually **32×32** (16×16 for windows and small decals).
  It's then uploaded with `NearestFilter`, sRGB, and repeat set to 16 px per
  world unit. No photos, no imported art, no smooth gradients on surfaces.
- **Every material has a base, a highlight and a shadow value** and at least
  one kind of wear: peeling paint, rust run-off, moss, water streaks,
  missing shingle tabs, rust-through holes, rivets, knots and nails.
- **Determinism:** all noise and randomness is seeded (`rng(seed)`,
  `vnoise`, `fbm` in the appendix). The same map always looks identical.
- **Master palette** (the `P` table in `textures.ts`): barn red `#8b3626`
  (light `#a8463a`, dark `#5e2219`) · old wood `#857865` / `#4f463a` · grey
  board `#77695a` / `#4a3f35` · white siding `#d6cfbf` / `#9c968a` · steel
  `#5b6066` / `#2e3236` · rust `#8a4a26` (light `#b26a32`, dark `#4a2614`) ·
  concrete `#a19c92` / `#6f6b63` · moss `#4f7a2c` / `#7aa83c` · shingle
  `#4a4440` / `#2c2825` · brick `#8c4733`, mortar `#9d968a` · hay `#c9a24a` /
  `#8a6a28` · bark `#4e3b2b` / `#2a1f17` · leaves `#1e4a1d #2f6b2a #3f8a32
  #5ea83c #8cc650` · glass `#22303a`, sky streak `#6f8a98` · black `#141210` ·
  hazard yellow `#d9a92a`.
- **The library** (all in the appendix): boards (vertical/horizontal, with
  peel), corrugated tin, grain-bin ribs, concrete (streaks, moss, cracks),
  shingles, brick, rust tank, steel, hazard stripes, hay, bark, leaves,
  olive leaves, a transparent climbing-vine decal (denser at the bottom:
  vines climb), glass, lit glass, boarded window. Signs and stencils come
  from `textTexture`: canvas text thresholded to hard pixels, then
  noise-worn.

### 6.2 The ground: one painted texture per map

Each outdoor map's whole floor is **one texture**, `cols×16` by `rows×16`
pixels, painted from the map's glyph grid and draped over a height field
subdivided into 4 vertices per unit.

| Glyph | Ground | Palette and painted detail |
|---|---|---|
| `g` | prairie | Big noise patches (scale 0.13) switch between **lush** `#3d6b26 #4f7f2f #5f9536 #79ad47 #335c21` and **dry** `#6c6a3a #7d7a45 #8f8a52 #5c5c33`. Rare wildflower pixels (`#e3c34a #ece6d6 #5e6fd0 #c4473a #b07ad0`) only in lush patches; rare dirt pixels. |
| `T` | tall grass (wild Ohms) | `#2f5420 #355f22 #41702a #2a4a1c` |
| `d` | asphalt | `#5f5c57 #6d6a64 #7a766e #55524d`; a crack network from noise contours, **weeds pushing through the cracks**, potholes, optional faded center line `#b49a52` |
| `e` | dirt road | `#6a5238 #7a5e40 #5a442e #84694a`; **wheel ruts** every 2.6 units (`#4e3c2a`); rare stones |
| `v` | gravel | `#7a746a #8e877a #9a9284 #666056`, bright speckles |
| `x` | dry cracked earth | `#a08a66 #b39c74 #8f7a58 #c2ab80`; hairline cracks `#6a5a40` |
| `k` | red clay | `#8a4a32 #9c5a3c #7a3f2a #a8664a` |
| `b` | broken concrete | `#4e4a45 #5e5952 #6a645b #433f3a`; rust run-off patches; moss dots |
| `c` | crop rows | dark furrows `#5a4630…` every 0.9 units between green rows `#4f8a2e #5f9a36 #6aa83e #447a28` |
| `w` | water (bed) | mud `#3f3527 #4a3f2e #55493a` under a water shader |
| `#` | edge scrub | `#2f3a1d #3d4a25 #4a5530 #5a5a35` |

Painting rules (MUST):

- **No tile seams.** Each pixel looks up its glyph at a **jittered
  position**: the coordinate shifted by fbm noise of ±0.375 units. Material
  borders wander like hand painting.
- **Shade choice per pixel** = layered noise (`fbm`) plus a small per-pixel
  random, indexing a 4–5 shade palette. Never a flat fill.
- **Contact shadows are painted into the ground:** under and 0.4 units
  around every solid footprint the ground is darkened to 72%, fading out.
  Buildings sit *in* the ground, not on it.

### 6.3 The height field

- Base: `(fbm(x·0.09, z·0.09) − 0.5) × 0.45`, about ±0.22 units of roll.
- **Flattened 90% under roads**, **lowered 0.6 under water**.
- **Raised toward the edges:** +0.5 per unit within 1.6 units of a normal
  edge. Under a bluff edge, up to +1.9, curving over 3.4 units.
- **Exits stay level** (height ≤ 0.05) where a road runs off the map.

### 6.4 Living layers

| Layer | Recipe | Why |
|---|---|---|
| **Grass** | Instanced clumps of 3 tapered blades, colored by vertex from `#1e3a14` (base) to `#9fd05a` (tip). **30 clumps per tall-grass cell**; 3 or 6 per prairie cell (by noise, so it's patchy); 5 per scrub cell. **Normals point straight up**, so the field lights like a painting. A vertex shader sways each blade by height² with two sine waves keyed to world position. | Tall grass must *look* like where Ohms hide. Patchy prairie avoids a carpet. |
| **Trees** | Crowns are **displaced icosahedrons** (detail 1, radius × 0.82–1.18 by noise, squashed to 0.82 tall), **flat-shaded**, with the pixel leaf texture at world density. Cottonwood: tapered trunk + 6 blobs + a few branch beams. Mesquite: 3 leaning branches with flattened blobs (olive leaves). Bush: 3 blobs. **Dead tree: recursive branching bark with a few leaf tufts and a vine decal, always with green on it.** Every crown sways (rotation.z, amplitude 0.012–0.018). | Chunky, painterly, low-poly. The dead tree is the mood line in one prop. |
| **Water** | A shader plane: shallow banks to a deep middle, sky tint, fog-matched. Day deep `#1d3a38`, shallow `#4f7a6a`, sky `#e8d6b0`. Night `#0b1a24`, `#1d3346`, `#5f7fb0`. | Reads from the fixed angle without reflections. |
| **Motes** | 220 additive points by day (`#fff2c8`, size 0.055, drifting dust); 140 at night (`#c8ff70`, size 0.09, fireflies), kept around the player | Air you can see. Cheap life. |

### 6.5 Map edges: the apron

Beyond each map edge, a 40-unit apron of scrub texture sits level with the
edge's average berm height, tucked 0.5 units under the map so no sky shows.
**Where an exit cuts through the edge, the road continues out of frame**
(blacktop, dirt or gravel, matching the road), with dirt banks on both
sides. The world MUST look like it goes on.

---

## 7. Props: how every object is built (MUST)

- **Built in code from primitives:** boxes, tapered cylinders, beams between
  two points, extruded 2D profiles, dodecahedron rocks, displaced spheres.
  **No imported 3D models.** One consistent chunky language, and anything the
  story needs can be made in minutes.
- **Helpers** (appendix `geo.ts`): `box(w,h,d,mat,x,y,z)` positioned by
  **center-bottom**; `cyl(...)`; `beam(a,b,thick,mat)`; `prism(shape,depth)`;
  `decal(...)`; `shade(obj)` turns on cast and receive shadows. All geometry
  carries world-unit UVs.
- **Silhouette first.** From the fixed camera, a prop must read by shape
  alone: a pumpjack's nodding head, a water tower's legs, a hopper car's
  sloped bays. Then material, then wear.
- **Proportions are believable, slightly chunky.** Real-world sizes at 1 unit
  ≈ 1 m-ish, with thick trim and posts so they read at the camera's distance
  (trim beams 0.1, posts 0.1–0.15, sign boards 1.35 × 0.4).
- **Solid footprints:** anything the player can't walk through registers a
  rectangle (`addSolid`). Posts get ±0.15.
- **Weathering tells time:** rust run-off, grey-topped hay bales, sagging
  rails, signs tilted a few degrees (random ±0.06 rad), vines on dead wood,
  roofs with missing tabs.
- **Animated props** return `{ update(t) }` and run forever. Flashing,
  turning, nodding and crawling are on a timer, never on player input.
- **Emissive only when it promises something** (§12).

Reference recipes in the appendix (`region1/props.ts`, `field/props.ts`,
`doorway.ts`): rock, hand-painted board sign, stock tank, hay bale, the
Garrison stencil, the red hand, the brass tag, a decommissioned husk, the
sprinkler, the weather vane, the fallen turbine, the crossing signal, and the
foliage. Use them as templates for new props.

**The region 1 prop library** (names only; build new regions to the same
breadth): rock, hoodoo, board sign, stock tank, bale, stencil, red hand,
brass tag, husk, sprinkler, weather vane, fallen turbine, crossing signal,
hopper car, blank billboard (peeled, no words), hump (a grassed mound with one
chimney where a house was), road grader, Garrison checkpoint, guardrail,
spotting scope, brick shell (roofless walls), loading chute, swing gate,
broken bridge, pump trough, rail line, grain elevator, shopping cart, drive-in
screen, speaker post, projector booth, sign flipper, warehouse front, fuel
canopy, telephone poles, fence, truck, crates, tumbleweed. Dungeons add:
bucket elevator loop, pulley wheel, steel stairs, hopper cone, bin top,
warehouse racking, forklift.

---

## 8. Density and sparsity (the quality bar)

**Full but believable. Never empty, never noise.**

### 8.1 Quotas per area (MUST)

- **3 or more seeded variants** of every ground and wall surface, so
  repetition never shows.
- **12 or more distinct themed props.**
- **3 or more scatter layers** over the base (cracks, stains, moss, litter,
  flowers…).
- **Exactly one hero landmark** per section, visible from across the map.
- **One routine** per section: a machine still doing its old job, animated
  (§11.2).
- **Three planes dressed:** floor (scatter, stains), objects (props), air and
  overhead (motes, wires, hanging things, light). Props on the ground alone
  isn't enough.
- **No empty screens:** wherever the camera can stop, something is in frame.

### 8.2 Where things go (MUST)

- **Clutter pools at walls, corners and edges; it thins across open
  centers.** The middle of a map breathes and the path reads instantly.
- **Along desire lines:** wear where feet go (doorways, between work points).
- **Around work points:** tools at a bench, cans by a console, bales by the
  barn.
- **Heaviest in neglected corners and behind machines.**
- **Reclamation creeps inward from the edges:** weeds, vines, water damage.
- **Keep-clear:** never on interactables, in doorways, or on the critical
  path. Nothing solid may seal a required route.

### 8.3 Density tiers

Assign one tier per map and dress exactly to it:

| Tier | Feels like |
|---|---|
| bare | swept, sterile (a shrine) |
| tidy | cared for (an office, a kept home) |
| lived_in | the default where people live |
| cluttered | markets, workshops, raider dens |
| squalid | abandoned interiors |
| ruined | dead towns, dungeons, the ruined capital |

### 8.4 Sparsity is designed (MUST)

- **One hero, not five.** Everything else supports it.
- **Travel spaces are quiet on purpose:** wide sky, few or no wild Ohms, one
  telling detail (a checkpoint, a scope still aimed north).
- **Tree lines are broken:** about **18% gaps** so the eye runs past the map.
- **Random spacing, never a grid:** e.g. edge trees every 0.9–2.5 units,
  scrub every 1.3–3.5, bluff rocks every 0.7–1.8, all seeded.
- **Hand-placed heroes on top of seeded scatter.**

### 8.5 Worked example: the Pickett Place (40×30 cells, tier lived_in)

- **Hero and routine:** one green crop field under a wheel-line sprinkler
  Ohm crawling its arc. The greenest thing for miles.
- **Buildings and big props:** house (enterable, lit door), barn (boarded),
  windmill with a stock tank, trade shed, porch set, clothesline, 3 hay
  bales, an old truck, crates, a tumbleweed, a fenced field.
- **Lines through the map:** telephone poles running north up the lane, the
  fence.
- **Trees:** 7 shade trees round the house and yard, 6 bushes.
- **Signs:** 3 hand-painted boards (place name, two directions with arrows).
- **Lore:** a brass tag with three notches on the windmill's gearbox.
- **People:** 3. **Wild Ohms:** 2 roaming, plus a tall-grass table.

About 40 placed things, all clustered round house, barn and field, with an
open middle. It reads as a quiet homestead, not a junkyard.

### 8.6 Region-scale targets

Region 1 measured: 22 maps, 44 connections, 47 NPCs, 36 things to inspect,
39 roaming wild Ohms, 21 encounter tables. Targets per region: **60–85
NPCs**, 1–3 interiors, 25–35 trainers (not yet built), ~5 side quests.

---

## 9. Maps: regions as webs of separate places

### 9.1 Structure (MUST)

- **A region is a web of 10–17 separate maps** (sections): towns, roads, side
  spots, dungeons, one travel space out. Each road and town is its own map.
- **Towns have 2–4 exits.** Every region has **at least one loop home.**
- **Every road is somewhere:** its own name, look, wild Ohms, 1–3 side
  pockets, often a fork to a dungeon. No filler.
- **Gates give reasons to return:** pockets locked behind field abilities,
  each visibly showing what it needs (§12).
- **One shared region kit** (palette, fences, trees, materials) and **one
  signature per section.**

### 9.2 Section sizes

| Kind | Cells | Notes |
|---|---|---|
| Road | 36×62 to 58×28 | long in the direction of travel |
| Town / side spot | 40×30 to 46×32 | |
| Dungeon floor | 18×12 to 40×24 | |

### 9.3 The section kit (appendix `region1/section.ts`)

A map is a short spec: `id, title, sub, kind, cols, rows, seed, zone,
ground(grid), edges, exits, dress(d)`. The ground is drawn on a glyph grid
with `rect`, `line` (thick polylines for roads and creeks) and `blob`
(ragged noise patches). The kit then:

1. **Frames each edge** with a one-cell band (two under a bluff), cut open at
   exits.
2. **Dresses the edge by style:**

   | Edge | Algorithm |
   |---|---|
   | `trees` | Step 0.9–2.5 along the edge; skip 18% for gaps. Place 65% cottonwood, 20% mesquite, 15% dead tree, 0.5–1.0 in; often a second tree 1.2–4 units *outside* the map for depth. |
   | `scrub` | Bushes and mesquites every 1.3–3.5; sometimes a mesquite outside. |
   | `fence` | A post-and-rail fence 1.25 in, broken at exits; bushes inside, trees outside. |
   | `bluff` | Raised ground with sandstone rocks every 0.7–1.8, the odd mesquite. |
   | `open` | Nothing: grass runs off the map. |
   | `none` | The section draws its own edge. |

   **Never trees on all four sides.** Mix at least two styles per map.
3. **Cuts exits** and wires them: walking off an edge lands you at the
   matching edge of the target map, facing the same way.
4. Builds the height field (§6.3) and paints the ground (§6.2).

### 9.4 Transitions (MUST)

| Moving | What happens |
|---|---|
| Between sections | **Pixel dissolve:** the screen is divided into 12 px cells that turn black in an order set by a 4×4 Bayer matrix (65%) mixed with a hash (35%), over ~0.28 s out and ~0.28 s back in. Then a small **name tag** (place name and, on roads, a subtitle), visible 1.7 s and fading by 2.6 s. |
| Into a town or dungeon, first time | A large **title card** (NAME, then a one-line subtitle). |
| Between regions | Walk through a quiet **travel space**, then a **travel card**: the world map with a dotted line drawing from here to there over ~2.6 s, and one line of text ("Half a day north."). |

---

## 10. Interiors and dungeons

Appendix `region1/interior.ts`. Glyphs: `.` floor · `#` wall · `r` debris
(wild Ohms) · `v` pit (blocked) · `=` steel grate over a pit (walkable).

- **The HD-2D cutaway (MUST):** walls are instanced cubes **2.9 units tall**;
  the **front row drops to 0.6** so the room is always visible. Wall-mounted
  props hide with their row.
- **Wall textures** are 32×48 px in five kinds: concrete, brick (with soot),
  tin (corrugated, rusted), block, boards (painted, faded, with a dado rail).
- **Light:** INSIDE mood plus a LightPool of 12 lights over pendant lamps.
  Stairs and the exit are always lit; the exit back outside shows
  **daylight** through the doorway.
- **Each dungeon floor has its routine:** a bucket elevator climbing and
  tipping out nothing, a turntable creeping, forklift Ohms restocking empty
  shelves.

---

## 11. Lore you can see

### 11.1 Threads: one fixed look each (MUST)

| Thread | Look | Means |
|---|---|---|
| the Garrison | a grey chevron stencil over tally marks | what they've "cleared" |
| Redbed | a red handprint | raiders signing what they took |
| Grandpa | a small brass tag, 0.2 × 0.12, with three notches | machines Eli kept alive |
| the Static | silver-grey grass, Ohms twitching in sync, no birds | the AI's signal |
| the old routines | a machine still doing its job | the ghost of purpose |

Threads **escalate** with progress (more stencils further north, the silver
grass spreading), recur, and pay off. Never add a thread casually.

### 11.2 Routines

Every section has **one machine still doing its old job**, animated: the
sprinkler crawling its arc, a grader smoothing a road to nowhere, a crossing
signal flashing for trains that never come (alternating lamps at 1.6 Hz),
stockyard gates opening at dusk, a projector lighting a blank screen at
night, a sign flipping its last letters. It asks the central question with no
words: are these machines monsters, or are they working?

### 11.3 Text and signs (MUST)

- Signs are **what locals would hand-paint:** board on a post, plain words,
  direction arrows (`GRAIN LINE ^`, `CREEK RD >`). Font: bold monospace,
  thresholded, worn ~30%.
- **Billboards are peeled blank:** layered paper, no word left.
- **Inspect text describes, never interprets:** "A small brass tag. Three
  notches stamped in it."
- **People's lines are short and read two ways** (before and after the
  story's reveal).
- **Names pass the tired-local test:** natural said by a tired local (the
  Rust Mile, the Breaks, the Pickett Place, Old Mutter). Named for what a
  place does, what it did to people, or who took it. No puns, no attitude.

---

## 12. Design language: every visual is a promise (MUST)

For each visual convention, state **what it promises** (one plain sentence),
make sure it **resolves every time**, and check **what it implies by
accident**. One broken promise teaches the player to distrust everything.

### The door language

| What you see | Means | Build |
|---|---|---|
| **A lit lamp at the door, warm light inside, a clear step** | Go in. Always opens. | Emissive interior plane (`#ffcf8a`, emissive `#ffb867`, 1.5 day / 2.6 night); caged bulb on a bracket at the door's right (emissive 2.2 day / 6 night, flickering ±4%); point light 2.4 day / 7 night, range 5.5; additive light pool on the step; a concrete step. |
| **Planks nailed across, no light** | Never opens. | A shut leaf + 2 diagonal and 2 horizontal grey planks. |
| **Chain and padlock, no light** | Opens later, via the story. | A shut leaf; torus chain links sagging across; a padlock (a fresh one is shiny brass). |
| **A dead lamp over a black opening** | Needs LUMEN (a light ability). | Black plane, empty bracket, a broken bulb hanging crooked. |
| **Heaped debris / fallen gates** | Needs HAUL. | |
| **Thorny growth grown solid** | Needs SHEAR. | |
| **Open water** | Needs HOVER. | |
| **Cracked, sealed wall or welded door** | Needs BREACH. | |

Rules: **never light a door that can't be used**; every way in (door,
hatch, stair, lift, dungeon exit) **is lit**; ground doors you can't use are
**shut** (never slid open onto darkness). Street lamps on poles are a
different shape and promise nothing. **Enforce it in code:** record every
door and warn on load if a lit door leads nowhere or a way in is unlit.

---

## 13. Pixel sprites (characters and Ohms)

### 13.1 The style (locked)

**"Indie action-adventure":** chunky stylized proportions, big bold readable
silhouette, saturated colors, **lineless** with strong graphic light and
shadow shapes, expressive and punchy. **64×64 px canvas, low top-down view, 8
directions.** Not chibi (big heads were rejected).

### 13.2 Generation (PixelLab API, verbatim settings)

Every figure is generated **with the protagonist as style reference**, so the
whole cast matches.

```json
POST https://api.pixellab.ai/v2/create-character-pro
{
  "description": "<subject description>. <type suffix>",
  "style_description": "modern indie action-adventure pixel art: chunky stylized proportions, big bold readable silhouette, saturated colours, lineless with strong graphic light and shadow shapes, expressive and punchy",
  "method": "create_with_style",
  "view": "low top-down",
  "image_size": { "width": 64, "height": 64 },
  "no_background": true,
  "style_character_id": "cea31c61-3b70-4ec6-a617-413b60f80ece"
}
```

- Poll `GET /v2/background-jobs/{id}` every 5 s until `completed`, then
  download `GET /v2/characters/{character_id}/zip`. The `rotations/` folder
  holds `south.png, south-east.png, east.png, north-east.png, north.png,
  north-west.png, west.png, south-west.png`.
- **Ohm type suffix (verbatim):** *"a small living machine creature (an Ohm),
  an old household or farm machine that woke up with a will of its own,
  weathered by years outdoors, no humans, no rider"*. Plant Ohms add *"a
  plant creature, not a machine"*.
- **How an Ohm description is written:** *object + creature reading + lore
  detail + paint/wear + personality.* Example (Toastlet): *"a small chrome
  pop-up toaster creature, two bread slots on top glowing hot orange inside,
  a lever on its side like a stubby arm, two little feet, mischievous eyes on
  its front panel, crumbs and scorch marks; ambush predator."* **Always give
  it eyes or a face.** Without one an Ohm reads as a plain machine (a known
  failure: a truck, a pumpjack and a tractor came out faceless).
- **Idle** (everyone gets one): `POST /v2/animate-character` with
  `character_id`, one direction per job, mode `v3`, `action_description`
  (e.g. *"idle: rocking gently on its wheels, headlight eye blinking"*),
  `frame_count` 4 (yields 5 frames), played at 6 fps. People use the template
  `breathing-idle`, 5 fps. The first direction creates an
  `animation_group_id`; the other 7 pass it.
- **Walk** only for things the game moves: template `walking-8-frames` at 11
  fps (or a custom trot for four-legged Ohms).
- **At most 3 jobs at once.** Retry on "concurrent/slot" errors after 15–20 s.
- **Cost:** about 10 generations per 8-direction figure and about 7 per
  8-direction idle.

### 13.3 Packing and checking (MUST)

- **Pack each animation into one sheet:** rows = directions (in `dirs`
  order), columns = frames. `anim.json`:
  `{"idle": {"frames": 5, "fps": 6, "loop": true, "dirs": [...], "sheet": true, "w": 72, "h": 72}}`.
  One request per animation, not hundreds.
- **Check every direction of every animation against its still.** If a row
  came out facing the wrong way, add `"mirror": {"east": "west"}`: the
  engine then uses the west frames flipped horizontally.
- **Contact sheet** per batch (all 8 directions per row) for review.
- **Keep a `.prompt.json` sidecar** for every generated asset (exact request
  and character id). Never overwrite approved art; version it.

### 13.4 In the engine (appendix `sprites.ts`, class `RotHero`)

- A sprite is an **upright plane facing the camera's direction (+z)**. With
  a fixed camera it never has to turn. `MeshBasicMaterial`, `alphaTest`
  0.5, double-sided, `NearestFilter`.
- **Sized by measurement:** the loader finds the drawn (alpha > 128) top and
  bottom of the south frame and scales so the figure stands exactly its
  target height (§2). Every frame shares that scale and center.
- **Facing:** 8 directions from the movement vector. An animation missing a
  direction borrows the nearest one it has. No walk animation means a bob,
  squash and lean while moving; idle gets a 1.2% breathing scale.
- **A soft round blob shadow** under each figure.
- **Tinted by the mood's sprite color** (§5).
- **In battle,** both sides stand **three-quarter toward the camera**
  (face(±1, 0.8)) so faces read.
- **Dialogue** shows the speaker's own sprite, upscaled, on the right facing
  left.

---

## 14. The battle stage (visual rules)

- **The panels are the local ground, not neon tiles.** The Field fights on
  earth plots (your dark loam, their cracked clay, grass in the gaps, a stone
  line down the middle). Roads fight on blacktop slabs (patched against
  bleached, a faded center line). Underground fights on deck plate with
  hazard edges. Panels are 32×32 painted textures; sides read through
  **material**, not color coding.
- **Layout:** 10×5 panels (your 5×5 on the left), each **1.14 × 0.86**
  units, a raised clearing dressed with the area's props, the same mood as
  the map. Battle camera: fov 30 at (0, 8.4, 11.4), looking at (0, 0.2, 0.35).
- **Color language:** your active panel has a faint lantern warmth (gold);
  danger is **ember orange** smouldering in the ground; a picked move
  previews in **its type's color**. Changed ground: scorched `#ff5a1a`
  pulsing, iced `#9fdcff`, live `#ffe85a` flickering fast, overgrown
  `#6ad84a`, cracked (a hairline texture), broken (a black hole).
- The protagonist stands behind the player's half.

---

## 15. Interface style

- **Type:** Cormorant SC (small caps) for names and titles; Alegreya Sans for
  everything else.
- **Panels:** dark and translucent, a thin gold rule on top, a dimmer one
  below. No heavy frames, no rounded bubbly boxes.
- **Text:** terse, mobile-first. Never start a sentence with "because." No
  "not X, but Y" constructions.
- **Phones in landscape are a first-class target:** a compact layout on touch
  or short screens.

---

## 16. Tone and color rules in one place

- Ruins, rust, dirt: **low saturation**, warm-grey browns.
- Life (grass, leaves, flowers, the one watered field): **saturated greens**
  plus small, bright flower pixels.
- Light: **warm** (sun, lamps, doors). Shadow: **cool**.
- Night: blue-black fog, fireflies, lamps carrying the scene.
- Accents are rare and meaningful: the brass tag's gold, Redbed's red, the
  Garrison's grey, the crossing signal's red flash.

---

## 17. Anti-patterns (caught and fixed; don't repeat)

| Don't | Do instead |
|---|---|
| Wall a map with trees on four sides | Mix edge styles; 18% gaps; some `open` sides |
| One long corridor map for a route | Separate sections, quick dissolves |
| A lit vault you can't enter | Chain it, unlit, until the story opens it |
| Barn doors slid open on darkness | Close and board them |
| Grid-placed scatter | Seeded random spacing, pooled at edges |
| Several competing landmarks | One hero per section |
| Neon battle grid | The region's ground |
| Explaining signs | Signs a local would paint; descriptive inspect text |
| Old-world or real names | Lived-in local names |
| Glow as decoration | Glow only where it promises |
| Faceless Ohms | Eyes and a stance; they're creatures |
| Flat-filled surfaces or tile seams | 4–5 shades by noise; jittered ground lookups |
| Smooth/HD textures next to pixel ones | Everything at 16 px per unit, NearestFilter |
| A void beyond the map edge | Aprons, roads running out of frame |

---

## 18. What is not decided yet

- An alternative to the glowing door is being discussed (a crew mark, signs
  of use, or a lamp that's merely lit). Until decided, use §12 as written.
- A modular block-kit approach was proposed but never built. Everything here
  is the fully custom approach.
- Weather: special scenes only; none built.
- Most NPC sprites are still placeholders; the main cast and 23 Ohms are done.

---

## 19. Build order for a new region (do it in this order)

1. Write the region's **one line of meaning** and answer: What is this place?
   What's going on? What's seen but never said? What does each section add?
2. Sketch the **web:** towns (2–4 exits each), roads, side spots, dungeons,
   one loop home, one travel space out.
3. Pick **names** that pass the tired-local test.
4. Decide which **threads** appear and how escalated.
5. For every section: one **hero**, one **routine**, one **signature**, a
   **density tier**.
6. Make the **region kit:** palette tweaks, ground painter glyph overrides,
   fences, trees, materials (all per §6, at 16 px per unit).
7. Build each section with the section kit: ground glyphs, mixed edges,
   exits.
8. **Dress** to the quotas of §8.1 and placement rules of §8.2.
9. Place **people** (short, double-reading lines) and **wild Ohms** themed to
   what the place used to be.
10. Dress every **door** per §12; the automatic check must be clean.
11. Generate the region's new **Ohm sprites** in the order the player meets
    them (§13).
12. **Verify** (§20), then fix and repeat.

---

## 20. Acceptance checks (pass/fail)

Render headless or in a browser at **1280×720** and at a phone landscape
size (**844×340**), and screenshot each map from its main entrance and its
hero. (Headless Chromium needs `--use-angle=swiftshader
--enable-unsafe-swiftshader --ignore-gpu-blocklist`.)

| # | Check | Pass |
|---|---|---|
| 1 | Tilt-shift | Top and bottom of frame visibly blurred; player sharp |
| 2 | Grade | Ruins/dirt read desaturated; grass and leaves read rich green |
| 3 | Sun | Building fronts lit; shadows fall up-screen and right |
| 4 | Texel density | Zoom a screenshot: pixel size equal on ground, walls, props, trees |
| 5 | Seams | No straight tile edges between ground materials |
| 6 | Edges | At least 2 edge styles; tree lines have gaps; no void past the edge |
| 7 | Hero | One landmark identifiable at a glance from the entrance view |
| 8 | Routine | One animated machine doing an old job is visible |
| 9 | Quotas | ≥12 distinct props; ≥3 scatter layers; floor/object/air all dressed |
| 10 | Breathing room | The walkable center and path read clearly; clutter at edges |
| 11 | Doors | Every lit door opens; every usable way in is lit; the automatic check is clean |
| 12 | Exits | Every exit walked; each lands at the matching edge of its target |
| 13 | Sprites | Figures at target heights; facings correct in all 8 directions; idle plays |
| 14 | Text | No real place or brand names; signs plain; inspect text descriptive |
| 15 | Phone | 844×340: HUD fits; nothing important covered |

---

<!-- APPENDIX:BEGIN (generated by tools/style-doc.mjs; do not edit below by hand) -->

## Appendix: reference source (verbatim, from commit 9fb4da7)

Port these first, unchanged; they are the ground truth for every number above. TypeScript on Three.js r170 (`three@^0.170.0`), built with Vite.

- `src/hd2d/noise.ts`: Seeded RNG, value noise, fbm. Everything random goes through these.
- `src/hd2d/geo.ts`: Geometry with world-unit UVs; box/cyl/beam/prism helpers; cached materials.
- `src/hd2d/textures.ts`: The pixel texture system: Pix buffer, master palette, every material recipe, textTexture.
- `src/hd2d/post.ts`: Post-processing: tilt-shift and grade shaders, pass order.
- `src/hd2d/mood.ts`: Lighting presets and how a mood is applied (sun, hemisphere, fog, shadows).
- `src/hd2d/world.ts`: The tile world: glyph lookup, height, solids.
- `src/hd2d/terrain.ts`: The painted ground, aprons beyond the edges, water shader, grass.
- `src/hd2d/field/props.ts`: Foliage (blob crowns, cottonwood, mesquite, dead tree, bush), sway, power lines, truck, crates, tumbleweed, motes.
- `src/hd2d/region1/section.ts`: The section kit: glyph grid, region painter, edges, exits, height.
- `src/hd2d/region1/props.ts`: Region prop recipes (rock, sign, tank, bale, thread marks, husk, routines, crossing signal).
- `src/hd2d/ohmstead/kit.ts`: Underground kit: world-UV materials, LightPool (many lamps, few lights), wall lamps.
- `src/hd2d/region1/interior.ts`: Interiors: cutaway walls, wall textures, lamps.
- `src/hd2d/doorway.ts`: The door language: dressDoor and the promise check.
- `src/hd2d/sprites.ts`: Sprites: RotHero (8-direction billboards, sizing by measurement, packed sheets, mirror), blob shadow.
- `src/hd2d/battle/themes.ts`: Battle grounds per region (panels painted as local ground).
- `src/hd2d/ui.ts`: The pixel dissolve, name tag and travel card.
- `tools/gen-ohms-style.mjs`: PixelLab: 8-direction Ohms in the locked style (prompts included).
- `tools/gen-cast-style.mjs`: PixelLab: people in the locked style.
- `tools/pack-anims.mjs`: Packs animation frames into one sheet per animation.

### src/hd2d/noise.ts

Seeded RNG, value noise, fbm. Everything random goes through these.

```ts
/** Seeded RNG + value noise for procedural textures and terrain. Deterministic
 *  so every load of a scene looks the same. */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 2D value noise in [0,1]. */
export function vnoise(x: number, y: number, seed = 1): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Fractal value noise in [0,1]. */
export function fbm(x: number, y: number, seed = 1, octaves = 4): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * freq, y * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
```

### src/hd2d/geo.ts

Geometry with world-unit UVs; box/cyl/beam/prism helpers; cached materials.

```ts
import * as THREE from 'three';

/**
 * Geometry helpers that bake WORLD-UNIT UVs, so any textured material tiles
 * at the shared texel density no matter the object's size (textures.ts sets
 * each texture's repeat to 16px-per-unit). Plus small mesh builders.
 */

/** BoxGeometry with per-face UVs in world units. */
export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // face order: px, nx (d×h) · py, ny (w×d) · pz, nz (w×h); 4 verts each
  const dims: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f]!;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  return g;
}

/** Cylinder/cone with world-unit UVs (torso wraps the circumference). */
export function cylGeo(rTop: number, rBot: number, h: number, seg = 16, open = false): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const torso = (seg + 1) * 2;
  const circ = Math.PI * 2 * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i++) {
    if (i < torso) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
    else uv.setXY(i, uv.getX(i) * 2 * Math.max(rTop, rBot), uv.getY(i) * 2 * Math.max(rTop, rBot));
  }
  return g;
}

export function planeGeo(w: number, h: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

// --------------------------------------------------------------- materials

const matCache = new Map<string, THREE.Material>();
/** Standard lit material over a texture, cached by key. */
export function texMat(key: string, map: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, ...opts });
    matCache.set(key, m);
  }
  return m;
}
export function colMat(hex: string, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = 'col:' + hex + JSON.stringify(opts);
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0, ...opts });
    matCache.set(key, m);
  }
  return m;
}

// ----------------------------------------------------------------- meshes

export function shade<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

/** A box whose position is given by its CENTER-BOTTOM. */
export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

export function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(cylGeo(rTop, rBot, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

/** A flat textured decal plane (windows, doors, vines) facing +Z. */
export function decal(w: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, rotY = 0): THREE.Mesh {
  const m = new THREE.Mesh(planeGeo(w, h), mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  return m;
}

/** A thin beam between two points (braces, rails, wires-with-thickness). */
export function beam(a: THREE.Vector3, b: THREE.Vector3, thick: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(boxGeo(thick, len, thick), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return shade(m);
}

/** Prism from a 2D profile (XY) extruded along Z; UVs are already world-unit. */
export function prism(shape: THREE.Shape, depth: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return shade(new THREE.Mesh(g, mat));
}
```

### src/hd2d/textures.ts

The pixel texture system: Pix buffer, master palette, every material recipe, textTexture.

```ts
import * as THREE from 'three';
import { rng, fbm, vnoise } from './noise';

/**
 * Procedural pixel-art textures for the HD-2D world.
 *
 * Every texture is authored at TEXEL_PER_UNIT pixels per world unit, and all
 * geometry carries world-unit UVs (see geo.ts), so every surface in a scene
 * shares one texel density — the thing that makes an HD-2D diorama read as a
 * single crafted object instead of a pile of mismatched assets.
 */
export const TEXEL_PER_UNIT = 16;

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

/** A tiny RGBA framebuffer we paint pixel by pixel. Coordinates wrap. */
export class Pix {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB, a = 255): void {
    const xi = ((Math.floor(x) % this.w) + this.w) % this.w;
    const yi = ((Math.floor(y) % this.h) + this.h) % this.h;
    const i = (yi * this.w + xi) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const xi = ((Math.floor(x) % this.w) + this.w) % this.w;
    const yi = ((Math.floor(y) % this.h) + this.h) % this.h;
    const i = (yi * this.w + xi) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }
  alpha(x: number, y: number): number {
    const xi = ((Math.floor(x) % this.w) + this.w) % this.w;
    const yi = ((Math.floor(y) % this.h) + this.h) % this.h;
    return this.data[(yi * this.w + xi) * 4 + 3]!;
  }
  fill(c: RGB): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c);
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  texture(opts: { repeat?: boolean; worldSize?: boolean } = {}): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas());
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // geometry UVs are in world units → one repeat spans this many units
    if (opts.worldSize !== false) t.repeat.set(TEXEL_PER_UNIT / this.w, TEXEL_PER_UNIT / this.h);
    return t;
  }
}

// ---------------------------------------------------------------- materials

const P = {
  barnRed: hex('#8b3626'),
  barnRedLight: hex('#a8463a'),
  barnRedDark: hex('#5e2219'),
  oldWood: hex('#857865'),
  oldWoodDark: hex('#4f463a'),
  greyBoard: hex('#77695a'),
  greyBoardDark: hex('#4a3f35'),
  white: hex('#d6cfbf'),
  whiteShade: hex('#9c968a'),
  steel: hex('#5b6066'),
  steelDark: hex('#2e3236'),
  rust: hex('#8a4a26'),
  rustLight: hex('#b26a32'),
  rustDark: hex('#4a2614'),
  concrete: hex('#a19c92'),
  concreteDark: hex('#6f6b63'),
  moss: hex('#4f7a2c'),
  mossLight: hex('#7aa83c'),
  shingle: hex('#4a4440'),
  shingleDark: hex('#2c2825'),
  brick: hex('#8c4733'),
  mortar: hex('#9d968a'),
  hay: hex('#c9a24a'),
  hayDark: hex('#8a6a28'),
  bark: hex('#4e3b2b'),
  barkDark: hex('#2a1f17'),
  leaf0: hex('#1e4a1d'),
  leaf1: hex('#2f6b2a'),
  leaf2: hex('#3f8a32'),
  leaf3: hex('#5ea83c'),
  leaf4: hex('#8cc650'),
  glass: hex('#22303a'),
  glassSky: hex('#6f8a98'),
  black: hex('#141210'),
  yellow: hex('#d9a92a'),
};

const cache = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Vertical boards: barn siding, fences, doors. */
function boards(seed: number, base: RGB, light: RGB, dark: RGB, opts: { horizontal?: boolean; boardPx?: number; peel?: RGB } = {}): Pix {
  const S = 32, p = new Pix(S, S), r = rng(seed);
  const bw = opts.boardPx ?? 5;
  const boardTone: number[] = [];
  for (let i = 0; i < S; i++) boardTone.push(0.86 + r() * 0.22);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = opts.horizontal ? y : x, v = opts.horizontal ? x : y;
      const bi = Math.floor(u / bw);
      const edge = u % bw === 0;
      let c = mul(base, boardTone[bi % boardTone.length]!);
      const grain = vnoise(bi * 7.3 + 0.3, v * 0.35, seed);
      c = mix(c, grain > 0.62 ? light : dark, Math.abs(grain - 0.5) * 0.5);
      if (opts.peel) {
        const pe = fbm(x * 0.18, y * 0.18, seed + 3, 3);
        if (pe > 0.62) c = mix(opts.peel, opts.peel, 1);
      }
      if (edge) c = dark;
      else if (opts.horizontal && u % bw === bw - 1) c = mix(c, dark, 0.45); // lap shadow
      if (r() < 0.012) c = dark; // knot / nail
      p.set(x, y, c);
    }
  return p;
}

export const T = {
  barnRed: () => once('barnRed', () => boards(11, P.barnRed, P.barnRedLight, P.barnRedDark, { peel: P.oldWood }).texture()),
  greyBoards: () => once('greyBoards', () => boards(12, P.greyBoard, mul(P.greyBoard, 1.2), P.greyBoardDark, { horizontal: true, boardPx: 4 }).texture()),
  whiteSiding: () => once('whiteSiding', () => boards(13, P.white, mul(P.white, 1.08), P.whiteShade, { horizontal: true, boardPx: 4, peel: P.greyBoard }).texture()),
  oldWood: () => once('oldWood', () => boards(14, P.oldWood, mul(P.oldWood, 1.15), P.oldWoodDark, { boardPx: 4 }).texture()),
  deck: () => once('deck', () => boards(15, hex('#6b4f36'), hex('#86654a'), hex('#33241a'), { horizontal: true, boardPx: 4 }).texture()),

  corrugated: () =>
    once('corrugated', () => {
      const S = 32, p = new Pix(S, S);
      const ridge = [1.18, 1.0, 0.72, 0.92];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(P.steel, ridge[x % 4]!);
          const ru = fbm(x * 0.12, y * 0.12, 21, 3);
          if (ru > 0.5) c = mix(c, mul(ru > 0.66 ? P.rust : P.rustLight, ridge[x % 4]!), Math.min(1, (ru - 0.5) * 4));
          const streak = vnoise(x * 0.9, y * 0.06, 22);
          if (streak > 0.78) c = mix(c, P.rustDark, 0.5);
          if (fbm(x * 0.3, y * 0.3, 23, 2) > 0.83) c = P.black; // rust-through holes
          p.set(x, y, c);
        }
      return p.texture();
    }),

  binRibs: () =>
    once('binRibs', () => {
      const S = 32, p = new Pix(S, S);
      const ridge = [1.15, 0.95, 0.75, 0.95];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(hex('#8d9296'), ridge[y % 4]!);
          const ru = fbm(x * 0.1, y * 0.14, 31, 3);
          if (ru > 0.56) c = mix(c, P.rust, Math.min(1, (ru - 0.56) * 4));
          if (vnoise(x * 0.7, y * 0.05, 32) > 0.8) c = mix(c, P.rustDark, 0.6); // vertical drip
          if (y % 16 === 0 && x % 4 === 1) c = mul(c, 0.55); // seam bolts
          p.set(x, y, c);
        }
      return p.texture();
    }),

  concrete: () =>
    once('concrete', () => {
      const S = 32, p = new Pix(S, S), r = rng(41);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.2, y * 0.2, 41, 3);
          let c = mix(P.concreteDark, P.concrete, 0.55 + n * 0.45);
          c = mul(c, 0.94 + r() * 0.1);
          if (vnoise(x * 0.8, y * 0.05, 42) > 0.74) c = mix(c, hex('#5e5a52'), 0.45); // water streaks
          if (fbm(x * 0.25, y * 0.25, 43, 2) > 0.72) c = mix(c, P.moss, 0.55);
          p.set(x, y, c);
        }
      // a couple of cracks
      for (let k = 0; k < 2; k++) {
        let x = r() * S, y = r() * S;
        for (let i = 0; i < 18; i++) {
          p.set(x, y, P.concreteDark.map((v) => v * 0.6) as RGB);
          x += r() * 2 - 0.6;
          y += r() * 1.6 - 0.3;
        }
      }
      return p.texture();
    }),

  shingles: () =>
    once('shingles', () => {
      const S = 32, p = new Pix(S, S), r = rng(51);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const row = Math.floor(y / 4);
          const off = row % 2 ? 3 : 0;
          const tab = Math.floor((x + off) / 6);
          let c = mul(P.shingle, 0.85 + vnoise(tab * 3.1, row * 2.7, 52) * 0.3);
          if (y % 4 === 3) c = P.shingleDark;
          if ((x + off) % 6 === 0) c = mix(c, P.shingleDark, 0.6);
          if (vnoise(tab * 1.7, row * 3.3, 53) > 0.86) c = hex('#3a2e24'); // missing tab
          if (fbm(x * 0.2, y * 0.2, 54, 3) > 0.66) c = mix(c, P.moss, 0.6);
          if (r() < 0.01) c = P.mossLight;
          p.set(x, y, c);
        }
      return p.texture();
    }),

  brick: () =>
    once('brick', () => {
      const S = 32, p = new Pix(S, S), r = rng(61);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const row = Math.floor(y / 3);
          const off = row % 2 ? 3 : 0;
          const bi = Math.floor((x + off) / 6);
          let c = mul(P.brick, 0.8 + vnoise(bi * 2.3, row * 1.9, 62) * 0.35);
          if (y % 3 === 2 || (x + off) % 6 === 5) c = P.mortar;
          if (r() < 0.03) c = mul(c, 0.7);
          p.set(x, y, c);
        }
      return p.texture();
    }),

  rustTank: () =>
    once('rustTank', () => {
      const S = 32, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.15, y * 0.15, 71, 3);
          let c = mix(hex('#7c8b8e'), P.rust, Math.min(1, n * 1.6)); // old paint → rust
          if (vnoise(x * 0.9, y * 0.08, 72) > 0.7) c = mix(c, P.rustDark, 0.55);
          if (y % 8 === 0) c = mul(c, 0.7); // plate seam
          if (y % 8 === 1 && x % 3 === 0) c = mul(c, 1.35); // rivets
          p.set(x, y, c);
        }
      return p.texture();
    }),

  steel: () =>
    once('steel', () => {
      const S = 32, p = new Pix(S, S), r = rng(81);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(P.steel, 0.82 + vnoise(x * 0.08, y * 1.3, 81) * 0.3);
          if (r() < 0.02) c = mul(c, 1.4); // scratches
          if (fbm(x * 0.2, y * 0.2, 82, 2) > 0.7) c = mix(c, P.rust, 0.5);
          p.set(x, y, c);
        }
      return p.texture();
    }),

  hazard: () =>
    once('hazard', () => {
      const S = 32, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = ((x + y) % 16) < 8 ? P.yellow : P.black;
          if (fbm(x * 0.3, y * 0.3, 91, 2) > 0.62) c = mix(c, P.concreteDark, 0.7); // worn
          p.set(x, y, c);
        }
      return p.texture();
    }),

  hay: () =>
    once('hay', () => {
      const S = 32, p = new Pix(S, S), r = rng(101);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mul(P.hay, 0.85 + r() * 0.25);
          if ((x * 2 + y) % 7 === 0) c = P.hayDark;
          if (fbm(x * 0.2, y * 0.2, 102, 2) > 0.7) c = mix(c, hex('#6f6a3a'), 0.5); // weathered grey
          p.set(x, y, c);
        }
      return p.texture();
    }),

  bark: () =>
    once('bark', () => {
      const S = 32, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = vnoise(x * 0.9, y * 0.12, 111);
          let c = mix(P.barkDark, P.bark, n);
          if (fbm(x * 0.3, y * 0.15, 112, 2) > 0.68) c = mix(c, P.moss, 0.6);
          p.set(x, y, c);
        }
      return p.texture();
    }),

  leaves: () =>
    once('leaves', () => {
      const S = 32, p = new Pix(S, S), r = rng(121);
      const pal = [P.leaf0, P.leaf1, P.leaf2, P.leaf3, P.leaf4];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.22, y * 0.22, 121, 3);
          let i = Math.min(4, Math.floor(n * 5.2 + (r() - 0.5) * 0.9));
          i = Math.max(0, i);
          p.set(x, y, pal[i]!);
        }
      return p.texture();
    }),

  leavesOlive: () =>
    once('leavesOlive', () => {
      const S = 32, p = new Pix(S, S), r = rng(131);
      const pal = [hex('#2f3a1c'), hex('#4b5a2a'), hex('#66763a'), hex('#86954a'), hex('#a5ad5c')];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const n = fbm(x * 0.25, y * 0.25, 131, 3);
          const i = Math.max(0, Math.min(4, Math.floor(n * 5.2 + (r() - 0.5) * 0.9)));
          p.set(x, y, pal[i]!);
        }
      return p.texture();
    }),

  /** Transparent climbing-vine decal — the "life over ruin" overlay. */
  vines: () =>
    once('vines', () => {
      const S = 32, p = new Pix(S, S), r = rng(141);
      const pal = [P.leaf1, P.leaf2, P.leaf3, P.leaf4];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          // denser toward the bottom of the tile: vines climb up
          const dens = fbm(x * 0.22, y * 0.22, 141, 3) + (y / S) * 0.25;
          if (dens > 0.6) p.set(x, y, pal[Math.min(3, Math.floor(r() * 4))]!, 255);
          else p.set(x, y, P.leaf0, 0);
        }
      // stems
      for (let k = 0; k < 5; k++) {
        let x = r() * S;
        for (let y = S - 1; y > 0; y--) {
          p.set(x, y, P.leaf0, 255);
          x += r() * 2 - 1;
        }
      }
      // a few wildflower dots
      for (let k = 0; k < 6; k++) p.set(r() * S, r() * S, k % 2 ? hex('#e9e2f0') : hex('#d8b23a'), 255);
      const t = p.texture();
      return t;
    }),

  glass: () =>
    once('glass', () => {
      const S = 16, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = P.glass;
          if ((x + (S - y)) % 11 < 2) c = mix(P.glass, P.glassSky, 0.6); // sky streak
          if (x < 1 || y < 1 || x > S - 2 || y > S - 2 || x === 7 || x === 8 || y === 7 || y === 8) c = P.white; // frame + mullions
          p.set(x, y, c);
        }
      return p.texture({ repeat: false, worldSize: false });
    }),

  glassLit: () =>
    once('glassLit', () => {
      const S = 16, p = new Pix(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = mix(hex('#ffcf7a'), hex('#ff9f45'), y / S);
          if (x < 1 || y < 1 || x > S - 2 || y > S - 2 || x === 7 || x === 8 || y === 7 || y === 8) c = hex('#3a2a1a');
          p.set(x, y, c);
        }
      return p.texture({ repeat: false, worldSize: false });
    }),

  boarded: () =>
    once('boarded', () => {
      const S = 16, p = new Pix(S, S), r = rng(151);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let c = P.black;
          const plank = Math.floor((y + x * 0.35) / 4);
          if (plank % 2 === 0) c = mul(P.oldWood, 0.8 + r() * 0.3);
          if (x < 1 || y < 1 || x > S - 2 || y > S - 2) c = P.whiteShade;
          p.set(x, y, c);
        }
      return p.texture({ repeat: false, worldSize: false });
    }),
};

/** Text painted onto a surface (stencils, signs). Pixelated by thresholding. */
export function textTexture(text: string, opts: { w: number; h: number; bg?: string; fg: string; font: string; worn?: number; seed?: number }): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = opts.w;
  cv.height = opts.h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, opts.w, opts.h);
  }
  ctx.fillStyle = opts.fg;
  ctx.font = opts.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, opts.w / 2, opts.h / 2 + 1);
  // threshold to crisp pixels + wear
  const img = ctx.getImageData(0, 0, opts.w, opts.h);
  const fg = hex(opts.fg);
  const bg = opts.bg ? hex(opts.bg) : null;
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % opts.w, y = Math.floor(i / 4 / opts.w);
    const a = img.data[i + 3]!;
    const isText = bg ? Math.abs(img.data[i]! - fg[0]) + Math.abs(img.data[i + 1]! - fg[1]) < Math.abs(img.data[i]! - bg[0]) + Math.abs(img.data[i + 1]! - bg[1]) : a > 110;
    const worn = fbm(x * 0.3, y * 0.3, opts.seed ?? 7, 2) < (opts.worn ?? 0);
    const c = isText && !worn ? fg : bg;
    if (c) {
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    } else img.data[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const COLORS = P;
```

### src/hd2d/post.ts

Post-processing: tilt-shift and grade shaders, pass order.

```ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * The HD-2D look lives here:
 *  1. Bloom — sunlit edges, lamps, the vault's glow.
 *  2. Tilt-shift — a sharp horizontal focus band through the player, blurring
 *     toward the top and bottom of the frame. Two separable Gaussian passes
 *     whose radius ramps with distance from the band. This is the diorama
 *     miniature feel; it is always on (Mark, 2026-10-23).
 *  3. Mood grade — "bleak and melancholy, overgrown by bright lush life":
 *     dull, low-saturation colors (ruins, rust, dirt) are pushed duller while
 *     already-vivid ones (greens, wildflowers) keep or gain saturation; cool
 *     shadows, warm highlights, vignette, fine grain.
 */

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    dir: { value: new THREE.Vector2(1, 0) },
    focus: { value: 0.46 },
    band: { value: 0.1 },
    falloff: { value: 0.34 },
    maxBlur: { value: 7.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 dir;
    uniform float focus, band, falloff, maxBlur;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - focus);
      float amt = smoothstep(band, band + falloff, d);
      float r = amt * maxBlur;
      if (r < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 sum = vec4(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 14.0);
        sum += texture2D(tDiffuse, vUv + dir * fi * (r / 6.0)) * w;
        wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

const Grade = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    res: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    dull: { value: 1.35 },      // >1 pushes low-saturation colors toward grey
    lush: { value: 1.18 },      // extra saturation on greens
    vignette: { value: 0.42 },
    grain: { value: 0.018 },
    shadowTint: { value: new THREE.Color(0.9, 0.97, 1.08) },
    highTint: { value: new THREE.Color(1.07, 1.0, 0.9) },
    lift: { value: new THREE.Color(0.012, 0.016, 0.026) },
  },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 res;
    uniform float time, dull, lush, vignette, grain;
    uniform vec3 shadowTint, highTint, lift;
    varying vec2 vUv;
    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
    }
    vec3 hsv2rgb(vec3 c) {
      vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
      return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
    }
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 col = max(src.rgb, 0.0);
      vec3 hsv = rgb2hsv(col);
      // life over ruin: dull stays dull, vivid stays vivid
      float s = pow(clamp(hsv.y, 0.0, 1.0), dull);
      float green = smoothstep(0.14, 0.2, hsv.x) * (1.0 - smoothstep(0.42, 0.5, hsv.x));
      s = clamp(s * mix(1.0, lush, green), 0.0, 1.0);
      col = hsv2rgb(vec3(hsv.x, s, hsv.z));
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(shadowTint, highTint, smoothstep(0.04, 0.7, l));
      col += lift * (1.0 - smoothstep(0.0, 0.3, l));
      vec2 p = vUv - 0.5; p.x *= res.x / res.y;
      col *= mix(1.0 - vignette, 1.0, smoothstep(0.98, 0.32, length(p)));
      float n = fract(sin(dot(vUv * res + time * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * grain * (0.4 + l);
      gl_FragColor = vec4(col, src.a);
    }`,
};

export interface PostFX {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  tiltH: ShaderPass;
  tiltV: ShaderPass;
  resize(w: number, h: number): void;
  tick(t: number): void;
  /** Point the render pass at a new area's scene. */
  setScene(s: THREE.Scene, cam?: THREE.Camera): void;
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): PostFX {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.55, 0.82);
  composer.addPass(bloom);
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);
  const tiltH = new ShaderPass(TiltShift);
  const tiltV = new ShaderPass(TiltShift);
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  composer.addPass(new OutputPass());

  const resize = (w: number, h: number): void => {
    composer.setSize(w, h);
    const dpr = renderer.getPixelRatio();
    const pw = w * dpr, ph = h * dpr;
    (tiltH.uniforms.dir!.value as THREE.Vector2).set(1 / pw, 0);
    (tiltV.uniforms.dir!.value as THREE.Vector2).set(0, 1 / ph);
    // blur radius in device pixels scales with resolution
    const blur = 7 * (ph / 720);
    tiltH.uniforms.maxBlur!.value = blur;
    tiltV.uniforms.maxBlur!.value = blur;
    (grade.uniforms.res!.value as THREE.Vector2).set(pw, ph);
  };
  return {
    composer, bloom, grade, tiltH, tiltV, resize,
    tick: (t) => { grade.uniforms.time!.value = t; },
    setScene: (s, cam) => { renderPass.scene = s; if (cam) renderPass.camera = cam; },
  };
}
```

### src/hd2d/mood.ts

Lighting presets and how a mood is applied (sun, hemisphere, fog, shadows).

```ts
import * as THREE from 'three';
import type { PostFX } from './post';

/**
 * Per-scene lighting. Day or night is FIXED per scene (no clock) — Mark,
 * 2026-10-22. The Field is a late, golden afternoon; `?time=night` previews
 * the same diorama after dark for comparison.
 */
export interface Mood {
  night: boolean;
  sun: { color: string; intensity: number; from: THREE.Vector3 };
  hemi: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  grade: { dull: number; lush: number; vignette: number; shadowTint: [number, number, number]; highTint: [number, number, number] };
  /** Flat-lit sprite brightness (the frame is tonemapped as a whole). */
  sprite: [number, number, number];
}

export const DAY: Mood = {
  night: false,
  // low sun from the west-southwest, over the viewer's left shoulder: fronts catch the light, long shadows fall north-east
  sun: { color: '#ffd09a', intensity: 3.4, from: new THREE.Vector3(-13, 10.5, 6.5) },
  hemi: { sky: '#a9c2d8', ground: '#5a5232', intensity: 1.05 },
  fog: { color: '#cdb895', density: 0.016 },
  exposure: 1.05,
  bloom: { strength: 0.42, radius: 0.55, threshold: 0.85 },
  grade: { dull: 1.35, lush: 1.2, vignette: 0.42, shadowTint: [0.9, 0.97, 1.08], highTint: [1.07, 1.0, 0.9] },
  sprite: [1.1, 1.05, 0.98],
};

export const NIGHT: Mood = {
  night: true,
  sun: { color: '#8aa6d8', intensity: 0.85, from: new THREE.Vector3(-8, 14, 5) },
  hemi: { sky: '#22365a', ground: '#0b0d12', intensity: 0.55 },
  fog: { color: '#101a2c', density: 0.03 },
  exposure: 1.15,
  bloom: { strength: 0.9, radius: 0.6, threshold: 0.6 },
  grade: { dull: 1.25, lush: 1.1, vignette: 0.55, shadowTint: [0.85, 0.95, 1.18], highTint: [1.12, 1.0, 0.86] },
  sprite: [0.6, 0.68, 0.95],
};

/** Underground: no sky. A faint cool wash from the vent shafts for shadow
 *  shape; the real light is the colony's own lamps (a pooled set of point
 *  lights the area moves to whichever lamps are near the camera). */
export const UNDER: Mood = {
  night: true,
  sun: { color: '#a8b8d0', intensity: 0.5, from: new THREE.Vector3(-5, 14, 7) },
  hemi: { sky: '#5a6070', ground: '#2a231b', intensity: 1.35 },
  fog: { color: '#07080b', density: 0.014 },
  exposure: 1.25,
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.7 },
  grade: { dull: 1.25, lush: 1.2, vignette: 0.58, shadowTint: [0.86, 0.94, 1.12], highTint: [1.12, 1.0, 0.86] },
  sprite: [0.9, 0.84, 0.8],
};

/** The Cistern: cool green-blue water light under the vaults, warm lamps
 *  and the nursery's soft glow doing the real work. */
export const CISTERN: Mood = {
  night: true,
  sun: { color: '#9fd0c8', intensity: 0.55, from: new THREE.Vector3(-4, 14, 6) },
  hemi: { sky: '#6a8a84', ground: '#2a3a32', intensity: 2.1 },
  fog: { color: '#06100f', density: 0.012 },
  exposure: 1.45,
  bloom: { strength: 0.75, radius: 0.6, threshold: 0.68 },
  grade: { dull: 1.2, lush: 1.25, vignette: 0.56, shadowTint: [0.84, 0.98, 1.06], highTint: [1.1, 1.02, 0.88] },
  sprite: [0.86, 0.9, 0.86],
};

export interface Lights {
  sun: THREE.DirectionalLight;
  follow(target: THREE.Vector3): void;
}

/** Exposure, bloom and grade for a mood — re-applied when returning from a battle stage. */
export function moodPost(renderer: THREE.WebGLRenderer, post: PostFX, m: Mood): void {
  renderer.toneMappingExposure = m.exposure;
  post.bloom.strength = m.bloom.strength;
  post.bloom.radius = m.bloom.radius;
  post.bloom.threshold = m.bloom.threshold;
  const g = post.grade.uniforms;
  g.dull!.value = m.grade.dull;
  g.lush!.value = m.grade.lush;
  g.vignette!.value = m.grade.vignette;
  (g.shadowTint!.value as THREE.Color).setRGB(...m.grade.shadowTint);
  (g.highTint!.value as THREE.Color).setRGB(...m.grade.highTint);
}

export function applyMood(scene: THREE.Scene, renderer: THREE.WebGLRenderer, post: PostFX, m: Mood): Lights {
  scene.background = new THREE.Color(m.fog.color);
  scene.fog = new THREE.FogExp2(m.fog.color, m.fog.density);
  renderer.toneMappingExposure = m.exposure;

  const hemi = new THREE.HemisphereLight(m.hemi.sky, m.hemi.ground, m.hemi.intensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(m.sun.color, m.sun.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 15;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  moodPost(renderer, post, m);

  const texel = (S * 2) / 2048;
  return {
    sun,
    follow(target) {
      // keep the shadow frustum centred on the player, snapped to shadow texels so edges don't shimmer
      const tx = Math.round(target.x / texel) * texel, tz = Math.round(target.z / texel) * texel;
      sun.target.position.set(tx, 0, tz);
      sun.position.set(tx + m.sun.from.x, m.sun.from.y, tz + m.sun.from.z);
    },
  };
}
```

### src/hd2d/world.ts

The tile world: glyph lookup, height, solids.

```ts
/**
 * The active area's ground + collision. Builders (buildings, props, terrain)
 * read heights and register solid footprints here, so the same hand-modeled
 * pieces can be placed in any area. `setWorld` is called once per area load,
 * before anything is built.
 */

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface TileWorld {
  cols: number;
  rows: number;
  /** Ground glyph at a cell: g prairie · T tall grass · d road · w water · # wall/scrub · . floor */
  cell(x: number, z: number): string;
  height(x: number, z: number): number;
  /** Gaps in the edge apron where a road runs off the map (x0..x1 runs along the edge: x on n/s, z on e/w). */
  openings?: Array<{ side: 'n' | 's' | 'e' | 'w'; x0: number; x1: number }>;
  /** Tint override for grass blades (silvered Static patches…). */
  grassTint?(x: number, z: number): string | undefined;
  /** Painted road centre-line test (world units). */
  centerLine?(x: number, z: number): boolean;
  seed?: number;
  /** Paint a ground glyph the shared painter doesn't know (rail ballast, gravel…); return undefined to fall through. */
  paint?(glyph: string, x: number, z: number, fine: number): [number, number, number] | undefined;
}

/** One map's ground + collision. The overworld holds several side by side;
 *  queries run against whichever chunk is active (see useChunk). */
export interface Chunk { w: TileWorld; solids: Rect[] }
const resets: Array<() => void> = [];
let cur: Chunk = { w: { cols: 1, rows: 1, cell: () => '#', height: () => 0 }, solids: [] };

/** Start building a map: a fresh chunk becomes active. */
export function setWorld(w: TileWorld): void {
  cur = { w, solids: [] };
}
/** Clear per-area module state (tree sway lists…) before a new area — or a whole overworld — is built. */
export function beginArea(): void { for (const r of resets) r(); }
export const currentChunk = (): Chunk => cur;
export function useChunk(c: Chunk): void { cur = c; }
export const world = (): TileWorld => cur.w;
export const cell = (x: number, z: number): string => (x >= 0 && z >= 0 && x < cur.w.cols && z < cur.w.rows ? cur.w.cell(x, z) : '#');
export const heightAt = (x: number, z: number): number => cur.w.height(x, z);

/** Register module state to clear whenever a new area loads. */
export function onWorldReset(fn: () => void): void { resets.push(fn); }

export function addSolid(x0: number, z0: number, x1: number, z1: number): void {
  cur.solids.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
}
export function solidRects(): readonly Rect[] { return cur.solids; }
export function hitsSolid(x: number, z: number, r: number): boolean {
  for (const s of cur.solids) if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) return true;
  return false;
}
export function insideSolid(x: number, z: number, pad = 0.1): boolean {
  for (const s of cur.solids) if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad) return true;
  return false;
}
```

### src/hd2d/terrain.ts

The painted ground, aprons beyond the edges, water shader, grass.

```ts
import * as THREE from 'three';
import { fbm, rng, vnoise } from './noise';
import { Pix, TEXEL_PER_UNIT } from './textures';
import { cell, heightAt, solidRects, insideSolid, world } from './world';
import { planeGeo } from './geo';

type RGB = [number, number, number];
const H = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const GRASS_DRY = ['#6c6a3a', '#7d7a45', '#8f8a52', '#5c5c33'].map(H);
const GRASS_LUSH = ['#3d6b26', '#4f7f2f', '#5f9536', '#79ad47', '#335c21'].map(H);
const TALL = ['#2f5420', '#355f22', '#41702a', '#2a4a1c'].map(H);
const ASPHALT = ['#5f5c57', '#6d6a64', '#7a766e', '#55524d'].map(H);
const SCRUB = ['#2f3a1d', '#3d4a25', '#4a5530', '#5a5a35'].map(H);
const MUD = ['#3f3527', '#4a3f2e', '#55493a'].map(H);
const FLOWERS = ['#e3c34a', '#ece6d6', '#5e6fd0', '#c4473a', '#b07ad0'].map(H);

/** Paint the whole outdoor floor as one pixel-art texture, 16px per tile. */
function paintGround(): THREE.CanvasTexture {
  const wd = world();
  const COLS = wd.cols, ROWS = wd.rows;
  const W = COLS * TEXEL_PER_UNIT, Hh = ROWS * TEXEL_PER_UNIT;
  const p = new Pix(W, Hh);
  const r = rng(wd.seed ?? 2026);
  for (let py = 0; py < Hh; py++)
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / TEXEL_PER_UNIT, z = (py + 0.5) / TEXEL_PER_UNIT;
      // jittered lookup → organic, hand-drawn boundaries instead of tile seams
      const jx = x + (fbm(x * 0.9, z * 0.9, 9, 2) - 0.5) * 0.75;
      const jz = z + (fbm(x * 0.9, z * 0.9, 19, 2) - 0.5) * 0.75;
      const c = cell(Math.floor(jx), Math.floor(jz));
      const fine = r();
      let col: RGB;
      const custom = wd.paint?.(c, x, z, fine);
      if (custom) {
        col = custom;
      } else if (c === 'd') {
        const n = fbm(x * 0.6, z * 0.6, 31, 3);
        col = ASPHALT[Math.min(3, Math.floor(n * 3.2 + fine * 0.9))]!;
        // crack network = contour lines of a noise field; weeds push through them
        const cr = fbm(x * 0.55, z * 0.55, 33, 3);
        const crack = Math.abs(cr - 0.5) < 0.012 || Math.abs(fbm(x * 1.3, z * 1.3, 34, 2) - 0.5) < 0.008;
        if (crack) col = vnoise(x * 3, z * 3, 35) > 0.55 ? GRASS_LUSH[1 + Math.floor(fine * 3)]! : H('#3a3733');
        // faded center line
        if (wd.centerLine?.(x, z)) col = H('#b49a52');
        // weathered potholes and gravel
        if (fbm(x * 0.35, z * 0.35, 37, 2) > 0.74) col = fine > 0.5 ? H('#7d6a4c') : H('#6a5a40');
      } else if (c === 'T') {
        col = TALL[Math.floor(fine * TALL.length)]!;
      } else if (c === 'w') {
        col = MUD[Math.floor(fine * MUD.length)]!;
      } else if (c === '#') {
        col = SCRUB[Math.min(3, Math.floor(fbm(x * 0.7, z * 0.7, 41, 2) * 3 + fine * 1.2))]!;
      } else {
        // prairie: big patches of lush life over dry straw
        const lush = fbm(x * 0.13, z * 0.13, 3, 3);
        const pal = lush > 0.5 ? GRASS_LUSH : GRASS_DRY;
        const n = fbm(x * 1.4, z * 1.4, 4, 2);
        col = pal[Math.min(pal.length - 1, Math.floor(n * pal.length * 0.9 + fine * 1.4))]!;
        if (lush > 0.55 && fine > 0.993) col = FLOWERS[Math.floor(r() * FLOWERS.length)]!;
        else if (fine < 0.006) col = H('#6a5638');
      }
      p.set(px, py, col);
    }
  // darken under/around building footprints: a painted contact shadow
  for (const s of solidRects()) {
    for (let z = s.z0 - 0.4; z < s.z1 + 0.4; z += 1 / TEXEL_PER_UNIT)
      for (let x = s.x0 - 0.4; x < s.x1 + 0.4; x += 1 / TEXEL_PER_UNIT) {
        const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
        const d = Math.hypot(dx, dz);
        const k = 0.72 + Math.min(1, d / 0.4) * 0.28;
        const px = Math.floor(x * TEXEL_PER_UNIT), py = Math.floor(z * TEXEL_PER_UNIT);
        if (px < 0 || py < 0 || px >= W || py >= Hh) continue;
        const c = p.get(px, py);
        p.set(px, py, [c[0] * k, c[1] * k, c[2] * k]);
      }
  }
  const t = p.texture({ repeat: false, worldSize: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Maps built into the overworld skip their own edge aprons. */
let aprons = true;
export function setAprons(on: boolean): void { aprons = on; }

/** Overgrown scrub for the land beyond the map edge. */
let scrubCache: THREE.Texture | null = null;
export function scrubTex(): THREE.Texture {
  if (scrubCache) return scrubCache;
  const S = 64, p = new Pix(S, S), r = rng(99);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = fbm(x * 0.09, y * 0.09, 98, 3);
      const pal = n > 0.5 ? GRASS_LUSH : SCRUB;
      p.set(x, y, pal[Math.min(pal.length - 1, Math.floor(r() * 1.3 + n * pal.length * 0.8))]!);
    }
  scrubCache = p.texture();
  return scrubCache;
}

export function buildGround(scene: THREE.Scene): void {
  const { cols: COLS, rows: ROWS, openings = [] } = world();
  const g = new THREE.PlaneGeometry(COLS, ROWS, COLS * 4, ROWS * 4);
  g.rotateX(-Math.PI / 2);
  g.translate(COLS / 2, 0, ROWS / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: paintGround(), roughness: 1, metalness: 0 }));
  m.receiveShadow = true;
  scene.add(m);
  if (!aprons) return; // the overworld frames all its chunks at once

  // a frame of scrubland beyond the map edge (level with the berm top), so
  // the diorama never shows a void at the edges of the camera
  const apronMat = new THREE.MeshStandardMaterial({ map: scrubTex(), roughness: 1 });
  const bankMat = new THREE.MeshStandardMaterial({ color: '#2b2419', roughness: 1, side: THREE.DoubleSide });
  const roadMat = new THREE.MeshStandardMaterial({ color: '#5f5c57', roughness: 1 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: '#6a5238', roughness: 1 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: '#7a746a', roughness: 1 });
  const E = 40;
  // each side's apron sits level with that edge's berm top
  const edgeY = (side: 'n' | 's' | 'w' | 'e'): number => {
    let sum = 0, n = 0;
    for (let t = 0.5; t < (side === 'n' || side === 's' ? COLS : ROWS); t += 1) {
      const [x, z] = side === 'n' ? [t, 0] : side === 's' ? [t, ROWS] : side === 'w' ? [0, t] : [COLS, t];
      sum += heightAt(x, z);
      n++;
    }
    return sum / n;
  };
  const rects: Array<[number, number, number, number, number]> = [];
  for (const side of ['n', 's', 'w', 'e'] as const) {
    const ns = side === 'n' || side === 's';
    // the apron band beyond this edge: along-edge span a0..a1, depth d0..d1
    const a0 = ns ? -E : 0, a1 = ns ? COLS + E : ROWS;
    const d0 = side === 'n' ? -E : side === 's' ? ROWS : side === 'w' ? -E : COLS;
    const d1 = side === 'n' ? 0 : side === 's' ? ROWS + E : side === 'w' ? 0 : COLS + E;
    const ay = edgeY(side);
    const band = (s0: number, s1: number): void => { if (s1 > s0) rects.push(ns ? [s0, d0, s1, d1, ay] : [d0, s0, d1, s1, ay]); };
    let a = a0;
    for (const o of openings.filter((q) => q.side === side).sort((p, q) => p.x0 - q.x0)) {
      band(a, o.x0);
      a = o.x1;
      const mid = (o.x0 + o.x1) / 2;
      const ry = heightAt(ns ? mid : side === 'w' ? 0.01 : COLS - 0.01, ns ? (side === 'n' ? 0.01 : ROWS - 0.01) : mid);
      // the road cut through the berm gets its own banks, and runs on out of frame
      for (const b of [o.x0, o.x1]) {
        const bank = new THREE.Mesh(new THREE.PlaneGeometry(E, Math.max(0.1, ay - ry + 0.05)), bankMat);
        if (ns) { bank.rotation.y = Math.PI / 2; bank.position.set(b, (ay + ry) / 2, (d0 + d1) / 2); }
        else bank.position.set((d0 + d1) / 2, (ay + ry) / 2, b);
        scene.add(bank);
      }
      // the road out matches whatever runs off the edge: blacktop, a dirt lane, gravel
      const g0 = cell(Math.floor(ns ? mid : side === 'w' ? 0 : COLS - 1), Math.floor(ns ? (side === 'n' ? 0 : ROWS - 1) : mid));
      const outMat = g0 === 'e' ? dirtMat : g0 === 'v' ? gravelMat : roadMat;
      const out = new THREE.Mesh(new THREE.PlaneGeometry(ns ? o.x1 - o.x0 : E, ns ? E : o.x1 - o.x0), outMat);
      out.rotation.x = -Math.PI / 2;
      out.position.set(ns ? mid : (d0 + d1) / 2, ry + 0.01, ns ? (d0 + d1) / 2 : mid);
      out.receiveShadow = true;
      scene.add(out);
    }
    band(a, a1);
  }
  for (const [ax0, az0, ax1, az1, y] of rects) {
    // tuck each apron half a unit under the map edge so no seam shows the sky
    const x0 = ax0 === COLS ? COLS - 0.5 : ax0, x1 = ax1 === 0 ? 0.5 : ax1;
    const z0 = az0 === ROWS ? ROWS - 0.5 : az0, z1 = az1 === 0 ? 0.5 : az1;
    const a = new THREE.Mesh(planeGeo(x1 - x0, z1 - z0), apronMat);
    a.rotation.x = -Math.PI / 2;
    a.position.set((x0 + x1) / 2, y - 0.02, (z0 + z1) / 2);
    a.receiveShadow = true;
    scene.add(a);
  }
}

// ------------------------------------------------------------------ water

/** A shader creek over the rect x0..x1, z0..z1 (banks shallow, centre deep). */
export function buildWater(scene: THREE.Scene, night: boolean, x0: number, z0: number, x1: number, z1: number, y: number, cells?: Array<[number, number]>): (t: number) => void {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      bankA: { value: z0 + 0.4 },
      bankB: { value: z1 - 0.6 },
      deep: { value: new THREE.Color(night ? '#0b1a24' : '#1d3a38') },
      shallow: { value: new THREE.Color(night ? '#1d3346' : '#4f7a6a') },
      sky: { value: new THREE.Color(night ? '#5f7fb0' : '#e8d6b0') },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying float vFog;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, fogDensity, bankA, bankB; uniform vec3 deep, shallow, sky, fogColor;
      varying vec3 vW; varying float vFog;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = floor(vW.xz * 16.0) / 16.0; // ripples snap to the 16-texel world grid
        float rip = sin(p.x * 3.1 + uTime * 1.3 + sin(p.y * 2.0)) * 0.5 + sin(p.y * 4.3 - uTime * 0.9 + p.x) * 0.5;
        float band = smoothstep(0.78, 1.0, rip) * (0.5 + 0.5 * sin(p.x * 0.73 + p.y * 1.9 + uTime * 0.35));
        // depth: shallower near the banks (z 24 / 27)
        float edge = min(abs(p.y - bankA), abs(p.y - bankB));
        vec3 col = mix(shallow, deep, smoothstep(0.1, 1.2, edge));
        col = mix(col, sky, band * 0.1);
        // pixel-snapped sun glints
        vec2 q = floor(p * 16.0);
        float g = step(0.985, h(q + floor(uTime * 3.0))) * band;
        col += sky * g * 1.2;
        float f = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
        col = mix(col, fogColor, f);
        gl_FragColor = vec4(col, 0.88);
      }`,
  });
  let m: THREE.Mesh;
  if (cells) {
    // one quad per water cell (any shape of pool); world-space positions
    const pos: number[] = [];
    for (const [cx, cz] of cells) pos.push(cx, 0, cz, cx, 0, cz + 1, cx + 1, 0, cz, cx + 1, 0, cz, cx, 0, cz + 1, cx + 1, 0, cz + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    m = new THREE.Mesh(g, mat);
    m.position.y = y;
  } else {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
    g.rotateX(-Math.PI / 2);
    m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  }
  scene.add(m);
  return (t) => {
    mat.uniforms.uTime!.value = t;
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      (mat.uniforms.fogColor!.value as THREE.Color).copy(fog.color);
      mat.uniforms.fogDensity!.value = fog.density;
    }
  };
}

// ------------------------------------------------- grass, tufts, flowers

/** A clump of 3 tapered blades. Normals point up so grass catches light like a
 *  painted field rather than flickering with blade orientation. */
function clumpGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], nrm: number[] = [];
  const base = new THREE.Color('#1e3a14'), tip = new THREE.Color('#9fd05a');
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI + 0.3;
    const ca = Math.cos(a) * 0.07, sa = Math.sin(a) * 0.07;
    const lean = (b - 1) * 0.08;
    const tri = [
      [-ca, 0, -sa, 0], [ca, 0, sa, 0], [lean * 0.5 - ca * 0.4, 0.55, -sa * 0.4, 0.55],
      [ca, 0, sa, 0], [lean * 0.5 + ca * 0.4, 0.55, sa * 0.4, 0.55], [lean * 0.5 - ca * 0.4, 0.55, -sa * 0.4, 0.55],
      [lean * 0.5 - ca * 0.4, 0.55, -sa * 0.4, 0.55], [lean * 0.5 + ca * 0.4, 0.55, sa * 0.4, 0.55], [lean, 1.0, 0, 1],
    ];
    for (const [x, y, z, t] of tri) {
      pos.push(x!, y!, z!);
      const c = base.clone().lerp(tip, t!);
      col.push(c.r, c.g, c.b);
      nrm.push(0, 1, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

function swayMaterial(uTime: { value: number }, amount: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
       float wv = sin(uTime * 1.5 + ip.x * 0.55 + ip.y * 0.35) * 0.6 + sin(uTime * 2.9 + ip.x * 1.7) * 0.25;
       float k = position.y * position.y * ${amount.toFixed(3)};
       transformed.x += wv * k;
       transformed.z += wv * k * 0.4;`,
    );
  };
  return m;
}


export function buildGrass(scene: THREE.Scene): (t: number) => void {
  const uTime = { value: 0 };
  const r = rng(77);
  const clump = clumpGeometry();
  type Spot = { x: number; z: number; s: number; c: THREE.Color };
  const spots: Spot[] = [];
  const { cols: COLS, rows: ROWS } = world();
  const tallTints = ['#cfe8a0', '#e8f0b8', '#b8d890', '#f0e8a8'];
  const shortTints = ['#d8e0a0', '#c8d890', '#e8d898', '#b0c880'];
  for (let z = 0; z < ROWS; z++)
    for (let x = 0; x < COLS; x++) {
      const c = cell(x, z);
      const n = c === 'T' ? 30 : c === 'g' ? (fbm(x * 0.13, z * 0.13, 3, 3) > 0.5 ? 6 : 3) : c === '#' ? 5 : 0;
      for (let i = 0; i < n; i++) {
        const px = x + r(), pz = z + r();
        if (insideSolid(px, pz)) continue;
        const tall = c === 'T' || c === '#';
        const pick = tall ? tallTints[Math.floor(r() * 4)]! : shortTints[Math.floor(r() * 4)]!;
        spots.push({
          x: px, z: pz,
          s: tall ? 0.55 + r() * 0.45 : 0.22 + r() * 0.2,
          c: new THREE.Color(world().grassTint?.(px, pz) ?? pick),
        });
      }
    }
  // tall grass hugging the road edges and building walls: life reclaiming the town
  for (let z = 1; z < ROWS - 1; z++)
    for (let x = 1; x < COLS - 1; x++) {
      if (cell(x, z) !== 'g') continue;
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cell(x + dx!, z + dz!) === 'd');
      if (!nearRoad) continue;
      for (let i = 0; i < 4; i++) {
        const px = x + r(), pz = z + r();
        if (insideSolid(px, pz)) continue;
        spots.push({ x: px, z: pz, s: 0.35 + r() * 0.3, c: new THREE.Color(tallTints[Math.floor(r() * 4)]!) });
      }
    }
  const mesh = new THREE.InstancedMesh(clump, swayMaterial(uTime, 0.16), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  spots.forEach((s, i) => {
    e.set(0, r() * Math.PI * 2, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(s.x, heightAt(s.x, s.z) - 0.02, s.z), q, new THREE.Vector3(s.s * 1.1, s.s, s.s * 1.1));
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, s.c);
  });
  mesh.receiveShadow = true;
  scene.add(mesh);

  // wildflowers: lupines, Indian paintbrush, yellow coneflower, white yarrow
  const fl: Spot[] = [];
  const FL = ['#5a6ee0', '#d8483a', '#f0c63a', '#f2ece0', '#b97ae0'];
  for (let k = 0; k < 900; k++) {
    const x = 1 + r() * (COLS - 2), z = 1 + r() * (ROWS - 2);
    const c = cell(Math.floor(x), Math.floor(z));
    if (c !== 'g' && c !== 'T') continue;
    const lush = fbm(x * 0.13, z * 0.13, 3, 3);
    if (lush < 0.52 && r() > 0.25) continue;
    if (insideSolid(x, z)) continue;
    // flowers grow in drifts
    const drift = Math.floor(fbm(x * 0.25, z * 0.25, 88, 2) * FL.length);
    fl.push({ x, z, s: 0.16 + r() * 0.1, c: new THREE.Color(FL[(drift + (r() > 0.8 ? 1 : 0)) % FL.length]!) });
  }
  const head = new THREE.IcosahedronGeometry(0.11, 0);
  head.translate(0, 0.32, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3);
  stem.translate(0, 0.16, 0);
  const flowerMat = swayMaterial(uTime, 0.5);
  flowerMat.vertexColors = false;
  const heads = new THREE.InstancedMesh(head, flowerMat, fl.length);
  const stems = new THREE.InstancedMesh(stem, new THREE.MeshLambertMaterial({ color: '#3f6b28' }), fl.length);
  fl.forEach((s, i) => {
    m4.compose(new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z), q.identity(), new THREE.Vector3(s.s * 4, s.s * 4, s.s * 4));
    heads.setMatrixAt(i, m4);
    heads.setColorAt(i, s.c);
    stems.setMatrixAt(i, m4);
  });
  heads.receiveShadow = stems.receiveShadow = true;
  scene.add(heads, stems);

  return (t) => { uTime.value = t; };
}
```

### src/hd2d/field/props.ts

Foliage (blob crowns, cottonwood, mesquite, dead tree, bush), sway, power lines, truck, crates, tumbleweed, motes.

```ts
import * as THREE from 'three';
import { T, textTexture } from '../textures';
import { box, cyl, beam, boxGeo, cylGeo, texMat, colMat, shade } from '../geo';
import { addSolid, heightAt, cell, onWorldReset } from '../world';
import { COLS, ROWS } from './layout';
import { rng, vnoise } from '../noise';
import type { Built } from './buildings';

const M = {
  bark: () => texMat('bark', T.bark()),
  wood: () => texMat('oldWood', T.oldWood()),
  rust: () => texMat('rustTank', T.rustTank(), { metalness: 0.25, roughness: 0.7 }),
  steel: () => texMat('steel', T.steel(), { metalness: 0.35, roughness: 0.65 }),
  concrete: () => texMat('concrete', T.concrete()),
  vine: () => texMat('vines', T.vines(), { alphaTest: 0.5, side: THREE.DoubleSide }),
  dark: () => colMat('#0d0c0b', { roughness: 1 }),
};

// ------------------------------------------------------------------ trees

/** An irregular foliage blob: displaced icosahedron, flat-shaded facets,
 *  leaf texture tiled at world density. */
export function blobGeo(r: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 0.82 + vnoise(v.x * 2.1 + seed, v.y * 2.1 + v.z * 1.3, seed) * 0.36;
    v.multiplyScalar(k);
    v.y *= 0.82;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6, uv.getY(i) * r * 3);
  g.computeVertexNormals();
  return g;
}

const leafMats = new Map<string, THREE.MeshStandardMaterial>();
export function leafMat(tint: string, olive = false): THREE.MeshStandardMaterial {
  const k = tint + olive;
  let m = leafMats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: olive ? T.leavesOlive() : T.leaves(), color: tint, roughness: 0.95, flatShading: true });
    leafMats.set(k, m);
  }
  return m;
}

type Sway = { obj: THREE.Object3D; phase: number; amp: number };
const sways: Sway[] = [];
onWorldReset(() => { sways.length = 0; });
/** Sway every tree/bush crown built for the current area. */
export function swayTrees(t: number): void {
  for (const s of sways) s.obj.rotation.z = Math.sin(t * 0.9 + s.phase) * s.amp;
}

export function cottonwood(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const trunkH = 1.7 * s;
  g.add(cyl(0.13 * s, 0.24 * s, trunkH, M.bark(), 0, -0.1, 0, 8));
  const crown = new THREE.Group();
  crown.position.y = trunkH * 0.92;
  const tints = ['#ffffff', '#e8f2d0', '#d6e8b8', '#f2f6dc'];
  const tint = tints[Math.floor(r() * tints.length)]!;
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, d = (i === 0 ? 0 : 0.55 + r() * 0.45) * s;
    const b = new THREE.Mesh(blobGeo((0.62 + r() * 0.38) * s, seed + i), leafMat(tint));
    b.position.set(Math.cos(a) * d, (0.35 + r() * 0.75) * s, Math.sin(a) * d);
    crown.add(shade(b));
    if (i > 0 && r() > 0.4) crown.add(beam(new THREE.Vector3(0, -0.2 * s, 0), b.position.clone().multiplyScalar(0.7), 0.07 * s, M.bark()));
  }
  g.add(crown);
  sways.push({ obj: crown, phase: r() * 6.28, amp: 0.018 });
  g.position.set(x, heightAt(x, z), z);
  return g;
}

export function mesquite(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const crown = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + r();
    const top = new THREE.Vector3(Math.cos(a) * 0.55 * s, 1.2 * s + r() * 0.3, Math.sin(a) * 0.55 * s);
    g.add(beam(new THREE.Vector3(0, -0.1, 0), top, 0.1 * s, M.bark()));
    const b = new THREE.Mesh(blobGeo((0.55 + r() * 0.25) * s, seed + i), leafMat('#ffffff', true));
    b.scale.y = 0.55;
    b.position.copy(top).add(new THREE.Vector3(0, 0.1, 0));
    crown.add(shade(b));
  }
  g.add(crown);
  sways.push({ obj: crown, phase: r() * 6.28, amp: 0.012 });
  g.position.set(x, heightAt(x, z), z);
  return g;
}

/** A dead tree — the bleak part — with green life already climbing it. */
export function deadTree(x: number, z: number, s: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, th: number, depth: number): void => {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    g.add(beam(from, to, th, M.bark()));
    if (depth > 0 && r() > 0.25) {
      for (let i = 0; i < 2; i++) {
        const d = dir.clone().add(new THREE.Vector3(r() - 0.5, r() * 0.3, r() - 0.5).multiplyScalar(1.4)).normalize();
        grow(to, d, len * 0.65, th * 0.62, depth - 1);
      }
    } else if (r() > 0.45) {
      const leaf = new THREE.Mesh(blobGeo(0.18 + r() * 0.12, seed + depth), leafMat('#ffffff'));
      leaf.position.copy(to);
      g.add(shade(leaf));
    }
  };
  grow(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0.05, 1, 0), 1.6 * s, 0.2 * s, 3);
  const v = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), M.vine());
  v.position.set(0, 0.7, 0.13);
  g.add(v);
  g.position.set(x, heightAt(x, z), z);
  return g;
}

export function bush(x: number, z: number, s: number, seed: number, olive = false): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(blobGeo((0.35 + r() * 0.2) * s, seed + i * 3), leafMat('#ffffff', olive));
    b.position.set((r() - 0.5) * 0.6 * s, 0.22 * s, (r() - 0.5) * 0.5 * s);
    g.add(shade(b));
  }
  g.position.set(x, heightAt(x, z), z);
  return g;
}

// ---------------------------------------------------------- power lines

export function powerLine(scene: THREE.Scene, poles: Array<[number, number, number]>, links: Array<[number, number]>): void {
  const r = rng(515);
  const tips: THREE.Vector3[][] = [];
  for (const [x, z, lean] of poles) {
    const g = new THREE.Group();
    g.add(cyl(0.07, 0.1, 4.3, M.wood(), 0, -0.2, 0, 7));
    const armBroken = r() < 0.15;
    const arm = box(1.3, 0.1, 0.1, M.wood(), 0, 3.85, 0);
    if (armBroken) arm.rotation.z = 0.35;
    g.add(arm);
    for (const dx of [-0.55, 0, 0.55]) g.add(cyl(0.035, 0.035, 0.13, colMat('#6f8f7a', { roughness: 0.3 }), dx, 3.95, 0, 6));
    g.rotation.z = lean;
    g.position.set(x, heightAt(x, z), z);
    g.updateMatrixWorld(true);
    scene.add(g);
    addSolid(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
    tips.push([-0.55, 0, 0.55].map((dx) => new THREE.Vector3(dx, 4.05, 0).applyMatrix4(g.matrixWorld)));
  }
  const wireMat = new THREE.MeshBasicMaterial({ color: '#1c1b1a' });
  for (const [a, b] of links) {
    for (let w = 0; w < 3; w++) {
      const p = tips[a]![w]!, q = tips[b]![w]!;
      const mid = p.clone().lerp(q, 0.5);
      mid.y -= 0.35 + p.distanceTo(q) * 0.035; // catenary sag
      const curve = new THREE.QuadraticBezierCurve3(p, mid, q);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.014, 3, false), wireMat));
    }
  }
}

// ---------------------------------------------------------- set dressing

export function truck(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  const paint = colMat('#4f6a78', { roughness: 0.85, metalness: 0.2 });
  g.add(box(1.0, 0.55, 1.3, M.rust(), -0.55, 0.32, 0));
  g.add(box(0.95, 0.42, 1.25, paint, 0.42, 0.32, 0));
  g.add(box(0.82, 0.5, 1.2, paint, -0.12, 0.87, 0));
  g.add(box(0.05, 0.36, 1.0, colMat('#26313a', { roughness: 0.2 }), 0.3, 0.95, 0));
  g.add(box(1.0, 0.25, 0.06, M.rust(), -0.55, 0.87, 0.62));
  g.add(box(1.0, 0.25, 0.06, M.rust(), -0.55, 0.87, -0.62));
  g.add(box(0.06, 0.25, 1.3, M.rust(), -1.05, 0.87, 0));
  for (const [wx, wz, sink] of [[0.55, 0.62, 0], [0.55, -0.62, 0.08], [-0.75, 0.62, 0.12], [-0.75, -0.62, 0]] as Array<[number, number, number]>) {
    const w = new THREE.Mesh(cylGeo(0.27, 0.27, 0.2, 12), colMat('#1d1b19'));
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.27 - sink, wz);
    g.add(shade(w));
  }
  // a sapling has rooted in the bed — life over ruin
  const sap = new THREE.Mesh(blobGeo(0.4, 71), leafMat('#ffffff'));
  sap.position.set(-0.55, 1.35, 0);
  g.add(shade(sap));
  g.add(box(0.06, 0.6, 0.06, M.bark(), -0.55, 0.7, 0));
  const v = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), M.vine());
  v.position.set(-0.1, 0.62, 0.66);
  g.add(v);
  g.position.set(x, heightAt(x, z) - 0.05, z);
  g.rotation.y = 0.18;
  scene.add(g);
  addSolid(x - 1.2, z - 0.75, x + 1.0, z + 0.75);
}

export function crates(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.add(box(0.6, 0.6, 0.6, M.wood(), 0, 0, 0));
  g.add(box(0.5, 0.5, 0.5, M.wood(), 0.62, 0, 0.05));
  g.add(box(0.45, 0.45, 0.45, M.wood(), 0.15, 0.6, 0.02).rotateY(0.3));
  g.add(cyl(0.26, 0.26, 0.75, M.rust(), 1.25, 0, 0.1, 10));
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.35, z - 0.35, x + 1.55, z + 0.4);
}

function fieldSign(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.add(box(0.09, 1.25, 0.09, M.wood(), -0.5, 0, 0));
  g.add(box(0.09, 1.1, 0.09, M.wood(), 0.5, 0, 0));
  const board = new THREE.Mesh(boxGeo(1.3, 0.5, 0.06), [M.wood(), M.wood(), M.wood(), M.wood(),
    new THREE.MeshStandardMaterial({ map: textTexture('THE FIELD', { w: 64, h: 24, bg: '#7d6b52', fg: '#efe6d0', font: 'bold 11px monospace', worn: 0.3, seed: 3 }), roughness: 1 }),
    M.wood()]);
  board.position.set(0, 1.0, 0.05);
  board.rotation.z = -0.05;
  g.add(shade(board));
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = -0.25;
  scene.add(g);
  addSolid(x - 0.6, z - 0.12, x + 0.6, z + 0.12);
}

function hitchingPost(scene: THREE.Scene, x: number, z: number): void {
  const g = new THREE.Group();
  g.add(box(0.1, 0.9, 0.1, M.wood(), -0.6, 0, 0));
  g.add(box(0.1, 0.9, 0.1, M.wood(), 0.6, 0, 0));
  g.add(box(1.4, 0.08, 0.08, M.wood(), 0, 0.82, 0));
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.7, z - 0.1, x + 0.7, z + 0.1);
}

function churchyard(scene: THREE.Scene): void {
  const stones: Array<[number, number, number]> = [[8.9, 23.35, 0.08], [9.8, 23.5, -0.15], [11.15, 23.35, 0.05]];
  for (const [x, z, tilt] of stones) {
    const g = new THREE.Group();
    g.add(box(0.36, 0.42, 0.1, M.concrete(), 0, 0, 0));
    const top = new THREE.Mesh(cylGeo(0.18, 0.18, 0.1, 10).rotateX(Math.PI / 2), M.concrete());
    top.position.y = 0.42;
    g.add(shade(top));
    g.rotation.z = tilt;
    g.position.set(x, heightAt(x, z) - 0.04, z);
    scene.add(g);
    addSolid(x - 0.2, z - 0.1, x + 0.2, z + 0.1);
  }
  const cross = new THREE.Group();
  cross.add(box(0.06, 0.7, 0.06, M.wood(), 0, 0, 0));
  cross.add(box(0.36, 0.06, 0.06, M.wood(), 0, 0.48, 0));
  cross.position.set(10.45, heightAt(10.45, 23.6), 23.6);
  cross.rotation.z = -0.2;
  scene.add(cross);
}

export function tumbleweed(scene: THREE.Scene, x: number, z: number, seed: number): void {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial({ color: '#8a7246', wireframe: true }));
  const r = rng(seed);
  m.rotation.set(r() * 3, r() * 3, r() * 3);
  m.position.set(x, heightAt(x, z) + 0.26, z);
  m.castShadow = true;
  scene.add(m);
}

function reeds(scene: THREE.Scene): void {
  const r = rng(909);
  const stalk = new THREE.CylinderGeometry(0.012, 0.018, 1, 3).translate(0, 0.5, 0);
  const head = new THREE.CylinderGeometry(0.035, 0.035, 0.18, 5).translate(0, 1.0, 0);
  const n = 160;
  const sm = new THREE.InstancedMesh(stalk, new THREE.MeshLambertMaterial({ color: '#5f7a34' }), n);
  const hm = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial({ color: '#5a3a22' }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const x = 1.2 + r() * 17.2;
    const z = r() < 0.75 ? 23.75 + r() * 0.45 : 26.8 + r() * 0.3;
    e.set((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25);
    q.setFromEuler(e);
    const s = 0.55 + r() * 0.5;
    m4.compose(new THREE.Vector3(x, heightAt(x, z) - 0.05, z), q, new THREE.Vector3(1, s, 1));
    sm.setMatrixAt(i, m4);
    hm.setMatrixAt(i, m4);
  }
  sm.receiveShadow = hm.receiveShadow = true;
  scene.add(sm, hm);
  // stones along the bank
  for (let i = 0; i < 22; i++) {
    const x = 1.2 + r() * 17, z = 23.9 + r() * 0.3;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + r() * 0.15, 0), M.concrete());
    s.position.set(x, heightAt(x, z), z);
    s.scale.y = 0.6;
    scene.add(shade(s));
  }
}

// ---------------------------------------------------------------- motes

export function motes(scene: THREE.Scene, night: boolean): (t: number, focus: THREE.Vector3) => void {
  const N = night ? 140 : 220;
  const g = new THREE.BufferGeometry();
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3);
  const r = rng(321);
  for (let i = 0; i < N; i++) {
    base[i * 3] = (r() - 0.5) * 26;
    base[i * 3 + 1] = 0.3 + r() * (night ? 2.2 : 3.5);
    base[i * 3 + 2] = (r() - 0.5) * 18;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: night ? '#c8ff70' : '#fff2c8', size: night ? 0.09 : 0.055, transparent: true, opacity: night ? 1 : 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return (t, f) => {
    for (let i = 0; i < N; i++) {
      const bx = base[i * 3]!, by = base[i * 3 + 1]!, bz = base[i * 3 + 2]!;
      // drift on the breeze, wrapped into a box that travels with the player
      let x = bx + Math.sin(t * 0.21 + i) * 0.6 + t * 0.12;
      let z = bz + Math.cos(t * 0.17 + i * 1.3) * 0.5;
      x = ((((x - f.x) % 26) + 39) % 26) - 13 + f.x;
      z = ((((z - f.z) % 18) + 27) % 18) - 9 + f.z;
      pos[i * 3] = x;
      pos[i * 3 + 1] = by + Math.sin(t * 0.6 + i * 0.7) * 0.18;
      pos[i * 3 + 2] = z;
    }
    g.attributes.position!.needsUpdate = true;
    if (night) mat.opacity = 0.65 + Math.sin(t * 3.1) * 0.35;
  };
}

// ------------------------------------------------------------------ build

export function buildProps(scene: THREE.Scene, night: boolean): Built & { motes: (t: number, f: THREE.Vector3) => void } {
  const add = (o: THREE.Object3D, solid?: [number, number]): void => {
    scene.add(o);
    if (solid) addSolid(o.position.x - solid[0], o.position.z - solid[1], o.position.x + solid[0], o.position.z + solid[1]);
  };
  // trees from the original layout (nudged clear of the new building footprints)
  const T2: Array<[number, number, 'c' | 'm' | 'd', number]> = [
    [4.5, 10.5, 'c', 1.0], [13.5, 5.5, 'c', 1.15], [27.5, 7.4, 'm', 1.2], [37.5, 16.6, 'c', 0.95],
    [3.5, 16.6, 'm', 1.0], [34.5, 16.6, 'c', 0.9], [6.5, 8.4, 'd', 1.0], [24.5, 4.5, 'c', 1.05],
    [11.6, 18.4, 'm', 0.9], [30.5, 25.5, 'c', 1.0], [16.6, 5.0, 'd', 1.1],
  ];
  let seed = 1000;
  for (const [x, z, k, s] of T2) {
    const tree = k === 'c' ? cottonwood(x, z, s, seed++) : k === 'm' ? mesquite(x, z, s, seed++) : deadTree(x, z, s, seed++);
    add(tree, [0.25, 0.25]);
  }
  // framing woods along the berm and beyond the edge (the diorama's walls)
  const r = rng(4242);
  for (let x = -6; x < COLS + 6; x += 1.6 + r() * 1.2) {
    if (x > 17.6 && x < 23.4) continue; // keep the road out to the Farm Road clear
    add(cottonwood(x, -0.4 - r() * 3.5, 1.15 + r() * 0.5, seed++));
    if (r() > 0.5) add(cottonwood(x + 0.8, 0.5 + r() * 0.4, 0.8 + r() * 0.3, seed++));
  }
  for (let z = 1; z < ROWS + 2; z += 1.5 + r() * 1.3) {
    if (z > 11.8 && z < 17.2) continue; // main street runs out both sides
    add(r() > 0.3 ? cottonwood(-0.6 - r() * 2.5, z, 1.0 + r() * 0.4, seed++) : mesquite(-0.5, z, 1.2, seed++));
    add(r() > 0.3 ? cottonwood(COLS + 0.6 + r() * 2.5, z, 1.0 + r() * 0.4, seed++) : mesquite(COLS + 0.5, z, 1.2, seed++));
  }
  for (let x = 0; x < COLS; x += 1.1 + r() * 1.4) add(bush(x, ROWS - 0.35 + r() * 0.6, 0.9 + r() * 0.5, seed++, r() > 0.6));
  // bushes against walls and in corners: life pressing back in
  for (const [x, z, s] of [[5.0, 12.9, 0.8], [9.9, 12.9, 0.7], [14.0, 12.85, 0.9], [26.3, 12.8, 0.8], [31.6, 12.75, 0.9], [8.4, 22.2, 0.8], [17.9, 22.6, 0.7], [24.0, 21.6, 0.8], [33.5, 22.9, 0.7]] as Array<[number, number, number]>)
    add(bush(x, z, s, seed++));
  for (let i = 0; i < 26; i++) {
    const x = 1.5 + r() * (COLS - 3), z = 1.5 + r() * (ROWS - 3);
    const c = cell(Math.floor(x), Math.floor(z));
    if (c !== 'g') continue;
    add(bush(x, z, 0.55 + r() * 0.4, seed++, r() > 0.5));
  }

  // power line along the north side of main street, plus the spur up the north road
  powerLine(scene,
    [[2.6, 12.85, 0.02], [10.4, 12.85, -0.04], [18.85, 12.85, 0.0], [25.6, 12.85, 0.09], [33.1, 12.85, 0.01], [38.4, 12.85, -0.05], [22.35, 8.4, 0.03], [22.35, 3.4, -0.07]],
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7]]);

  truck(scene, 7.1, 16.9);
  crates(scene, 22.5, 12.1);
  fieldSign(scene, 22.7, 16.7);
  hitchingPost(scene, 15.2, 16.5);
  churchyard(scene);
  reeds(scene);
  for (const [x, z, s] of [[26.8, 16.4, 1], [6.6, 14.2, 2], [14.4, 9.0, 3]] as Array<[number, number, number]>) tumbleweed(scene, x, z, s);

  return {
    update(t) {
      swayTrees(t);
    },
    motes: motes(scene, night),
  };
}
```

### src/hd2d/region1/section.ts

The section kit: glyph grid, region painter, edges, exits, height.

```ts
import * as THREE from 'three';
import { fbm, rng, vnoise } from '../noise';
import { setWorld, cell, heightAt, hitsSolid, addSolid, type TileWorld } from '../world';
import { buildGround, buildGrass, buildWater } from '../terrain';
import { maskAt } from '../field/layout';
import { cottonwood, mesquite, deadTree, bush, motes, swayTrees } from '../field/props';
import { fence } from '../farmroad/area';
import type { Built } from '../field/buildings';
import { DAY, NIGHT, type Mood } from '../mood';
import type { Area, AreaBuilder, NPC, SectionKind, Spot, Thing, Travel, Trigger } from '../area';
import { rock } from './props';

/**
 * One section of a region (docs/design/regions.md): a hand-dressed map built
 * from a short spec. The kit paints the ground from a glyph grid the section
 * draws, frames each edge naturally (trees, scrub, a fence line, a bluff, or
 * open grass), cuts the exits, and wires spawns + triggers so walking off an
 * edge lands you on the matching edge of the next map.
 *
 * Glyphs: g prairie · T tall grass (wild Ohms) · d asphalt · e dirt road ·
 * v gravel · x dry cracked earth · k red clay · w water · # edge scrub.
 */

export type Side = 'n' | 's' | 'e' | 'w';
export type EdgeStyle = 'trees' | 'scrub' | 'fence' | 'bluff' | 'open' | 'none';

export interface Exit {
  side: Side;
  /** Centre of the gap along the edge (x on n/s, z on e/w). */
  at: number;
  /** Gap width (default 3). */
  w?: number;
  to: string;
  /** Spawn name in the destination. */
  spawn: string;
  /** This exit's own spawn name (arrivals from `to` land here). */
  name: string;
  travel?: Travel;
}

/** The glyph grid a section draws on. */
export class Grid {
  readonly m: string[][];
  constructor(readonly cols: number, readonly rows: number, fill = 'g') {
    this.m = Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
  }
  inb(x: number, z: number): boolean { return x >= 0 && z >= 0 && x < this.cols && z < this.rows; }
  get(x: number, z: number): string { return this.inb(x, z) ? this.m[z]![x]! : '#'; }
  set(x: number, z: number, c: string): void { if (this.inb(x, z)) this.m[z]![x] = c; }
  rect(x0: number, z0: number, w: number, h: number, c: string): void {
    for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) this.set(x, z, c);
  }
  /** A thick polyline (roads, creeks): every cell whose centre is within w/2 of the line. */
  line(pts: Array<[number, number]>, w: number, c: string, only?: (cur: string) => boolean): void {
    for (let z = 0; z < this.rows; z++)
      for (let x = 0; x < this.cols; x++) {
        if (only && !only(this.get(x, z))) continue;
        if (distToPath(x + 0.5, z + 0.5, pts) <= w / 2) this.set(x, z, c);
      }
  }
  /** A ragged blob (grass patches, clay, Static). */
  blob(cx: number, cz: number, rx: number, rz: number, c: string, seed: number, only: (cur: string) => boolean = (q) => q === 'g'): void {
    for (let z = Math.floor(cz - rz - 2); z <= cz + rz + 2; z++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (z + 0.5 - cz) / rz);
        if (d < 0.75 + vnoise(x * 0.6, z * 0.6, seed) * 0.5 && only(this.get(x, z))) this.set(x, z, c);
      }
  }
}

export function distToPath(x: number, z: number, pts: Array<[number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!;
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

type RGB = [number, number, number];
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pick = (pal: RGB[], k: number): RGB => pal[Math.min(pal.length - 1, Math.max(0, Math.floor(k * pal.length)))]!;
const DIRT = ['#6a5238', '#7a5e40', '#5a442e', '#84694a'].map(H);
const GRAVEL = ['#7a746a', '#8e877a', '#9a9284', '#666056'].map(H);
const DRY = ['#a08a66', '#b39c74', '#8f7a58', '#c2ab80'].map(H);
const CLAY = ['#8a4a32', '#9c5a3c', '#7a3f2a', '#a8664a'].map(H);

/** The region's shared painter for the extra glyphs. */
export function regionPaint(g: string, x: number, z: number, fine: number): RGB | undefined {
  const n = fbm(x * 0.5, z * 0.5, 71, 3);
  if (g === 'e') {
    let c = pick(DIRT, n * 0.7 + fine * 0.35);
    if (Math.abs((((x + z * 0.15) % 2.6) + 2.6) % 2.6 - 1.3) < 0.14 && fine > 0.35) c = H('#4e3c2a'); // wheel ruts
    if (fine > 0.992) c = H('#9a9284');
    return c;
  }
  if (g === 'v') return fine > 0.97 ? H('#b0a898') : pick(GRAVEL, n * 0.7 + fine * 0.4);
  if (g === 'x') {
    let c = pick(DRY, n * 0.8 + fine * 0.3);
    const crack = Math.abs(fbm(x * 0.8, z * 0.8, 77, 2) - 0.5) < 0.018;
    if (crack) c = H('#6a5a40');
    if (fine > 0.995) c = H('#5f6a3a');
    return c;
  }
  if (g === 'k') return fine > 0.985 ? H('#c08060') : pick(CLAY, n * 0.75 + fine * 0.35);
  if (g === 'b') {
    let c = pick(['#4e4a45', '#5e5952', '#6a645b', '#433f3a'].map(H), n * 0.6 + fine * 0.5);
    if (fbm(x * 0.3, z * 0.3, 73, 2) > 0.7) c = [c[0] * 1.15 + 18, c[1], c[2] * 0.85]; // rust run-off
    if (vnoise(x * 2, z * 2, 74) > 0.86) c = H('#4f7a2c');
    return c;
  }
  if (g === 'c') {
    // crop rows: green hills over dark furrows, the one field someone still waters
    const row = ((z % 0.9) + 0.9) % 0.9;
    if (row < 0.22) return pick(['#5a4630', '#64503a', '#523f2a'].map(H), fine);
    return pick(['#4f8a2e', '#5f9a36', '#6aa83e', '#447a28'].map(H), n * 0.6 + fine * 0.5);
  }
  return undefined;
}

export interface Dress {
  scene: THREE.Scene;
  night: boolean;
  grid: Grid;
  r: () => number;
  /** A fresh prop seed. */
  seed(): number;
  /** Add a tree (or any prop) with a small square footprint. */
  tree(o: THREE.Object3D, solid?: number): void;
  built: Built[];
  things: Thing[];
  npcs: NPC[];
  roamers: NonNullable<Area['roamers']>;
  triggers: Trigger[];
  spawns: Record<string, Spot>;
}

export interface SectionSpec {
  id: string;
  title: string;
  sub: string;
  kind: SectionKind;
  /** Battle grid theme / region id. */
  region?: string;
  cols: number;
  rows: number;
  seed: number;
  zone?: string;
  /** Draw roads, grass, water and custom ground on the grid. */
  ground(g: Grid): void;
  edges: Partial<Record<Side, EdgeStyle>>;
  exits: Exit[];
  /** Adjust the height field (gullies, embankments…); gets the kit's height. */
  height?(x: number, z: number, h: number, g: Grid): number;
  grassTint?(x: number, z: number): string | undefined;
  /** Paint a glyph this section treats specially (falls back to the region painter). */
  paint?(g: string, x: number, z: number, fine: number): RGB | undefined;
  /** Water surface height over 'w' cells. */
  waterY?: number;
  /** Place the section's buildings, props, people. */
  dress(d: Dress): void | Promise<void>;
  start?: Spot;
  mood?: Mood;
}

const ROAD = new Set(['d', 'e', 'v']);
export type { RGB };

export function section(spec: SectionSpec): AreaBuilder {
  return async (scene, night) => {
    const { cols: COLS, rows: ROWS } = spec;
    const grid = new Grid(COLS, ROWS);
    spec.ground(grid);
    const edges = spec.edges;
    // the edge band: one row of scrub (two under a bluff), cut open at the exits
    const exitAt = (side: Side, a: number, pad = 0): Exit | undefined =>
      spec.exits.find((e) => e.side === side && Math.abs(a - e.at) <= (e.w ?? 3) / 2 + pad);
    for (const side of ['n', 's', 'w', 'e'] as const) {
      const st = edges[side] ?? 'trees';
      if (st === 'none') continue;
      const depth = st === 'bluff' ? 2 : 1;
      const len = side === 'n' || side === 's' ? COLS : ROWS;
      for (let a = 0; a < len; a++) {
        if (exitAt(side, a + 0.5)) continue;
        for (let k = 0; k < depth; k++) {
          const [x, z] = side === 'n' ? [a, k] : side === 's' ? [a, ROWS - 1 - k] : side === 'w' ? [k, a] : [COLS - 1 - k, a];
          grid.set(x, z, '#');
        }
      }
    }
    const get = (x: number, z: number): string => grid.get(x, z);
    const edgeDist = (x: number, z: number): Record<Side, number> => ({ n: z, s: ROWS - z, w: x, e: COLS - x });
    const height = (x: number, z: number): number => {
      let h = (fbm(x * 0.09, z * 0.09, spec.seed, 3) - 0.5) * 0.45;
      const road = Math.max(maskAt(get, 'd', x, z), maskAt(get, 'e', x, z), maskAt(get, 'v', x, z));
      h *= 1 - road * 0.9;
      h -= maskAt(get, 'w', x, z) * 0.6;
      const d = edgeDist(x, z);
      for (const side of ['n', 's', 'w', 'e'] as const) {
        const st = edges[side] ?? 'trees';
        const along = side === 'n' || side === 's' ? x : z;
        if (st === 'none' || st === 'open' || exitAt(side, along, 0.6)) continue;
        if (st === 'bluff') { if (d[side] < 3.4) h += Math.pow((3.4 - d[side]) / 3.4, 1.4) * 1.9; }
        else if (d[side] < 1.6) h += (1.6 - d[side]) * 0.5;
      }
      // exits stay level with the road running off the map
      for (const e of spec.exits) {
        const along = e.side === 'n' || e.side === 's' ? x : z;
        if (d[e.side] < 2.2 && Math.abs(along - e.at) < (e.w ?? 3) / 2 + 0.6) h = Math.min(h, 0.05);
      }
      return spec.height ? spec.height(x, z, h, grid) : h;
    };
    const openings = spec.exits.map((e) => ({ side: e.side, x0: e.at - (e.w ?? 3) / 2 - 0.4, x1: e.at + (e.w ?? 3) / 2 + 0.4 }));
    const W: TileWorld = { cols: COLS, rows: ROWS, cell: get, height, seed: spec.seed, paint: (g, x, z, f) => spec.paint?.(g, x, z, f) ?? regionPaint(g, x, z, f), openings, grassTint: spec.grassTint };
    setWorld(W);

    const r = rng(spec.seed * 13 + 7);
    let seedN = spec.seed * 100;
    const d: Dress = {
      scene, night, grid, r,
      seed: () => seedN++,
      tree(o, solid = 0.25) { scene.add(o); if (solid > 0) addSolid(o.position.x - solid, o.position.z - solid, o.position.x + solid, o.position.z + solid); },
      built: [], things: [], npcs: [], roamers: [], triggers: [], spawns: {},
    };

    // exits: a spawn just inside, a trigger just beyond
    for (const e of spec.exits) {
      const w = e.w ?? 3, a0 = e.at - w / 2 - 0.4, a1 = e.at + w / 2 + 0.4;
      const go = { to: e.to, spawn: e.spawn, travel: e.travel };
      if (e.side === 'n') { d.spawns[e.name] = { x: e.at, z: 1.1, face: 'S' }; d.triggers.push({ x0: a0, x1: a1, z0: -3, z1: 0.3, go }); }
      if (e.side === 's') { d.spawns[e.name] = { x: e.at, z: ROWS - 1.1, face: 'N' }; d.triggers.push({ x0: a0, x1: a1, z0: ROWS - 0.3, z1: ROWS + 3, go }); }
      if (e.side === 'w') { d.spawns[e.name] = { x: 1.1, z: e.at, face: 'E' }; d.triggers.push({ x0: -3, x1: 0.3, z0: a0, z1: a1, go }); }
      if (e.side === 'e') { d.spawns[e.name] = { x: COLS - 1.1, z: e.at, face: 'W' }; d.triggers.push({ x0: COLS - 0.3, x1: COLS + 3, z0: a0, z1: a1, go }); }
    }

    await spec.dress(d);
    frameEdges(d, spec, exitAt);

    buildGround(scene);
    const water: Array<[number, number]> = [];
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) if (get(x, z) === 'w') water.push([x, z]);
    const waterTick = water.length ? buildWater(scene, night, 0, 0, COLS, ROWS, spec.waterY ?? -0.32, water) : null;
    const grass = buildGrass(scene);
    const dust = motes(scene, night);

    const inExit = (x: number, z: number): boolean => {
      if (z < 0.4) return !!exitAt('n', x, -0.2);
      if (z > ROWS - 0.4) return !!exitAt('s', x, -0.2);
      if (x < 0.4) return !!exitAt('w', z, -0.2);
      if (x > COLS - 0.4) return !!exitAt('e', z, -0.2);
      return true;
    };
    const blocked = (x: number, z: number, rad: number): boolean => {
      for (const [dx, dz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]] as Array<[number, number]>) {
        const px = x + dx, pz = z + dz;
        if (px < -2.5 || pz < -2.5 || px > COLS + 2.5 || pz > ROWS + 2.5) return true;
        if (!inExit(px, pz)) return true;
        if (px < 0 || pz < 0 || px >= COLS || pz >= ROWS) continue; // running out through an exit
        const c = get(Math.floor(px), Math.floor(pz));
        if (c === '#' || c === 'w') return true;
      }
      return hitsSolid(x, z, rad);
    };
    const firstExit = spec.exits[0];
    const cam = {
      x0: COLS > 16.4 ? 8.2 : COLS / 2, x1: COLS > 16.4 ? COLS - 8.2 : COLS / 2,
      z0: ROWS > 9 ? 4.4 : ROWS / 2, z1: ROWS > 9 ? ROWS - 4.6 : ROWS / 2,
    };
    return {
      id: spec.id,
      title: spec.title,
      sub: spec.sub,
      kind: spec.kind,
      region: spec.region,
      mood: spec.mood ?? (night ? NIGHT : DAY),
      sky: true,
      cam,
      blocked,
      water: (x, z) => get(Math.floor(x), Math.floor(z)) === 'w',
      ground: (x, z) => heightAt(x, z),
      wild: (x, z) => get(Math.floor(x), Math.floor(z)) === 'T',
      zone: spec.zone,
      spawns: { ...d.spawns, start: spec.start ?? (firstExit ? d.spawns[firstExit.name]! : { x: COLS / 2, z: ROWS / 2 }) },
      triggers: d.triggers,
      things: d.things,
      npcs: d.npcs,
      roamers: d.roamers,
      update(t, focus) {
        grass(t);
        swayTrees(t);
        waterTick?.(t);
        for (const b of d.built) b.update?.(t);
        dust(t, focus);
      },
    };
  };
}

/** Natural edges: a broken tree line, scrub and a fence, a bluff with rocks, or nothing but grass. */
function frameEdges(d: Dress, spec: SectionSpec, exitAt: (side: Side, a: number, pad?: number) => Exit | undefined): void {
  const { cols: COLS, rows: ROWS } = spec;
  const r = rng(spec.seed * 31 + 3);
  for (const side of ['n', 's', 'w', 'e'] as const) {
    const st = spec.edges[side] ?? 'trees';
    if (st === 'none' || st === 'open') continue;
    const len = side === 'n' || side === 's' ? COLS : ROWS;
    // (along, inward depth) → world x, z
    const P = (a: number, k: number): [number, number] =>
      side === 'n' ? [a, k] : side === 's' ? [a, ROWS - k] : side === 'w' ? [k, a] : [COLS - k, a];
    const clearOf = (a: number): boolean => !exitAt(side, a, 1.4);
    if (st === 'trees') {
      for (let a = 0.4; a < len; a += 0.9 + r() * 1.6) {
        if (!clearOf(a) || r() < 0.18) continue; // gaps: you can see past the trees
        const [x, z] = P(a, 0.5 + r() * 0.5);
        const k = r();
        d.tree(k < 0.65 ? cottonwood(x, z, 0.95 + r() * 0.45, d.seed()) : k < 0.85 ? mesquite(x, z, 1.05, d.seed()) : deadTree(x, z, 1.0, d.seed()), 0);
        const [ox, oz] = P(a + r(), -1.2 - r() * 2.8);
        if (r() > 0.25) d.scene.add(cottonwood(ox, oz, 1.0 + r() * 0.5, d.seed()));
      }
    } else if (st === 'scrub') {
      for (let a = 0.5; a < len; a += 1.3 + r() * 2.2) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 0.4 + r() * 0.6);
        d.tree(r() > 0.35 ? bush(x, z, 0.8 + r() * 0.6, d.seed(), r() > 0.5) : mesquite(x, z, 0.9 + r() * 0.3, d.seed()), 0);
        if (r() > 0.6) { const [ox, oz] = P(a, -1.5 - r() * 2.5); d.scene.add(mesquite(ox, oz, 1.0 + r() * 0.3, d.seed())); }
      }
    } else if (st === 'fence') {
      // a fence line along the edge, broken where the exits pass; a few trees beyond
      let run: Array<[number, number]> = [];
      for (let a = 0.6; a < len - 0.4; a += 1.4) {
        if (!clearOf(a)) { if (run.length > 1) fence(d.scene, run, d.seed()); run = []; continue; }
        run.push(P(a, 1.25));
      }
      if (run.length > 1) fence(d.scene, run, d.seed());
      for (let a = 0.5; a < len; a += 1.8 + r() * 3) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 0.45);
        if (r() > 0.45) d.tree(bush(x, z, 0.7 + r() * 0.5, d.seed(), r() > 0.5), 0);
        const [ox, oz] = P(a + r(), -1.6 - r() * 3);
        if (r() > 0.5) d.scene.add(r() > 0.5 ? cottonwood(ox, oz, 1.0 + r() * 0.4, d.seed()) : mesquite(ox, oz, 1.1, d.seed()));
      }
    } else if (st === 'bluff') {
      for (let a = 0.3; a < len; a += 0.7 + r() * 1.1) {
        if (!clearOf(a)) continue;
        const [x, z] = P(a, 1.0 + r() * 2.0);
        rock(d.scene, x, z, 0.35 + r() * 0.55, d.seed());
        if (r() > 0.8) { const [tx, tz] = P(a, 0.4); d.tree(mesquite(tx, tz, 0.9, d.seed()), 0); }
      }
    }
  }
}

/** True when (x, z) is on a road glyph. */
export const onRoad = (x: number, z: number): boolean => ROAD.has(cell(Math.floor(x), Math.floor(z)));
```

### src/hd2d/region1/props.ts

Region prop recipes (rock, sign, tank, bale, thread marks, husk, routines, crossing signal). (lines 1–308 of 848)

```ts
import * as THREE from 'three';
import { rng } from '../noise';
import { textTexture } from '../textures';
import { box, cyl, beam, boxGeo, cylGeo, colMat, shade, planeGeo } from '../geo';
import { heightAt, addSolid } from '../world';
import { M, put, vines, windowAt, type Built } from '../field/buildings';
import { powerLine } from '../field/props';
import { dressDoor, markDoor } from '../doorway';

/**
 * Railhead Country's shared props (docs/design/region1-railhead-country.md):
 * the region kit every section draws from, plus the visual threads that run
 * through it unsaid: the Garrison's grey stencil, Redbed's red hand,
 * Grandpa's brass tag, the Static's silver grass, and the machines still
 * doing their old jobs.
 */

const SAND = ['#a8865e', '#9a7a54', '#b89670', '#8a6c4a'];

/** A weathered sandstone boulder. */
export function rock(scene: THREE.Scene, x: number, z: number, s: number, seed: number): void {
  const r = rng(seed);
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), colMat(SAND[Math.floor(r() * SAND.length)]!, { roughness: 1 }));
  m.scale.set(1 + r() * 0.4, 0.55 + r() * 0.35, 1 + r() * 0.3);
  m.rotation.set(r() * 0.4, r() * 6, r() * 0.4);
  m.position.set(x, heightAt(x, z) + s * 0.25, z);
  scene.add(shade(m));
  if (s > 0.45) addSolid(x - s * 0.8, z - s * 0.6, x + s * 0.8, z + s * 0.6);
}

/** A hoodoo: a pillar of soft stone with a harder cap, left standing by the wind. */
export function hoodoo(scene: THREE.Scene, x: number, z: number, h: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const rad = (0.55 - i * 0.08) * (0.85 + r() * 0.3);
    const seg = h / 4;
    g.add(cyl(rad * 0.85, rad, seg, colMat(SAND[(i + 1) % SAND.length]!, { roughness: 1 }), (r() - 0.5) * 0.06, y, 0, 7));
    y += seg;
  }
  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), colMat('#6e5a44', { roughness: 1 }));
  cap.scale.set(1.2, 0.45, 1.1);
  cap.position.set(0, y + 0.1, 0);
  g.add(shade(cap));
  g.position.set(x, heightAt(x, z) - 0.1, z);
  scene.add(g);
  addSolid(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
}

/** A hand-painted board on a post: the only kind of sign anyone still makes. */
export function boardSign(scene: THREE.Scene, x: number, z: number, text: string, rotY = 0, seed = 3): void {
  const g = new THREE.Group();
  g.add(box(0.1, 1.45, 0.1, M.wood(), 0, 0, 0));
  const face = new THREE.MeshStandardMaterial({ map: textTexture(text, { w: 96, h: 24, bg: '#6f6656', fg: '#efe8d6', font: 'bold 12px monospace', worn: 0.3, seed }), roughness: 1 });
  const b = new THREE.Mesh(boxGeo(1.35, 0.4, 0.05), [M.wood(), M.wood(), M.wood(), M.wood(), face, M.wood()]);
  b.position.set(0, 1.25, 0.06);
  b.rotation.z = (rng(seed)() - 0.5) * 0.12;
  g.add(shade(b));
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rotY;
  scene.add(g);
  addSolid(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
}

/** A round galvanized stock tank, still holding water. */
export function stockTank(scene: THREE.Scene, x: number, z: number, rad = 0.95): void {
  const g = new THREE.Group();
  const side = new THREE.Mesh(cylGeo(rad, rad, 0.55, 20, true), colMat('#8f9498', { metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide }));
  side.position.y = 0.27;
  g.add(shade(side));
  g.add(cyl(rad + 0.03, rad + 0.03, 0.05, colMat('#6e7378', { metalness: 0.5 }), 0, 0.53, 0, 20));
  const wtr = new THREE.Mesh(new THREE.CircleGeometry(rad - 0.04, 20), colMat('#3f6a62', { roughness: 0.2, metalness: 0.2 }));
  wtr.rotation.x = -Math.PI / 2;
  wtr.position.y = 0.44;
  g.add(wtr);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - rad, z - rad, x + rad, z + rad);
}

/** A round hay bale on its side, gone grey on top. */
export function bale(scene: THREE.Scene, x: number, z: number, rotY = 0): void {
  const m = new THREE.Mesh(cylGeo(0.62, 0.62, 1.1, 14), [M.hay(), colMat('#a89464', { roughness: 1 }), colMat('#a89464', { roughness: 1 })]);
  m.rotation.set(Math.PI / 2, 0, rotY);
  m.position.set(x, heightAt(x, z) + 0.58, z);
  scene.add(shade(m));
  addSolid(x - 0.6, z - 0.6, x + 0.6, z + 0.6);
}

// ------------------------------------------------------------- the threads

let stencilTex: THREE.CanvasTexture | null = null;
/** The Garrison's grey stencil: a chevron over a tally. Marks what they've "cleared". */
export function stencil(parent: THREE.Object3D, x: number, y: number, z: number, rotY = 0, s = 0.6): void {
  if (!stencilTex) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const g = c.getContext('2d')!;
    g.fillStyle = '#c9ccce';
    g.beginPath(); g.moveTo(4, 14); g.lineTo(16, 4); g.lineTo(28, 14); g.lineTo(28, 19); g.lineTo(16, 10); g.lineTo(4, 19); g.closePath(); g.fill();
    for (let i = 0; i < 4; i++) g.fillRect(6 + i * 5, 22, 2, 7);
    g.fillRect(4, 25, 22, 2);
    stencilTex = new THREE.CanvasTexture(c);
    stencilTex.magFilter = THREE.NearestFilter;
    stencilTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(planeGeo(s, s), new THREE.MeshStandardMaterial({ map: stencilTex, transparent: true, alphaTest: 0.3, roughness: 1, opacity: 0.9 }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
}

let handTex: THREE.CanvasTexture | null = null;
/** Redbed's red handprint: raiders sign what they've taken. */
export function redHand(parent: THREE.Object3D, x: number, y: number, z: number, rotY = 0, s = 0.45): void {
  if (!handTex) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d')!;
    g.fillStyle = '#9a2a1e';
    g.fillRect(4, 7, 8, 7);
    for (const [fx, h] of [[4, 5], [6, 6], [8, 6], [10, 5]] as Array<[number, number]>) g.fillRect(fx, 7 - h, 2, h);
    g.fillRect(12, 8, 3, 2);
    g.fillRect(3, 14, 1, 2); g.fillRect(9, 14, 1, 2); // drips
    handTex = new THREE.CanvasTexture(c);
    handTex.magFilter = THREE.NearestFilter;
    handTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(planeGeo(s, s), new THREE.MeshStandardMaterial({ map: handTex, transparent: true, alphaTest: 0.3, roughness: 1 }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
}

/** Grandpa's mark: a small brass tag with three notches, on machines someone kept running. */
export function brassTag(parent: THREE.Object3D, x: number, y: number, z: number, rotY = 0): void {
  const g = new THREE.Group();
  const brass = colMat('#c8a050', { metalness: 0.75, roughness: 0.35, emissive: '#3a2a08', emissiveIntensity: 0.4 });
  g.add(box(0.2, 0.12, 0.015, brass, 0, -0.06, 0));
  for (const dx of [-0.05, 0, 0.05]) g.add(box(0.018, 0.05, 0.02, colMat('#4a3a1c'), dx, -0.01, 0.004));
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
}

/** A decommissioned Ohm, left where the Garrison dropped it: eye dark, stencilled. */
export function husk(scene: THREE.Scene, x: number, z: number, rot: number, seed: number): void {
  const r = rng(seed);
  const g = new THREE.Group();
  const shell = colMat(['#8a8f88', '#b8a888', '#6a7a86', '#a86a48'][Math.floor(r() * 4)]!, { metalness: 0.35, roughness: 0.6 });
  const w = 0.7 + r() * 0.4, h = 0.55 + r() * 0.3, d = 0.6 + r() * 0.3;
  g.add(box(w, h, d, shell, 0, 0, 0));
  g.add(box(w * 0.5, 0.18, 0.04, colMat('#121212'), 0, h * 0.55, d / 2 + 0.01)); // the dead eye
  for (const sx of [-1, 1]) g.add(beam(new THREE.Vector3(sx * w * 0.45, 0.2, 0), new THREE.Vector3(sx * (w * 0.45 + 0.45), 0.02, 0.2 * sx), 0.07, M.steel()));
  stencil(g, 0, h * 0.25, d / 2 + 0.02, 0, 0.32);
  g.rotation.set(0, rot, 0.55 + r() * 0.3); // tipped on its side
  g.position.set(x, heightAt(x, z) + 0.12, z);
  scene.add(shade(g));
  addSolid(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
}

// ------------------------------------------------- machines on the old jobs

/** A wheel-line sprinkler Ohm crawling its arc, keeping one field green. */
export function sprinkler(scene: THREE.Scene, cx: number, cz: number, len: number): Built {
  const pivot = new THREE.Group();
  pivot.position.set(cx, heightAt(cx, cz), cz);
  pivot.add(cyl(0.12, 0.16, 1.6, M.steel(), 0, 0, 0, 8));
  const arm = new THREE.Group();
  arm.position.y = 1.35;
  pivot.add(arm);
  const pipe = colMat('#c8cccc', { metalness: 0.5, roughness: 0.45 });
  arm.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(len, 0, 0), 0.08, pipe));
  const wheels: THREE.Object3D[] = [];
  for (let k = 1; k <= 3; k++) {
    const x = (len * k) / 3;
    const tower = new THREE.Group();
    tower.position.x = x;
    tower.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.35, -1.3, 0.25), 0.05, M.steel()));
    tower.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, -1.3, -0.25), 0.05, M.steel()));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 5, 12), colMat('#2a2622'));
    wheel.position.set(0, -1.05, 0);
    tower.add(shade(wheel));
    wheels.push(wheel);
    arm.add(tower);
  }
  // spray: little additive droplets falling under the arm
  const N = 90, pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) seeds[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spray = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#d8ecf0', size: 0.07, transparent: true, opacity: 0.7, depthWrite: false }));
  arm.add(spray);
  scene.add(pivot);
  addSolid(cx - 0.25, cz - 0.25, cx + 0.25, cz + 0.25);
  return {
    update(t) {
      arm.rotation.y = Math.sin(t * 0.05) * 1.1 - 0.4;
      for (const w of wheels) w.rotation.z = -t * 0.6;
      for (let i = 0; i < N; i++) {
        const s = seeds[i]!, k = (t * 0.9 + s * 7) % 1;
        pos[i * 3] = (s * 9.7 % 1) * len;
        pos[i * 3 + 1] = -k * 1.3;
        pos[i * 3 + 2] = Math.sin(s * 40) * 0.35 * (0.3 + k);
      }
      geo.attributes.position!.needsUpdate = true;
    },
  };
}

/** A weather-vane Ohm on a leaning post, still turning to the wind. */
export function weatherVane(scene: THREE.Scene, x: number, z: number): Built {
  const g = new THREE.Group();
  g.add(box(0.1, 2.4, 0.1, M.wood(), 0, 0, 0));
  const head = new THREE.Group();
  head.position.y = 2.45;
  head.add(box(1.0, 0.05, 0.05, M.tank(), 0, 0, 0));
  const tail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, -0.2, 0), new THREE.Vector3(-0.5, 0.25, 0), new THREE.Vector3(-0.2, 0.03, 0)]), colMat('#8a5a3a', { side: THREE.DoubleSide, metalness: 0.3 }));
  tail.geometry.computeVertexNormals();
  head.add(shade(tail));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), M.tank());
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.55;
  head.add(shade(tip));
  // the cups: a little anemometer spinning above
  const cups = new THREE.Group();
  cups.position.y = 0.35;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    cups.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), 0.025, M.steel()));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI), M.steel());
    c.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    cups.add(c);
  }
  head.add(cups);
  g.add(head);
  g.rotation.z = 0.05;
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
  return { update(t) { head.rotation.y = 0.6 + Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.83) * 0.12; cups.rotation.y = -t * 3.1; } };
}

/** A wind turbine down in the dirt: the tower on its side, two blades flat, one stuck upright. */
export function fallenTurbine(scene: THREE.Scene, x: number, z: number, rot: number): void {
  const g = new THREE.Group();
  const white = colMat('#d8d4c8', { roughness: 0.7 });
  const tower = new THREE.Mesh(cylGeo(0.32, 0.5, 9, 14), white);
  tower.rotation.z = Math.PI / 2;
  tower.position.set(4.5, 0.42, 0);
  g.add(shade(tower));
  g.add(box(1.3, 0.8, 0.8, white, -0.4, 0.05, 0)); // the nacelle
  g.add(box(0.5, 0.5, 0.5, colMat('#8a8a84'), -1.1, 0.2, 0));
  const blade = (): THREE.Mesh => {
    const b = new THREE.Mesh(boxGeo(0.35, 4.6, 0.08), white);
    b.geometry.translate(0, 2.3, 0);
    return shade(b);
  };
  const b1 = blade(); b1.rotation.set(Math.PI / 2, 0, 0.5); b1.position.set(-1.2, 0.1, 0.3); g.add(b1);
  const b2 = blade(); b2.rotation.set(-Math.PI / 2 + 0.05, 0, -0.9); b2.position.set(-1.3, 0.1, -0.2); g.add(b2);
  const b3 = blade(); b3.rotation.set(0.3, 0, 0.25); b3.position.set(-2.8, -0.6, 1.2); g.add(b3); // driven into the ground
  vines(g, 3.0, 0.0, 0.52, 2.4, 0.6);
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = rot;
  scene.add(g);
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let k = -1.5; k <= 9; k += 1.5) { const px = x + c * k, pz = z - s * k; addSolid(px - 0.55, pz - 0.55, px + 0.55, pz + 0.55); }
}

/** A railroad crossing signal still flashing for trains that never come. */
export function crossingSignal(scene: THREE.Scene, x: number, z: number, night: boolean): Built {
  const g = new THREE.Group();
  g.add(box(0.12, 2.7, 0.12, M.steel(), 0, 0, 0));
  const mat = new THREE.MeshStandardMaterial({ map: textTexture('RAILROAD', { w: 64, h: 12, bg: '#e8e2d2', fg: '#1d1b19', font: 'bold 9px monospace', worn: 0.25 }), roughness: 1 });
  for (const a of [0.6, -0.6]) {
    const b = new THREE.Mesh(boxGeo(1.2, 0.2, 0.03), [M.steel(), M.steel(), M.steel(), M.steel(), mat, M.steel()]);
    b.position.set(0, 2.45, 0.08);
    b.rotation.z = a;
    g.add(shade(b));
  }
  g.add(box(1.1, 0.07, 0.07, M.steel(), 0, 1.75, 0.05));
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (const dx of [-0.45, 0.45]) {
    const m = colMat('#ff3a22', { emissive: '#ff2a12', emissiveIntensity: 0 }).clone();
    lamps.push(m);
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), m);
    l.position.set(dx, 1.75, 0.12);
    g.add(l);
    g.add(box(0.34, 0.34, 0.08, colMat('#151515'), dx, 1.58, 0.06));
  }
  const glow = new THREE.PointLight('#ff4020', 0, 4, 1.8);
  glow.position.set(0, 1.8, 0.4);
  g.add(glow);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  addSolid(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
  return {
    update(t) {
      const on = Math.floor(t * 1.6) % 2;
      lamps[0]!.emissiveIntensity = on ? 3 : 0.1;
      lamps[1]!.emissiveIntensity = on ? 0.1 : 3;
      glow.intensity = night ? 2.4 : 0.6;
      glow.position.x = on ? -0.45 : 0.45;
    },
  };
}

```

### src/hd2d/ohmstead/kit.ts

Underground kit: world-UV materials, LightPool (many lamps, few lights), wall lamps. (lines 1–260 of 496)

```ts
import * as THREE from 'three';
import { Pix, T, textTexture } from '../textures';
import { rng, fbm, vnoise } from '../noise';
import { box, cyl, beam, boxGeo, cylGeo, texMat, colMat, shade } from '../geo';
import { addSolid } from '../world';

/**
 * Ohmstead's interior kit: the metal bomb-shelter look Mark set for the
 * colony (big riveted floor plates, thick steel walls), plus the furniture
 * and lamps that make it lived-in. Everything sits on a flat floor at y = 0.
 */

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

export const C = {
  steel: hex('#566068'),
  steelLight: hex('#7c8790'),
  steelDark: hex('#2b3136'),
  plate: hex('#68727a'),
  rust: hex('#7c4424'),
  rustLight: hex('#a8622e'),
  grime: hex('#23211d'),
  hazard: hex('#d2a22a'),
  moss: hex('#4f7a2c'),
  mossLight: hex('#7aa83c'),
  black: hex('#0b0c0e'),
};

const cache = new Map<string, THREE.Texture>();
const once = (k: string, make: () => THREE.Texture): THREE.Texture => {
  let t = cache.get(k);
  if (!t) { t = make(); cache.set(k, t); }
  return t;
};

// ------------------------------------------------------------- textures

/** Wall panels: 1-unit riveted plates, a seam at 1.2, a dark kick plate. 2×3 units. */
function wallTex(): THREE.Texture {
  return once('ohm-wall', () => {
    const W = 32, H = 48, p = new Pix(W, H), r = rng(51);
    const tone = [0.95, 1.05, 0.9, 1.0];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const up = H - 1 - y; // texels above the floor
        const panel = Math.floor(x / 16) + (up >= 19 ? 2 : 0);
        let c = mul(C.steel, tone[panel % 4]! * (0.94 + vnoise(x * 0.5, y * 0.5, 52) * 0.1));
        // seams: vertical every unit, horizontal at 1.2 units, kick plate below 0.5
        const vx = x % 16;
        if (vx === 0) c = C.steelDark;
        else if (vx === 1) c = mul(C.steelLight, 0.95);
        if (up === 19) c = C.steelDark;
        if (up === 20) c = mul(C.steelLight, 0.92);
        if (up < 8) c = mul(C.steel, 0.62 + (up === 7 ? 0.25 : 0));
        if (up < 8 && (x + up) % 8 < 1) c = mul(C.steel, 0.5); // tread lines
        // rivets beside seams
        if ((vx === 3 || vx === 13) && (up % 6 === 3) && up > 8) c = up === 9 ? C.steelLight : mix(C.steelLight, C.steel, 0.3);
        // rust streaks bleeding down from the seams, grime rising from the floor
        const streak = vnoise(x * 1.1, y * 0.08, 53);
        if (streak > 0.8 && up > 6) c = mix(c, C.rust, (streak - 0.8) * 3);
        const grime = fbm(x * 0.15, y * 0.15, 54, 3);
        if (up < 14) c = mix(c, C.grime, Math.max(0, (14 - up) / 14) * 0.45 * grime);
        if (r() < 0.01) c = mul(c, 0.8);
        p.set(x, y, c);
      }
    return p.texture();
  });
}

/** Wall tops: the black of the rock beyond — a cut wall draws a crisp dark
 *  outline round the lit room, the way HD-2D interiors read. */
function capTex(): THREE.Texture {
  return once('ohm-cap', () => {
    const S = 16, p = new Pix(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const c = mul(hex('#121417'), 0.85 + vnoise(x * 0.6, y * 0.6, 55) * 0.3);
        p.set(x, y, c);
      }
    return p.texture();
  });
}

/** Rough rock: the Yard's dig face. */
function rockTex(): THREE.Texture {
  return once('ohm-rock', () => {
    const S = 32, p = new Pix(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const n = fbm(x * 0.18, y * 0.18, 56, 3);
        let c = mix(hex('#3a3430'), hex('#6a5e52'), n);
        if (Math.abs(fbm(x * 0.12, y * 0.12, 57, 2) - 0.5) < 0.025) c = hex('#1e1a17');
        if (n > 0.7) c = mix(c, hex('#8a7a66'), 0.5);
        p.set(x, y, c);
      }
    return p.texture();
  });
}

/** World-space UVs (triplanar by face normal): instanced walls of any height
 *  keep the same texel density, so a wall can drop low without its panels squashing. */
export function worldUV(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_MAP
      {
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
        im = instanceMatrix;
        #endif
        vec3 wp = (modelMatrix * im * vec4(transformed, 1.0)).xyz;
        vec3 wn = abs(normalize(mat3(modelMatrix * im) * objectNormal));
        vec2 w = wn.y > 0.5 ? wp.xz : (wn.x > 0.5 ? wp.zy : wp.xy);
        vMapUv = (mapTransform * vec3(w, 1.0)).xy;
      }
      #endif`);
  };
  m.customProgramCacheKey = () => 'worldUV';
  return m;
}

export const KM = {
  wall: (): THREE.MeshStandardMaterial => texMat('ohm-wall-mat', wallTex(), { metalness: 0.35, roughness: 0.7 }),
  cap: (): THREE.MeshStandardMaterial => texMat('ohm-cap-mat', capTex(), { roughness: 1 }),
  rock: (): THREE.MeshStandardMaterial => texMat('ohm-rock-mat', rockTex(), { roughness: 1 }),
  steel: (): THREE.MeshStandardMaterial => texMat('steel', T.steel(), { metalness: 0.35, roughness: 0.65 }),
  rust: (): THREE.MeshStandardMaterial => texMat('rustTank', T.rustTank(), { metalness: 0.25, roughness: 0.7 }),
  wood: (): THREE.MeshStandardMaterial => texMat('oldWood', T.oldWood()),
  deck: (): THREE.MeshStandardMaterial => texMat('deck', T.deck()),
  concrete: (): THREE.MeshStandardMaterial => texMat('concrete', T.concrete()),
  hazard: (): THREE.MeshStandardMaterial => texMat('hazard', T.hazard()),
  dark: (): THREE.MeshStandardMaterial => colMat('#101113', { roughness: 1 }),
  paintRed: (): THREE.MeshStandardMaterial => colMat('#8a2e24', { roughness: 0.6, metalness: 0.3 }),
  paintGreen: (): THREE.MeshStandardMaterial => colMat('#3f5a3c', { roughness: 0.7, metalness: 0.2 }),
  paintBlue: (): THREE.MeshStandardMaterial => colMat('#34506a', { roughness: 0.7, metalness: 0.2 }),
  cloth: (hexc: string): THREE.MeshStandardMaterial => colMat(hexc, { roughness: 1, side: THREE.DoubleSide }),
  vine: (): THREE.MeshStandardMaterial => texMat('vines', T.vines(), { alphaTest: 0.5, side: THREE.DoubleSide }),
  leaves: (): THREE.MeshStandardMaterial => texMat('leaves-flat', T.leaves(), { roughness: 0.95, flatShading: true }),
};

/** Wall + cap materials for the instanced walls (world-space UVs). */
export function wallMaterials(rock = false): THREE.Material[] {
  const side = worldUV(new THREE.MeshStandardMaterial({ map: rock ? rockTex() : wallTex(), metalness: rock ? 0 : 0.35, roughness: rock ? 1 : 0.7 }));
  const cap = worldUV(new THREE.MeshStandardMaterial({ map: capTex(), roughness: 1 }));
  // BoxGeometry groups: +x, -x, +y (cap), -y, +z, -z
  return [side, side, cap, cap, side, side];
}

// --------------------------------------------------------------- floor

/** Paint the colony floor: 2×2 riveted plates, scuffed walk-lines, oil and
 *  rust, hazard paint at thresholds, moss pushing up through the seams. */
export function paintFloor(cols: number, rows: number, floor: (x: number, z: number) => boolean, extra: (x: number, z: number, c: RGB) => RGB): THREE.CanvasTexture {
  const S = 16, W = cols * S, H = rows * S;
  const p = new Pix(W, H);
  const r = rng(77);
  const plateTone = new Map<number, number>();
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / S, z = (py + 0.5) / S;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!floor(cx, cz)) { p.set(px, py, C.black); continue; }
      const bx = Math.floor(x / 2), bz = Math.floor(z / 2), key = bz * 1000 + bx;
      let tone = plateTone.get(key);
      if (tone === undefined) { tone = 0.86 + r() * 0.22; plateTone.set(key, tone); }
      const u = px % 32, v = py % 32;
      let c = mul(C.plate, tone * (0.95 + vnoise(px * 0.4, py * 0.4, 61) * 0.08));
      // diamond tread on alternate plates
      if ((bx + bz) % 3 === 0 && (u + v) % 6 === 0) c = mul(c, 1.18);
      if ((bx + bz) % 3 === 0 && (u - v + 64) % 6 === 0) c = mul(c, 0.86);
      // seams + bevel highlight, corner rivets
      if (u === 0 || v === 0) c = C.steelDark;
      else if (u === 1 || v === 1) c = mul(C.steelLight, tone * 0.9);
      if ((u === 3 || u === 29) && (v === 3 || v === 29)) c = C.steelLight;
      if ((u === 4 || u === 30) && (v === 4 || v === 30)) c = C.steelDark;
      // grime, oil, rust blooms
      const g = fbm(x * 0.35, z * 0.35, 62, 3);
      c = mix(c, C.grime, Math.max(0, g - 0.5) * 0.7);
      if (fbm(x * 0.6, z * 0.6, 63, 2) > 0.85) c = mix(c, hex('#1f1c17'), 0.4);
      const ru = fbm(x * 0.25, z * 0.25, 64, 3);
      if (ru > 0.66) c = mix(c, ru > 0.74 ? C.rust : C.rustLight, Math.min(1, (ru - 0.66) * 4) * 0.7);
      // moss and tiny leaves in the seams near the edges of rooms
      if ((u <= 1 || v <= 1) && fbm(x * 0.3, z * 0.3, 65, 2) > 0.7 && vnoise(px * 0.7, py * 0.7, 66) > 0.55) c = r() < 0.5 ? C.moss : C.mossLight;
      p.set(px, py, extra(x, z, c));
    }
  const t = p.texture({ repeat: false, worldSize: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
export { hex as kitHex, mix as kitMix, mul as kitMul };
export type { RGB };

// -------------------------------------------------------------- lamps

export interface Lamp { pos: THREE.Vector3; color: THREE.Color; intensity: number; dist: number; flicker?: number }

/** A small pool of point lights moved each frame to the lamps nearest the
 *  camera — dozens of lamps for the price of a few lights. */
export class LightPool {
  private readonly lights: THREE.PointLight[] = [];
  private readonly lamps: Lamp[] = [];
  constructor(scene: THREE.Scene, n = 10) {
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 6, 1.7);
      scene.add(l);
      this.lights.push(l);
    }
  }
  add(l: Lamp): void { this.lamps.push(l); }
  update(t: number, focus: THREE.Vector3): void {
    const near = this.lamps
      .map((l) => ({ l, d: (l.pos.x - focus.x) ** 2 + ((l.pos.z - focus.z) * 1.3) ** 2 }))
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((light, i) => {
      const e = near[i];
      if (!e) { light.intensity = 0; return; }
      const { l } = e;
      light.position.copy(l.pos);
      light.color.copy(l.color);
      light.distance = l.dist;
      const fl = l.flicker ? 1 - l.flicker * (0.5 + 0.5 * Math.sin(t * 23 + l.pos.x * 7) * Math.sin(t * 5.1 + l.pos.z)) : 1;
      // fade with distance so a light handed to a new lamp doesn't pop
      const fade = THREE.MathUtils.clamp(1.6 - Math.sqrt(e.d) / 11, 0, 1);
      light.intensity = l.intensity * fl * fade;
    });
  }
}

function glow(hexc: string, intensity: number): THREE.MeshStandardMaterial {
  return colMat(hexc, { emissive: hexc, emissiveIntensity: intensity, roughness: 0.4 });
}

/** A caged bulb on a wall bracket (+z facing wall at z), pooled light. */
export function wallLamp(g: THREE.Object3D, pool: LightPool, x: number, z: number, y = 2.1, warm = true): void {
  g.add(box(0.1, 0.1, 0.32, KM.steel(), x, y + 0.1, z + 0.16));
  g.add(box(0.26, 0.05, 0.26, KM.steel(), x, y + 0.2, z + 0.36));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow(warm ? '#ffcf7a' : '#bfe8ff', 5));
  bulb.position.set(x, y + 0.08, z + 0.36);
  g.add(bulb);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#202428', wireframe: true }));
  cage.position.set(x, y + 0.08, z + 0.36);
  g.add(cage);
  pool.add({ pos: new THREE.Vector3(x, y, z + 0.7), color: new THREE.Color(warm ? '#ffb35c' : '#9ad8ff'), intensity: warm ? 11 : 8, dist: 8, flicker: Math.random() < 0.12 ? 0.6 : 0 });
}

/** A pendant lamp hanging on a cord from the dark overhead. */
export function pendant(g: THREE.Object3D, pool: LightPool, x: number, z: number, warm = true, y = 2.5): void {
  g.add(box(0.015, 3.5, 0.015, colMat('#111214'), x, y + 0.2, z));
  const sh = new THREE.Mesh(cylGeo(0.07, 0.3, 0.2, 10, true), colMat('#3d5248', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }));
  sh.position.set(x, y + 0.1, z);
  g.add(sh); // no shadow: a shade's blot on the floor reads as a hole
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glow(warm ? '#ffd590' : '#cfeeff', 5));
  bulb.position.set(x, y - 0.02, z);
  g.add(bulb);
```

### src/hd2d/region1/interior.ts

Interiors: cutaway walls, wall textures, lamps.

```ts
import * as THREE from 'three';
import { fbm, rng, vnoise } from '../noise';
import { Pix } from '../textures';
import { box, colMat } from '../geo';
import { setWorld, hitsSolid } from '../world';
import { KM, LightPool, worldUV, type RGB } from '../ohmstead/kit';
import type { Built } from '../field/buildings';
import type { Mood } from '../mood';
import type { Area, AreaBuilder, NPC, SectionKind, Spot, Thing, Trigger } from '../area';
import { Grid } from './section';
import { dressDoor, markDoor } from '../doorway';
import { pendant } from '../ohmstead/kit';

/**
 * Interiors for Railhead Country's dungeons (the Grain Tower, the Roundhouse,
 * Ohm Depot), built the Cistern's way: a glyph grid, a painted floor, walls as
 * instanced cubes that drop low in front of the player (the HD-2D cutaway),
 * a pooled set of lamps. Glyphs: . floor · # wall · r debris/spill (wild
 * Ohms) · v void (a pit, blocked) · = steel grate over a void (walkable).
 */

/** Dusty daylight through high windows; the lamps do the rest. */
export const INSIDE: Mood = {
  night: true,
  sun: { color: '#ffd8a0', intensity: 0.9, from: new THREE.Vector3(-6, 14, 5) },
  hemi: { sky: '#9a8a70', ground: '#3a2e22', intensity: 2.1 },
  fog: { color: '#0c0906', density: 0.012 },
  exposure: 1.42,
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.7 },
  grade: { dull: 1.25, lush: 1.1, vignette: 0.58, shadowTint: [0.92, 0.94, 1.08], highTint: [1.12, 1.02, 0.86] },
  sprite: [0.95, 0.88, 0.8],
};

export type WallKind = 'concrete' | 'brick' | 'tin' | 'block' | 'boards';
const H = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

const wallCache = new Map<WallKind, THREE.Texture>();
function wallTex(kind: WallKind): THREE.Texture {
  const hit = wallCache.get(kind);
  if (hit) return hit;
  const W = 32, Hh = 48, p = new Pix(W, Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const up = Hh - 1 - y, n = vnoise(x * 0.4, y * 0.4, 11);
    let c: RGB;
    if (kind === 'brick') {
      const row = Math.floor(up / 4), off = (row % 2) * 4;
      const mortar = up % 4 === 0 || (x + off) % 8 === 0;
      c = mortar ? H('#6a6052') : mix(H('#8a4a36'), H('#6e3a2a'), n);
      if (vnoise(x * 0.2, y * 0.6, 5) > 0.72) c = mix(c, H('#2a2420'), 0.45); // soot
    } else if (kind === 'tin') {
      c = mix(H('#8a8c88'), H('#6a6c68'), (Math.sin(x * 1.6) + 1) / 2 * 0.6 + n * 0.4);
      if (fbm(x * 0.15, y * 0.15, 6, 3) > 0.58) c = mix(c, H('#8a4a2a'), 0.6); // rust
    } else if (kind === 'boards') {
      // painted board walls gone soft with age, a dado rail low down
      const seam = x % 6 === 0;
      c = seam ? H('#5a4a3a') : mix(H('#a8957a'), H('#968468'), n);
      if (up === 14 || up === 15) c = H('#6a5440');
      if (up < 14) c = mix(c, H('#7a6650'), 0.35);
    } else if (kind === 'block') {
      const mortar = up % 6 === 0 || (x + (Math.floor(up / 6) % 2) * 8) % 16 === 0;
      c = mortar ? H('#7a766c') : mix(H('#b8b0a0'), H('#a09888'), n);
      if (up < 10) c = mix(c, H('#7a6a50'), 0.3 * (1 - up / 10)); // grime at the foot
    } else {
      c = mix(H('#8a867a'), H('#6e6a60'), n);
      if (up % 12 === 0) c = mix(c, H('#4e4a42'), 0.6);
      if (vnoise(x * 1.2, y * 0.07, 12) > 0.74) c = mix(c, H('#4a4438'), 0.5);
    }
    p.set(x, y, c);
  }
  const t = p.texture();
  wallCache.set(kind, t);
  return t;
}

export interface InteriorDress {
  scene: THREE.Scene;
  root: THREE.Group;
  pool: LightPool;
  grid: Grid;
  r: () => number;
  seed(): number;
  /** A group that hides with its wall row when the cutaway drops it. */
  mount(row: number): THREE.Group;
  built: Built[];
  things: Thing[];
  npcs: NPC[];
  roamers: NonNullable<Area['roamers']>;
  triggers: Trigger[];
  spawns: Record<string, Spot>;
}

/** The way back out: a gap in the south wall with daylight in it (the door language: every way in is lit). */
export function exitDoor(d: InteriorDress, x: number, to: string, spawn: string, w = 1.6): void {
  const rows = d.grid.rows;
  d.spawns.door = { x, z: rows - 1.3, face: 'N' };
  d.triggers.push({ x0: x - 1.4, x1: x + 1.4, z0: rows - 0.2, z1: rows + 2, go: { to, spawn } });
  d.built.push(dressDoor(d.root, x, 0, rows - 0.04, w, 2.2, 'open', false, Math.PI, { daylight: true }));
  markDoor(x, rows - 0.1, 'open');
}

/** A lamp over a stairway or ladder (every way through is lit). */
export function stairLight(d: InteriorDress, x: number, z: number): void {
  pendant(d.root, d.pool, x, z, true);
  markDoor(x, z, 'open');
}

export interface InteriorSpec {
  id: string;
  title: string;
  sub: string;
  kind?: SectionKind;
  region?: string;
  cols: number;
  rows: number;
  seed: number;
  zone?: string;
  mood?: Mood;
  wall: WallKind;
  ground(g: Grid): void;
  /** Floor colour per texel (x, z in world units) for a non-wall glyph. */
  floor(glyph: string, x: number, z: number, fine: number): RGB;
  dress(d: InteriorDress): void | Promise<void>;
  start: Spot;
}

export function interior(spec: InteriorSpec): AreaBuilder {
  return async (scene) => {
    const { cols: COLS, rows: ROWS } = spec;
    const grid = new Grid(COLS, ROWS, '.');
    for (let x = 0; x < COLS; x++) { grid.set(x, 0, '#'); grid.set(x, ROWS - 1, '#'); }
    for (let z = 0; z < ROWS; z++) { grid.set(0, z, '#'); grid.set(COLS - 1, z, '#'); }
    spec.ground(grid);
    const get = (x: number, z: number): string => grid.get(x, z);
    setWorld({ cols: COLS, rows: ROWS, cell: (x, z) => (get(x, z) === 'r' ? 'T' : get(x, z) === '#' ? '#' : '.'), height: () => 0 });
    scene.background = new THREE.Color('#060504');
    const root = new THREE.Group();
    scene.add(root);
    const pool = new LightPool(scene, 12);

    // ---------------------------------------------------------- floor
    const S = 16, p = new Pix(COLS * S, ROWS * S);
    const fr = rng(spec.seed);
    for (let py = 0; py < ROWS * S; py++) for (let px = 0; px < COLS * S; px++) {
      const x = (px + 0.5) / S, z = (py + 0.5) / S, gl = get(Math.floor(x), Math.floor(z));
      if (gl === '#') { p.set(px, py, H('#0c0b0a')); continue; }
      if (gl === 'v') { p.set(px, py, mix(H('#050404'), H('#14110e'), vnoise(x * 3, z * 3, 9))); continue; }
      p.set(px, py, spec.floor(gl, x, z, fr()));
    }
    const ft = p.texture({ repeat: false, worldSize: false });
    ft.wrapS = ft.wrapT = THREE.ClampToEdgeWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(COLS / 2, 0, ROWS / 2);
    floor.receiveShadow = true;
    root.add(floor);

    // ---------------------------------------------------------- grates over the voids
    const grateMat = colMat('#4a5258', { metalness: 0.5, roughness: 0.5 });
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (get(x, z) !== '=') continue;
      root.add(box(1.0, 0.06, 1.0, grateMat, x + 0.5, 0.02, z + 0.5));
      for (let k = 0; k < 4; k++) root.add(box(1.0, 0.012, 0.04, colMat('#22262a'), x + 0.5, 0.085, z + 0.15 + k * 0.23));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
        if (get(x + dx, z + dz) !== 'v') continue;
        const ex = x + 0.5 + dx * 0.47, ez = z + 0.5 + dz * 0.47;
        root.add(box(0.05, 0.9, 0.05, KM.steel(), ex, 0.06, ez));
        root.add(box(dx === 0 ? 1.0 : 0.04, 0.04, dx === 0 ? 0.04 : 1.0, KM.steel(), ex, 0.96, ez));
      }
    }

    // ---------------------------------------------------------- walls (cutaway)
    const TALL = 2.9, LOW = 0.6;
    const walls: Array<{ x: number; z: number; front: boolean }> = [];
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (get(x, z) !== '#') continue;
      let near = false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = get(x + dx, z + dz); if (c !== '#' && grid.inb(x + dx, z + dz)) near = true; }
      if (near) walls.push({ x, z, front: z === ROWS - 1 });
    }
    const side = worldUV(new THREE.MeshStandardMaterial({ map: wallTex(spec.wall), roughness: 0.9 }));
    const cap = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 1 });
    const wg = new THREE.BoxGeometry(1.02, 1, 1.02);
    wg.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(wg, [side, side, cap, cap, side, side], Math.max(1, walls.length));
    im.castShadow = im.receiveShadow = true;
    root.add(im);
    const rowH = new Map<number, number>();
    for (let z = 0; z < ROWS; z++) rowH.set(z, TALL);
    const m4 = new THREE.Matrix4();
    const writeWalls = (): void => {
      walls.forEach((w, i) => { m4.makeScale(1, w.front ? LOW : rowH.get(w.z)!, 1).setPosition(w.x + 0.5, 0, w.z + 0.5); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    };
    writeWalls();
    const mounts: Array<{ row: number; obj: THREE.Object3D }> = [];

    const r = rng(spec.seed * 7 + 1);
    let seedN = spec.seed * 100;
    const d: InteriorDress = {
      scene, root, pool, grid, r,
      seed: () => seedN++,
      mount(row) { const g = new THREE.Group(); root.add(g); mounts.push({ row, obj: g }); return g; },
      built: [], things: [], npcs: [], roamers: [], triggers: [], spawns: {},
    };
    // debris piles on the wild cells
    for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
      if (get(x, z) !== 'r' || r() > 0.45) continue;
      const pile = new THREE.Mesh(new THREE.SphereGeometry(0.28 + r() * 0.22, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), colMat(spec.wall === 'concrete' ? '#a8884a' : '#6a5a48', { roughness: 1 }));
      pile.scale.y = 0.4;
      pile.position.set(x + r(), 0, z + r());
      root.add(pile);
    }
    await spec.dress(d);

    const blocked = (x: number, z: number, rad: number): boolean => {
      for (const [dx, dz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]] as Array<[number, number]>) {
        const px = x + dx, pz = z + dz;
        if (px < 0 || px > COLS) return true;
        if (pz < -2 || pz > ROWS + 2) return true;
        if (pz < 0 || pz >= ROWS) continue; // stepping out through a door
        const c = get(Math.floor(px), Math.floor(pz));
        if (c === '#' || c === 'v') return true;
      }
      return hitsSolid(x, z, rad);
    };
    const cam = { x0: COLS > 19 ? 9.5 : COLS / 2, x1: COLS > 19 ? COLS - 9.5 : COLS / 2, z0: ROWS > 12 ? 6.0 : ROWS / 2, z1: ROWS > 12 ? ROWS - 5.5 : ROWS / 2 };
    return {
      id: spec.id,
      title: spec.title,
      sub: spec.sub,
      kind: spec.kind ?? 'dungeon',
      region: spec.region ?? 'bunker',
      mood: spec.mood ?? INSIDE,
      sky: false,
      cam,
      blocked,
      ground: () => 0,
      wild: (x, z) => get(Math.floor(x), Math.floor(z)) === 'r',
      zone: spec.zone,
      spawns: { ...d.spawns, start: spec.start },
      triggers: d.triggers,
      things: d.things,
      npcs: d.npcs,
      roamers: d.roamers,
      update(t, focus, camT) {
        let dirty = false;
        for (let z = 0; z < ROWS; z++) {
          const target = z + 0.5 > focus.z + 0.7 ? LOW : TALL;
          const h = rowH.get(z)!;
          if (Math.abs(h - target) > 0.002) { rowH.set(z, h + (target - h) * 0.14); dirty = true; }
        }
        if (dirty) writeWalls();
        for (const m of mounts) m.obj.visible = rowH.get(m.row)! > TALL * 0.8;
        pool.update(t, camT);
        for (const b of d.built) b.update?.(t);
      },
    };
  };
}
```

### src/hd2d/doorway.ts

The door language: dressDoor and the promise check.

```ts
import * as THREE from 'three';
import { box, beam, colMat, planeGeo } from './geo';
import { onWorldReset } from './world';
import { M, type Built } from './field/buildings';
import type { Area } from './area';

/**
 * The door language (docs/design/design-philosophy.md §2b). Light is the
 * promise: a lit lamp at a door means you can go in, always. Planks mean
 * never; a chain means later, when the story gets there; a dead lamp over a
 * black doorway means it needs LUMEN.
 *
 * Every door a builder dresses is also marked in world space, so the game can
 * check its own promises: a lit door must lead somewhere, and every way in
 * must be lit (checkDoors, run on every area load in development).
 */

export type DoorState = 'open' | 'boarded' | 'chained' | 'dark';
export interface DoorMark { x: number; z: number; state: DoorState }

const marks: DoorMark[] = [];
onWorldReset(() => { marks.length = 0; });
/** Record a door at world (x, z) for the promise check. */
export function markDoor(x: number, z: number, state: DoorState): void { marks.push({ x, z, state }); }
export const doorMarks = (): readonly DoorMark[] => marks;

let poolTex: THREE.CanvasTexture | null = null;
function poolTexture(): THREE.CanvasTexture {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,214,150,0.9)');
  grd.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}

/**
 * Dress a doorway in `parent`'s local space: (x, y, z) is the bottom-centre of
 * the opening on a wall facing +z (turned by rotY), w × h its size.
 * - open: warm light inside, a lamp on the wall by the door, light pooled on the step
 * - boarded: planks nailed across a shut door
 * - chained: a shut door with a chain and padlock across it (fresh = a new lock)
 * - dark: a black opening under a dead lamp
 */
export function dressDoor(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, state: DoorState, night: boolean, rotY = 0, opts: { fresh?: boolean; daylight?: boolean; noLeaf?: boolean } = {}): Built {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  if (state === 'open') {
    // warm light inside (or daylight, for a way back out of a dungeon)
    // (both faces: an exit is seen from inside the room, looking at the wall's back)
    const inside = new THREE.Mesh(planeGeo(w * 0.96, h * 0.96), colMat(opts.daylight ? '#fff2d0' : '#ffcf8a', { emissive: opts.daylight ? '#fff0c8' : '#ffb867', emissiveIntensity: opts.daylight ? 2.6 : night ? 2.6 : 1.5, side: THREE.DoubleSide }));
    inside.position.set(0, h * 0.48, -0.015);
    g.add(inside);
    let bulbMat: THREE.MeshStandardMaterial | null = null;
    if (!opts.daylight) {
      // the lamp: a bracket on the wall beside the door, a caged bulb, always lit
      g.add(box(0.06, 0.06, 0.32, M.steel(), w / 2 + 0.22, h + 0.12, 0.16));
      bulbMat = colMat('#ffe0a0', { emissive: '#ffb850', emissiveIntensity: night ? 6 : 2.2 }).clone();
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bulbMat);
      bulb.position.set(w / 2 + 0.22, h + 0.02, 0.3);
      g.add(bulb);
      const cage = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshStandardMaterial({ color: '#2a2622', wireframe: true }));
      cage.position.copy(bulb.position);
      g.add(cage);
    }
    const light = new THREE.PointLight(opts.daylight ? '#fff0d0' : '#ffb867', night ? 7 : 2.4, 5.5, 1.6);
    light.position.set(0, h * 0.7, 0.7);
    g.add(light);
    // light pooled on the step
    const pool = new THREE.Mesh(planeGeo(w * 2.6, 2.4), new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: opts.daylight ? 0.7 : night ? 0.55 : 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.03, 0.9);
    g.add(pool);
    g.add(box(w + 0.3, 0.08, 0.5, M.concrete(), 0, 0, 0.26)); // a clear step
    return { update(t) { if (bulbMat) bulbMat.emissiveIntensity = (night ? 6 : 2.2) * (0.94 + Math.sin(t * 9) * 0.04 + Math.sin(t * 2.7) * 0.02); } };
  }
  if (state === 'dark') {
    g.add(box(w * 0.98, h * 0.98, 0.04, colMat('#030303', { roughness: 1 }), 0, 0, -0.02));
    g.add(box(0.06, 0.06, 0.32, M.steel(), w / 2 + 0.22, h + 0.12, 0.16));
    const dead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), colMat('#3a3632', { roughness: 0.6 }));
    dead.position.set(w / 2 + 0.22, h + 0.02, 0.3);
    dead.rotation.x = 0.6; // the broken bulb, hanging crooked
    g.add(dead);
    return {};
  }
  // boarded and chained doors are shut doors first
  if (!opts.noLeaf) g.add(box(w, h, 0.07, M.wood(), 0, 0, 0.02));
  if (state === 'boarded') {
    const plank = M.grey();
    const span = Math.hypot(w, h * 0.7);
    for (const [ang, py] of [[Math.atan2(h * 0.7, w), h * 0.5], [-Math.atan2(h * 0.7, w), h * 0.5], [0.04, h * 0.25], [-0.03, h * 0.78]] as Array<[number, number]>) {
      const len = Math.abs(ang) > 0.2 ? span + 0.2 : w + 0.3;
      const b = box(len, 0.16, 0.05, plank, 0, -0.08, 0);
      const hold = new THREE.Group();
      hold.add(b);
      hold.position.set(0, py, 0.1);
      hold.rotation.z = ang;
      g.add(hold);
    }
    return {};
  }
  // chained: links sagging across the door, a padlock where they meet
  const steel = opts.fresh ? colMat('#b8bcc0', { metalness: 0.8, roughness: 0.3 }) : colMat('#6a645c', { metalness: 0.6, roughness: 0.6 });
  const n = Math.max(6, Math.round(w / 0.11));
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = -w / 2 + 0.05 + t * (w - 0.1), py = h * 0.52 - Math.sin(t * Math.PI) * 0.18;
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.024, 4, 8), steel);
    link.position.set(px, py, 0.1);
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    g.add(link);
  }
  g.add(box(0.26, 0.28, 0.08, opts.fresh ? colMat('#c8a050', { metalness: 0.8, roughness: 0.3 }) : steel, 0, h * 0.52 - 0.46, 0.13));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.026, 4, 10, Math.PI), steel);
  shackle.position.set(0, h * 0.52 - 0.18, 0.13);
  g.add(shackle);
  g.add(beam(new THREE.Vector3(-w / 2 - 0.05, h * 0.52, 0.06), new THREE.Vector3(-w / 2 - 0.05, h * 0.52 - 0.2, 0.06), 0.05, steel)); // the hasp
  return {};
}

/**
 * The promise check: every lit door must lead somewhere, and every way in
 * (a Thing that travels; a dungeon's exit) must have a lit door at it.
 * Returns the broken promises, one line each.
 */
export function checkDoors(a: Area): string[] {
  const out: string[] = [];
  const near = (x: number, z: number, px: number, pz: number, r = 2.6): boolean => Math.hypot(x - px, z - pz) < r;
  const ways: Array<{ x: number; z: number; what: string }> = [
    ...a.things.filter((t) => t.go).map((t) => ({ x: t.x, z: t.z, what: `"${t.label}" → ${t.go!.to}` })),
    // an interior's own exits are doorways too (outdoor edge exits are roads, not doors)
    ...(!a.sky
      ? a.triggers.filter((t) => t.go).map((t) => ({ x: Math.max(t.x0, Math.min(t.x1, (t.x0 + t.x1) / 2)), z: Math.max(0, Math.min(t.z0, t.z1)), what: `exit → ${t.go!.to}` }))
      : []),
  ];
  for (const m of marks) if (m.state === 'open' && !ways.some((w) => near(m.x, m.z, w.x, w.z))) out.push(`${a.id}: a lit door at (${m.x.toFixed(1)}, ${m.z.toFixed(1)}) goes nowhere`);
  for (const w of ways) if (!marks.some((m) => m.state === 'open' && near(m.x, m.z, w.x, w.z))) out.push(`${a.id}: ${w.what} at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) has no lit door`);
  return out;
}
```

### src/hd2d/sprites.ts

Sprites: RotHero (8-direction billboards, sizing by measurement, packed sheets, mirror), blob shadow.

```ts
import * as THREE from 'three';

/**
 * 2D pixel-art characters standing in the 3D world. Each is an upright,
 * camera-facing plane (the camera's yaw is fixed, so "facing +z" is enough),
 * anchored at the feet, alpha-cut so it casts a crisp silhouette shadow, with
 * a soft contact blob under it. Sheets are the existing walk sheets (4 frames
 * × rows S/N/W; E mirrors W) — placeholders until the 8-direction remake.
 */

export type Dir = 'S' | 'N' | 'W' | 'E';
export interface SheetMeta { frameW: number; frameH: number; cols: number; rows: number; fps: number; originY: number; contentH: number; scale?: number }

/** World units per sheet pixel: SAL's 68px of content stands ~1.65 tall. */
export const PX = 0.0243;

const texLoader = new THREE.TextureLoader();
/** JSON fetches retry too (a throttled host may answer with an error page). */
export async function fetchJson<T>(url: string, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
}

/** Texture loads retry (with a short back-off) so a throttled host doesn't break a character. */
const loader = {
  async loadAsync(url: string, tries = 4): Promise<THREE.Texture> {
    for (let i = 0; ; i++) {
      try { return await texLoader.loadAsync(url); } catch (e) {
        if (i >= tries - 1) throw e;
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  },
};
function pixelTex(t: THREE.Texture): THREE.Texture {
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

let blobTex: THREE.Texture | null = null;
function blob(radius: number): THREE.Mesh {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 1.3), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/** Sprite brightness: the frame is ACES-tonemapped as a whole, so flat sprites are lifted to read at full value. */
export function spriteTint(night: boolean): THREE.Color {
  return night ? new THREE.Color().setRGB(0.6, 0.68, 0.95) : new THREE.Color().setRGB(1.1, 1.05, 0.98);
}

function spriteMesh(tex: THREE.Texture, w: number, h: number, footFromTop: number, tint: THREE.Color): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h * (footFromTop - 0.5), 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: tint });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

export class Walker {
  readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly tex: THREE.Texture;
  dir: Dir = 'S';
  private t = 0;
  private moving = false;

  private constructor(tex: THREE.Texture, readonly meta: SheetMeta, tint: THREE.Color) {
    this.tex = tex;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const k = PX * (meta.scale ?? 1);
    this.mesh = spriteMesh(tex, meta.frameW * k, meta.frameH * k, meta.originY, tint);
    this.root.add(this.mesh, blob(0.34));
    this.setFrame('S', 0);
  }

  static async load(id: string, tint: THREE.Color): Promise<Walker> {
    const [tex, meta] = await Promise.all([
      loader.loadAsync(`./world/char/${id}_walk.png`).then(pixelTex),
      fetchJson<SheetMeta>(`./world/char/${id}_walk.meta.json`, 1).catch(() => null),
    ]);
    // the old generic NPC sheets (npc_kid, npc_rancher, npc_elder) have no meta: 3×3 frames of 20×32
    const img = tex.image as HTMLImageElement;
    const m: SheetMeta = meta ?? { frameW: img.width / 3, frameH: img.height / 3, cols: 3, rows: 3, fps: 6, originY: 0.94, contentH: img.height / 3 - 2, scale: 2.1 };
    return new Walker(tex, m, tint);
  }

  private setFrame(dir: Dir, frame: number): void {
    const { cols, rows } = this.meta;
    const row = dir === 'S' ? 0 : dir === 'N' ? 1 : 2;
    const flip = dir === 'E';
    this.tex.repeat.set((flip ? -1 : 1) / cols, 1 / rows);
    this.tex.offset.set((flip ? frame + 1 : frame) / cols, 1 - (row + 1) / rows);
  }

  /** Advance the walk cycle; `speed` scales cadence (running steps faster). */
  animate(dt: number, moving: boolean, speed = 1): void {
    if (moving !== this.moving) { this.t = 0; this.moving = moving; }
    this.t += dt * speed;
    const f = moving ? Math.floor(this.t * this.meta.fps) % this.meta.cols : 0;
    this.setFrame(this.dir, f);
    // idle: a slow breath so nobody looks pasted on
    this.mesh.scale.y = moving ? 1 : 1 + Math.sin(this.t * 2.2) * 0.012;
  }

  setTint(c: THREE.Color): void { (this.mesh.material as THREE.MeshBasicMaterial).color.copy(c); }

  /** Dialogue card: this sheet's west-facing (left) standing frame. */
  card(): Promise<string> {
    const { frameW, frameH } = this.meta;
    return spriteCard(this.tex.image as HTMLImageElement, 220, { x: 0, y: frameH * 2, w: frameW, h: frameH }, true);
  }

  face(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    this.dir = Math.abs(dx) >= Math.abs(dz) * 0.9 ? (dx < 0 ? 'W' : 'E') : dz < 0 ? 'N' : 'S';
  }
}

/** The lead Ohm: front/back stills that hop as it trots behind the player. */
export class OhmFollower {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly front: THREE.Mesh;
  private readonly back: THREE.Mesh;
  private hop = 0;

  private constructor(front: THREE.Mesh, back: THREE.Mesh) {
    this.front = front;
    this.back = back;
    this.back.visible = false;
    this.body.add(front, back);
    this.root.add(this.body, blob(0.36));
  }

  static async load(num: number, tint: THREE.Color, scale = 0.019): Promise<OhmFollower> {
    const make = async (url: string): Promise<THREE.Mesh> => {
      const tex = pixelTex(await loader.loadAsync(url));
      tex.wrapS = THREE.RepeatWrapping;
      const img = tex.image as HTMLImageElement;
      const foot = lowestOpaqueRow(img) / img.height;
      return spriteMesh(tex, img.width * scale, img.height * scale, foot, tint);
    };
    const [f, b] = await Promise.all([make(`./sprites/ohms/${num}_front_hd.png`), make(`./sprites/ohms/${num}_back_hd.png`)]);
    return new OhmFollower(f, b);
  }

  setTint(c: THREE.Color): void {
    for (const m of [this.front, this.back]) (m.material as THREE.MeshBasicMaterial).color.copy(c);
  }

  /** dx/dz: this frame's motion. Faces the way it moves; hops while moving. */
  step(dt: number, dx: number, dz: number): void {
    const moving = Math.hypot(dx, dz) > 1e-4;
    if (moving) {
      const north = dz < 0 && Math.abs(dz) > Math.abs(dx) * 0.9;
      this.front.visible = !north;
      this.back.visible = north;
      // the stills look right; mirror them when trotting west
      if (Math.abs(dx) > 1e-4) this.front.scale.x = this.back.scale.x = dx < 0 ? -1 : 1;
      this.hop += dt * 11;
    } else {
      this.hop = 0;
    }
    this.body.position.y = moving ? Math.abs(Math.sin(this.hop)) * 0.09 : 0;
  }
}

function lowestOpaqueRow(img: HTMLImageElement): number {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]! > 128) return y + 1;
  return c.height;
}

/** A single still sprite scaled so its drawn content stands `height` units
 *  tall (feet on the ground) — used to compare art styles side by side. */
export async function stillSprite(url: string, height: number, tint: THREE.Color): Promise<THREE.Group> {
  const tex = pixelTex(await loader.loadAsync(url));
  const img = tex.image as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let top = c.height, bottom = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]! > 128) { top = Math.min(top, y); bottom = Math.max(bottom, y + 1); }
  const k = height / Math.max(1, bottom - top);
  const root = new THREE.Group();
  root.add(spriteMesh(tex, img.width * k, img.height * k, bottom / img.height, tint), blob(0.34));
  return root;
}

const DIRS8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'] as const;
export type Dir8 = (typeof DIRS8)[number];

/** One animation as listed in a style's anim.json (sheet: rows = dirs, cols = frames). */
/** `mirror` replaces a direction's frames with another's flipped, for rows that came out facing the wrong way: { "east": "west" }. */
interface AnimInfo { frames: number; fps: number; loop?: boolean; dirs?: string[]; sheet?: boolean; w?: number; h?: number; mirror?: Record<string, string> }
type Frame = { mat: THREE.MeshBasicMaterial; geo: THREE.PlaneGeometry };

/** A hero drawn from 8 directional stills (PixelLab rotations) plus any
 *  animations its anim.json lists (walk, run, idle loops; one-shots such as
 *  pickup, hurt, hop, throw). Animations with fewer than 8 directions borrow
 *  the nearest one they have. Without a walk it steps with a bob. */
export class RotHero {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly still: Record<Dir8, Frame>;
  private readonly anims: Record<string, { info: AnimInfo; frames: Partial<Record<Dir8, Frame[]>> }>;
  dir: Dir = 'S';
  facing: Dir8 = 'south';
  private t = 0;
  /** wall-clock seconds for frame playback (t is scaled by stride speed) */
  private lt = 0;
  private moving = false;
  private oneShot: { name: string; t: number; done: () => void } | null = null;

  private constructor(still: Record<Dir8, Frame>, anims: RotHero['anims']) {
    this.still = still;
    this.anims = anims;
    this.mesh = new THREE.Mesh(still.south.geo, still.south.mat);
    this.mesh.castShadow = true;
    this.body.add(this.mesh);
    this.root.add(this.body, blob(0.34));
  }

  /** Loads ./world/styles/<id>/<dir>.png plus every animation in anim.json
   *  (one packed <name>.png sheet each, or <name>/<dir>/<n>.png frames);
   *  scales so the figure stands `height` tall. An animation that fails to
   *  load is skipped rather than failing the character. */
  static async load(id: string, tint: THREE.Color, height = 1.65): Promise<RotHero> {
    const base = `./world/styles/${id}`;
    const list = (await fetch(`${base}/anim.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))) as Record<string, AnimInfo>;
    const texs = await Promise.all(DIRS8.map((d) => loader.loadAsync(`${base}/${d}.png`).then(pixelTex)));
    const img = texs[0]!.image as HTMLImageElement;
    // measure the south figure's drawn height to size every direction alike
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let top = c.height, bottom = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]! > 128) { top = Math.min(top, y); bottom = Math.max(bottom, y + 1); }
    const k = height / Math.max(1, bottom - top); // world units per source pixel
    // the rotation canvas's centre sits here; bigger animation canvases share that centre
    const centreY = img.height * k * (bottom / img.height - 0.5);
    const geoFor = (pw: number, ph: number): THREE.PlaneGeometry => {
      const geo = new THREE.PlaneGeometry(pw * k, ph * k);
      geo.translate(0, centreY, 0);
      return geo;
    };
    const mat = (t: THREE.Texture): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, color: tint });
    const stillGeo = geoFor(img.width, img.height);
    const still = Object.fromEntries(DIRS8.map((dn, i) => [dn, { mat: mat(texs[i]!), geo: stillGeo }])) as Record<Dir8, Frame>;

    const anims: RotHero['anims'] = {};
    await Promise.all(Object.entries(list).map(async ([name, info]) => {
      try {
        const dirs = (info.dirs ?? DIRS8).filter((x): x is Dir8 => (DIRS8 as readonly string[]).includes(x));
        const frames: Partial<Record<Dir8, Frame[]>> = {};
        if (info.sheet) {
          const sheet = pixelTex(await loader.loadAsync(`${base}/${name}.png`));
          const geo = geoFor(info.w ?? img.width, info.h ?? img.height);
          dirs.forEach((dn, row) => {
            frames[dn] = Array.from({ length: info.frames }, (_, i) => {
              const t = sheet.clone(); // shares the uploaded image; only the window differs
              t.repeat.set(1 / info.frames, 1 / dirs.length);
              t.offset.set(i / info.frames, 1 - (row + 1) / dirs.length);
              return { mat: mat(t), geo };
            });
          });
        } else {
          await Promise.all(dirs.map(async (dn) => {
            const fr = await Promise.all(Array.from({ length: info.frames }, (_, i) => loader.loadAsync(`${base}/${name}/${dn}/${i}.png`).then(pixelTex)));
            const fi = fr[0]!.image as HTMLImageElement;
            const geo = geoFor(fi.width, fi.height);
            frames[dn] = fr.map((t) => ({ mat: mat(t), geo }));
          }));
        }
        for (const [to, from] of Object.entries(info.mirror ?? {})) {
          const src = frames[from as Dir8];
          if (!src) continue;
          frames[to as Dir8] = src.map((f) => {
            const geo = f.geo.clone();
            geo.scale(-1, 1, 1); // materials are double-sided, so the flip shows
            return { mat: f.mat, geo };
          });
        }
        anims[name] = { info, frames };
      } catch {
        // missing or blocked frames: play on without this animation
      }
    }));
    return new RotHero(still, anims);
  }

  private show(f: Frame): void {
    this.mesh.material = f.mat;
    if (this.mesh.geometry !== f.geo) this.mesh.geometry = f.geo;
  }

  has(name: string): boolean { return !!this.anims[name]; }
  get busy(): boolean { return this.oneShot !== null; }

  setTint(c: THREE.Color): void {
    for (const f of Object.values(this.still)) f.mat.color.copy(c);
    for (const a of Object.values(this.anims)) for (const list of Object.values(a.frames)) for (const f of list ?? []) f.mat.color.copy(c);
  }

  face(dx: number, dz: number): void {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    // screen-space angle: 0 = south (toward camera), clockwise toward west
    const a = Math.atan2(-dx, dz);
    const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    // atan2(-dx, dz): south 0, south-west +45°, west +90° … so walk the list backwards
    this.facing = DIRS8[(8 - i) % 8]!;
    if (!this.oneShot) this.show(this.still[this.facing]);
    this.dir = Math.abs(dx) >= Math.abs(dz) * 0.9 ? (dx < 0 ? 'W' : 'E') : dz < 0 ? 'N' : 'S';
  }

  /** Frames of `name` for the current facing, or the nearest direction it has. */
  private framesFor(name: string): Frame[] | undefined {
    const a = this.anims[name];
    if (!a) return undefined;
    const at = DIRS8.indexOf(this.facing);
    for (const step of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const f = a.frames[DIRS8[(at + step + 8) % 8]!];
      if (f?.length) return f;
    }
    return undefined;
  }

  /** Play a one-shot (pickup, hurt, hop, throw…) once, then return to idle. */
  play(name: string): Promise<void> {
    if (!this.anims[name]) return Promise.resolve();
    this.oneShot?.done();
    return new Promise((done) => { this.oneShot = { name, t: 0, done }; });
  }

  animate(dt: number, moving: boolean, speed = 1): void {
    this.t += dt * speed;
    this.lt += dt;
    if (moving !== this.moving) { this.moving = moving; this.t = 0; this.lt = 0; }
    this.body.position.y = 0;
    this.body.rotation.z = 0;
    this.body.scale.set(1, 1, 1);
    if (this.oneShot) {
      const o = this.oneShot;
      o.t += dt;
      const fr = this.framesFor(o.name);
      const info = this.anims[o.name]!.info;
      const i = Math.floor(o.t * info.fps);
      if (!fr || i >= fr.length) { this.oneShot = null; o.done(); } else { this.show(fr[i]!); return; }
    }
    // loops: run when fast and a run exists, else walk; idle when still
    const loop = moving ? (speed > 1.2 && this.anims.run ? 'run' : 'walk') : 'idle';
    const fr = this.framesFor(loop);
    if (fr?.length) {
      const fps = this.anims[loop]!.info.fps;
      this.show(fr[Math.floor(this.lt * fps) % fr.length]!);
      return;
    }
    this.show(this.still[this.facing]);
    if (moving) {
      // stand-in step: a bob, a squash, a lean into the stride
      const s = Math.sin(this.t * 14);
      this.body.position.y = Math.abs(s) * 0.07;
      this.body.scale.set(1 + Math.abs(s) * 0.02, 1 - Math.abs(s) * 0.03, 1);
      this.body.rotation.z = s * 0.035;
    } else {
      this.body.scale.set(1, 1 + Math.sin(this.t * 2.2) * 0.012, 1);
    }
  }
}

/** The dialogue "portrait": the speaker's own sprite, trimmed to its figure
 *  and upscaled by a whole number for crisp pixels (Mark, 2026-10-23 — no
 *  separate portraits). `rect` picks a frame out of a sheet. */
export async function spriteCard(src: string | HTMLImageElement, targetH = 220, rect?: { x: number; y: number; w: number; h: number }, mirror = false): Promise<string> {
  const img = typeof src === 'string' ? await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }) : src;
  const r = rect ?? { x: 0, y: 0, w: img.width, h: img.height };
  const c = document.createElement('canvas');
  c.width = r.w;
  c.height = r.h;
  const g = c.getContext('2d')!;
  g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const d = g.getImageData(0, 0, r.w, r.h).data;
  let x0 = r.w, y0 = r.h, x1 = 0, y1 = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (d[(y * r.w + x) * 4 + 3]! > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  if (x1 <= x0) return c.toDataURL();
  const w = x1 - x0, h = y1 - y0, k = Math.max(1, Math.floor(targetH / h));
  const out = document.createElement('canvas');
  out.width = w * k;
  out.height = h * k;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  if (mirror) { o.translate(w * k, 0); o.scale(-1, 1); }
  o.drawImage(c, x0, y0, w, h, 0, 0, w * k, h * k);
  return out.toDataURL();
}
```

### src/hd2d/battle/themes.ts

Battle grounds per region (panels painted as local ground).

```ts
import * as THREE from 'three';
import { COLS, ROWS, HALF } from './rules';
import type { Mood } from '../mood';
import { cottonwood, bush } from '../field/props';
import { colMat, box } from '../geo';
import { rng } from '../noise';
import type { Side } from './rules';

/**
 * The battle grid belongs to the place you're fighting in (Mark: it looked
 * too much like Battle Network). Each region turns the 6×3 field into its own
 * ground — prairie earth plots, cracked blacktop, bunker deck plate — and
 * dresses the clearing around it. Sides read through material, not neon:
 * your side is worn and familiar, theirs is foreign ground.
 */

export type ThemeId = 'field' | 'road' | 'bunker' | 'cistern';

export interface ArenaTheme {
  id: ThemeId;
  /** panel height (a raised plot, a slab, a plate) */
  panelH: number;
  roughness: number;
  metalness: number;
  paintPanel(side: Side, seed: number, night: boolean): THREE.CanvasTexture;
  ground(mood: Mood): THREE.Mesh;
  /** set dressing around (and between) the panels */
  dress(scene: THREE.Scene, mood: Mood, panelAt: (col: number, row: number) => THREE.Vector3, pw: number, pd: number): void;
  /** the glow under your Ohm's panel, and the ground's warning before a hit */
  standGlow: string;
  warnGlow: string;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Paint a 32×32 pixel texture from a per-pixel function. */
function paint(fn: (x: number, y: number, r: () => number) => RGB, seed: number): THREE.CanvasTexture {
  const S = 32, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const r = rng(seed);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = fn(x, y, r), i = (y * S + x) * 4;
    img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundDisc(colors: [string, string], speck: string[], night: boolean): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, colors[0]);
  grd.addColorStop(1, colors[1]);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const r = rng(91);
  g.globalAlpha = night ? 0.25 : 0.4;
  for (let i = 0; i < 1400; i++) { g.fillStyle = speck[i % speck.length]!; g.fillRect(r() * 128, r() * 128, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/** Wild grass tufts: little crossed blade cards. */
function tufts(scene: THREE.Scene, spots: Array<[number, number]>, color: string, seed: number): void {
  const r = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
  for (const [x, z] of spots) {
    for (let k = 0; k < 3; k++) {
      const h = 0.18 + r() * 0.22;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, h, 3), mat);
      blade.position.set(x + (r() - 0.5) * 0.25, h / 2, z + (r() - 0.5) * 0.18);
      blade.rotation.z = (r() - 0.5) * 0.5;
      blade.castShadow = true;
      scene.add(blade);
    }
  }
}

// ------------------------------------------------------------- the Field

const field: ArenaTheme = {
  id: 'field',
  panelH: 0.1,
  roughness: 1,
  metalness: 0,
  // your side: dark worked loam with green coming through; theirs: dry, cracked red clay
  paintPanel(side, seed, night) {
    const base = side === 'player' ? hex('#5a4630') : hex('#8a5a3a');
    const dark = side === 'player' ? hex('#3a2c1e') : hex('#5e3a24');
    const life = side === 'player' ? hex('#5e8a32') : hex('#8a8a4a');
    return paint((x, y, r) => {
      let c = mix(base, dark, r() * 0.45);
      if (side === 'player' && (y % 6 === 2)) c = mix(c, dark, 0.5); // furrows
      if (side === 'foe' && (Math.abs(((x * 7 + y * 3) % 23) - 11) < 1 || Math.abs(((x * 3 - y * 5 + 64) % 19) - 9) < 1)) c = dark; // drying cracks
      if (r() < 0.05) c = life;
      if (x === 0 || y === 0) c = mix(c, hex('#a08868'), 0.35);
      if (x === 31 || y === 31) c = mix(c, dark, 0.6);
      return night ? mix(c, hex('#1a2230'), 0.25) : c;
    }, seed);
  },
  ground: (mood) => groundDisc(mood.night ? ['#2c3a26', '#141c14'] : ['#5b7f34', '#34501f'], ['#6f9a3c', '#4f7a2c', '#8a8a4a', '#3d5e24'], mood.night),
  dress(scene, mood, at, pw, pd) {
    let seed = 7100;
    for (const [x, z, s] of [[-9, -5.5, 1.3], [-6.2, -6.4, 1.1], [-2, -7.2, 1.25], [2.6, -7.0, 1.2], [6.4, -6.2, 1.15], [9.4, -5.2, 1.3], [-10.5, -1.5, 1.1], [10.8, -1.0, 1.2]] as Array<[number, number, number]>) {
      const t = cottonwood(x, z, s, seed++);
      t.position.y = 0;
      scene.add(t);
    }
    for (const [x, z] of [[-7.5, 3.5], [7.8, 3.2], [-4.6, -4.4], [4.4, -4.6], [0.3, -5.1], [-8.6, 0.8], [8.8, 0.4]] as Array<[number, number]>) {
      const b = bush(x, z, 0.9, seed++);
      b.position.y = 0;
      scene.add(b);
    }
    for (let x = -6; x <= 6; x += 1.5) {
      const post = box(0.1, 0.9, 0.1, colMat('#5a4a3a'), x, 0, -3.4);
      post.rotation.z = Math.sin(x * 3) * 0.08;
      scene.add(post);
    }
    // wild grass growing up between the plots, and a line of field stones down the middle
    const gaps: Array<[number, number]> = [];
    for (let c = 0; c < COLS - 1; c++) if (c !== HALF - 1) for (let r = 0; r < ROWS; r++) gaps.push([at(c, r).x + pw / 2, at(c, r).z]); // between columns
    for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) gaps.push([at(c, r).x, at(c, r).z + pd / 2]); // between rows
    tufts(scene, gaps, mood.night ? '#2e4a24' : '#6a9a3a', 33);
    const stone = colMat('#8a8478', { roughness: 1 });
    for (let k = 0; k < ROWS * 2 + 1; k++) {
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + (k % 3) * 0.03, 0), stone);
      s.position.set(0, 0.05, at(0, 0).z - pd * 0.7 + k * (pd * (ROWS + 0.4)) / (ROWS * 2 + 1));
      s.scale.y = 0.55;
      s.castShadow = true;
      scene.add(s);
    }
  },
  standGlow: '#ffd08a',
  warnGlow: '#ff6a1a',
};

// ------------------------------------------------------------- the Farm Road

const road: ArenaTheme = {
  id: 'road',
  panelH: 0.06,
  roughness: 0.95,
  metalness: 0,
  // slabs of the old blacktop: yours darker and patched, theirs sun-bleached and crumbling
  paintPanel(side, seed, night) {
    const base = side === 'player' ? hex('#4a4844') : hex('#77736a');
    const dark = hex('#2c2a27');
    return paint((x, y, r) => {
      let c = mix(base, dark, r() * 0.3);
      if (r() < 0.04) c = mix(c, hex('#9a958a'), 0.6); // aggregate
      if (Math.abs(((x * 5 + y * 2) % 29) - 14) < 1 && r() < 0.8) c = r() < 0.4 ? hex('#5e8a32') : dark; // cracks with weeds
      if (side === 'player' && x > 18 && x < 26 && y > 6 && y < 14) c = mix(c, hex('#3a3936'), 0.6); // a tar patch
      if (x === 0 || y === 0 || x === 31 || y === 31) c = mix(c, dark, 0.55);
      return night ? mix(c, hex('#1a2230'), 0.25) : c;
    }, seed);
  },
  ground: (mood) => groundDisc(mood.night ? ['#2a3224', '#131812'] : ['#6a7a3c', '#3c4a22'], ['#8a8a4a', '#5e7a32', '#a09a68'], mood.night),
  dress(scene, mood, at, pw, pd) {
    // the faded centre line where the sides meet
    for (let k = 0; k < ROWS; k++) {
      const dash = box(0.08, 0.008, pd * 0.5, colMat('#c9a84a', { roughness: 1 }), 0, 0.065, at(0, k).z);
      scene.add(dash);
    }
    // telephone poles and a sagging line, barbed fence, tumbled hay
    const wood = colMat('#4e3b2b', { roughness: 1 });
    for (const x of [-8.5, 0, 8.5]) {
      scene.add(box(0.16, 4.2, 0.16, wood, x, 0, -6));
      scene.add(box(1.4, 0.1, 0.1, wood, x, 3.8, -6));
    }
    for (let x = -10; x <= 10; x += 1.6) {
      const post = box(0.08, 0.85, 0.08, wood, x, 0, -3.6);
      post.rotation.z = Math.sin(x * 2.3) * 0.1;
      scene.add(post);
    }
    scene.add(box(20, 0.02, 0.02, colMat('#6a6560', { metalness: 0.5 }), 0, 0.55, -3.6));
    scene.add(box(20, 0.02, 0.02, colMat('#6a6560', { metalness: 0.5 }), 0, 0.3, -3.6));
    for (const [x, z] of [[-7.2, 2.6], [7.4, 2.2], [6.6, 3.0]] as Array<[number, number]>) {
      const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.75, 14), colMat('#c9a24a', { roughness: 1 }));
      bale.rotation.z = Math.PI / 2;
      bale.position.set(x, 0.45, z);
      bale.castShadow = true;
      scene.add(bale);
    }
    let seed = 7300;
    for (const [x, z, s] of [[-10, -7, 1.3], [-5, -8, 1.1], [5, -8.2, 1.2], [10.2, -7, 1.3]] as Array<[number, number, number]>) {
      const t = cottonwood(x, z, s, seed++);
      t.position.y = 0;
      scene.add(t);
    }
    // weeds at the slab joints
    const gaps: Array<[number, number]> = [];
    for (let c = 0; c < COLS; c++) gaps.push([at(c, 0).x, at(0, 0).z - pd / 2], [at(c, ROWS - 1).x + pw / 2, at(0, ROWS - 1).z + pd / 2]);
    tufts(scene, gaps, mood.night ? '#2e4a24' : '#7aa83c', 41);
  },
  standGlow: '#ffd08a',
  warnGlow: '#ff7a2a',
};

// ------------------------------------------------------------- underground

const bunker: ArenaTheme = {
  id: 'bunker',
  panelH: 0.08,
  roughness: 0.6,
  metalness: 0.45,
  // riveted deck plate: yours painted the colony's teal-grey, theirs bare rusting steel
  paintPanel(side, seed, night) {
    const base = side === 'player' ? hex('#4e6268') : hex('#6a5248');
    const dark = hex('#262b2e');
    return paint((x, y, r) => {
      let c = mix(base, dark, r() * 0.2);
      if ((x + y) % 6 === 0) c = mix(c, hex('#9aa4aa'), 0.18); // tread
      if (side === 'foe' && r() < 0.08) c = mix(c, hex('#8a4a26'), 0.7); // rust bloom
      if (x <= 1 || y <= 1 || x >= 30 || y >= 30) c = (x + y) % 4 < 2 ? hex('#c99a2a') : hex('#1d1b17'); // hazard edge
      if ((x === 4 || x === 27) && (y === 4 || y === 27)) c = hex('#b8c0c4'); // rivets
      return night ? mix(c, hex('#1a2230'), 0.15) : c;
    }, seed);
  },
  ground: () => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.8, metalness: 0.3 }));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return m;
  },
  dress(scene) {
    const steel = colMat('#4a5258', { metalness: 0.4, roughness: 0.6 });
    scene.add(box(22, 3.2, 0.4, steel, 0, 0, -4.2));
    for (const x of [-7, -2, 3, 8]) {
      scene.add(box(0.3, 3.2, 0.5, colMat('#2b3136'), x, 0, -4.0));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), colMat('#ffcf7a', { emissive: '#ffcf7a', emissiveIntensity: 4 }));
      bulb.position.set(x + 1.2, 2.3, -3.8);
      scene.add(bulb);
      const l = new THREE.PointLight('#ffb35c', 6, 7, 1.6);
      l.position.set(x + 1.2, 2.1, -3.2);
      scene.add(l);
    }
    for (const y of [1.7, 2.0]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 22, 8), colMat('#7c4424', { metalness: 0.3 }));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, y, -3.95);
      scene.add(pipe);
    }
    for (const [x, z] of [[-7.4, 2.4], [7.6, 2.0]] as Array<[number, number]>) scene.add(box(0.6, 0.6, 0.6, colMat('#6b5a44'), x, 0, z));
  },
  standGlow: '#9fe8ff',
  warnGlow: '#ff6a1a',
};

// ------------------------------------------------------------- the Cistern

const cistern: ArenaTheme = {
  id: 'cistern',
  panelH: 0.1,
  roughness: 0.5,
  metalness: 0.05,
  // wet channel concrete: yours scrubbed and drained, theirs slick with algae and standing water
  paintPanel(side, seed) {
    const base = side === 'player' ? hex('#6e7068') : hex('#4e5a52');
    const dark = hex('#2e3430');
    return paint((x, y, r) => {
      let c = mix(base, dark, r() * 0.25);
      if (side === 'foe' && Math.hypot(x - 16, y - 16) < 6 + r() * 2) c = mix(c, hex('#2e4a48'), 0.6); // a standing puddle
      if (r() < (side === 'foe' ? 0.12 : 0.04)) c = mix(c, hex('#4f7a2c'), 0.7); // algae
      if (x <= 0 || y <= 0) c = mix(c, hex('#9a9c90'), 0.4);
      if (x >= 31 || y >= 31) c = mix(c, dark, 0.6);
      return c;
    }, seed);
  },
  ground: () => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: '#1e2a26', roughness: 0.3, metalness: 0.2 }));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return m;
  },
  dress(scene) {
    const wall = colMat('#5e5f58', { roughness: 0.9 });
    scene.add(box(22, 3.4, 0.5, wall, 0, 0, -4.3));
    const moss = colMat('#3d5e24', { roughness: 1 });
    for (const x of [-8, -3, 2, 7]) scene.add(box(1.6, 0.9 + (x % 3) * 0.2, 0.08, moss, x, 0, -4.0));
    for (const y of [1.8, 2.2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 22, 8), colMat('#7c4424', { metalness: 0.3 }));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, y, -3.95);
      scene.add(pipe);
    }
    // a strip of open channel water behind the field, and lamps over it
    const water = new THREE.Mesh(new THREE.PlaneGeometry(22, 1.6), new THREE.MeshStandardMaterial({ color: '#1d3a38', roughness: 0.1, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, -3.0);
    scene.add(water);
    for (const x of [-6, 0, 6]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), colMat('#ffcf7a', { emissive: '#ffcf7a', emissiveIntensity: 4 }));
      bulb.position.set(x, 2.6, -3.8);
      scene.add(bulb);
      const l = new THREE.PointLight('#ffb35c', 6, 7, 1.6);
      l.position.set(x, 2.4, -3.2);
      scene.add(l);
    }
  },
  standGlow: '#9fe8ff',
  warnGlow: '#ff6a1a',
};

export const THEMES: Record<ThemeId, ArenaTheme> = { field, road, bunker, cistern };

/** Which grid a region fights on. */
export function themeFor(areaId: string): ThemeId {
  // a section can name its grid outright (region: 'road' | 'bunker' …)
  if (areaId === 'field' || areaId === 'road' || areaId === 'bunker' || areaId === 'cistern') return areaId;
  return areaId === 'farmroad' || areaId === 'railhead' || areaId === 'scar' ? 'road' : areaId === 'ohmstead' ? 'bunker' : areaId === 'cistern' ? 'cistern' : 'field';
}
```

### src/hd2d/ui.ts

The pixel dissolve, name tag and travel card. (lines 1–200 of 280)

```ts
/**
 * The HD-2D overworld UI: a clean dark panel with a thin gold rule, a name
 * plate, and the speaker's own sprite (upscaled, facing left) standing at the
 * right of the box, tucked behind the panel (Mark's notes). Plus the area
 * title card, the interact prompt, and touch controls.
 */

export interface Speech { name?: string; portrait?: string; lines: string[] }

/** 4×4 ordered-dither thresholds, for the pixel dissolve. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
};

export class UI {
  readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly box: HTMLDivElement;
  private readonly portrait: HTMLImageElement;
  private readonly plate: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private readonly more: HTMLDivElement;
  private speech: Speech | null = null;
  private line = 0;
  private shown = 0;
  private onClose: (() => void) | null = null;

  /** Touch stick vector in [-1,1]², and a one-shot A press. */
  stick = { x: 0, y: 0 };
  private aPressed = false;

  constructor(host: HTMLElement) {
    this.root = el('div', 'ui', host);
    this.prompt = el('div', 'prompt', this.root);
    this.box = el('div', 'dlg', this.root);
    this.portrait = el('img', 'dlg-portrait', this.box);
    const panel = el('div', 'dlg-panel', this.box);
    this.plate = el('div', 'dlg-name', panel);
    this.text = el('div', 'dlg-text', panel);
    this.more = el('div', 'dlg-more', panel);
    this.more.textContent = '▼';
    this.box.addEventListener('pointerdown', (e) => { e.preventDefault(); this.aPressed = true; });
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) this.touchControls();
  }

  get talking(): boolean { return this.speech !== null; }

  /** True once per A press (keyboard handled by the caller; touch here). */
  takeA(): boolean {
    const a = this.aPressed;
    this.aPressed = false;
    return a;
  }

  titleCard(title: string, sub: string): void {
    this.root.querySelectorAll('.title-card').forEach((e) => e.remove());
    const c = el('div', 'title-card', this.root);
    el('div', 'tc-rule', c);
    el('div', 'tc-title', c).textContent = title;
    el('div', 'tc-sub', c).textContent = sub;
    el('div', 'tc-rule', c);
    setTimeout(() => c.classList.add('out'), 3200);
    setTimeout(() => c.remove(), 4600);
  }

  hint(html: string): void {
    const h = el('div', 'hint', this.root);
    h.innerHTML = html;
    setTimeout(() => h.classList.add('out'), 9000);
  }

  private badgeEl: HTMLDivElement | null = null;
  badge(html: string): void {
    this.badgeEl ??= el('div', 'badge', this.root);
    this.badgeEl.innerHTML = html;
  }

  private fadeEl: HTMLDivElement | null = null;
  /** Fade the screen to black (true) or back in (false); resolves when done. */
  fade(on: boolean, ms = 450): Promise<void> {
    this.fadeEl ??= el('div', 'fade', this.root);
    const f = this.fadeEl;
    f.style.transitionDuration = `${ms}ms`;
    void f.offsetWidth;
    f.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, ms));
  }

  private disEl: HTMLCanvasElement | null = null;
  /** A quick pixel dissolve to black (true) or back (false): cells drop out in a
   *  dithered order, so it reads as "next area" rather than a slow fade. */
  dissolve(on: boolean, ms = 280): Promise<void> {
    const c = (this.disEl ??= el('canvas', 'dissolve', this.root));
    const cell = 12, w = Math.ceil(window.innerWidth / cell), h = Math.ceil(window.innerHeight / cell);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const th = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const hash = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        th[y * w + x] = ((BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16) * 0.65 + Math.abs(hash) * 0.35;
      }
    for (let i = 0; i < w * h; i++) { img.data[i * 4] = 11; img.data[i * 4 + 1] = 12; img.data[i * 4 + 2] = 14; }
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (): void => {
        const k = Math.min(1, (performance.now() - t0) / ms), v = on ? k : 1 - k;
        for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = th[i]! < v ? 255 : 0;
        ctx.putImageData(img, 0, 0);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }

  /** The small place-name tag shown each time you enter a section. */
  nameTag(text: string, sub = ''): void {
    this.root.querySelectorAll('.name-tag').forEach((e) => e.remove());
    const t = el('div', 'name-tag', this.root);
    el('div', 'nt-title', t).textContent = text;
    if (sub) el('div', 'nt-sub', t).textContent = sub;
    setTimeout(() => t.classList.add('out'), 1700);
    setTimeout(() => t.remove(), 2600);
  }

  private travelImg = new Map<string, Promise<HTMLImageElement>>();
  /** The travel card between regions: the world map, a dotted line drawing from
   *  here to there, and one line of text. Shown over the dissolve's black. */
  async travel(s: { img: string; box: [number, number, number, number]; path: Array<[number, number]>; line: string; ms?: number }): Promise<void> {
    let p = this.travelImg.get(s.img);
    if (!p) {
      p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s.img; });
      this.travelImg.set(s.img, p);
    }
    const img = await p.catch(() => null);
    const card = el('div', 'travel-card', this.root);
    const cv = el('canvas', 'tv-map', card);
    el('div', 'tv-line', card).textContent = s.line;
    const [bx0, by0, bx1, by1] = s.box;
    const H = Math.min(window.innerHeight * 0.62, 560), W = H * ((bx1 - bx0) / (by1 - by0));
    const dpr = Math.min(window.devicePixelRatio, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${Math.round(W)}px`; cv.style.height = `${Math.round(H)}px`;
    const ctx = cv.getContext('2d')!;
    const k = (W * dpr) / (bx1 - bx0);
    const P = (q: [number, number]): [number, number] => [(q[0] - bx0) * k, (q[1] - by0) * k];
    // path length, for drawing it out over time
    const pts = s.path.map(P);
    const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
    const total = seg.reduce((a, b) => a + b, 0);
    const ms = s.ms ?? 2600;
    void card.offsetWidth;
    card.classList.add('on');
    await new Promise<void>((res) => {
      const t0 = performance.now();
      const draw = (): void => {
        const e = Math.min(1, (performance.now() - t0) / ms), d = Math.min(1, Math.max(0, (e - 0.15) / 0.6)) * total;
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (img) ctx.drawImage(img, bx0, by0, bx1 - bx0, by1 - by0, 0, 0, cv.width, cv.height);
        else { ctx.fillStyle = '#e6d6b4'; ctx.fillRect(0, 0, cv.width, cv.height); }
        ctx.save();
        ctx.strokeStyle = '#6b2a1e'; ctx.lineWidth = 4 * dpr; ctx.setLineDash([9 * dpr, 7 * dpr]); ctx.lineCap = 'round';
        ctx.beginPath();
        let left = d, head = pts[0]!;
        ctx.moveTo(head[0], head[1]);
        for (let i = 0; i < seg.length && left > 0; i++) {
          const a = pts[i]!, b = pts[i + 1]!, f = Math.min(1, left / seg[i]!);
          head = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
          ctx.lineTo(head[0], head[1]);
          left -= seg[i]!;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#efe3c8'; ctx.strokeStyle = '#6b2a1e'; ctx.lineWidth = 3 * dpr;
        ctx.beginPath(); ctx.arc(head[0], head[1], 7 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        if (e < 1) requestAnimationFrame(draw); else res();
      };
      draw();
    });
    card.classList.remove('on');
    await new Promise((r) => setTimeout(r, 380));
    card.remove();
  }

  /** The floating "talk" prompt, placed at a screen point (px) or hidden. */
  showPrompt(label: string | null, x = 0, y = 0): void {
    if (!label || this.talking) { this.prompt.classList.remove('on'); return; }
    this.prompt.innerHTML = `<b>${'ontouchstart' in window ? 'A' : 'E'}</b>${label}`;
    this.prompt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    this.prompt.classList.add('on');
  }

  say(s: Speech, onClose?: () => void): void {
```

### tools/gen-ohms-style.mjs

PixelLab: 8-direction Ohms in the locked style (prompts included).

```js
/**
 * Wild Ohms in SAL's locked indie-action style (PixelLab Pro, 8 directions,
 * style_character_id = SAL), in the order the player meets them on the
 * critical path: the Field → Farm Road → the Pickett Place → … Looks follow
 * docs/compendium/ohms.md (object, type, lore).
 *   node tools/gen-ohms-style.mjs [num ...]   (default: every Ohm listed)
 * Writes assets/reference/styles/ohms/<id>__<dir>.png + <id>.prompt.json,
 * stages public/world/styles/<id>/<dir>.png and registers the Ohm in
 * public/world/styles/index.json. Skips Ohms already staged.
 */
import { writeFileSync, readFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/reference/styles/ohms');
const PUB = join(ROOT, 'public/world/styles');
const API = 'https://api.pixellab.ai/v2';
const H = { Authorization: `Bearer ${process.env.PIXELLAB_API_KEY}`, 'Content-Type': 'application/json' };
const SAL_ID = 'cea31c61-3b70-4ec6-a617-413b60f80ece';
const STYLE = 'modern indie action-adventure pixel art: chunky stylized proportions, big bold readable silhouette, saturated colours, lineless with strong graphic light and shadow shapes, expressive and punchy';
const OHM = 'a small living machine creature (an Ohm), an old household or farm machine that woke up with a will of its own, weathered by years outdoors, no humans, no rider';
const FLOOR = 1000; // Mark's rule: never dip below 1000 generations without telling him

/** Encounter order (first sighting on the critical path). */
const OHMS = [
  [10, 'toastlet', 'Toastlet: a small chrome pop-up toaster creature, two bread slots on top glowing hot orange inside, a lever on its side like a stubby arm, two little feet, mischievous eyes on its front panel, crumbs and scorch marks; ambush predator'],
  [19, 'vacuette', 'Vacuette: an upright vacuum cleaner creature, bulging dust bag body, a long nozzle hose like an elephant trunk, the floor head as feet, power cord trailing like a tail, one round glowing eye, faded maroon plastic'],
  [21, 'fanlet', 'Fanlet: a little ceiling fan creature that walks on its pull-chain legs, five wooden blades as a spinning crown, frosted glass light dome as its face with a soft eye glow, brass motor housing, swaying and dainty'],
  [24, 'mailstrom', 'Mailstrom: a rural roadside mailbox creature on its post like a single leg, the rounded tin box is its body, the door is a mouth with old letters peeking out, the red flag raised like an ear, dented and loyal'],
  [12, 'wavelet', 'Wavelet: a small microwave oven creature, boxy beige body, the glass door is a face with a dim turntable glow inside, keypad on its side like freckles, short stubby legs, humming, waiting patiently'],
  [15, 'filaglow', 'Filaglow: a tiny light bulb creature, clear glass head with a glowing coiled filament like a wisp of hair and eyes, a screw-thread metal base as its body, hopping on the threads, warm amber glow, gentle'],
  [47, 'mowlet', 'Mowlet: a small push lawn mower creature, red deck body with a grass-stained skirt, the handle bar arching up like a tail, front wheels as paws, little blades whirring underneath, headlamp eyes, grass clippings flying'],
  [32, 'staplejaw', 'Staplejaw: a desktop stapler creature, the hinged top is a big biting jaw with a row of staple teeth, black and chrome body, crouched low like a snapping turtle, stubborn glare'],
  [18, 'beeplet', 'Beeplet: a round ceiling smoke detector creature, white disc body with vent slits, one small red blinking light eye, tiny legs, alarmed nervous expression, a little speaker grille mouth'],
  [41, 'tumblet', 'Tumblet: a tumbleweed creature taken over by a strange signal, a ball of dry tangled brush around a rusty baling-wire skeleton, two faint green glowing eyes deep inside, rolling, drifting; a plant creature, not a machine'],
  [49, 'sawlet', 'Sawlet: a small chainsaw creature, orange engine body, the chain bar sticking out like a long toothy snout, the pull-cord handle as a tail, rough exhaust breath, purring but dangerous'],
  [54, 'cellet', 'Cellet: a small chunky battery cell creature, copper top terminal like a hat, black and gold body with a charge meter on its belly, little stubby arms, sparks at its terminals, friendly giver'],
  [30, 'vendlet', 'Vendlet: a squat vending machine creature, tall red body, the lit glass front shows rows of cans like teeth, coin slot eyes, the delivery flap as a mouth, heavy stomping legs, holds a grudge'],
  [70, 'rustbed', 'Rustbed: a small rusty ranch pickup truck creature, headlight eyes, a grille shaped like curved cattle horns across its front, cargo bed on its back loaded with junk, four wheels, never quits hauling'],
  [65, 'pumplet', 'Pumplet: a small oil pumpjack creature, the walking beam is its long neck with the horsehead as its head nodding up and down, counterweight body, a sturdy base for feet, slow patient nod, oily black and yellow'],
  [80, 'balelet', 'Balelet: a small square hay baler creature, green farm-machine body with a pickup reel mouth that gobbles hay, a little chute on its back puffing straw, wheels, stubborn worker'],
  [82, 'tillbit', 'Tillbit: a small farm tractor creature, big rear wheels and small front wheels, a rounded hood like a snout with headlight eyes, an exhaust stack like a horn, a little tiller rake on its back, red paint'],
  [38, 'spoutlet', 'Spoutlet: a short fire hydrant creature, fat red cast-iron body, the side caps are its arms, the top bonnet is its head with determined eyes, water spurting from a nozzle, planted wide and defiant'],
  [46, 'barbwyre', 'Barbwyre: a spool of barbed wire come alive, a wooden reel body with rusty barbed wire wrapped around it, loose coils of wire lashing out like tentacles, glinting barbs, two eyes peering between the coils'],
  [45, 'bonnetbloom', 'Bonnetbloom: a patch of tall blue-violet lupine wildflowers grown into a small creature, flower spikes as a crown, leafy body, roots tangled with an old buried cable that glows faintly, sleepy kind eyes; a plant creature, not a machine'],
];

const bal = async () => (await (await fetch(`${API}/balance`, { headers: H })).json()).subscription?.generations;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run([num, id, desc]) {
  const body = {
    description: `${desc}. ${OHM}`, style_description: STYLE, method: 'create_with_style', view: 'low top-down',
    image_size: { width: 64, height: 64 }, no_background: true, style_character_id: SAL_ID,
  };
  let sub;
  for (let i = 0; i < 60; i++) {
    sub = await (await fetch(`${API}/create-character-pro`, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
    if (sub.background_job_id) break;
    if (/concurrent|slot|limit|busy/i.test(JSON.stringify(sub))) { await sleep(20000); continue; }
    throw new Error(`${id}: ${JSON.stringify(sub).slice(0, 300)}`);
  }
  if (!sub?.background_job_id) throw new Error(`${id}: never got a job slot`);
  let cid = sub.character_id;
  for (let i = 0; ; i++) {
    const j = await (await fetch(`${API}/background-jobs/${sub.background_job_id}`, { headers: H })).json();
    if (j.status === 'completed') { cid ??= j.last_response?.character_id; break; }
    if (j.status && !['processing', 'queued', 'pending'].includes(j.status)) throw new Error(`${id}: ${j.status} ${JSON.stringify(j).slice(0, 300)}`);
    if (i > 240) throw new Error(`${id}: timeout`);
    await sleep(5000);
  }
  const zip = Buffer.from(await (await fetch(`${API}/characters/${cid}/zip`, { headers: H })).arrayBuffer());
  const tmp = join(OUT, `.zip_${id}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'c.zip'), zip);
  execFileSync('unzip', ['-o', '-q', join(tmp, 'c.zip'), '-d', tmp]);
  const rot = join(tmp, readdirSync(tmp).find((d) => d !== 'c.zip' && d !== 'metadata.json'), 'rotations');
  mkdirSync(join(PUB, id), { recursive: true });
  for (const f of readdirSync(rot)) {
    copyFileSync(join(rot, f), join(OUT, `${id}__${f}`));
    copyFileSync(join(rot, f), join(PUB, id, f));
  }
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(OUT, `${id}.prompt.json`), JSON.stringify({ source: 'pixellab', endpoint: 'v2/create-character-pro', species: num, body, character_id: cid, at: new Date().toISOString() }, null, 2));
  // register so the game picks it up
  const idxPath = join(PUB, 'index.json');
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  idx.ohms[String(num)] = id;
  writeFileSync(idxPath, JSON.stringify(idx));
  return `#${num} ${id}: ok (${cid})`;
}

mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2).map(Number);
const todo = OHMS.filter(([n, id]) => (want.length ? want.includes(n) : true) && !existsSync(join(PUB, id, 'south.png')));
const start = await bal();
console.log(`${todo.length} to make; ${start} generations on hand`);
// three at a time (PixelLab's concurrent-job cap); stop before the floor
let used = 0;
const queue = [...todo];
const worker = async () => {
  for (let o = queue.shift(); o; o = queue.shift()) {
    const now = await bal();
    if (now - 60 < FLOOR) { console.log(`stopping: ${now} left, near the ${FLOOR} floor`); return; }
    try { console.log(await run(o)); used++; } catch (e) { console.log(`FAILED ${e.message}`); }
  }
};
await Promise.all([worker(), worker(), worker()]);
const end = await bal();
console.log(`made ${used}; used ${start - end} generations (${used ? ((start - end) / used).toFixed(1) : '-'} each); ${end} remain`);
```

### tools/gen-cast-style.mjs

PixelLab: people in the locked style.

```js
/**
 * Cast + starter Ohms in SAL's locked indie-action style: PixelLab Pro,
 * 8 directions, style_character_id = SAL (so every figure matches him).
 *   node tools/gen-cast-style.mjs [id ...]
 * Writes assets/reference/styles/cast/<id>__<dir>.png + <id>.prompt.json and
 * stages public/world/styles/<id>/<dir>.png for the game.
 */
import { writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/reference/styles/cast');
const PUB = join(ROOT, 'public/world/styles');
const API = 'https://api.pixellab.ai/v2';
const H = { Authorization: `Bearer ${process.env.PIXELLAB_API_KEY}`, 'Content-Type': 'application/json' };
const SAL_ID = 'cea31c61-3b70-4ec6-a617-413b60f80ece';
const STYLE = 'modern indie action-adventure pixel art: chunky stylized proportions, big bold readable silhouette, saturated colours, lineless with strong graphic light and shadow shapes, expressive and punchy';

const CAST = {
  wren: { size: 64, desc: 'WREN, a teenage girl, young scavenger hero of post-collapse plains cattle country: blonde hair in a low ponytail under a worn leather cap with brass goggles pushed up, red bandana at the neck, scuffed tan work jacket with a salvaged metal shoulder pad, patched denim trousers with knee pads, worn brown boots, tool pouch on belt, determined hopeful face' },
  mabel: { size: 64, desc: "Grandma Mabel Vane, a warm elderly woman, silver hair in a neat bun, round wire glasses, cardigan over a work dress, canvas apron with a pocket of tools, kind steady face, the keeper of her late husband's workshop" },
  boone: { size: 64, desc: "Warden Hollis Boone, gruff broad-shouldered colony chief in his fifties, salt-and-pepper beard, sun-faded cattleman's hat, long weathered duster coat over a work vest, heavy boots, arms ready, stern but fair" },
  cass: { size: 64, desc: "Cass, the hero's best friend, a younger teen with short scruffy brown hair, oversized mustard-yellow jacket with rolled sleeves, a homemade badge pin, cargo shorts, scuffed sneakers, eager restless grin" },
  odessa: { size: 64, desc: 'Odessa, the colony archivist and radio operator, a woman in her thirties, dark hair in a practical bun, headset with a boom mic around her neck, long olive field coat with many pockets, satchel of papers, dry clever smile' },
  rook: { size: 64, desc: 'Rook, a hard-edged teenage raider rival from a red-dust colony, spiky dark hair, rust-red scarf over the shoulders, patched leather vest over a sleeveless shirt, fingerless gloves, cargo trousers, cocky sneer' },
  scootlet: { size: 64, ohm: true, desc: 'Scootlet, a small living machine companion: a cute kick e-scooter creature with a single headlight eye, a stubby handlebar like ears, small deck body, two little wheels, restless like a puppy on wheels, scuffed teal and cream paint, no rider' },
  dronelet: { size: 64, ohm: true, desc: 'Dronelet, a small living machine companion: a cute pocket quadcopter creature hovering, round body with one big camera lens eye, four small rotor arms with spinning props, antenna, scuffed white and orange paint' },
  scraplet: { size: 64, ohm: true, template: 'dog', desc: 'Scraplet, a small living machine companion: a sturdy scrap-metal puppy built from salvaged parts, grey riveted body, one glowing cyan eye, antenna tail with a little bulb, bolted legs, loyal and eager' },
};

const bal = async () => (await (await fetch(`${API}/balance`, { headers: H })).json()).subscription?.generations;

async function run(id) {
  const c = CAST[id];
  const body = {
    description: c.desc, style_description: STYLE, method: 'create_with_style', view: 'low top-down',
    image_size: { width: c.size, height: c.size }, no_background: true, style_character_id: SAL_ID,
    ...(c.template ? { template_id: c.template } : {}),
  };
  const sub = await (await fetch(`${API}/create-character-pro`, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (!sub.background_job_id) throw new Error(`${id}: ${JSON.stringify(sub).slice(0, 300)}`);
  let cid = sub.character_id;
  for (let i = 0; ; i++) {
    const j = await (await fetch(`${API}/background-jobs/${sub.background_job_id}`, { headers: H })).json();
    if (j.status === 'completed') { cid ??= j.last_response?.character_id; break; }
    if (j.status && !['processing', 'queued', 'pending'].includes(j.status)) throw new Error(`${id}: ${j.status} ${JSON.stringify(j).slice(0, 300)}`);
    if (i > 240) throw new Error(`${id}: timeout`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  const zip = Buffer.from(await (await fetch(`${API}/characters/${cid}/zip`, { headers: H })).arrayBuffer());
  const tmp = join(OUT, `.zip_${id}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'c.zip'), zip);
  execFileSync('unzip', ['-o', '-q', join(tmp, 'c.zip'), '-d', tmp]);
  const rot = join(tmp, readdirSync(tmp).find((d) => d !== 'c.zip' && d !== 'metadata.json'), 'rotations');
  mkdirSync(join(PUB, id), { recursive: true });
  for (const f of readdirSync(rot)) {
    copyFileSync(join(rot, f), join(OUT, `${id}__${f}`));
    copyFileSync(join(rot, f), join(PUB, id, f));
  }
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(OUT, `${id}.prompt.json`), JSON.stringify({ source: 'pixellab', endpoint: 'v2/create-character-pro', body, character_id: cid, at: new Date().toISOString() }, null, 2));
  return `${id}: ok (${cid})`;
}

mkdirSync(OUT, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CAST);
const before = await bal();
if (before - ids.length * 60 < 1000) throw new Error(`would approach the 1000-generation floor (have ${before})`);
for (const r of await Promise.allSettled(ids.map(run))) console.log(r.status === 'fulfilled' ? r.value : `FAILED ${r.reason}`);
console.log(`used ${before - (await bal())}, remaining ${await bal()}`);
```

### tools/pack-anims.mjs

Packs animation frames into one sheet per animation.

```js
/**
 * Pack each character's animation frames into one sprite sheet per animation
 * (rows = directions, columns = frames), so the game makes ~1 request per
 * animation instead of one per frame (raw.githack throttles hundreds).
 *   node tools/pack-anims.mjs
 * Reads public/world/styles/<id>/anim.json + <anim>/<dir>/<i>.png (freshly
 * staged) or, once packed, assets/reference/styles/frames/<id>/<anim>/…; writes
 * <anim>.png, marks the entry { sheet: true, w, h }, and moves the loose frames
 * out of public/ into assets/reference/styles/frames/ (kept as source).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = new URL('..', import.meta.url).pathname;
const STYLES = join(ROOT, 'public/world/styles');
const FRAMES = join(ROOT, 'assets/reference/styles/frames');
const ALL8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

for (const id of readdirSync(STYLES)) {
  const animPath = join(STYLES, id, 'anim.json');
  if (!existsSync(animPath)) continue;
  const anim = JSON.parse(readFileSync(animPath, 'utf8'));
  for (const [name, info] of Object.entries(anim)) {
    const fresh = existsSync(join(STYLES, id, name));
    const srcRoot = fresh ? join(STYLES, id, name) : join(FRAMES, id, name);
    const dirs = (info.dirs ?? ALL8).filter((d) => existsSync(join(srcRoot, d)));
    if (!dirs.length) continue;
    const first = PNG.sync.read(readFileSync(join(srcRoot, dirs[0], '0.png')));
    const w = first.width, h = first.height, n = info.frames;
    const sheet = new PNG({ width: w * n, height: h * dirs.length });
    dirs.forEach((d, row) => {
      for (let i = 0; i < n; i++) {
        const f = join(srcRoot, d, `${i}.png`);
        if (!existsSync(f)) continue;
        const src = PNG.sync.read(readFileSync(f));
        PNG.bitblt(src, sheet, 0, 0, Math.min(w, src.width), Math.min(h, src.height), i * w, row * h);
      }
    });
    writeFileSync(join(STYLES, id, `${name}.png`), PNG.sync.write(sheet));
    anim[name] = { ...info, dirs, sheet: true, w, h };
    if (fresh) {
      mkdirSync(join(FRAMES, id), { recursive: true });
      rmSync(join(FRAMES, id, name), { recursive: true, force: true });
      renameSync(join(STYLES, id, name), join(FRAMES, id, name));
    }
  }
  writeFileSync(animPath, JSON.stringify(anim, null, 2));
  console.log(`${id}: ${Object.keys(anim).join(', ')}`);
}
```
