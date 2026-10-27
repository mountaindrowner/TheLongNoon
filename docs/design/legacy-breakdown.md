# The first version, broken down

**2026-10-27.** What `legacy/poc2` (the last build the owner gave us) actually
does, scene by scene and system by system. For each part it says where that
part lives in the rebuild and whether it's ported yet. This is the checklist for
"build out the game the way the first one did it". Rule 5 still holds: nothing
here adds a system the first version didn't have.

## The story it tells: one night, "Lamp"

The first version is one mission, called **Lamp**. It runs over one night in
the Span, from Lamp (7:20 pm) to Shutter (about 4:30 am).

1. **Title.** "The Long Noon", with New and Continue. Continue only shows if
   there's a save. On a phone, the first tap starts the sound.
2. **The tale (cinematic).** A chapter card: *"A story told at Mar Farm, a
   long time ago."* Then a fire at night with Papá (Elías), Mamá (Rosa) and
   little Juno. Papá tells the old story, and painted panels play behind his
   words:
   - **rain:** the sky full of clouds, water falling for free;
   - **machines:** machines sent up to spray shade into the sky;
   - **veil:** the dust killing what made the clouds;
   - **white:** the White Year, when the heat came all at once;
   - **below:** people going down under bridges and stores; machines still
     walking the day;
   - **circling:** something still up there, circling.

   It closes on *"Will it ever rain again?" / "Not in my lifetime, mija. …
   Maybe in yours."* Then a card: **The Long Noon / Many years later.** The
   whole tale can be skipped.
3. **The burial (the game starts).** Lamp. Papá is dead, wrapped in white on a
   platform by Mar Farm, left for the sun to take at first light. **Hermana
   Lupe** says the rite with Juno. Mamá is gone: she "left this on the counter
   before she went". Lupe gives Juno **the staybook**, the family's book of
   rules. Page 1 is in Papá's capitals: *NEVER WALK IN WHITE*.
   *"Eleven days, Juno. Don't you go doing anything stupid."*
   So **Papá is never alive in the game itself, only in the tale.**
4. **Home.** *Feed the goats and check the water tank.*
   - The goats give **2 jars of milk**.
   - The tank fills Juno's **water to 10** and unlocks **page 3** (Mamá: "Wet
     you didn't see come out of the ground…").
5. **The market.** *Trade the milk with Doña Chayo at the night market.*
   Chayo gives **2 tins of white** for the milk ("Your mamá never once sold me
   gray") and unlocks **page 2** (Mamá: put white on before you leave).
6. **Kit.** *Find Kit by the seven flags.* Kit asks whether rain makes a noise,
   then tells Juno that **Pancha (Juno's goat) got out** toward the drain:
   "There's something down there… It's got a light." "Like a lantern?" "Like
   an eye."
7. **Pancha.** *Find Pancha down by the drain, east of the park.* Walking into
   the drain starts a scene. A **Stray** (a six-wheeled machine with one red
   eye) rolls out of the culvert, and a **coyote** follows it. That unlocks
   **page 5** (Papá: *HIT WHAT'S SOFT. ON MACHINES, EYES.*). Then the fight.
8. **The fight at the drain** (the one battle; see below). After it Kit asks
   to come along ("That's a yes. I'm counting that as a yes"), **Kit joins**,
   and Juno strips the Stray for scrap, a dead solar cell and bearings.
   Pancha follows them home.
9. **Home before Shutter.** *Get home to Mar Farm before Shutter.* At the door:
   - *"Shutter. Doors sealed. The Span sleeps through the heat."*
   - **The ending.** In daylight, Kit wakes Juno: everybody's up on the roofs.
     They look up. **A drone the length of a street (NIMBUS-3)** crosses the
     white sky, low, heading toward the lake. *"Nothing comes down from up
     there." … "It's going toward the lake." "The White Bowl."*
   - The **last page** of the staybook, in Mamá's hand: *"Juno. If you're
     reading this by yourself, then"*, and the page stops there.
   - An end card: read the last page, keep exploring, or go to the title.
10. **Free roam.** *First mission complete. The Span is yours to explore.*

## The rules it runs on

| System | In the first version | In the rebuild |
|---|---|---|
| **Clock** | One game minute per real second. Lamp starts at 7:20 pm. Phases: Lamp, Long night, Shutter, Day. Stops in menus and talk. | **Ported** (`game/clock.ts`). The light follows it, and the town relights at Lamp and at 6 am. |
| **Water** | 10 drops. Starts at 6. The tank fills it to 10; the well gives +3. One drop is lost to thirst every 150 s (it never drops below 1 that way). In battle, *Drink* heals 16. | **Ported** |
| **Daylight** | In Day, outside Mar Farm's door, you lose 1 water every 3.5 s and the HUD says *"Daylight. Your water is burning."* At 0 you **faint**: you wake at Mar Farm at the next Lamp with 3 water and one less tin of white. At Shutter, a warning: *"Shutter. Get under a roof before the white."* | **Ported:** the first version's rule as it was. Rooms count as a roof. The owner's **shade-as-cover** idea (held-ideas.md) stays held. |
| **White** | Tins of zinc paste; the money. Shown by the water meter. Chayo trades 2 for the milk. | **Ported** (the count only, as in the first version) |
| **Items** | The staybook, milk, scrap, a dead cell, bearings. Shown in the pause menu. | **Ported** |
| **Staybook** | Pages unlock with a full-screen page: Papá's capitals or Mamá's slant, then a line saying what it teaches. Open it with B or Tab, or from the pause menu. Pages: 1, 2, 3, 5, last. | **Ported** |
| **Objective** | Top of the screen: *Mission: Lamp*, then the step's line. A marker floats over the target, and it's pinned to the screen edge when the target is off screen. | **Ported**, plus the **mini map** (new, asked for by the owner) |
| **Dialogue** | Scripts in `dialogue.json`. A talk picks its lines from what's happening (`home&!fed`, `market`, `*`). Commands: wait, item, take, white, water, page, step, flag, sfx, choice, rest, ending, cam, spawnEnemies, battle, join, salvage, lookUp, tale, waitDrone. Typed text with a voice blip per speaker. | **Ported:** the same files and the same commands (`src/game/data`, `game/script.ts`) |
| **Rest and save** | At Mar Farm's door: *"Rest here?"* Resting heals the party and saves. The game also saves at every new step. | **Ported.** The rest spot is the cot inside Mar Farm. |
| **Saves** | `localStorage` key `longnoon.poc2.save`, `v: 1`: step, flags, clock, day, water, white, items, pages, party HP, pipe durability, who has joined, position. | **Ported** as **`longnoon.save`, `v: 1`** (a new key, so the first version's saves don't collide) |
| **Pause menu** | Resume, Staybook, Save, Load, settings (frame counter, graphics, sound, music), Title. The side panel shows the party and items. | **Ported** |
| **Kit following** | After he joins, Kit walks Juno's trail, and Pancha follows behind him. | **Ported** |
| **Battle** | See below | **Ported** (`game/battle.ts`) |
| **Sound** | All synthesized: footsteps by ground type, a voice blip per speaker, goats, chickens, a coyote's howl at night, fire crackle, wind louder in Day, menu sounds, the battle set, the drone's drone. **Three music tracks:** intro (title and tale), explore, combat. | **Ported** (`game/sound.ts`). The three tracks come across from `legacy/poc2/src/assets/music`, re-encoded at 64 kbps. |
| **Input** | WASD/arrows, E/Space/Z/Enter to talk, Esc/Q for pause, B/Tab for the book. On touch: a floating stick, an A button, Book and Menu buttons. | **Ported**; touch gets Book and Menu buttons |

## The battle (one fight, at the drain)

The fight happens in the open, where you were standing. It isn't a separate
arena.

- **Turns:** charge time. Each unit gains its speed every tick and acts at
  100. A strip shows the next six turns.
- **Party:** Juno (HP 42, attack 7, speed 10) with a **pipe**, and Kit (HP 26,
  attack 4, speed 12) with a **sling**.
  - The pipe has 12 durability. It loses 1 per hit, or 2 on armor, and at 0
    it bends: *"The pipe bends."* After that it does 60 % damage.
- **Your turn:**
  - **Fight:** pick a target *and a part*.
  - **Brace:** take half damage.
  - **Drink water:** costs 1 water, heals 16.
  - **Run:** refused here, because "Pancha's still back there."
- **Parts:**
  - **The Stray:**
    - Sensor eye: 10 HP, soft.
    - Chassis: 30 HP, armored (it takes 35 %).
    - Breaking the eye **stuns** it for a turn. After that it's blind, and
      40 % of its rams miss.
    - Once page 5 is read, soft parts show a **Soft** tag.
  - **The coyote:** 14 HP, soft. It **flees** at 4 HP.
- **Damage:**
  - Soft parts take ×1.4 (×2.2 from the sling).
  - Armor takes ×0.35 from the pipe and ×0.3 from the sling.
  - A stunned machine takes ×2 on armor.
  - Every hit does at least 1.
- **Enemy turns:**
  - The coyote lunges at whoever has the least HP, for 4 to 6.
  - The Stray rams one target for 7 to 10. With its eye still whole, 35 % of
    the time it **sparks** the whole party for 4 to 6.
- **Parry:** a ring closes on the target. Press when it closes and the hit is
  cut to 20 %. The first time, the game says how to do it, and the ring is
  slower.
- **Losing:** *"Juno goes down."* Then *Try the fight again*, with HP back to
  at least 60 %, or *Load last save*.
- **Winning:** *"The drain goes quiet."* The Stray's wreck stays where it fell.

## Places, moved onto Seven Flags

The first version's town was a small grid. The same beats land here
(coordinates are Seven Flags' own; add 64 to z for region coordinates):

| Beat | First version | Seven Flags |
|---|---|---|
| Start, the burial platform, Lupe | (4.6, 32) | the platform by Mar Farm's lot (134.6, 121.2), with Lupe beside it |
| The goats' pen | (20, 35) | the pen east of the lot (150, 125) |
| The water tank | (24, 24) | the AGUA tank (156.4, 110.6) |
| Home, the door | (13, 27) | Mar Farm's door (143, 116.7) |
| The night market, Chayo | Del Mar Park | the Plaza, Chayo's stall (82, 144) |
| Kit by the seven flags | by the flags | Kit by the flags (84, 139) |
| The well | (86, 57) | the plaza's well (94, 150) |
| The bench with the heart | north, on the Old Trail | the old bench (140.6, 41) |
| Pancha, the drain | east of the park (107.5, 56.5) | in the drain south of Del Mar, east of the Plaza (115, 147) |
| Shelter in Day | within 3.4 of the door | within 3.4 of Mar Farm's door, or inside any room |

## Things the first version had that the rebuild changes

- **Papá is not in the town.** The first Seven Flags build placed him there by
  mistake. He is the one on the platform. He
  appears only in the tale.
- **The staybook** used to sit on the counter in Mar Farm's room. Lupe hands it
  over at the burial now, as the first version had it, so the counter shows
  where it sat.
- **The mini map** is new. The owner asked for it on 2026-10-27: always on
  the right, close or zoomed out.
