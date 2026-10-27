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
  - **People:** a breathing idle (PixelLab's `breathing-idle`, 5 fps).
    Juno and Kit also get a walk (`walking-8-frames`, 11 fps), because they
    move.
  - **Animals and the Stray:** an idle and a walk each.
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

**Not made yet:** the people on the owner's map with no sprite or lines
(Lourdes, Inés, Rafa, Goyo, Güero, Mari, Chuy, Don Pepe). They wait for the
newer story.
