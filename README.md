# The Long Noon

A browser JRPG in HD-2D: pixel-art people standing in a lit, hand-built 3D
world. It's being rebuilt piece by piece on the **world style spec**
([`docs/style/world-style-spec.md`](docs/style/world-style-spec.md)). The first
proof of concept is kept in [`legacy/poc2/`](legacy/poc2/README.md) for reference.

```
npm install
npm run dev          # live-reloading dev server
npm run build        # dist/index.html: the whole game in one offline file
npm test             # typecheck, build, playtest at 1080p and on a phone
```

Add `?time=lamp|night|white|day` to the URL to see Mar Farm in each light.

## Layout

```
src/
  main.ts              runtime: renderer, camera, post, input, walking, talking, exits
  engine/              the spec's engine, ported from its reference source
    noise geo textures   seeded noise · world-unit UV geometry · the pixel texture library
    post mood            tilt-shift + bloom + grade · lighting presets
    world terrain        ground glyphs, height, solids · painted ground, aprons, water, grass
    section interior     the map kit (glyph grid, edges, exits) · cutaway interiors
    foliage props kit    trees, motes, power lines · prop recipes · light pool and lamps
    buildings fence      building recipe and shared materials · fences
    doorway              the door language and its promise check
    sprites ui area      8-direction sprites · dialogue and transitions · map types
  game/actors.ts       the cast, drawn from the proof of concept's atlas until regenerated
  regions/span/        the Span: its moods, its prop kit, and its maps
    mar-farm.ts        Mar Farm, the first map rebuilt
  styles/              interface type and panels (spec §15)
docs/
  style/               the world style spec (the rules everything follows)
  architecture/        how the rebuild is put together, what's done, what's next
  research/            the engineering brief
legacy/poc2/           the original game, its tools' output, its audit and screenshots
tests/                 Playwright playtests (rebuild + legacy)
tools/                 build.py / unpack.py for the legacy single-file game
```

See [`docs/architecture/current-state.md`](docs/architecture/current-state.md)
for what's built and where it departs from the spec.
