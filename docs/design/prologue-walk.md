# The prologue, walked step by step

Generated from the prologue checker (`__LN.prologueCheck()`, tests/story.spec.js "the prologue can be done") and
`src/game/data/quests.json`. The checker builds every map and room, works out where Juno can walk, and then walks
the whole prologue on paper down each branch (`src/game/progress.ts`). At every step it asks four things:

- whether the person, thing, spot or road the step needs is there at that point in the story (by day, only people who stay out);
- whether Juno can reach it on foot;
- whether the script it runs exists;
- whether the script hands on to the next step.

It also checks:

- every script's targets exist: other scripts, pages, stories, steps, places, fights and items;
- every condition reads a flag that something sets;
- every door leads somewhere with a way back;
- every marker points at something real;
- night three's daylight search can be done on full water.

**Result: no problems on any branch.** It was tested by breaking three things on purpose: a person moved, the roof ladder walled in, and a script deleted. It caught all three, plus the dead end the deleted script caused.

## Steps

| Night | Step | Objective | How it's done |
|---|---|---|---|
| 1 | `burial` | (the burial) | the burial plays |
| 1 | `home` | Feed the goats and check the water tank | use **pen**; then use **tank** |
| 1 | `market` | Trade the milk with Doña Chayo at the night market in the Plaza | talk to **chayo** |
| 1 | `kit` | Find Kit by the seven flags | talk to **kit** |
| 1 | `pancha` | Find Pancha down by the drain, east of the park | walk down into the drain |
| 1 | `home2` | Get home to Mar Farm before Shutter | use **door** |
| 2 | `n2_table` | Go to the elders' table at the Chapel | talk to **lupe** in chapel |
| 2 | `n2_shares` | Your father's share | talk to **fina**; then talk to **ines** in cellar; then talk to **tona**; then talk to **fina**; then talk to **ruben**; then talk to **kit** · tasks in any order: The water shift with Doña Fina, Daylight wraps from Rubén's stall, The salve for Kit's hand |
| 2 | `n2_store` | Walk Papá's salvage route to the Big Store | walk into **dogs** in big-store; then use **ehshelf** in big-store |
| 2 | `n2_memo` | Memo wants a word at the east barricade | talk to **memo** |
| 2 | `n2_sleep` | Go home and sleep | use **cot** in mar-home |
| 3 | `n3_tithe` | Riders at the east barricade | talk to **memo** |
| 3 | `n3_late` | The night's nearly done. Get home. | use **cot** in mar-home |
| 3 | `n3_search` | Find Güero. He followed the machines east. | talk to **guero** (by day) · fainting in the white: gueroLost (sets guero_lost), night 4 |
| 3 | `n3_home` | Get Güero home to the Cellars | arrive in cellar (by day) · fainting in the white: gueroDragged (sets memo_dragged), night 4 · on reaching cellar: reunion |
| 3 | `n3_sleep` | The white is up. Get home and sleep. | use **cot** in mar-home (by day) |
| 4 | `n4_mower` | Nina says the mower in Abby's yard has stopped | talk to **nina** |
| 4 | `n4_ines` | Go and see Doña Inés in the Cellars | talk to **ines** in cellar |
| 4 | `n4_shoes` | Abuela Toña wants Papá's shoes for her shrine | talk to **tona**; then use **shoes** in mar-home; then talk to **tona** |
| 4 | `n4_memo` | Memo found something at the east barricade | talk to **memo** |
| 4 | `n4_sleep` | Go home and sleep | use **cot** in mar-home |
| 5 | `n5_shelves` | Clear Papá's last two shelves in the Big Store | use **ehshelf** in big-store |
| 5 | `n5_market` | The night market. Don Beto has a story. | talk to **beto** |
| 5 | `n5_roof` | Kit wants to watch the sky from Mar Farm's roof | use **roof** |
| 5 | `n5_sleep` | Go home and sleep | use **cot** in mar-home |
| 6 | `n6_east` | Go east, down the Lake Road to the White Bowl | arrive in white-bowl · on reaching white-bowl: n6_wreck |
| 6 | `n6_wreck` | The wreck on the dry lake | talk to **digger** |
| 6 | `n6_fuselage` | Go inside the wreck | use **cradle** in fuselage |
| 6 | `n6_warden` | Get out of the wreck | arrive in white-bowl · on reaching white-bowl: wardenRise |
| 6 | `n6_home` | Get home to Mar Farm and sleep | use **cot** in mar-home |
| 7 | `n7_meeting` | The town meets under the seven flags | talk to **lupe** |
| 7 | `n7_roof` | Up on the roof, with NIM | use **roof** |
| 7 | `n7_pack` | Build a shielded pack at Papá's workbench | use **workbench** in mar-home |
| 7 | `n7_goodbyes` | Say goodbye. Hermana Lupe is waiting at the platform. | talk to **lupe** |
| 7 | `n7_sled` | Kit found something by the Ramp | use **sled** |
| 7 | `n7_leave` | Leave at Lamp, up the Thirty-Five | take the road to **thirty-five** |

## The walk, on each branch

### Güero found

```
burial: 
  burial
  → home
home: Feed the goats and check the water tank
  pen [home&!fed]
  tank [home&!tank]
  homeDone
  → market
market: Trade the milk with Doña Chayo at the night market in the Plaza
  chayo [market]
  → kit
kit: Find Kit by the seven flags
  kit [kit]
  → pancha
pancha: Find Pancha down by the drain, east of the park
  drainIntro
  drainWin
  → home2
home2: Get home to Mar Farm before Shutter
  door [home2]
night 2 (Night two: Her Father's Share) starts at n2_table
  wake2
n2_table: Go to the elders' table at the Chapel
  lupe [n2_table]
  → n2_shares
n2_shares: Your father's share: The water shift with Doña Fina · Daylight wraps from Rubén's stall · The salve for Kit's hand
  fina [n2_shares&!fina_started]
  ines [n2_shares&fina_started&!drop_cellar]
  tona [n2_shares&fina_started&!drop_tona]
  fina [n2_shares&fina_started&!fina_done&drop_cellar&drop_tona]
  ruben [n2_shares&!wraps_got&white:1]
  kit [n2_shares&has:salve&!salve_used]
  → n2_store (every task done)
n2_store: Walk Papá's salvage route to the Big Store
  dogs
  fight: dogs
  dogsWin
  ehshelf [n2_store&dogs_done]
  → n2_memo
n2_memo: Memo wants a word at the east barricade
  memo [n2_memo]
  → n2_sleep
n2_sleep: Go home and sleep
  cot [n2_sleep]
night 3 (Night three: The Signs) starts at n3_tithe
  wake3
n3_tithe: Riders at the east barricade
  memo [n3_tithe]
  → n3_late
n3_late: The night's nearly done. Get home.
  cot [n3_late]
  gueroGone
  → n3_search
n3_search: Find Güero. He followed the machines east.
  guero [n3_search]
  → n3_home
n3_home: Get Güero home to the Cellars
  reunion
  → n3_sleep
n3_sleep: The white is up. Get home and sleep.
  cot [n3_sleep]
night 4 (Night four: Tracks East) starts at n4_mower
  wake4 [*]
n4_mower: Nina says the mower in Abby's yard has stopped
  nina [n4_mower]
  → n4_ines
n4_ines: Go and see Doña Inés in the Cellars
  ines [n4_ines]
  → n4_shoes
n4_shoes: Abuela Toña wants Papá's shoes for her shrine
  tona [n4_shoes]
  shoes [n4_shoes&shoes_asked&!has:shoes&!shoes_given]
  tona [n4_shoes&has:shoes]
  → n4_memo
n4_memo: Memo found something at the east barricade
  memo [n4_memo]
  → n4_sleep
n4_sleep: Go home and sleep
  cot [n4_sleep]
night 5 (Night five: Two Shelves Left) starts at n5_shelves
  wake5
n5_shelves: Clear Papá's last two shelves in the Big Store
  ehshelf [n5_shelves]
  → n5_market
n5_market: The night market. Don Beto has a story.
  beto [n5_market]
  → n5_roof
n5_roof: Kit wants to watch the sky from Mar Farm's roof
  roof [n5_roof]
  → n5_sleep
n5_sleep: Go home and sleep
  cot [n5_sleep]
day five: the drone comes down in the White Bowl
night 6 (Night six: The White Bowl) starts at n6_east
  wake6
n6_east: Go east, down the Lake Road to the White Bowl
  → n6_wreck (arrived at white-bowl)
n6_wreck: The wreck on the dry lake
  digger [n6_wreck]
  → n6_fuselage
n6_fuselage: Go inside the wreck
  cradle [n6_fuselage]
  → n6_warden
n6_warden: Get out of the wreck
  wardenRise
  fight: warden
  wardenWin
  → n6_home
n6_home: Get home to Mar Farm and sleep
  cot [n6_home]
night 7 (Night seven: The Choice) starts at n7_meeting
  wake7
n7_meeting: The town meets under the seven flags
  lupe [n7_meeting]
  → n7_roof
n7_roof: Up on the roof, with NIM
  roof [n7_roof]
  → n7_pack
n7_pack: Build a shielded pack at Papá's workbench
  workbench [n7_pack&has:toolroll&has:wire&has:cell]
  → n7_goodbyes
n7_goodbyes: Say goodbye. Hermana Lupe is waiting at the platform.
  lupe [n7_goodbyes]
  → n7_sled
n7_sled: Kit found something by the Ramp
  sled [n7_sled]
  → n7_leave
n7_leave: Leave at Lamp, up the Thirty-Five
  leaveTown
  → the prologue ends
```

### Güero lost (the white takes Juno searching)

```
burial: 
  burial
  → home
home: Feed the goats and check the water tank
  pen [home&!fed]
  tank [home&!tank]
  homeDone
  → market
market: Trade the milk with Doña Chayo at the night market in the Plaza
  chayo [market]
  → kit
kit: Find Kit by the seven flags
  kit [kit]
  → pancha
pancha: Find Pancha down by the drain, east of the park
  drainIntro
  drainWin
  → home2
home2: Get home to Mar Farm before Shutter
  door [home2]
night 2 (Night two: Her Father's Share) starts at n2_table
  wake2
n2_table: Go to the elders' table at the Chapel
  lupe [n2_table]
  → n2_shares
n2_shares: Your father's share: The water shift with Doña Fina · Daylight wraps from Rubén's stall · The salve for Kit's hand
  fina [n2_shares&!fina_started]
  ines [n2_shares&fina_started&!drop_cellar]
  tona [n2_shares&fina_started&!drop_tona]
  fina [n2_shares&fina_started&!fina_done&drop_cellar&drop_tona]
  ruben [n2_shares&!wraps_got&white:1]
  kit [n2_shares&has:salve&!salve_used]
  → n2_store (every task done)
n2_store: Walk Papá's salvage route to the Big Store
  dogs
  fight: dogs
  dogsWin
  ehshelf [n2_store&dogs_done]
  → n2_memo
n2_memo: Memo wants a word at the east barricade
  memo [n2_memo]
  → n2_sleep
n2_sleep: Go home and sleep
  cot [n2_sleep]
night 3 (Night three: The Signs) starts at n3_tithe
  wake3
n3_tithe: Riders at the east barricade
  memo [n3_tithe]
  → n3_late
n3_late: The night's nearly done. Get home.
  cot [n3_late]
  gueroGone
  → n3_search
n3_search: Find Güero. He followed the machines east.
  (the white takes her)
  gueroLost
night 4 (Night four: Tracks East) starts at n4_mower
  wake4 [guero_lost]
n4_mower: Nina says the mower in Abby's yard has stopped
  nina [n4_mower]
  → n4_ines
n4_ines: Go and see Doña Inés in the Cellars
  ines [n4_ines&guero_lost]
  → n4_shoes
n4_shoes: Abuela Toña wants Papá's shoes for her shrine
  tona [n4_shoes]
  shoes [n4_shoes&shoes_asked&!has:shoes&!shoes_given]
  tona [n4_shoes&has:shoes]
  → n4_memo
n4_memo: Memo found something at the east barricade
  memo [n4_memo]
  → n4_sleep
n4_sleep: Go home and sleep
  cot [n4_sleep]
night 5 (Night five: Two Shelves Left) starts at n5_shelves
  wake5
n5_shelves: Clear Papá's last two shelves in the Big Store
  ehshelf [n5_shelves]
  → n5_market
n5_market: The night market. Don Beto has a story.
  beto [n5_market]
  → n5_roof
n5_roof: Kit wants to watch the sky from Mar Farm's roof
  roof [n5_roof]
  → n5_sleep
n5_sleep: Go home and sleep
  cot [n5_sleep]
day five: the drone comes down in the White Bowl
night 6 (Night six: The White Bowl) starts at n6_east
  wake6
n6_east: Go east, down the Lake Road to the White Bowl
  → n6_wreck (arrived at white-bowl)
n6_wreck: The wreck on the dry lake
  digger [n6_wreck]
  → n6_fuselage
n6_fuselage: Go inside the wreck
  cradle [n6_fuselage]
  → n6_warden
n6_warden: Get out of the wreck
  wardenRise
  fight: warden
  wardenWin
  → n6_home
n6_home: Get home to Mar Farm and sleep
  cot [n6_home]
night 7 (Night seven: The Choice) starts at n7_meeting
  wake7
n7_meeting: The town meets under the seven flags
  lupe [n7_meeting]
  → n7_roof
n7_roof: Up on the roof, with NIM
  roof [n7_roof]
  → n7_pack
n7_pack: Build a shielded pack at Papá's workbench
  workbench [n7_pack&has:toolroll&has:wire&has:cell]
  → n7_goodbyes
n7_goodbyes: Say goodbye. Hermana Lupe is waiting at the platform.
  lupe [n7_goodbyes]
  → n7_sled
n7_sled: Kit found something by the Ramp
  sled [n7_sled]
  → n7_leave
n7_leave: Leave at Lamp, up the Thirty-Five
  leaveTown
  → the prologue ends
```

### Güero found, Juno faints on the way home

```
burial: 
  burial
  → home
home: Feed the goats and check the water tank
  pen [home&!fed]
  tank [home&!tank]
  homeDone
  → market
market: Trade the milk with Doña Chayo at the night market in the Plaza
  chayo [market]
  → kit
kit: Find Kit by the seven flags
  kit [kit]
  → pancha
pancha: Find Pancha down by the drain, east of the park
  drainIntro
  drainWin
  → home2
home2: Get home to Mar Farm before Shutter
  door [home2]
night 2 (Night two: Her Father's Share) starts at n2_table
  wake2
n2_table: Go to the elders' table at the Chapel
  lupe [n2_table]
  → n2_shares
n2_shares: Your father's share: The water shift with Doña Fina · Daylight wraps from Rubén's stall · The salve for Kit's hand
  fina [n2_shares&!fina_started]
  ines [n2_shares&fina_started&!drop_cellar]
  tona [n2_shares&fina_started&!drop_tona]
  fina [n2_shares&fina_started&!fina_done&drop_cellar&drop_tona]
  ruben [n2_shares&!wraps_got&white:1]
  kit [n2_shares&has:salve&!salve_used]
  → n2_store (every task done)
n2_store: Walk Papá's salvage route to the Big Store
  dogs
  fight: dogs
  dogsWin
  ehshelf [n2_store&dogs_done]
  → n2_memo
n2_memo: Memo wants a word at the east barricade
  memo [n2_memo]
  → n2_sleep
n2_sleep: Go home and sleep
  cot [n2_sleep]
night 3 (Night three: The Signs) starts at n3_tithe
  wake3
n3_tithe: Riders at the east barricade
  memo [n3_tithe]
  → n3_late
n3_late: The night's nearly done. Get home.
  cot [n3_late]
  gueroGone
  → n3_search
n3_search: Find Güero. He followed the machines east.
  guero [n3_search]
  → n3_home
n3_home: Get Güero home to the Cellars
  (the white takes her)
  gueroDragged
night 4 (Night four: Tracks East) starts at n4_mower
  wake4 [*]
n4_mower: Nina says the mower in Abby's yard has stopped
  nina [n4_mower]
  → n4_ines
n4_ines: Go and see Doña Inés in the Cellars
  ines [n4_ines]
  → n4_shoes
n4_shoes: Abuela Toña wants Papá's shoes for her shrine
  tona [n4_shoes]
  shoes [n4_shoes&shoes_asked&!has:shoes&!shoes_given]
  tona [n4_shoes&has:shoes]
  → n4_memo
n4_memo: Memo found something at the east barricade
  memo [n4_memo]
  → n4_sleep
n4_sleep: Go home and sleep
  cot [n4_sleep]
night 5 (Night five: Two Shelves Left) starts at n5_shelves
  wake5
n5_shelves: Clear Papá's last two shelves in the Big Store
  ehshelf [n5_shelves]
  → n5_market
n5_market: The night market. Don Beto has a story.
  beto [n5_market]
  → n5_roof
n5_roof: Kit wants to watch the sky from Mar Farm's roof
  roof [n5_roof]
  → n5_sleep
n5_sleep: Go home and sleep
  cot [n5_sleep]
day five: the drone comes down in the White Bowl
night 6 (Night six: The White Bowl) starts at n6_east
  wake6
n6_east: Go east, down the Lake Road to the White Bowl
  → n6_wreck (arrived at white-bowl)
n6_wreck: The wreck on the dry lake
  digger [n6_wreck]
  → n6_fuselage
n6_fuselage: Go inside the wreck
  cradle [n6_fuselage]
  → n6_warden
n6_warden: Get out of the wreck
  wardenRise
  fight: warden
  wardenWin
  → n6_home
n6_home: Get home to Mar Farm and sleep
  cot [n6_home]
night 7 (Night seven: The Choice) starts at n7_meeting
  wake7
n7_meeting: The town meets under the seven flags
  lupe [n7_meeting]
  → n7_roof
n7_roof: Up on the roof, with NIM
  roof [n7_roof]
  → n7_pack
n7_pack: Build a shielded pack at Papá's workbench
  workbench [n7_pack&has:toolroll&has:wire&has:cell]
  → n7_goodbyes
n7_goodbyes: Say goodbye. Hermana Lupe is waiting at the platform.
  lupe [n7_goodbyes]
  → n7_sled
n7_sled: Kit found something by the Ramp
  sled [n7_sled]
  → n7_leave
n7_leave: Leave at Lamp, up the Thirty-Five
  leaveTown
  → the prologue ends
```

## Notes from the checker

- n3_search: Güero is 68 units' walk from lakeside's start
- night three in the white: at most 296 units in the open (59 s running, wraps on); full water and health last 120 s before she faints
