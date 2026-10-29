# The Prologue: Seven Flags, seven nights

The owner's shape for the prologue (2026-10-28). It follows the Complete Story File's prologue (five nights) with
one change: **the drone comes down on day five**, after five nights have made the town's routine ordinary
(*"it's what changes the dynamic the first 5 nights have established"*). So the prologue runs seven nights, and the
White Bowl and the Choice come after the fall.

How a night works is in `docs/architecture/current-state.md`, piece 7: the night is timed, daylight costs water
then health, people go in at Shutter, and a night ends when Juno sleeps.

| Night | Name | What happens | Status |
|---|---|---|---|
| 1 | Given to the Sun | The tale by the fire, the burial, the goats and the tank, Chayo, Kit and the drain, the walk home, Papá's chair | **Built** |
| 2 | Her Father's Share | Kit at the door (Daysleep). The elders' table at the Chapel (shares). Papá's share, in any order: the water shift with Doña Fina (one jug down the Cellars to Doña Inés, one to Toña), wraps from Rubén's stall (credit if Juno has no white), Fina's salve on Kit's hand. Papá's route through the Big Store: feral dogs, his chalk (E.H.), two shelves left. Memo: riders on the Thirty-Five. Juno's first page in her own hand. The side stories open. | **Built** |
| 3 | The Signs | The Strays roll east down Del Mar in a line. The Noonriders' tithe at the barricade (a rider asks Juno's name). Near dawn Inés pounds on the hatch: Güero followed the machines east. In the white, find him crouched in the Lake Road culvert and get him home to the Cellars. If the white takes her first, Güero is lost. | **Built** |
| 4 | Tracks East (**new**) | The mower in Abby's yard stopped at Shutter, facing east (Nina). Doña Inés: thanks and half a tin of white if Güero came home; sitting on her steps if not, and Juno can light her lantern. Toña asks for Papá's shoes for her shrine, so he walks easy. Memo at the barricade: hundreds of tracks, every machine heading for the White Bowl. | **Built** |
| 5 | Two Shelves Left (**new**) | Juno and Kit clear Papá's last two shelves in the Big Store: his tool roll and a coil of mirror wire (she chalks J.M. under E.H.). Don Beto at the night market: before things change, the dogs leave. On Mar Farm's roof with Kit: lights at the lake, "I'd clap back." Then **the drone's day**: Kit wakes her in the white, it goes over toward the lake. | **Built** |
| 6 | The White Bowl | Memo has sealed the east road and looks the other way. Down the Lake Road to the dry lake: scavengers prying at the wreck, two Noonrider scouts on the dam, the old plane buried to its wings. Inside the wreck: dead drones, screens, a picture of clouds, the cradle. NIM wakes ("Can you tell me what day it is?"). The Warden climbs over the dam: the boss fight. If Güero was lost, one small footprint in the mud. | **Built** |
| 7 | The Choice | Memo's bell at noon; machines circle Mar Farm until Lamp. The meeting under the seven flags (trade it, break it, or say nothing; Lupe; NIM speaks to the town). On the roof: Station Nine, and "Maybe in yours". The shielded pack at Papá's workbench (his tools, the wire, the cell from the drain, scrap). Goodbyes (Lupe gives his mirror-cloth wraps; Toña, Inés, Nina, Chayo, Beto, Memo, Fina answer what Juno did). The sign by the Ramp flipped into a sled: WELCOME TO LAREDO, "What's a Laredo?" Up the Thirty-Five past Chuy at Lamp. | **Built** |

**Every step of all seven nights is checked** (`docs/design/prologue-walk.md`): the person or thing each step needs is
there at that point in the story and reachable on foot; the scripts exist and hand on to the next step; the three
branches of night three (found, lost, fainting on the way home) all reach the end.

## Open for the owner

- **Nights four and five** are new writing (the owner asked for "a few extra story pieces"). They lead into the
  drone's fall: the machines all heading east, Papá's last shelves (the parts the shielded pack needs on night
  seven), and Toña's shoes (a goodbye on night seven). Change anything.
- **Night three's search** no longer ends with the drone (it falls on day five). If Juno finds Güero, he tells her
  the machines are all at the lake, waiting; the reunion is in the Cellars. If the white takes her, he's lost.
- **Built simpler than the story file asks, for now:**
  - **The Signal** isn't a mechanic: the Warden is a normal fight.
  - **NIM's face** is text: she has no screen portrait yet.
  - **Buying and equipping** are one dialogue choice. Wraps slow the white (×0.7) while Juno has them, which is a
    small rule the owner should confirm.
  - **The caravan** is a dialogue beat.
  - **The Words page** isn't built.
  - **Rafa** has no sprite, so he's mentioned rather than met.
- **The side stories** open on night two, as the story file has it. Mesquite Flour and Gray lead out to the church
  and the mall; The Bell and Open for Business are found there. The story file's own three (La Llorona, Applause,
  the Lawnkeeper) are mentioned (Beto, Kit, the stopped mower) but not built as stories.
