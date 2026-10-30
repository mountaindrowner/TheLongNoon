# Can this build carry a 40-hour game?

Measured on 2026-10-29. The owner asked: *"Can it support 20 more maps like this? Maybe bigger? … can it support a
40-hour game?"* These figures come from the built game. Frame rates in the container are software-rendered and mean
nothing. Draw calls, triangles, memory and download size do carry over to real machines.

## What the game is made of now

| | Size | What it is |
|---|---|---|
| Music | 5.6 MB | 3 tracks (MP3) |
| Figures | 4.8 MB | 62 PNG sheets and portraits, about 40 people and creatures |
| Fonts | 0.3 MB | 8 files |
| Code and data | ~1 MB | the engine, every map, the whole prologue's story |
| **The whole game** | **11.6 MB** | one HTML file, everything inlined (`vite-plugin-singlefile`) |

**Maps cost almost nothing to download.** A map is code that builds itself from primitives when Juno comes near it
(spec rule: props from primitives). Seven outdoor maps and ten rooms come to about 4,400 lines. Twenty more maps
add maybe 150–300 KB.

**Code:**

| Area | Lines | Note |
|---|---|---|
| `src/engine` | 4,575 | region-agnostic |
| `src/game` | 2,090 | rules, fights, progress |
| `src/regions/span` | 4,355 | the first region |
| `src/main.ts` | ~2,100 | everything that ties them together |

**Story data:** 80 KB for the whole prologue (`dialogue.json` is 57 KB).

## At run time

Since the Span became hub and spokes (below), every map is built alone, so each row is that map's whole cost.
Triangles include the shadow pass.

| Where | Draw calls | Triangles | Meshes |
|---|---|---|---|
| Seven Flags (the town, the hub) | 686 | 4.3 M | 2,415 |
| The Lake Road | 178–220 | 4.1–4.4 M | 483 |
| The White Bowl | 148 | 3.0 M | 330 |
| The Ramp | 384 | 1.7 M | 418 |
| The Trail North | 388 | 3.1 M | 310 |
| The church | 606 | 3.0 M | 558 |
| The mall | 340 | 2.5 M | 429 |
| A room | ~530 | 9 k | ~120 |

The cutaway walls in rooms are many small pieces, hence the draw calls. Since 2026-10-30 each place also carries its
run-outs, the ground and brush past each crossing (current-state.md piece 13): 0.1–0.4 M triangles a place, almost no
draw calls.

- **Before hub and spokes,** two maps were drawn at once wherever they met. The town's east edge with the Lake Road
  came to about 7.7 M triangles, and the Lake Road with the White Bowl to 6.2 M.
- **Memory:** the JS heap is about 160 MB in town. It reaches about 350 MB in the moment of going from one place to
  another, before the old one is collected.
- **More maps don't make any frame cost more.** Only the place Juno is in exists.
- **Building a map** took 3 to 20 s here, in software rendering on a shared CPU. On a real machine it should be a
  fraction of that, spread over frames, but it hasn't been measured on a phone. `?perf` now shows it.

**Leaks found and fixed (2026-10-29).** Going between regions left GPU memory behind every time:

- the old world's textures (about 17 per round trip);
- its shadow map;
- the figures of people taken down with their maps;
- the small textures of maps dropped while streaming.

All four are now freed. After three round trips through every region, the textures, geometries and heap are back
where they started. Before this, a long session, and phones above all, would have run out of GPU memory.

## Hub and spokes (the owner, 2026-10-29)

*"Would it be better to have regions that have main hubs and have connections, but you load into separate maps in
the region?"*, then *"try to make our current region and maps like that."*

- **Seven Flags is the hub.** Every other map is a place of its own, loaded through a transition at its edge:
  - the Ramp, north up the highway;
  - the Lake Road, east down the boulevard, and the White Bowl down past it;
  - the Trail North, through the trail gate, and the church up past it;
  - the mall, through the underpass.
- **A road off the map runs on past the edge** with its banks and brush, further than the camera ever sees (the
  run-outs, region.ts). Walking into it is the transition: the dissolve, then the next place.
- **Only one place is built at a time,** so each map's cost (the table above) is the most a frame ever costs there.
- Story markers for somewhere else point at the way there, through the hub if need be (`gateTo`, region.ts).
- `edgeIssues`, the door checks and the prologue checker cover every place.

## Verdict

**The direction holds, and three things need to change before the game grows.** (The world model already changed:
hub and spokes, 2026-10-29.)

**What scales:**

- **Regions that stream maps.** A 40-hour route is more regions, each loaded on its own (the hill and the mall are
  already built this way). Frame cost depends on the maps near Juno, never on the total.
- **Maps built from code.** They're nearly free to ship, and every map follows the same rules (doors, edges).
- **The story as data, with a checker.** Nights, steps and dialogue are JSON. The paper walk takes a fraction of a
  second, however long the story gets. That's what keeps a 40-hour story from quietly breaking.
- **Saves are versioned** and migrate.

**What has to change:**

1. **Packaging: one file won't carry a 40-hour game.**
   - Rough sizes for a 40-hour route (the story file's prologue, four acts and an epilogue):
     - about 15 regions;
     - about 150 figures (~15 MB);
     - about 25 music tracks (~40 MB as MP3, about half that at a lower bitrate);
     - 3–6 MB of code and story.
   - That's 60–80 MB in total, which as one HTML file becomes about 100 MB. All of it would be read and decoded at
     startup, on every launch, which means a slow start and a large memory spike. Phone browsers close tabs for
     that.
   - **Do instead:** a normal multi-file build. Each region's code, figures and music load when Juno heads there,
     with a loading screen at the transitions that already exist. Vite does this without plugins (dynamic imports,
     asset files).
   - itch.io's limits for an HTML5 game, as its upload guidelines are quoted in its forums (confirm on the
     official page): at most 1,000 files and 500 MB extracted, 200 MB per file. Figures packed into atlases per
     region stay far inside that.
   - Keep the one-file build for small shareable demos.
2. **Frame cost for phones.**
   - 750 draw calls and 4 M triangles is fine on a desktop GPU, but heavy for a phone. Rough target for a mid-range
     phone: under 300 calls and 1 M triangles.
   - Where they come from:
     - the brush walls (thousands of small pieces);
     - the shadow pass drawing everything twice;
     - rooms' cutaway walls (many small meshes).
   - This is an engine pass (merging, instancing, a shorter shadow distance, cheaper brush), not a change of
     direction. Measure first: open the game with `?perf` on the phone.
3. **Splitting the code and data as they grow.**
   - `main.ts` holds the runtime, the story runtime, the fights and their staging, the followers, the HUD wiring
     and the test hooks: about 2,100 lines. It should be split into modules before it doubles.
   - The story data should be one file per act or region rather than one `dialogue.json`.
   - The checker builds every map to test reach, so with many regions it should run per region.

**Tests and CI:**

- A full run takes about 35 minutes over four parallel jobs.
- Walking tests in software rendering don't grow cheaply. Lean on the fast checks (the paper walk, lint, the edge
  and door checks per region), keep slow walking tests for the mechanics, and shard further.

**Content budget:**

- A figure with its animations costs about 40–60 PixelLab generations, so 150 figures is roughly 6,000–9,000. The
  balance is about 1,900.
- Music is three tracks now; a long game needs many more.

## `?perf`

Add `?perf` to the game's address, or `#perf` where a `?` doesn't pass (the shared page, itch.io). A corner readout shows:

- frames a second;
- draw calls and triangles per frame;
- geometries and textures on the GPU;
- the JS heap, where the browser reports it;
- how long the last map took to build.

Those are the numbers that decide the phone work.
