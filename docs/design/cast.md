# The cast, from PixelLab

**Started 2026-10-27.** The first version's 16 × 24 sprites are replaced by
figures made on PixelLab in the spec's locked style (`docs/style/world-style-spec.md`
§13): 64 px, low top-down, lineless, chunky, saturated.

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
  - **Animations come in three directions only** (the owner, 2026-10-27):
    front, side and back. The other side is the side mirrored.
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
