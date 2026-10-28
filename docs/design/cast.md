# The cast, from PixelLab

**Started 2026-10-27.** The first version's 16 × 24 sprites are replaced by
figures made on PixelLab in the spec's locked style (`docs/style/world-style-spec.md`
§13): 64 px, low top-down, lineless, chunky, saturated.

## The look (locked by the owner, 2026-10-27)

The owner saw the first thirteen (`docs/design/cast-preview.png`) and said:
**"great style, make sure to capture that."** Every character from here on is
made the same way, and nothing below changes without the owner.

- **The anchor:** Juno, PixelLab character `d8dd94ff-62b8-482f-a3ce-31e888d3ceb1`.
  - Every new figure passes her as `style_character_id`.
  - She herself was styled on the spec's style character
    (`cea31c61-3b70-4ec6-a617-413b60f80ece`).
  - Never remake Juno without the owner. Remaking her changes the anchor
    for everyone made after her.
- **The request:** `v2/create-character-pro`, `method: create_with_style`,
  `view: low top-down`, a 64 × 64 canvas, no background, `template_id:
  mannequin` for people (`dog` for four-legged animals).
- **The style line**, verbatim (`tools/cast.json` `style`): *modern indie
  action-adventure pixel art: chunky stylized proportions, big bold readable
  silhouette, saturated colours, lineless with strong graphic light and shadow
  shapes, expressive and punchy*.
- **The world line** for people, verbatim (`tools/cast.json` `person`): *a
  person of a small South Texas border town generations after the sky turned
  white, sun-faded patched clothes, dust on the boots*.
- **How a person is described:** name and role, age, hair, then each layer of
  clothing with its colour, then what they carry, then the face.
  - Each person keeps one strong colour and one shape you can read from
    across the plaza (Beto's sombrero, Chayo's red hair and apron, Kit's
    goggles).
  - Example (Chayo): *Doña Chayo, a stout middle-aged market trader: red hair
    tied back, teal dress with a white apron, bangles, warm bossy face.*
- **What it looks like:** chunky, lineless, strong light and shadow; worn,
  patched, dusty clothes; real colour against the bleached town. Not chibi:
  heads stay in proportion.
- **In the game:** the figure is measured on its front-facing still, then
  scaled to each person's height (`HEIGHT` in `src/game/actors.ts`), so
  children read as children.

## How they're made

- **The anchor is Juno.** She was made first, styled on the spec's style
  character, and everyone after her is made with her as the style
  reference. That keeps the whole cast in one hand.
- **Who's who** lives in `tools/cast.json`, one description per figure.
  The descriptions follow the first version's sprites and dialogue (colours,
  hats, ages, what they carry). Change a line there and remake that figure
  with `--force`.
- **Directions:**
  - The still figure is made in all eight directions (PixelLab always makes
    eight).
  - **Animations come in four directions** (the owner, 2026-10-27): front,
    back and both sides.
- **Animations:**
  - **Everyone:** a breathing idle (PixelLab's `breathing-idle`, 5 fps).
  - **Juno and Kit** (the main characters, the owner 2026-10-27: *"our main
    characters definitely have to have that"*):
    - walk (`walking-8-frames`, 11 fps) and run (`running-8-frames`, 14
      fps; Shift or a full push of the stick);
    - a fight stance between turns (`fight-stance-idle-8-frames`);
    - taking a hit (`taking-punch`) and going down (`falling-back-death`,
      held until the fight ends);
    - Juno drinks water (`drinking`);
    - Kit throws with the sling (`throw-object`). PixelLab's person skeleton
      has no weapon swing, so Juno's pipe swing is drawn from a line of text
      (v3).
  - **Animals and the enemies:** an idle and a walk each (still to make).
  - A few idles came back missing one direction (Beto, Tavo, Memo, Toña);
    that side shows the still figure until it's remade.
  - The goat and the coyote use PixelLab's four-legged skeleton; the chicken
    and the Stray are animated from a line of text.
- **Portraits for the dialogue box** are made from each person's front
  sprite, using PixelLab's character-to-portrait conversion.

```
PIXELLAB_API_KEY=… NODE_USE_ENV_PROXY=1 node tools/gen-cast.mjs juno       # the anchor, alone
PIXELLAB_API_KEY=… NODE_USE_ENV_PROXY=1 node tools/gen-cast.mjs            # everyone not made yet
PIXELLAB_API_KEY=… NODE_USE_ENV_PROXY=1 node tools/gen-cast.mjs --anims    # their idles and walks
node tools/gen-cast.mjs --plan                                             # what it would make, roughly what it costs
```

- **The key** comes from the environment, never from a file in the repo.
- **`NODE_USE_ENV_PROXY=1`** lets Node's fetch use the cloud session's
  proxy.
- **The floor:** the script stops before the account would drop under
  1,000 generations (`PIXELLAB_FLOOR` changes it).
- **A run cut short** (a restart) leaves figures half-made on the account.
  The next run adopts them by their description instead of paying twice.
- **Where things go:** the raw PixelLab output and the request behind each
  figure (`prompt.json`, with its `character_id`) are kept in
  `assets/cast/<id>/`.

## The cast

| id | Who | Notes |
|---|---|---|
| juno | Juno, the hero | anchor; idle and walk |
| kit | Kit | idle and walk (he follows Juno) |
| lupe | Hermana Lupe | |
| chayo | Doña Chayo | |
| beto | Don Beto | |
| ruben | Rubén | |
| tavo | Tavo | |
| nacho | Abuelo Nacho | |
| fina | Doña Fina | |
| memo | Memo | |
| nina | Nina | |
| tona | Abuela Toña | |
| elias | Papá (Elías) | only in the old tale |
| rosa | Mamá (Rosa) | only in the old tale |
| kidjuno | little Juno | only in the old tale |
| stray | the Stray | the machine at the drain |
| coyote | a coyote | |
| goat | the goats, and Pancha | |
| chicken | the chickens | |

## Animals, with a little variety

The owner, 2026-10-27: *"a little bit of variation, so it's not all the same."*

- **Goats:**
  - white with brown patches;
  - black and white, with floppy ears;
  - tan with a dark stripe and a beard.
- **Pancha** is her own goat: young and white, with one brown ear, a patch
  over one eye, and a red collar with a bell. She's in the story, so she
  should stand out from the pen.
- **Chickens:** a brown hen, a white hen, and a speckled rooster.
- **Coyotes:** a lean tawny one, and an old scarred one with a torn ear.
- **In the game,** each animal takes one of its looks from where it stands
  (`variant` in `src/game/actors.ts`). A pen is mixed and stays the same
  each visit. Looks that aren't drawn yet fall back to the first.

## The first enemies (proposals: names and roles are for the owner)

There's no story file in the repo yet. These come from what is written down:
- Papá's tale: *"the machines kept going. They still walk the day, doing
  whatever they were told a hundred years ago."*
- The owner's Seven Flags key: *La Llorona, the Keeper* at the dry creek;
  the Lawnkeeper.
- The methodology's threads (§4.2), which it quotes from the Story File:
  Keepers, Noonriders, Halogen.
- The first version's dialogue: Memo's *"Big tracks out by the lake lately.
  Bigger than any Stray."*

| id | Working name | Where | What it is | From |
|---|---|---|---|---|
| stray | **the Stray** | the drains | Six wheels, one red eye. The first fight. | the first version |
| coyote, coyote2 | **coyote** | the brush, the drains | Follows the noise, follows the meal | the first version |
| keeper | **the Keeper ("La Llorona")** | the dry creek, the concrete pipe | A tall old cleaning machine. It sweeps the sand at the pipe's mouth at night, and its cracked speaker keens; the town calls it La Llorona. | Seven Flags key; Keepers thread; Beto's lines |
| sprinkler | **the crawler** | dead fields, yards | An old irrigation robot on four legs, still looking for crops to water. It spits hot dust. | the methodology's routine examples (§4.3) |
| hauler | **the hauler** | the Lake Road, the White Bowl | A cargo machine twice a Stray's size: treads, a forklift jaw, three red eyes, dragging chains. Its tracks are the big ones Memo has seen around the lake. | Memo's lines |
| noonrider | **a Noonrider** | the road north (the Ninety Miles) | A raider who rides the daylight for Halogen: a white cold-rig suit, a mirrored visor, a heat cape, a toll tag, a cattle prod | the Noonriders thread |

**Not decided:**
- which of these fight, and which are only routines to avoid;
- their stats and their weak parts. The first version's battle has the rules
  (soft parts, armor, breaking an eye) but numbers only for the Stray and the
  coyote;
- their real names, which the newer story may already have.

**Not made yet:** the people on the owner's map with no sprite or lines
(Lourdes, Inés, Rafa, Goyo, Güero, Mari, Chuy, Don Pepe). They wait for the
newer story.
