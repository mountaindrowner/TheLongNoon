# Held ideas

The owner's ideas for later. **None of these are approved to build yet**
(CLAUDE.md rule 5). Each one waits for the owner to say go. Write each down
when it comes up, with what already exists that it would build on.

## Daytime: shade as cover, the sun as damage (owner, 2026-10-26)

**Built (2026-10-28):** the owner said go, with the rules: a timed night, then water, then health, and conditions
until Juno sleeps. See `docs/architecture/current-state.md`, piece 7. The notes below are kept for the history.

> "I like the idea of using shadows during daytime as cover and taking damage
> over time when you travel above ground. Maybe we could use that later, or
> maybe it could be a normal function."

### What already exists

**In the story** (`legacy/poc2/src/data/pages.json`, page 1):
- "NEVER WALK IN WHITE. IF YOUR SHADOW'S SHORTER THAN YOU ARE, YOU'RE ALREADY LATE."
- Its teaching line: "The clock runs all night. At Shutter, get under a roof. Daylight costs water by the minute."

**In the proof of concept** (`legacy/poc2/src/js/16-exploration.js`):
- **Shutter** (4:30 to 6:00 am) warns once: "Shutter. Get under a roof before the white."
- **Day** (6:00 am to 6:30 pm): out from under a roof, one water every 3.5 s, with the warning "Daylight. Your water is burning."
- **At zero water, you faint.** You wake at the farm the next evening with 3 water, and a tin of white is spent.
- **Thirst:** one water every 150 s at any hour, never below 1.

**In the rebuild:**
- The clock moves the light: night, Shutter, the white, Lamp.
- The sun is a real shadow-casting light that sits overhead by day, so shadows are short at noon and long at the ends of the day. That is the page's rule, made visible.
- Shade is real geometry: the shade sails, the canopy, the billboard, the bus shelter, building shadows.

### The idea, as I'd shape it

- **The sun hurts:** above ground in daylight, you take damage over time (water first, then health?).
- **Shade is cover:** standing in a real shadow, cast by whatever the sun is behind, stops the damage or slows it. Shadows move through the day, so a patch of cover at 9 am is gone by noon, and noon is the worst hour. Crossing open ground by day becomes hopping from shade to shade.
- **Under is safe:** drains, culverts and interiors take no damage. That makes the dark ways in (the East Road culverts) a daytime route, not just a dungeon.
- **How to check:** a ray from Juno toward the sun, tested against solid geometry, a few times a second. That's cheap, and it matches exactly what the player sees.

### Questions for the owner

1. **Always on, or only some of the time?** For example, only once the story reaches the road, or only on caravan legs.
2. **What does the sun take?** Water (the legacy rule), health, or both in turn.
3. **Does shade stop the damage or only slow it?**
4. **Do you faint or die at zero?** And what does fainting cost?
