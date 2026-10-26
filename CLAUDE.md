# The Long Noon: rules for coding sessions

A browser JRPG in HD-2D, being **rebuilt from the ground up** on the world style
spec. Every session starts fresh, so read these first:

- `docs/style/world-style-spec.md`: **the rules for how the world looks and is built.** MUST rules are hard.
- `docs/design/world-methodology.md`: **how The Long Noon's world is laid out** (regions, roads, naming, day/night,
  the lantern language). It overrides the style spec where they differ (real places, night first). `[PROPOSAL]` items await the owner.
- `docs/design/held-ideas.md`: the owner's ideas waiting for a go (daytime shade-as-cover, …). Don't build them unasked.
- `docs/architecture/current-state.md`: what's built, where it departs from the spec (and why), what's next.
- `docs/architecture/display-and-input.md`: 1080p desktop first; phones (landscape) are where the owner tests.
- `docs/research/engineering-brief.md`: the agreed technical direction.
- `legacy/poc2/`: the original proof of concept: its story, dialogue and quest data, sprites and music to bring across.

## Commands

```
npm install
npm run dev            # dev server
npm run build          # dist/index.html, the whole game in one offline file
npm test               # typecheck, build (rebuild + legacy), Playwright at 1080p and phone landscape
```

`?time=lamp|night|white|day` picks the light. `window.__LN` (pos, areaId, piece, tp, face, go, talking, doorIssues, checkAllRooms) is there for tests and checks.
Headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`; it renders a frame or two
a second, so tests wait on outcomes, never fixed durations.

## Rules

1. **Follow the spec.** Port, don't reinterpret. Every textured surface at 16 px per world unit with world-unit UVs.
   Props from primitives. One hero, one routine, one signature per map. Glow only where it promises something.
2. **Prove it by looking.** Build, screenshot at 1280×720 and 844×340, and check against spec §20 before calling a map done.
3. **The door language is enforced:** `checkDoors` must come back empty (the playtests assert it).
4. Engine code (`src/engine`) stays region-agnostic. Region kits and maps live in `src/regions/<region>/`.
5. Never invent game systems (XP, gold, crafting, shops) without the owner's approval.
   The in-world economy is **water** and **tins of white**, not gold.
   Real place names never appear on screen except as Old Name hints where the sun never reached.
6. Departures from the spec are written down in `current-state.md` with the reason; open ones wait for the owner.
7. Text describes, never interprets. Signs are what a local would paint. New writing matches the voice in
   `legacy/poc2/src/data/dialogue.json` and `pages.json`.
8. Save compatibility: once saves exist, any change to their shape needs a version bump and a migration.
9. Small changes on a branch. Say what changed, how it was checked, and what's left.
