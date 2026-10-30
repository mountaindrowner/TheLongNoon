# Current state: the rebuild

Updated 2026-10-28. The game is being rebuilt from the ground up on the world
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

## Piece 2 (done): the Span as one region, with rooms

The whole of the region's design is in `docs/design/regions/span.md`. In short:

- **The engine walks a region, not a map** (`src/engine/region.ts`; methodology
  §2.4, option C):
  - **Layout:** sections of 44×32 sit on a grid, each built in its own chunk at
    its offset.
  - **Seams:** ground glyphs read across them (`outside`), and the terrain
    noise uses region coordinates (`origin`, `heightSeed`), so roads and land
    carry across with no cut. A seam side has no edge dressing and stays
    walkable.
  - **Lights:** every built point light goes into one shared pool of ten that
    follows the camera.
  - **Doors:** the door check runs per section.
- **Five sections:** Mar Farm (moved to cell 0,1), the Ramp, the Plaza, the
  East Road and the White Bowl. Each has its hero, routine and signature.
- **Four rooms** behind lit doors: the Mar store, the Chapel, Doña Fina's, and
  Tavo and Nina's.
  - **Getting in and out:** you enter through a pixel dissolve and come back
    out onto the step you went in from.
  - **The door's light says what it is:** a caged bulb, a hung lantern, light
    under the door, or a lit window. Doors you can't use are shut, boarded or
    dark.
- **Night is the default** (`?time=` still picks a light). The Span's night
  has a stronger moon than the engine's, so empty roads read in blue.
- **Checks:**
  - `npm test` builds the Span in all three moods. It checks every door
    promise in every section and room, where each section sits, the walk
    across the farm–Plaza seam, collision, going into the Chapel and back out,
    Lupe's dialogue, and the unbuilt east road turning you back.
  - Screenshots were reviewed at 1280×720 and 844×340, by night and by day.
- **Known gaps:**
  - The region builds all five sections at load (about 2 s on a laptop); real
    streaming waits until regions are bigger.
  - Two rooms have nobody in them yet.
  - The Bowl's crust is near-white by day on purpose, and still needs a
    phone check outdoors.

## Piece 3 (done): the clock

- **The clock** (`src/game/clock.ts`) follows the proof of concept's rules:
  - The phases: Lamp from 6:30 pm, the long night from 8, Shutter from 4:30 am, the white from 6.
  - One game minute per real second.
  - It stops while people talk or the screen changes.
  - It starts at 7:20 pm, as the story does.
- **The light follows it.** The engine got `mixMood` and `moodAt` (a day as
  keyframes) and `Lights.set`, so a scene can be re-lit live. The Span's
  keyframes (`SKY` in `regions/span/moods.ts`):
  - Lamp, then the long night, then Shutter (a new gray mood);
  - then morning, the white, the afternoon, and back to Lamp.

  Sprites take the tint of the moment. Rooms keep their own lamps.
- **Two moments change the town itself.** At Lamp the lanterns are lit, and at
  6 am they're out, with doors and windows to match. The region is rebuilt in
  the other state behind a dissolve, with a tag: "Lamp: the first lanterns are
  lit" or "The white: shutters down". If you're indoors, nothing shows, and the
  town is rebuilt when you step out.
- **URL controls:** `?clock=HH:MM` starts the clock elsewhere.
  `?time=lamp|night|shutter|white|day` holds one light still (screenshots,
  playtests).
- **What daylight costs** was held for the owner here; piece 7 builds it.
- **People out by day** was open here; in piece 7 they go in at Shutter, as the
  methodology's §5.3 proposed ("shutters down, nobody out").
- **Fixed on the way:** collision in a room you've visited before read the
  wrong collision data, so you could walk through its furniture. Rooms now
  keep their own.

## Piece 4 (done): the Span at the owner's scale

The owner judged the first Span too small (2026-10-26). Their scale: a large
map is the size the whole first region was (132 × 96), a medium is half to two
thirds of that, the town is twice a large map, and the dry lake is a full
large map, reached down a long road map stood on end. The look is South Texas:
brush and bramble, harsh grey-green, no lush trees outdoors, and a village
pieced together from ruins. `docs/design/regions/span.md` has the whole layout.

- **Region engine v2** (`src/engine/region.ts`):
  - **Layout:** maps of any size at any place, joined where a road runs
    through a gap in the brush (an exit whose target is another map in the
    region is a seam: no trigger, no cut).
  - **Between maps:** a tileable brush apron fills the gaps.
  - **Streaming:** maps are built within 26 units and dropped past 44. Builds
    are paced over frames, and the section kit puts its own ground and solids
    back after every pause.
  - **What streams with a map:** people, animals, lamps, swaying plants and
    fading props.
  - **For checks:** `hold` plus `buildAll` builds everything at once (the
    door checks, the overview). `settle` and `prepare` make sure a spawn's map
    exists before you land in it.
- **Batching** (`src/engine/batch.ts`): static scenery marked `batch()` is
  merged per material when a map finishes. Thousands of brush clumps draw in a
  handful of calls.
- **Section kit:**
  - edge style `brush` (walls of bramble);
  - a region's own `flora` for the edges;
  - `seam` exits;
  - paced builds.
- **The Span's kits:**
  - `brush.ts`: mesquite, huisache, cenizo, thicket, yucca, tasajillo, dead
    mesquite, and scatter.
  - `ruins.ts`: patched houses, container homes, salvage fences, yard tanks,
    fire rings, rubble, ruin walls.
  - `fill.ts`: brush mottes and open-ground scatter.
  - Dry asphalt paint, no weeds.
- **Six maps:**
  - the Ramp (medium);
  - Mar Farm, the Plaza, the Colonia (large);
  - the Lake Road (large, on end);
  - the White Bowl (large).

  The East Road map is gone. Its fork, culverts, billboard and Memo are now on
  the Lake Road.
- **Measured headless:**
  - A large map builds in about 2.5 s unpaced, and about 10 s paced (wall
    clock at one or two software-rendered frames a second).
  - Memory peaked at 550 MB walking every map.
  - Real-device hitches still need measuring on a phone.

## Piece 5 (done): Seven Flags, from the owner's map of the town

The owner sent their own top-down map of the town ("SEVEN FLAGS: the
playable town", 192 × 160, built from the real streets of north Laredo) and
asked for the Span to follow it: less linear, more like the real place. The
town is now one map (`src/regions/span/seven-flags.ts`), with the owner's
layout, story places and people. Mar Farm, the Plaza and the Colonia maps are
gone; their contents are in the town. The Ramp now carries the Thirty-Five
north at grade, and the Lake Road joins at Memo's barricade on Del Mar.
`docs/design/regions/span.md` has the details.

- **Engine:**
  - **Ground in tiles:** a map's ground is painted in tiles of at most 64
    units (1024 px textures), so big maps stay within what phones hold. Big
    maps also use half the ground-mesh density.
  - **Turned buildings:** a building can turn to sit square to its street
    (`rot`); door marks and collision follow (`onBuilding`, `footprint`).
  - **Grid:** grid rectangles take fractional corners.
- **Streets on their true lines:** the town paints its streets from their
  centre lines, so diagonals have clean edges. A per-cell list of nearby
  streets keeps the cost down.
- **Checks:** the playtests cover every map's position, walking out of town
  onto the Lake Road, Mar Farm's wall, the chapel in and out, Lupe, the
  unbuilt east road, and the clock. They pass at 1080p.

## Piece 6 (done): the story, as the first version told it

The owner asked (2026-10-27) to build the game out the way the first version
did it, cinematic and all, with a mini map, and pointed out that Papá is dead
by the time the game starts. `docs/design/legacy-breakdown.md` breaks the
first version down beat by beat and rule by rule; this piece ports all of it.

- **Papá** is no longer standing in the lot. He's on the burial platform, and
  he appears only in the old tale.
- **The mini map** (`engine/minimap.ts`) sits top right, north up. M or a tap
  switches between close (about two screens) and far (most of the region).
  - It paints every map's ground with that map's own painter, so streets
    run on their true lines.
  - Buildings and walls are drawn in as each map is built.
  - It shows people, lit doors, Juno's facing and the goal; the goal is
    pinned to the edge when it's out of range.
  - Inside a room it shows where you went in, dimmed.
- **The story runtime** (`src/game/`):
  - `script.ts` runs the first version's `dialogue.json` as written: lines,
    conditions, commands and choices.
  - `hud.ts` holds the status panel (clock, ten drops, tins of white), the
    objective and its marker, toasts, the staybook, and the title, pause
    and end menus.
  - `tale.ts` is the tale's painted panels, ported drawing for drawing.
  - `battle.ts` is the fight, rule for rule.
  - `sound.ts` has every synthesized effect and voice, plus the three
    tracks.
  - `state.ts` is the save (`longnoon.save`, v 1).
- **The mission, "Lamp", on Seven Flags:**
  - title, then the tale by a fire in Mar Farm's lot, then "Many years
    later";
  - the burial (Lupe, the staybook, page 1);
  - the goats and the tank (milk, water, page 3);
  - Chayo at the Plaza (white, page 2);
  - Kit by the flags (Pancha got out);
  - the drain (the Stray and the coyote, page 5, the fight; Kit joins and
    Pancha follows);
  - home before Shutter: the doors seal, the drone crosses the white sky,
    the last page, the end card (since piece 7: a quiet ending; the drone waits for day five);
  - free roam.
- **The first version's rules:**
  - daylight away from a roof costs a drop of water every 3.5 s;
  - at none you faint and wake at Mar Farm the next Lamp;
  - thirst takes a drop every 150 s;
  - a Shutter warning;
  - rest and save at the cot inside Mar Farm;
  - saves at every new step.
- **Playtests:** `tests/story.spec.js` plays the title and tale, the home
  chores, the drain fight and the ending. `?step=<step>` starts at a mission
  step with what the steps before it would have given.

## Piece 7 (done): the timed night, what daylight costs, and edges that hold

The owner, 2026-10-28: *"a timed night run, 5–10 min in real time, and if you stay out it costs water then
health and also might produce certain condition effects until you sleep"*; *"shadows should be dynamic"*; *"during
the day, most NPCs go back in before the sun rises"*; *"color theming night vs day is important"*; and every reachable
edge is *"a physical barrier, or a person who talks to you and turns you back."*

- **A night is timed** (`game/clock.ts`): Lamp (6:30 pm) to Shutter (4:30 am) takes 8 minutes of play
  (`NIGHT_MINUTES`); the clock stops while people talk. Sleeping at the cot ("Sleep until Lamp?") skips to the next
  Lamp and saves.
- **What the white costs** (`game/sun.ts`, every number a first guess to tune):
  - out from under a roof by day, a drop of water every 3.5 s;
  - with no water left, 3 health every 3.5 s; at none, Juno faints and wakes at Mar Farm at Lamp with 3 water,
    half her health and a tin of white fewer;
  - **conditions**, until she sleeps: *Sunburned* after 20 s of sun (a quarter less health), *Noonblind* after 45 s
    (the screen's edges swim white; a quarter of her blows miss), *Heat-sick* when her water runs out (no running;
    slower walking and fighting);
  - **shade halves all of it.** Shade is read straight from the sun's shadow map just above Juno's head
    (`engine/shade.ts`), so it's exactly the shadow on screen: sails, stalls, walls, trees, people.
  - The thirst drain (a drop every 150 s at any hour) is gone: the Complete Story File says water is spent only
    in daylight and to heal.
- **The sun and the moon cross the sky** (`SKY` in `regions/span/moods.ts`): by day the sun comes up in the east, is
  overhead at noon and goes down in the west, so shade moves through the day and noon has least of it. By night the
  moon does the same.
- **People go in at Shutter:** each walks to the nearest door and goes inside. By day nobody is out and the
  animals are under cover, except lookouts (`allDay`).
- **The panels take the hour:** blue glass by night, warm at Lamp, gray at Shutter, bleached by day.
- **The HUD** adds Juno's health under the drops, and her conditions under that.
- **Edges hold** (rule 3 in CLAUDE.md):
  - **Barriers:** concrete barriers and wrecked cars close the road south out of town and the boulevard east past
    the Lake Road. A line of barriers is now solid end to end (it had gaps a person could slip through).
  - **A lookout:** Chuy holds the Thirty-Five north on the Ramp, day and night. Step onto his line and he talks, then
    Juno walks back (NPC `guard`). The road north is where the caravan leaves, later.
  - **The check:** `__LN.edgeIssues()` walks out from Juno over every map and lists anywhere she can reach past a
    map's edge or onto a road to a map not built. It's empty, and the playtests assert it.
- **Night one ends quietly** (the Complete Story File's night one):
  - Memo's bell rings far off, Kit says what Shutter is and runs home with Pancha;
  - inside, Juno sits by Papá's chair while the light under the door turns white;
  - she sleeps, and the card reads *Night one: Given to the Sun*.
- **The drone comes down on day five** (the owner, 2026-10-28: *"it's what changes the dynamic the first 5 nights
  have established"*). The flyover is kept whole for the end of night five (`droneDay` in `main.ts`, `#drone` to
  see it now). The story file had it at the end of night three, with NIM found on night four.
  - The prologue is now **seven nights** (the owner, 2026-10-28): the White Bowl is night six, the Choice night
    seven. `docs/design/prologue.md` has the plan; nights four and five, and the end of night three's search for
    Güero, are open for the owner.
- On screen the town is **Seven Flags**: the objective reads *Seven Flags · Night one*.
- **Saves are v2** (rule 8): `conds` and `sunTime`; a v1 save loads clean of both.
- **Checks:**
  - Playtests: the edge check, the barriers east, and Chuy turning Juno back.
  - Driven by hand in the browser:
    - the shade map against the stalls and the palm at 10 am and noon;
    - the conditions coming on in turn;
    - fainting and waking at Lamp;
    - the town empty by day.

## Piece 8 (done): north-east to the church, south-west to the mall

The owner, 2026-10-28: *"more exploration areas … north east could lead to a separate area through a transition
space that leads to an old church in the shape of Laredo Church of the Crossroads, there's still people there helping
others and preaching the gospel (low-key, not too heavy-handed) … south west could lead to an abandoned mall area the
shape of Mall del Norte."* The owner sent a map and a photo of the church.

- **The Trail North** (`regions/span/trail.ts`, medium 88×72, road leg): the Old Trail goes on out of town as a
  footpath. It crosses the dry creek on a plank footbridge (hero), passes a windmill filling a stock tank someone
  keeps clean (routine), and has lanterns lit every night along it (signature: they promise the hill).
- **The Open Door** (`church.ts`, large 120×96), laid out from the owner's map and photo:
  - a tall mission front facing the old boulevard, its gable carrying an arched belfry and a cross (hero);
  - the long low wing to the east, its arched windows lit all night where people sleep (signature);
  - the parking lot between building and road, live palms by the door with green under them, and the big tree
    at the end of the wing, dead, a sail tied off it;
  - a water table under shade sails (routine) with Doña Marta and Benny, and a traveler from the river side;
  - the door is lantern-lit and never shuts. Inside (`churchHall`, rooms.ts): chairs facing a plain cross, cots
    along the walls, bread on the long table, and Pastor Abel. A plaque inside the door, out of the sun, keeps most
    of the old name: *…CH OF THE CROSSROADS* (the Old Name).
  - The writing keeps the faith plain and light: they fed whoever came, and they knew who they did it for.
- **The Mall** (`mall.ts`, large 132×96), on the real mall's lines:
  - one long concourse with a big store at each end, the north-east wing to two two-storey stores, the cinema
    (its marquee is the hero), all ringed by a road and parking;
  - a roof ventilator spinning (routine); the pylon sign face down by the access road, its underside keeping
    *MALL DEL NORTE* (signature, the Old Name);
  - a Stray works the lot (machines are out by day too);
  - the centre court's broken doors have a scavenger's lantern hung at them. Inside (`mallCourt`): the dry
    fountain, grilles down on every shop but one, sand blown in under the broken skylight, the scavenger's camp.
- **Getting there:** the town's east edge opens where the Old Trail runs out; its south edge opens at the side
  street west of the boulevard. The church's boulevard and the mall's ring road run into brush, closed with wrecks.
  Since piece 10 both are places of their own, reached by a transition, not by a seam.
- **New people** (`tools/gen-cast.mjs`, the locked look): Pastor Abel, Doña Marta, Benny, the traveler, the scavenger.
- **Open:**
  - **The church's name on screen** is *the Open Door*. The real name shows only on the plaque, an Old Name hint,
    per CLAUDE.md rule 5. If the owner wants *the Crossroads* as its name, that's a change to that rule.
  - **The camera shows only about six units north of Juno** at ground level, so tall fronts facing the camera are
    cropped at the top unless she stands right under them. The church front was scaled to the town's tallest (the
    water tower). Lowering the camera or framing Juno lower on screen is the owner's call.
  - **The real roads are compressed** (method §3): the mall is reached without crossing the Thirty-Five.

## Piece 9 (done): side stories that lead out to the new places, and ones found there

The owner, 2026-10-28: *"quests in that area that either lead us to that area, and then quests that we discover in
that area."* Four side stories, each run on flags (`data/stories.json`), with no new systems: the trades are in
water and tins of white, the rewards are pages in the staybook in Juno's own hand.

| Story | Starts | Goes | Ends |
|---|---|---|---|
| **Mesquite Flour** (leads out) | Doña Chayo, in town, gives Juno a sack and says nothing more | up the Old Trail to Doña Marta at the church | back to Chayo: tell her Marta said thank you, or keep it to yourself (two pages) |
| **Gray** (leads out) | Rubén gives Juno a jug for the brother he hasn't seen in three months | south-west to the mall: the scavenger is Neto, who sold chalk-cut white | back to Rubén: tell him where Neto sleeps, or keep Neto's secret (two pages) |
| **The Bell** (found there) | Benny at the church: the belfry arch has been empty since before he was born | the mall: the scavenger sells it for two tins of white | Benny hangs it. It shows in the arch from then on, and rings at Lamp when Juno is on the hill or the trail |
| **Open for Business** (found there) | the scavenger, or the one grille that's up a hand's width | under the grille: a toy store with the lights still on and every toy in a perfect row, and its Keeper still saying welcome (`mallShop`, rooms.ts) | take the stuffed cloud it holds out, or put it back (two pages) |

- **How they show:** a toast ("New story: …"), then a smaller line under the night's objective. The marker points at
  the followed story's person or place when the night's mission has none.
- **What was added to make them run:** script commands `story`, `buy` (white for an item, which fails without
  enough), `run`, `go` and `bell`; Juno's pages in the staybook; the bell mesh in the belfry; the toy store room.
  The stories start once night one's mission is done (`free`), the only post-mission state there is so far. The
  story file opens them from night two.
- **Checked:** `tests/story.spec.js` plays all four stories end to end at 1080p and on a phone in landscape. Door
  promises and `edgeIssues` are clean with the new room.
- **Fixed in passing:** the mall court's shop fronts sat inside the back wall's cell and couldn't be seen. They
  stand in front of it now.
- **Open:**
  - The bell hangs high on the church front, above what the camera shows at ground level (piece 8's framing
    question). You hear it at Lamp more than you see it.
  - Which night each story opens on, once nights two to five are built.

## Piece 10 (done): the hill and the mall are places of their own

The owner, 2026-10-29: *"I'd like it if the new additions were actually extensions, so you would have to transition
to them. So either through a tunnel that allows us to load it, or like a narrow road, or we just transition."*

- **Three outdoor regions** now (`regions/span/region.ts` `REGIONS`). Each is built on its own, with a dissolve
  between them, the way a room is:
  - **the town** (`span`): the Ramp, Seven Flags, the Lake Road and the White Bowl, still walked between with no cut;
  - **the hill** (`hill`): the Trail North and the Open Door;
  - **the mall** (`mallside`): the mall and its lot.
- **One coordinate frame for all three.** The maps keep their places (`PLACE`), so a point says which region it's in
  (`regionAt`). A story marker for a place in another region points at the way there (`GATES`). A save made at
  the church before this change still loads at the church.
- **The ways through:**
  - **To the mall, a tunnel.** The side street runs south under the old rail embankment: a concrete box with
    rails and ties across the top (`underpass`, kit.ts). Its dark is a wall, and walking in loads the mall. The
    embankment thins as Juno walks under it, so she can be seen going in. On the mall side the same underpass
    opens toward the camera, with a lantern hung at its mouth.
  - **To the hill, a narrow road.** The Old Trail narrows to a gate of two posts and a crossbar with a lantern on
    it (`trailGate`), at both ends.
- **One outdoor region is built at a time.** Crossing to another lets go of the one behind (and its rooms). The
  rooms at the church and the mall let you back out into their own region.
- **Checks:**
  - `checkAllRooms` visits each region in turn;
  - `edgeIssues` counts a way into another region as closed, and is clean in all three;
  - a new playtest walks through the underpass and the trail gate and back;
  - the side-story playtest crosses between the regions.

## Piece 11 (done): the whole prologue, seven nights, and a checker that proves it can be done

The owner, 2026-10-29: *"make sure that the logic exists now. Have a few extra story pieces for nights 4 and 5 …
make sure that those paths exist, that the conversation and dialogue exist. Make sure that the progression is
possible … for every part of the prologue."* Before this, only night one was built; after it the game fell into
free roam.

- **Nights as data** (`data/quests.json`). Each night has a first step, a wake script, and an hour to wake at
  (night seven: noon). Each step has:
  - an objective and a marker (a person, a thing, a place, or chosen by condition);
  - optionally `tasks` done in any order, then `then`;
  - `arrive` (reaching a map or room), `faint` (what the white means at that step), `exit` (a road the step turns
    into a script);
  - `via`: how the step is done, which is what the checker walks.
- **A night ends when Juno sleeps on her cot** (the cot's scripts call `nightEnd`): the night's card, then the next
  night at Lamp in Mar Farm. Night five's dawn is the drone's day. Night seven ends up the Thirty-Five, with the
  prologue's card.
- **What the nights needed:**
  - **People and things for one beat:** NPC, Thing and Trigger `when`, Guard `unless`, prop `userData.when`.
  - **Conditions:** `|` (or), `night:N`, `has:item`, `white:N`.
  - **Script commands:** `nightEnd`, `clock`, `fight`, `strays`, `noonBell`, `prologueEnd`.
  - **Fights:** they can happen where the story starts them. The feral dogs in the Big Store (three of them, the
    overworld camera indoors) and the Warden in the White Bowl. Both are in `battles.json`.
  - **Followers:** Kit can be talked to while he follows; Güero follows Juno home on night three.
  - **Wraps** slow the white (×0.7), the small rule the owner should confirm (prologue.md).
- **New places:**
  - Doña Inés's cellar under a hatch behind the Plaza (blue lantern; it goes dark if Güero is lost).
  - The Big Store's loading dock and its inside.
  - A ladder up Mar Farm's west wall to the roof.
  - Papá's shoes and workbench inside Mar Farm.
  - In the White Bowl: the drone's wreck (there only after day five) and the inside of it, plus the old plane.
  - On the Ramp: a second fallen sign (the sled; WELCOME TO LAREDO underneath, an Old Name hint).
  - The elders at the Chapel's table; the Noonriders at the barricade; Güero in the Lake Road culvert by day;
    Nina in Abby's yard; the town at the Plaza meeting.
- **New people** (`tools/gen-cast.mjs`, the locked look): Doña Inés, Güero, a feral dog, the Warden.
- **The checker:**
  - **On paper** (`game/progress.ts`, no screen): conditions, and the scripts run for their effect on the state.
    `walk` follows the steps down a branch. `lint` checks every script: its commands, its targets (scripts,
    pages, stories, steps, places, fights, items), and that every flag a condition reads is set somewhere.
  - **In the game** (`__LN.prologueCheck()`): builds every region and room and floods where Juno can walk. Then it
    walks the three branches of night three and asks, at every step, whether the person, thing, spot or road is
    there at that point (by day, only people who stay out) and reachable on foot. It also checks doors and their
    way back, markers, and night three's daylight against water and health. `?step=` catches up with the same
    walk.
  - The result, step by step: `docs/design/prologue-walk.md`. It was tested by breaking three things on purpose;
    it caught all three.
- **Tests:**
  - the checker, asserted empty;
  - night one's end into night two;
  - night two's cot into night three's Strays;
  - the dogs' fight opening indoors;
  - the white taking Juno on the search (Güero lost, night four begins);
  - leaving past Chuy (the prologue's card).
- **CI:** the 1080p tests split into two jobs.
- **Open:** prologue.md, "Open for the owner".

## Piece 12 (done): the Span as hub and spokes

The owner, 2026-10-29: *"regions that have main hubs and have connections, but you load into separate maps in the
region … try to make our current region and maps like that."*

- **The places:**
  - Seven Flags is the hub.
  - The Ramp, the Lake Road, the White Bowl, the Trail North, the church and the mall are each a place of their own
    (`REGIONS`, region.ts).
  - They're joined at their roads (`LINKS`): north up the highway, east down the boulevard, the trail gate, the
    underpass, the Lake Road down to the White Bowl, and the trail up to the church.
- **Each crossing** runs on past the map's edge (piece 13). The trail gate and the underpass keep their own
  dressing.
- **Spawns at the highway crossing** are off the median, which is solid.
- **Markers** for somewhere else point at the way there, through the hub (`gateTo`).
- **Arriving on a map** fires its step on a crossing too (the White Bowl, night six).
- **Checks:**
  - the prologue checker is clean in every place;
  - night three's daylight walk is measured across the hub's edge: 59 s against 120 s;
  - the edge check runs in every place;
  - tests that walked across a seam now walk through a transition.
- **Measured** (scaling.md): the most a frame costs anywhere is now one map's own (town 680 calls; Lake Road
  4.1 M triangles), down from two maps at a seam (6.2–7.7 M triangles). Memory returns to where it was after every
  round trip.

## Piece 13 (done): the world runs on past the crossings

The owner, 2026-10-30: *"if you look past the space, it's like a white line … it should still continue a little bit
past what you can see. To not remove the immersion."*

- **What was wrong.** Past a crossing, the road ran 22 units on as a flat strip and faded to a flat colour: navy by
  night, a pale cream by day, which read as a white band at the top of the frame. Along the other edges, the region's
  land beyond sat lower than the map's rim, with nothing under the rim, so a thin line of sky showed through.
- **Run-outs** (region.ts, section.ts). Past every exit, the map's own ground goes on, 16 units either side of the road
  and 24 out, laid on the region's 4-unit grid:
  - its glyphs and heights carried straight out from the edge, so the road keeps its paint and level and the banks
    keep theirs;
  - painted 16 px a unit by the map's own painter (`buildPatch`, terrain.ts);
  - the land off the road rolls a little more the farther out it goes;
  - the edge's own growth goes on along both sides: thicket for brush, trees for a tree line, rock under a bluff,
    thickest by the road (`runOutFlora`).
- **No more fade.** The camera stops 4.4 inside an edge and sees about 9 past it, so the run-out reaches well past
  anything in frame. Walking into it is still the transition.
- **Skirts.** Every map and run-out hangs a bank of earth from its rim, so no sky shows where the land beside it is
  lower.
- **The region's land beyond** now runs 16 units out from every map, not 8.
- **Props that run with the road:** the highway's barriers and retaining walls go on past the town–Ramp crossing on
  both sides.
- **Cost:** 0.1–0.4 M more triangles a place, almost no more draw calls. The brush stops where the camera stops
  seeing: 14 units past a north edge, 10 past a side one, 5 past a south one. Past that the run-out is bare ground.
- **Heights past any edge** now carry on from the edge. Before, the brush drawn just outside a map stood on the
  edge's slope continued, up to about a unit too high.

## Where this departs from the spec, on purpose

| Spec says | The Long Noon does | Why |
|---|---|---|
| One fixed mood per scene, no clock (§5); the key light over the viewer's left shoulder | A clock moves the light through Lamp, the long night, Shutter and the white. The town is built twice (lanterns lit, lanterns out). By day the sun, and by night the moon, cross the sky east to west. | Settled by `docs/design/world-methodology.md` §5.3: night is the living time and daylight is its own state of the same map. The owner asked for a timed night and moving shadows (2026-10-28), over the Complete Story File's "no running clock". |
| Prairie ground, lush green as the norm | Desert ground (caliche, sand, old asphalt); green only where water has been | The Span is a desert. The spec's mood line still holds: bleak, with bright life where it's tended. |
| 64px, 8-direction PixelLab sprites (§13), every figure styled on the protagonist | 64px PixelLab figures in the spec's style, styled on Juno (`docs/design/cast.md`). The game plays four directions; animations are made in four (the owner, 2026-10-27). | Juno is the anchor in place of the spec's style character, so the cast is The Long Noon's own; the owner locked the look on 2026-10-27. Anyone not remade yet still uses the old 16×24 sprites. |
| Fixed-angle outdoor maps (no occlusion rule) | Overhead props fade when the player is behind them | Shade sails and the tank would otherwise hide Juno. |
| Every exit lands on its target (§9.4, §20 #12) | Roads to maps not built yet are closed by a barrier or held by a person who turns Juno back | The roads out of the Span lead to regions not built yet (the owner, 2026-10-28). The old turn-back note stays only as a safety net. |
| One map per scene, exits between maps (§9) | **Back in line since 2026-10-29:** each map is its own place, loaded through a transition at its edge (the road runs on out of sight, then the dissolve), around a hub. The region (one coordinate frame, the caravan legs between regions) stays. | The owner chose hub and spokes inside each region (methodology §2.4, scaling.md). |
| Section sizes 40×30 to 58×28 (§9.2) | Large maps are 132×96; the town is two of them | The owner's scale (2026-10-26): the first Span's maps felt too small. |
| Edge trees: cottonwood, mesquite, dead tree (§9.3) | Walls of bramble with mesquite standing out of them; no lush trees outdoors | South Texas brush country (owner, 2026-10-26). |
| A battle stage of its own (§14) | The fight happens where it starts, in the drain, framed by one of six stagings (`STAGINGS` in `main.ts`, `?battle=` or `#fight-<name>`): in place, diorama, over the shoulder, hero shot, face-off, diorama with cuts. **Default: directed** (the owner, 2026-10-27): one formation; the camera opens over the shoulder, floats between the shoulder, the diorama and the face-off every five seconds, swings to the hero shot for an enemy's turn, and cuts in over the shoulder on the party's blows. | The owner asked to try orientations, then asked for this mix. The rules stay the first version's; only the framing changes. |
| The camera never rotates (§3) | In the ending, the camera tilts up to the sky while the drone crosses | It's a cutscene, as in the first version: "Look up." Play never tilts. |
| (no mini map in the spec) | A mini map, top right | Asked for by the owner, 2026-10-27. |
| Rest at the door (first version) | Rest at the cot inside Mar Farm | The rebuild's Mar Farm has a room behind the door; the door now goes in. |
| No old-world names (§1) | Built on the real Laredo and I-35. Places carry survivors' names; real names appear only as Old Name hints where the sun never reached | Settled by the methodology §0 and §3. **Open:** MAR on the store roof is painted, but paint doesn't survive the sun (§3.3). Proposal: rebuild it as steel letters with the rest of the name fallen away. |

## The world methodology (2026-10-26)

`docs/design/world-methodology.md` is the owner's layout method for regions, maps and roads. It sits above the style
spec: the spec says how a map looks, and the methodology says what maps exist and how they connect. Where they
disagree, the methodology wins for The Long Noon. Open questions for the owner are in its §11. The one that shapes
the engine most is the world model (§2.4): option C, open streamed regions joined by caravan legs, means building a
region as many sections streamed side by side. The ported engine already has the hooks for that (`world.ts`
chunks, `terrain.ts` `setAprons`). The owner chose C on 2026-10-26; the Span (piece 2) is built that way.

## Next pieces (proposed order)

1. **The owner plays the first mission** on a phone and says what's off:
   pacing, the drain, the ending, the sound levels.
2. **Tune the night and the white** on a phone: the night's length, the drain, the conditions.
3. **The newer story** (the Complete Story File) and the people with no lines
   yet: Lourdes, Inés, Rafa, Goyo, Güero, Mari, Chuy, Don Pepe.
4. **Out of the Span:** the first caravan leg up the Thirty-Five, or the east
   road to the White Bowl, where the drone went.
5. **Sprites:** done for everyone with lines, the animals and the first
   enemies (`docs/design/cast.md`), with portraits for the fifteen speakers.
   Left: the people on the owner's map with no sprite yet, and the fights for
   the Keeper, hauler, crawler and Noonrider (they have idles and walks, but
   no fight moves until the owner decides which of them fight).
6. **Saves:** export and import.
