# The Long Noon: rules for coding sessions

A browser JRPG (HD-2D: pixel sprites in a lit three.js world). Every session starts fresh,
so read these before changing anything:

- `docs/architecture/current-state.md`: how the game is actually built today. Keep it updated when that changes.
- `docs/research/engineering-brief.md`: the agreed direction. These are recommendations, not existing APIs.
- `README.md`: how each system works.

## Commands

```
python3 tools/build.py                 # src/ -> dist/The-Long-Noon.html (open it in a browser)
python3 tools/unpack.py file.html src  # import a single-file build made elsewhere
```

Append `#debug` to the URL for instant text and `window.__LN` (tp, setStep, setClock, runScript).

## Rules

1. **Preserve the working game.** The owner loves how it looks, plays and sounds. Never
   change art, writing, camera, lighting, battle timing or sound as a side effect of a refactor.
2. Check visual changes by building and screenshotting in headless Chromium, and compare
   with `docs/baseline/`. Unit tests alone are not enough.
3. Content (dialogue, quests, map, battles) lives in `src/data/`; reusable logic lives in
   `src/js/`. Don't write mission-specific facts into engine code.
4. Never invent game systems (XP, gold, crafting, shops) without the owner's approval.
   The in-world economy is **water** and **tins of white**, not gold.
5. Save compatibility: any change to the save shape needs a version bump and a migration.
6. Keep changes small and on a branch. Explain what changed, how it was checked, and what's left.
7. No three.js upgrade or new major library without a separate, approved change.
8. New writing matches the voice already in `src/data/dialogue.json` and `pages.json`.
