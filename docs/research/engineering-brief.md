# THE LONG NOON
## Engine Selection, JRPG File Architecture, Content Pipelines, AI Coding Workflow & Implementation Blueprint

**Research and engineering handoff**  
**Prepared:** October 10, 2026  
**Audience:** Project owner, Claude Code / other terminal-based coding agents, and future contributors  
**Status:** **Recommendation / architecture proposal — NOT a command to rewrite the game**  
**Primary deployment:** Desktop and mobile web browsers  
**Secondary possible deployments:** Desktop/Steam and packaged mobile applications

> **Instructions for the coding agent:** Read this entire document before making structural changes. Your first task is to **audit the actual repository and preserve the running demo**. This is an architectural research brief, not a claim that the suggested structure already exists or that an untested migration will work. Never replace an implemented mechanic simply because this guide recommends a cleaner interface. When implementation and this guide differ, report the difference, recommend the least disruptive path, and proceed incrementally.

---

# 0. THE DECISION IN ONE PAGE

## Recommended engine: retain Three.js

**Keep the existing Three.js-based game; convert its source into modular, version-controlled JavaScript/TypeScript; preserve the working gameplay; and build a robust, validated, data-driven content pipeline around it.** Do not migrate to Babylon.js, Godot, Unity, or another engine merely to gain “RPG tools.” Neither Three.js nor Babylon.js supplies a built-in JRPG quest/dialogue/inventory/turn-based-battle suite. Babylon.js has more integrated general game-engine tooling, which is valuable for new projects but insufficient to justify reimplementing a playable game. [S01][S02][S03]

### Highest-confidence conclusions

1. **The largest scaling risk is content and progression architecture, not graphics rendering.** Hundreds of maps, events, dialogues, encounters, and save-state combinations create complexity that a 20-minute prototype hides. CrossCode's developers explicitly made this distinction, changing their JavaScript game to use modular features and asynchronously loaded JSON map data. [S01]
2. **A 20–40-hour browser RPG is viable in JavaScript.** CrossCode was built using HTML5/JavaScript and a heavily modified ImpactJS-based engine. This is proof of feasibility, not proof that any particular Three.js implementation will meet mobile performance targets. [S01][S04]
3. **HD-2D is an art/rendering pipeline, not an Unreal-only capability.** Octopath's team emphasizes pixel art plus point lights, shadows, and effects. Three.js supports compositing, bloom, and depth of field; good art direction and thoughtful performance management are more important than engine branding. [S05][S06][S07]
4. **Use typed content records and stable IDs.** The documented databases, item tables, and event scripting of Final Fantasy, Dragon Quest XI, Triangle Strategy, and Stardew Valley support separating authored data from reusable runtime systems. These examples do **not** reveal every game's original source project layout. [S08][S09][S10][S11]
5. **Build a game-specific authoring pipeline, not another general-purpose engine.** Preserve existing JSON; add schemas, reference validation, save migrations, predictable loading, CLI tools, and browser regression tests. Pilot Tiled and Ink only after auditing current content. [S01][S12][S13][S14]

### Recommended near-term stack

| Layer | Recommendation | Status |
|---|---|---|
| 3D scene rendering | Three.js; **keep r128 while reorganizing** | Keep, then assess upgrades |
| Runtime language | Existing JS, introduce TypeScript gradually | Incremental |
| Packaging/dev server | Vite with locked dependencies | Adopt during modularization |
| Scenes/maps | Existing JSON + documented 3D scene metadata; test Tiled | Preserve first |
| Story/cutscenes | Declarative commands interpreted by reusable event runner | Refine existing system |
| Branching dialogue | Keep existing JSON; pilot Ink + inkjs for complicated branches | Optional pilot |
| State | Typed scope-aware flags/variables, stable ID registry | Priority |
| Quests | Declarative objectives, prerequisites, reward transactions | Priority |
| Battle | Preserve speed order, enemy-part targeting, timed parries | Non-negotiable preservation |
| Economy/balancing | Simple CSV authoring -> validated JSON; structured item/shop data | Gradual |
| Saves | Versioned JSON; IndexedDB storage + downloadable backups + migrations | Priority |
| Assets | PNG atlases, MP3, synthesized SFX; optional Aseprite CLI | Keep |
| QA | JSON Schema/Ajv, Vitest, Playwright, GitHub Actions, real devices | Priority |
| Desktop later | Evaluate Electron/Tauri after web release stabilizes | Defer |
| Mobile app later | Evaluate Capacitor/WebView/native packaging | Defer |

### Do not do these without evidence and a separate approved change

- Do **not** rewrite the game in Godot, Babylon.js, Unity, or RPG Maker.
- Do **not** upgrade Three.js and reorganize the entire source in the same unreviewable change.
- Do **not** convert all dialogue to Ink or all maps to Tiled wholesale.
- Do **not** replace existing artwork, narrative, sound synthesis, encounter balance, camera behavior, or battle timings as an incidental refactor.
- Do **not** invent an XP, gold, leveling, crafting, or shop system if the game does not yet require it. This guide describes how to organize **future** systems, not a feature mandate.
- Do **not** equate a successful desktop Playwright emulation test with performance on a real iPhone or Android phone.
- Do **not** assume that this document describes current paths, APIs, flags, or save fields until inspected in the repository.

---

# 1. PROJECT CONTEXT, REQUIREMENTS AND SUCCESS CRITERIA

## 1.1 Known project facts (from the owner)

- A JRPG called **The Long Noon**, targeting a finished experience of **20–40 hours**.
- HD-2D aesthetic: **pixel-art characters and textures within a lit 3D world**, tilt-shift/depth-of-field, bloom, dynamic lighting, and a day/night cycle.
- Existing working browser demo: approximately **20 minutes** including story, exploration, dialogue, and one turn-based fight.
- Combat includes **speed-based turn order**, **attacks aimed at separate enemy parts**, and **timed parries**.
- Existing technology: **custom JavaScript on Three.js r128**; demo distributed as a **single self-contained HTML file**, and runs on desktop and mobile browsers.
- Story content includes maps, dialogues, quests, and battles stored as **JSON data distinct from game logic**.
- Art/audio: **PNG sprite atlases**, **MP3 music**, and **sound effects synthesized by code**.
- Main developer workflow: **Claude Code / AI coding agents working through GitHub, CLI, and text files**; the owner sometimes wants to edit dialogue, story, balance numbers, and map definitions without programming.
- Later distribution to desktop/Steam and mobile apps is desirable but must not undermine browser-first design.

**Important caveat:** These are supplied facts, not the result of a repository inspection in this research session. A separate earlier prototype audit, if available in the repository, should be reviewed, but the coder must not assume its findings still describe the current branch.

## 1.2 Nonfunctional requirements

1. **Text-first authoring:** Every consequential configuration, gameplay rule, scenario definition, quest, flag, map placement, and dialogue branch should have an auditable text representation in Git. Binary art is exempt; generated metadata must be readable.
2. **No visual editor dependency:** Tools may provide optional visual editing, but source must remain editable via CLI. If a map editor is adopted, its saved authoritative output must be text or have a deterministic export.
3. **Browser-first architecture:** No filesystem APIs or native engine assumptions in core logic; avoid requiring WebGPU, service-specific authentication, a desktop runtime, or features unavailable on Safari without a fallback.
4. **Maintain behavior through refactoring:** Story, combat rules, frame pacing, mobile touch input, render appearance, and synth sound need baseline comparisons.
5. **Small initial download / bounded memory:** Load content in regions or bundles, do not load a 40-hour game into memory at title screen.
6. **Save durability:** Save data supports schema migration, backups/export, reliable chapter revisits and interrupted event recovery.
7. **AI-friendly verification:** A fresh agent should be able to clone, install, run, validate, test, and build the game with documented commands.
8. **Human editing:** A nonprogrammer should be able to edit a dialogue line, objective condition, enemy stat, or map marker with written instructions and meaningful validation feedback.

## 1.3 Delivery quality gates (proposed, not measured)

| Gate | Acceptance criterion |
|---|---|
| Existing demo parity | Side-by-side screenshots and scripted playthroughs show no unintended changes |
| Story continuity | All currently reachable quest/story states still resolve correctly |
| Combat parity | Initiative, target-part behavior, parry timing and damage calculations match approved baseline |
| Browser | Current supported desktop browsers and actual iOS/Android devices run the build |
| Performance | Define device tiers and measure cold load, memory, frame times; target stable 30 FPS on minimum device as an initial planning goal |
| Loading | Chapter/region content loads on demand without unexpected full-game preload |
| Save | New, old and interrupted-save fixtures pass; a user can export/import a backup |
| Content consistency | Duplicate IDs, missing references, invalid prerequisites and broken map links fail the content check |
| CI | A single documented CLI command runs the fast project checks; slower browser tests in CI |
| Deployment | Browser release is reproducible from a clean clone; optional standalone-demo mode remains separate |

---

# 2. ENGINE DECISION: CRITERIA, RATINGS AND TRADEOFFS

## 2.1 Definitions — particularly “RPG tools”

A rendering framework can draw characters, lights, and shadows without providing *any* RPG-specific features. **RPG systems** mean story event progression, dialogue and choices, quests, inventory/equipment, shops, item rewards, battle turn resolution, menu orchestration, party stats, save compatibility and localization. **General game-engine conveniences** mean scene graphs, animation systems, loading APIs, GUI primitives, asset managers and physics integration. These are different categories.

> **Correction to an earlier comparison:** Babylon.js deserves a higher rating for *integrated general game-engine conveniences*, not for *built-in JRPG mechanics*. Both Three.js and Babylon.js are **2/5 for ready-made RPG-specific mechanics**. The current Three.js demo already has custom RPG mechanics, which raises its *project fit* but does not change how much comes built into Three.js itself.

### Rating methodology

All ratings are **judgment calls for this project**, not benchmark results. 5 = strongest fit, 1 = weak fit. “AI/text” measures CLI usability, readability of canonical project files, examples/docs, and reliance on GUI-only authoring. “Web” emphasizes desktop **and mobile**. “RPG built-ins” is narrowly defined above; “RPG ecosystem” scores available tools/packages. Switching cost is Low/Medium/High/Very High and is **not** a numeric score where higher is better.

| Engine | AI/text authoring | HD-2D render potential | Browser + mobile fit | Built-in RPG mechanics | General game tools | Switch cost |
|---|---:|---:|---:|---:|---:|---|
| **Existing Three.js** | **5** | **5** | **5** | **2** | 2 | **None for keeping; medium refactor** |
| **Babylon.js** | **5** | **5** | **5** | **2** | **4** | Medium–high |
| **PlayCanvas standalone Engine** | **5** | **5** | **5** | **2** | **4** | Medium–high |
| **Phaser** | **5** | **2** (native 3D requirement) | **5** | **2** | 3 | High |
| **Godot 4 (GDScript)** | **4** | **5** | **3** | **2** | **5** | Very high |
| **Unity** | **3** | **5** | **3** | **2** | **5** | Very high |
| **RPG Maker MZ** | 3 | 2 (stock) | 4 (verify target phones) | **5** (classic RPG) | 4 | Very high |
| **Defold** | 4 | 3 | 4 | 2 | 3 | Very high |

**RPG Maker nuance:** Its 5 is for a conventional RPG workflow (events, databases, menus, standard combat, saves), **not** built-in support for the exact custom part-targeting/parry game. Under The Long Noon's mechanics, extensive plugin work reduces the practical benefit.

## 2.2 Three.js — **recommended to retain**

**What it is:** A highly capable 3D rendering library in JavaScript, with a flexible scene graph, lights, materials, cameras, animation, texture/sprite support and post-processing examples. [S06][S07]

- **AI workflow:** Excellent. Code, JSON, shaders, and build configuration are ordinary text; Git and CLI are the natural authoring model. Huge sample ecosystem. No locked GUI scene format.
- **HD-2D:** Excellent potential. Sprites are planes/billboards in 3D, depth-aware sorting and shadows where appropriate, orthographic/perspective cameras, PBR or stylized surfaces, tone mapping, bloom and DOF. *Existing look is already evidence of fit.*
- **Browser/mobile:** Excellent fit at the platform level. Render time still depends on resolution, sprite fill rate, texture memory, shader count and post passes. Native WebGL integration is not a performance guarantee.
- **Long-RPG fit:** Requires building or selecting state/event/save/content tools. **The demo has a head start.**
- **License:** MIT / free. Verify every additional dependency and purchased art separately.
- **Switching cost:** None if retained. Restructuring monolithic source still requires careful engineering, but can preserve the gameplay model.
- **Risk:** A single-file prototype can grow into deeply coupled ad hoc functions. Treat organization and testability as first-order production work.

**Three.js r128 warning:** The official migration guide spans a large series of breaking changes and recommends updating in increments of approximately ten releases. Notably, raw non-module builds were removed in later releases and WebGL 1 support was dropped by later versions. Start with extraction/parity, then consider a separate staged Three.js modernization branch. [S15]

## 2.3 Babylon.js — **best integrated JS 3D alternative, not a clear migration win**

- **AI/text:** JS/TS-first, CLI/npm-friendly, extensive docs/playground/examples.
- **HD-2D:** Excellent potential with lighting, materials, post processing and scenes.
- **Browser/mobile:** Excellent architecture fit; actual performance requires benchmarks.
- **RPG mechanics:** Does **not** provide a standard quest/dialogue/inventory/turn-based combat suite. You still create/customize these.
- **General game tools:** More integrated than Three.js: Babylon GUI (2D and 3D UI), asset containers, engine systems, physics integrations and editors. [S16]
- **License:** Apache 2.0 / free open source; verify ancillary commercial tools separately.
- **Migration:** Rebuild rendering scene graph, sprites/materials, cameras, effects, input/scenes as applicable; retain clean JSON content and engine-neutral combat/state logic where separated.
- **When to reconsider:** Only if a measured blocker demonstrates Babylon's tooling or platform support solves a significant problem that Three.js cannot solve economically.

## 2.4 PlayCanvas — **strong browser-native alternative if starting over**

- **AI/text:** Its *standalone engine* supports npm, TypeScript, Vite and CLI development without the browser editor; PlayCanvas documents an engine-only project generator with AI assistance. [S17]
- **HD-2D:** Excellent potential; 3D engine with render, lighting, materials and effects.
- **Web/mobile:** Web-native architecture, strong fit, still device-budget dependent.
- **RPG tools:** Not a built-in JRPG framework. More general engine conventions than Three.js.
- **License/cost:** Standalone engine MIT/free. Optional hosted/cloud editor plans are separate and pricing may change. [S17][S18]
- **Migration:** Meaningful renderer/scene rewrite. Main reason to use it is a *new* browser game whose author wants a more integrated engine without losing JS/CLI.

## 2.5 Phaser — **excellent 2D, poor native-3D match**

- **AI/text:** Excellent JS/TS code, docs and examples.
- **HD-2D:** Strong for composited 2D effects, not a general-purpose 3D renderer for depth-lit 3D scenes. A Phaser + Three.js hybrid adds responsibilities rather than replacing Three.js.
- **Web/mobile:** Strong browser-oriented tooling.
- **RPG tools:** Scene/UI/animation conveniences, but quest/inventory/event architecture still custom.
- **License:** MIT/free.
- **Migration:** High if preserving present 3D semantics.
- **Use case:** Reconsider only if art direction becomes truly 2D and the current 3D requirement is abandoned.

## 2.6 Godot 4 — **best full desktop editor alternative, constrained web target**

- **AI/text:** `.tscn`/`.tres` resource files are mostly readable text and scripts can be GDScript, but the serialized scene tree has paths/UIDs and is best validated by the engine/editor. Headless CLI is possible. [S19]
- **HD-2D:** Excellent rendering potential; node/scene composition and lighting.
- **Web/mobile:** Godot 4 web exports use the Compatibility renderer with WebGL 2. Single-threaded exports improve web deployment compatibility, but web export has limitations relative to native. In Godot 4, **C# web export is not supported**; GDScript is the appropriate web language. [S20]
- **RPG tools:** General scenes/UI/animation excellent; actual RPG systems still custom/add-ons.
- **License:** MIT/free.
- **Migration:** Very high; port code/scene/rendering and battle integration; scripts cannot simply be pasted over.
- **If browser first is relaxed:** It becomes a stronger candidate for a fresh project. Still not compelling given a working Three.js implementation.

## 2.7 Unity — **excellent content tool ecosystem, poor migration value here**

- **AI/text:** C# is easy for agents to author, but YAML scene/prefab files, GUID metadata and serialized references increase coupling to editor/import workflows. Force Text serialization improves version control, not necessarily editor-free usability.
- **HD-2D:** Excellent; 3D lights, cameras, materials, sprite integration and post-process tooling.
- **Web/mobile:** Unity 6 documentation recognizes selected mobile browsers (e.g., iOS Safari and Android Chrome), but the larger WebAssembly/asset pipeline and phone memory limits should be benchmarked. Older Unity web docs that state mobile is unsupported must not be misapplied to Unity 6. [S21]
- **RPG mechanics:** Extensive third-party asset-store ecosystem, no universal first-party JRPG system.
- **License:** Unity Personal currently lists the **$200,000 annual revenue/funding threshold** (2026 pricing announcement); above that, paid tiers/terms apply. Revalidate terms before adopting. [S22]
- **Migration:** Very high; near-total runtime rewrite. Not recommended.

## 2.8 RPG Maker MZ — **great conventional JRPG authoring, wrong constraints**

- **AI/text:** Runtime/content use web technologies and database JSON, but workflow is editor-defined and custom plugins are needed for specialized mechanics.
- **HD-2D:** Stock engine is 2D; pseudo-3D/3D plugins exist but materially change rendering assumptions.
- **Web/mobile:** HTML5 export possible; complex plugin-heavy games require mobile testing.
- **RPG systems:** Strong stock databases, events, menus, text, shops and saves for classic RPGs.
- **License:** Commercial one-time tool license; verify redistribution, plugins and assets individually.
- **Migration:** Very high and may sacrifice custom timed parries, enemy-part targeting and the current 3D aesthetic.
- **Recommendation:** No.

## 2.9 Defold and other alternatives

**Defold:** Lightweight multi-platform engine with HTML5 export and text-heavy project assets; Lua rather than current JavaScript, less direct 3D HD-2D fit, rewrite costs remain high. Consider for a new leaner 2D project, not this migration.

**Unreal Engine:** Relevant as an artistic and production reference, *not* a practical browser-first migration target. Modern Unreal has no current maintained first-party HTML5 export equivalent to a straightforward mobile-browser build. Octopath's use of Unreal is not a reason The Long Noon must use it. [S05]

**PixiJS:** Great for 2D WebGL/WebGPU and fast sprites. Could become an optional UI/2D layer, but mixing two renderers complicates depth and compositor integration. Prefer DOM/CSS or existing UI until measured needs justify this.

**Custom pure WebGL:** Gives control without added value over Three.js unless a specific rendering bottleneck is measured.

## 2.10 Switching cost breakdown

| Existing demo subsystem | Three.js retained | Babylon/PlayCanvas | Godot/Unity | RPG Maker |
|---|---|---|---|---|
| Existing story dialogue text | Preserve | Preserve if engine-neutral | Transform/import | Convert to database/events |
| Map JSON | Preserve/schema-adapt | Adapter required | Convert to scenes/resources | Extensive conversion |
| 3D scene/camera/lighting | Preserve | Port | Rebuild | Extensive plugin work |
| Combat rules | Preserve/extract | Preserve if pure JS | Rewrite in GDScript/C# | Custom plugins |
| Enemy-part targeting UI | Preserve | Port presentation | Rebuild | Likely substantial plugin work |
| Timed parry behavior | Preserve | Port input/render | Rebuild | Likely substantial plugin work |
| MP3 and PNG assets | Preserve | Mostly reusable | Import pipeline | Mostly reusable |
| Synthesized SFX | Preserve | Adapt | Rewrite | Plugin or audio replacement |
| Browser distribution | Already works | New pipeline | New WebAssembly build | New export |
| Mobile behavior | Baseline available | Full retest | Full retest | Full retest |

### Decision record (ADR-001; proposed)

- **Decision:** Retain Three.js as the renderer and develop RPG services independent of the render layer.
- **Reasons:** Demonstrated prototype, maximum AI/CLI compatibility, lowest migration risk, browser native, full HD-2D potential.
- **Rejected for now:** Babylon.js, PlayCanvas, Phaser, Godot, Unity, RPG Maker MZ, Defold and Unreal as replacements.
- **Revisit triggers:** An independently reproduced, expensive-to-fix engine limitation; serious cross-device incompatibility; a renderer rewrite that is already unavoidable; or material changes to web/browser requirements.
- **Required evidence to revisit:** A standalone spike comparing the same scene and mobile device under both renderers, including load time, visual parity, device FPS/frame time and porting effort.

---
# 3. WHAT SHIPPED RPGs ACTUALLY TEACH US

## 3.1 Evidence labels: do not confuse modded shipping assets with source projects

Use the following distinctions when applying external examples:

- **DEV** — described directly by a developer or official technical documentation. Highest confidence about a *particular* subsystem.
- **MOD** — determined by modders through shipped files, mod APIs, or reverse engineering. Good evidence for *serialized runtime resources*, but **not** a verified original project directory or authoring workflow.
- **INF** — an engineering inference or recommendation assembled from multiple sources. Not a claim about how the original commercial team organized its repository.

No public evidence surveyed gives a complete authenticated source tree for every listed game. **Do not invent one.**

## 3.2 CrossCode — the key technical model [DEV + MOD]

**Developer's own architecture article:** *Architecture of CrossCode #1 – Overview*, Radical Fish Games. [S01]

The developers explicitly identify two problems with a smaller ImpactJS-style project as it grew: a continuously extended `main.js` was difficult to maintain, and levels as JS modules were all loaded during startup. They reorganized code into modular features and loaded JSON maps **asynchronously only when needed**.

**Developer-documented excerpt, not a full repo reconstruction:**

```text
CrossCode (published excerpt)
├── data/
│   ├── animations/        animation metadata
│   ├── effects/           effect definitions
│   ├── maps/              JSON level/map data
│   └── ...
├── lib/
│   ├── features/
│   │   ├── ig/            reusable engine-adjacent features
│   │   │   ├── camera/
│   │   │   └── gui/
│   │   └── sc/            CrossCode-specific features
│   │       ├── combat/
│   │       ├── player/
│   │       └── puzzle/
│   └── game/
│       ├── config.js
│       └── features.js
└── media/                 image and audio assets
```

The modding ecosystem provides an independently inspectable distributed structure:

```text
assets/
├── data/                  JSON maps, animation/item/entity data
├── js/                    compiled JavaScript
└── media/                 image, music and audio assets
```

The official/community CrossCode map editor supports editing JSON maps and entity placements; modding resources document map fields such as levels, tile layers, collision, entity settings and audio/environment attributes. A savegame reference describes `map`, `vars`, `position`, `saveVersion`, `quests`, `party`, and other data. [S23][S24][S25]

**Most transferable ideas:**

1. **Independent region files** permit async map streaming and bounded memory.
2. **Data-configured reusable entities** prevent per-enemy/per-NPC code duplication.
3. **Shared code by features** is clearer than continually extending a single main file.
4. **A map is more than tile art:** it links collision, object instances, teleports, NPCs, events and environment settings.
5. **Saves capture semantic world state, not renderer objects.**

**What not to imitate blindly:** CrossCode's exact engine APIs, asset IDs, or save encryption. Reproduce the architectural separation, not its proprietary schema.

## 3.3 Octopath Traveler and Octopath Traveler II [DEV + MOD]

**Developer/official reporting:** Octopath Traveler used Unreal Engine, pixel characters, a 3D environment, lighting and visual effects. A developer interview explains that adding **point lights to combat effects** made characters cast shadows on surrounding geometry and improved the look. The team relied on Unreal tooling with a relatively small programmer group. [S05]

**Modder evidence:** In Octopath Traveler II, modders identify enemy database assets, including `EnemyDB` under a cooked Unreal-style path resembling `Content/Character/Database`, and modify drop information through `.uasset` and `.pak` tools. [S08]

**Transferable separation:**

```text
conceptual runtime areas, NOT an alleged original Octopath repo
- enemies and battle parameters
- character/item definitions
- map and encounter resources
- narrative/scripted interactions
- localization text
- art and materials
```

**For The Long Noon:** Treat enemy-part definitions as data (IDs, hit zones, resistances, break effects, drop/reward references), while keeping generic turn-order and hit-resolution algorithms in code. Keep scene lighting and VFX configurable per attack or encounter. Do not embed numbers in presentation handlers.

**HD-2D implementation note:** Depth of field should support the miniature look without making interactive characters or critical floor markers illegible. Combat-light flashes, bloom, particles, and color treatment should be authored with rendering presets and tested on phones.

## 3.4 Triangle Strategy [MOD]

A documented mod lists specific files in cooked Unreal assets:

- `.../Data/DataTables/GOP_Shop_List.uasset` — shop stock information.
- `.../Data/DataTables/GOP_Unit_VoteParam.uasset` — conviction/belief requirements.
- `.../Data/DataTables/GOP_World_Icon.uasset` — world icon/story conditions.
- `.../LuaScriptBin/Src/Newera_Handling/Scenario/Story/.../*.lub` — compiled Lua scenario and story scripts.

This is unusually concrete evidence that **data tables and procedural scenario scripts can be serialized separately**. It does not reveal their original developer spreadsheet source or exact script-building pipeline. The modding guides explain that the `.lub` resources are compiled/protected and need extraction/decompilation to inspect. [S26][S27]

**For The Long Noon:**

- `database/shops/` holds stock rules and prices.
- `campaign/` or `events/` holds scenario actions/branching.
- `state/` holds conviction-like moral variables, faction standing, trust etc. **only if narrative design calls for them**.
- Region map markers read story preconditions, never copy entire story tables into the map.
- Scene event scripts should be declarative where possible; complex one-off cinematic behavior can use well-named, reviewed script adapters.

## 3.5 Dragon Quest XI [MOD + official Unreal format]

Modders describe DQXI's `DT_ItemTable` Unreal DataTable containing item/weapon data, which can be converted to CSV and back with a mod tool. [S09]

**Lesson:** Put numerical balance into structured tables that designers can audit. Example dimensions include item ID, category, stack limit, sell value, use effect, equipment modifiers and acquisition sources. However, avoid flattening inherently hierarchical content (dialogue trees, multi-part enemy anatomy, conditional cutscenes) into giant CSV tables just because spreadsheets are easy to open.

**Recommended authoring split:**

- **CSV** for flat rectangular balancing records.
- **JSON/JSONC/YAML** for nested definitions (prefer JSON for runtime portability and schema validation; if JSONC/YAML authoring is chosen, compile to plain JSON).
- **Ink or current dialogue JSON** for branching narrative.
- **Tiled/LDtk map source + Three.js scene JSON** for spatial placement.

## 3.6 Final Fantasy VI and classic Final Fantasy [reverse engineering]

A maintained FFVI disassembly/reconstruction documents a **field event interpreter** with a command-oriented event script containing storyline/scenario logic, including character/inventory commands, branching and related operations. The project explicitly warns that the complete *original* Squaresoft source scripts are not publicly available and its reconstruction is still a work in progress. [S10]

**Transferable idea:** A small, stable vocabulary of **event commands** can support a huge story. Examples: show dialogue, move actor, set flag, branch on condition, give item, start combat, camera operation, music change and map transition. This is far safer than creating hundreds of hand-coded event JavaScript functions.

### Important event interpreter requirements

- Deterministic action ordering and explicit waits.
- Conditions must be parseable/testable before runtime.
- Player controls lock/unlock through a `try/finally`-style or lifecycle cleanup mechanism.
- Scene transitions preserve the required world state.
- Skipping/replaying events does not award duplicate rewards.
- Interrupt/reload semantics are defined rather than accidental.
- Unknown commands fail validation in development.
- Asynchronous actions have cancellation and timeout handling.

## 3.7 Stardew Valley [documented modding data/API]

Stardew's event keys combine **stable event IDs plus preconditions** (time, weather, friendship, location, items, previously seen events, choices, etc.). Its event scripts execute command sequences controlling NPC motion, music, dialogue and scene state. NPC dialogue resources are separate from other shared string assets; conversations can respond to flags, dates and story progress. [S11][S28]

**Lesson:** Content selection is state-driven; the same location/NPC can behave differently over time without duplicating the location or writing new bespoke gameplay systems.

**Apply it:**

```text
shared region + stable NPC ID
              |
              v
   evaluate ordered candidates
     first-meeting dialogue
     quest-active dialogue
     quest-completed dialogue
     daily fallback dialogue
              |
              v
      play matching content
```

Do not use Stardew's exact slash-delimited syntax for a new engine unless already present. Its historical terseness is efficient for the runtime but error-prone for nonprogrammers. Prefer typed JSON conditions that can produce useful validation errors.

## 3.8 Undertale [reverse-engineered GameMaker runtime]

Undertale's shipped GameMaker data files contain rooms, objects, code, sprites/textures and other resources that community tools can inspect. UndertaleModTool exposes separate lists for rooms, game objects, textures and code. This reveals packed game resources, **not** the creator's original editable source hierarchy. [S29]

**Lesson:** Remember the semantic distinction between **transient events**, **per-run persistent state**, and any **longer-lived meta-state** needed for narrative consequences. *The Long Noon should only implement meta-state if the story actually requires it.*

Suggested scopes:

| Scope | Examples | Stored across reload? |
|---|---|---|
| Frame/action | parry window, current animation tick | Usually no |
| Battle | active turn queue, temporary buffs | Only if mid-battle saves supported |
| Scene/session | one-time nonpersistent VFX, temporary interactable state | Maybe, per design |
| World/region | door opened, item collected, bridge repaired | Yes |
| Quest/chapter | branch chosen, objective complete, scene seen | Yes |
| Campaign | major relationships, endings unlocked | Yes |
| Meta-profile | accessibility/settings, optional NG+ unlocks | Separate profile, if needed |

## 3.9 Eastward [developer first-party information]

Pixpil listed its MOAI-based game engine, in-house MOCK framework and **Gii editor**, along with Lua/C++ runtime work, Python/Lua tools and Aseprite artwork. The studio also described separating sprite art into structural layers during asset processing. [S30][S31]

**Lesson:** Custom engines work when reinforced by a good production pipeline. Reusable content authoring and export tools are more valuable than endlessly expanding rendering features. A building's roof/walls and related occlusion layers may need separate graphical resources or depth metadata, not just one sprite.

## 3.10 Sea of Stars [developer press kit]

Sabotage Studio states that *Sea of Stars* uses a **custom-made rendering pipeline** to provide full dynamic lighting to pixel-art worlds; publicly available developer/Steam statements identify Unity as the underlying engine. “Custom render pipeline” does **not** mean “engine written from scratch.” Its source content directory, event toolchain and save migration implementation are not publicly evidenced here. [S32][S33]

**Lesson:** Keep the renderer's distinctive effects modular. A small team can layer distinctive lighting onto an existing engine without owning every low-level subsystem.

## 3.11 Chained Echoes [developer interview]

Developer Matthias Linda describes evolving from RPG Maker experimentation to Unity and reports using **Photoshop, Aseprite and Tiled** for production. The longer development process also involved purchasing targeted tools/assets for difficult areas such as pathfinding. [S34][S35]

**Lesson:** Select tools for concrete bottlenecks, rather than migrating the whole codebase to obtain broad, theoretical conveniences. This is a good argument for testing Tiled and Ink in a tiny production slice.

## 3.12 Common content-pipeline pattern distilled from the evidence [INF]

```text
Authoring content             Reusable runtime
-------------------           -----------------------------
Map/scene data  ----------->  Map loader / scene instances
Dialogue/branches ----------> Narrative runtime / UI
Chapter/quest JSON ---------> Condition evaluator / event runner
Enemy and combat records ---> Battle engine / target-part resolver
Items/shops CSV/JSON -------> Inventory + transaction services
Audio/texture atlases ------> Asset loader / rendering/audio adapters
All persistent state -------> Versioned save serializer
```

**Not all games have identical directories or technologies**; the reusable principle is the separation of authored content, generic interpreters, renderer/platform integration and versioned state.

---

# 4. PROPOSED CANONICAL REPOSITORY TREE

This tree is a **target**, not an immediate migration instruction. A 20–40-hour project should grow into it organically. Each folder includes a brief purpose annotation. If an equivalent structure already exists, keep it unless there is a concrete reason to change it.

```text
the-long-noon/
├── README.md                         # Human-readable run/build/architecture orientation
├── AGENTS.md                         # Rules and workflows for terminal coding agents
├── package.json                      # Scripts and pinned dependency declarations
├── package-lock.json                 # Reproducible dependency resolution (if npm)
├── tsconfig.json                     # Incremental JS/TS settings when adopted
├── vite.config.ts                    # Bundler / dev server configuration (if adopted)
├── index.html                        # Thin application HTML shell
├── .github/
│   ├── workflows/                    # CI for content checks, tests, build
│   └── ISSUE_TEMPLATE/               # Repeatable feature/bug submission structure
├── docs/
│   ├── architecture/                 # Subsystem boundaries and data-flow diagrams
│   ├── decisions/                    # ADRs; why major choices were made
│   ├── game-design/                  # Systems rules and balancing philosophies
│   ├── narrative/                    # Chapter outlines, character arcs, continuity
│   ├── world/                        # Locations, lore, timeline, environmental rules
│   ├── content-formats/              # How the owner edits each JSON/CSV/Ink type
│   ├── agent-workflows/              # Small reproducible AI implementation tasks
│   └── research/                     # This report and linked studies
├── src/
│   ├── app/                          # Boot, bootstrap, lifecycle and feature registration
│   ├── core/                         # Shared IDs, types, clock, random, event contracts
│   ├── rendering/                    # Three.js-specific adaptation boundary
│   │   ├── world/                    # 3D geometry/cameras/terrain/sprite placement
│   │   ├── sprites/                  # Atlas animation, occlusion and sort policy
│   │   ├── lighting/                 # Dynamic lights, day/night and shadow controls
│   │   ├── postprocessing/           # Bloom, focus/DOF, color and accessibility options
│   │   └── shaders/                  # Shader authoring/runtime integration
│   ├── world/                        # Region loading, collision, navigation, transitions
│   ├── entities/                     # NPC, prop and enemy instance lifecycle
│   ├── events/                       # Declarative event interpreter / scheduler
│   ├── narrative/                    # Dialogue service, branch selection, localization
│   ├── quests/                       # Objective evaluation, progress, rewards
│   ├── combat/                       # Initiative, parts, attacks, defenses, parries
│   ├── progression/                  # Character and campaign advancement (as needed)
│   ├── economy/                      # Currency, inventory transactions, merchants
│   ├── time/                         # Game clock, schedules, day/night conditions
│   ├── ui/                           # HUD, dialogue window, battle menus, settings
│   ├── audio/                        # MP3 player, synth sound engine, audio buses
│   ├── input/                        # Keyboard, gamepad and touch mapping
│   ├── platform/                     # Browser storage, feature detection and adapters
│   └── save/
│       ├── serializer/               # Save DTO and serialization logic
│       └── migrations/               # Version-to-version save upgrades
├── content/
│   ├── manifest.json                 # Stable index of all content packs and their IDs
│   ├── campaign/
│   │   ├── chapters/                 # Chapter stage, preconditions and milestones
│   │   ├── sequences/                # Main story events that can span maps
│   │   └── endings/                  # Endgame route configuration if needed
│   ├── regions/
│   │   ├── region-id/
│   │   │   ├── region.json            # Region metadata, connections, climate, preload
│   │   │   ├── maps/                 # Tiled/original layout and collision source
│   │   │   ├── scenes/               # Height, meshes, lighting, objects and triggers
│   │   │   ├── npcs/                 # NPC placement, schedules and regional override
│   │   │   └── encounters/           # Encounter spawn and regional rules
│   │   └── ...
│   ├── dialogue/                     # Existing JSON/optional .ink canonical source
│   ├── quests/                       # Quest definitions, goals, and dependencies
│   ├── database/
│   │   ├── characters/               # Base playable character templates
│   │   ├── enemies/                  # Enemy archetypes and targetable components
│   │   ├── encounters/               # Enemy group/wave definitions
│   │   ├── abilities/                # Skills, costs, ranges and conditions
│   │   ├── items/                    # Consumables and key items
│   │   ├── equipment/                # Equipment data, if introduced
│   │   ├── shops/                    # Merchant stock, rules and prices
│   │   ├── loot/                     # Conditional drop and salvage tables
│   │   ├── currencies/               # Currency types and display rules
│   │   └── balance/                  # Editable CSV curves/tuning records
│   ├── state/                        # Registry of typed persistent IDs/flags
│   ├── locales/
│   │   ├── en/                       # English authored/compiled display strings
│   │   └── es/                       # Optional future Spanish localization
│   └── schemas/                      # JSON Schemas/contracts for all content types
├── assets/
│   ├── sprites/
│   │   ├── sources/                  # Original Aseprite/PNG source art
│   │   └── atlases/                  # Generated PNG and frame metadata
│   ├── tilesets/                     # Source tiles and exported graphics
│   ├── environments/                 # Models, geometric assets and reusable props
│   ├── textures/                     # Albedo, normals, palettes, material textures
│   ├── music/                        # MP3 tracks and alternate loops
│   ├── audio/                        # Optional sample files (synth code remains src)
│   ├── fonts/                        # Licensed font files, with provenance
│   └── shaders/                      # Optional non-runtime shader source assets
├── scripts/
│   ├── audit/                         # Inventory/analysis of existing content/JS
│   ├── validate/                      # Schema, refs, localization, story checks
│   ├── build-content/                 # Source files -> deterministic runtime JSON
│   ├── export-assets/                 # Art and atlas conversion via CLI
│   ├── migrate/                       # One-time content transformations (reviewed)
│   ├── debug/                         # Scenario bootstrap and reproducible states
│   └── reports/                       # Generated data reports, graph outputs
├── tests/
│   ├── unit/                          # Combat/math/conditions/persistence unit tests
│   ├── content/                       # Invalid ID and schema fixture tests
│   ├── story/                         # Graph reachability and critical progression
│   ├── integration/                   # Interacting gameplay services
│   ├── browser/                       # Playwright: visible game, touch, screenshots
│   ├── saves/                         # Old-version/golden/invalid saves
│   ├── performance/                   # Repeatable profiling scripts and baselines
│   ├── visual/                        # Approved regression screenshots
│   └── fixtures/                      # Compact real-world test content/states
├── releases/
│   └── standalone-demo/               # Generated optional one-file demo artifact
├── legacy/
│   └── original-demo/                 # Preserved reference, temporary or archival
└── dist/                              # Generated website assets; generally gitignored
```

## 4.1 Core dependency direction

```text
content/* ---------------------+ 
                               v
                         content loader
                               |
                               v
                        domain game state
                  +------------+-----------+
                  |            |           |
                events       combat       quests/economy
                  |            |           |
                  +------------+-----------+
                               |
                      presentation services
                               |
                         Three.js / DOM
                               |
                       browser / platform
```

**Rule:** Gameplay rules should not import concrete Three.js classes unless rendering is fundamental to that operation. For example, combat damage resolution receives target-part IDs and player timing inputs, not a `THREE.Mesh` object. Likewise, the save serializer receives a small serializable state model, not the entire Three.js scene graph.

## 4.2 Recommended repository architecture boundaries

- **Data layer:** Format-specific loader validates and produces stable records keyed by IDs.
- **Domain/state layer:** One authoritative mutable game state or controlled store; prefer command/reducer boundaries rather than multiple free-form global objects.
- **Event layer:** Safe script interpreter selects and executes a small vocabulary of actions.
- **Gameplay systems:** Combat, quest objectives, inventories, shops and clocks work on explicit domain models.
- **Presentation adapters:** Rendering, UI and audio subscribe to changes and issue player intent commands.
- **Persistence:** Serializes explicit versioned DTOs and migrates across releases.

**Avoid circular dependencies:** `combat` must not import `ui`; `ui` may read combat snapshot and dispatch a battle action through an interface. `world` must not rewrite quest internals; it raises world events. `content` imports nothing from game source and contains zero executable JavaScript by default.

## 4.3 Chapter organization versus region organization

**Chapters are narrative units; regions are geographical content bundles.** The same region may be revisited across chapters without cloning the map. Put dynamic NPC availability, altered terrain layers, quest markers and dialogue triggers behind named state conditions.

```text
chapter_01 -----+-------------------+
                |                   |
                v                   v
           same valley          settlement
                ^                   |
                |                   |
chapter_04 -----+-------------------+
    activate changed dialogue, new encounter and bridge layer
```

When world geometry substantially changes, create explicit scene variants or composable condition-driven layers (e.g., `bridge_destroyed`, `bridge_repaired`) instead of maintaining duplicated giant map files.

## 4.4 Naming and stable IDs

**Preferred IDs:** lower-case ASCII namespaces: `region.map.object`, `story.chapter.event`, `quest.id.objective`, `enemy.id.part`. Avoid using human-readable display names as machine keys.

Examples:

```text
region.mar_farm.yard
npc.kit
quest.lamp.check_supplies
story.lamp.intro_seen
enemy.stray.left_arm
item.goat_milk
currency.white
```

*These examples are illustrative; map them to the real game's existing IDs rather than renaming live records unnecessarily.*

Rules:

1. IDs are stable across refactors and localization.
2. Renaming a filename does not require renaming the semantic ID.
3. Retired IDs remain in a documented alias/migration table if old saves reference them.
4. Never use mutable array indices as persistent references.
5. Each record has an owner/module, schema version and optionally a designer-facing description.
6. The content build rejects duplicate IDs globally and validates foreign references.

---

# 5. SPECIFIC RECOMMENDED CONTENT FORMATS

All examples in this section are **proposed schematic formats**, NOT exact current engine APIs, not commercial game files, and not a command to introduce features that The Long Noon does not yet contain. Design the formal schemas after examining current JSON.

## 5.1 Content manifest and asynchronous loading

```json
{
  "schemaVersion": 1,
  "campaign": ["campaign/chapters/lamp.json"],
  "regions": [
    { "id": "region.mar_farm", "entry": "regions/mar_farm/region.json" },
    { "id": "region.the_span", "entry": "regions/the_span/region.json" }
  ],
  "globalDatabases": [
    "database/items/index.json",
    "database/enemies/index.json"
  ]
}
```

- Do not copy the whole manifest into every save.
- Load only global data needed for initial navigation; defer region encounters, optional dialogues, textures and music.
- A region bundle lists dependencies so nearby portals can preload assets while the player approaches.
- Use reference counting or explicit owner groups to dispose textures, geometries and GPU render targets when leaving a region.
- Cache shared assets but apply a memory budget; DOF and bloom framebuffers also consume GPU memory.
- Show a meaningful progress UI and recover from interrupted network requests.
- Preserve browser caching via versioned filenames/hashes in production.

## 5.2 A region definition

```json
{
  "id": "region.mar_farm",
  "schemaVersion": 1,
  "titleKey": "region.mar_farm.name",
  "defaultMap": "map.mar_farm.yard",
  "maps": ["map.mar_farm.yard", "map.mar_farm.house"],
  "ambientMusic": "music.farm_evening",
  "connections": [
    {
      "exitId": "farm_east_gate",
      "destinationMap": "map.the_span.west_approach",
      "spawnId": "west_entry"
    }
  ]
}
```

The parser should resolve map IDs through a manifest rather than depending on guessed filenames. Do not couple the logical gameplay state with whether its geometry is currently loaded.

## 5.3 Map layout versus 3D scene metadata

Recommended split (after validating current content):

- **Map authoring source:** Tiled JSON/LDtk JSON or the existing simple JSON. Holds tile grids, collision, trigger markers, spawn coordinates, and interaction regions.
- **Scene metadata:** Original JSON using 3D coordinates, elevation, meshes, lighting presets, camera framing, weather, sounds and sprite occlusion rules.
- **Encounter placements:** References shared enemy encounter records; do not duplicate all enemy statistics in map files.
- **Event scripts:** Trigger references stable event IDs; do not paste large branching cutscenes into spatial placement structures.

Example Three.js scene metadata:

```json
{
  "id": "scene.mar_farm.yard",
  "mapId": "map.mar_farm.yard",
  "coordinateSystem": "x-right_y-up_z-depth",
  "lightingProfile": "light.sheltered_afternoon",
  "renderQualityOverrides": {},
  "props": [
    { "instanceId": "farm_well", "prefabId": "prop.well", "position": [8, 0, 4] }
  ],
  "actors": [
    { "instanceId": "kit_at_gate", "actorId": "npc.kit", "spawn": "north_gate" }
  ],
  "eventTriggers": [
    {
      "id": "trigger.first_return",
      "volumeId": "yard_entry",
      "eventId": "event.lamp.return_to_farm"
    }
  ]
}
```

**3D depth warning:** Flat sprites can suffer order/occlusion bugs when camera angles, transparent sorting, shadows, and overlapping roofs interact. Define a consistent policy for character ground anchors, draw order, alpha cutout/depth writing, roof transparency and near-camera geometry. Test against the approved reference scenes.

## 5.4 Typed story flags and state ownership

Use a **registry** to declare persistent identifiers, defaults and intended scope rather than allowing any script to invent arbitrary strings at runtime.

```json
{
  "schemaVersion": 1,
  "flags": [
    {
      "id": "story.lamp.intro_seen",
      "type": "boolean",
      "default": false,
      "scope": "campaign",
      "description": "The opening Lamp sequence has resolved."
    },
    {
      "id": "world.mar_farm.well_restored",
      "type": "boolean",
      "default": false,
      "scope": "world",
      "description": "The farm well is usable again."
    }
  ],
  "variables": [
    {
      "id": "world.time_of_day",
      "type": "number",
      "default": 12,
      "scope": "world",
      "minimum": 0,
      "maximum": 24
    }
  ]
}
```

**Scopes should be explicit:** `battle`, `session`, `map`, `world`, `quest`, `campaign`, and optionally `meta`. Do not blindly serialize all scopes. Persist true world changes and story choices; recompute UI-only or transient effects from the source of truth.

**Condition grammar (proposal):**

```json
{
  "all": [
    { "flag": "story.lamp.intro_seen", "eq": true },
    { "not": { "flag": "world.mar_farm.well_restored", "eq": true } },
    { "inventoryHas": { "itemId": "item.goat_milk", "quantity": 1 } }
  ]
}
```

Support `all`, `any`, `not`, typed comparisons, possession checks, quest status, region/time and party conditions as requirements demand. Prevent arbitrary `eval` or script snippets inside authorable JSON. Every condition type needs a schema, deterministic evaluation, a human-readable diagnostic and a test.

## 5.5 Event commands and cinematic transactions

Design around **typed declarative steps**:

```json
{
  "id": "event.lamp.return_to_farm",
  "once": true,
  "precondition": {
    "flag": "story.lamp.intro_seen",
    "eq": true
  },
  "steps": [
    { "type": "player.lock" },
    { "type": "camera.focusActor", "actorId": "npc.kit", "durationMs": 450 },
    { "type": "dialogue.play", "dialogueId": "dialogue.lamp.kit_return" },
    { "type": "flag.set", "id": "story.lamp.return_scene_seen", "value": true },
    { "type": "player.unlock" }
  ]
}
```

### Event execution contract

- Distinguish **authoring source**, **compiled validated event** and **currently running event state**.
- Register each command in a typed registry and fail on unknown steps.
- Commands have documented sync/async behavior, cancellation and retry policy.
- Avoid literal time delays for narrative correctness; use completion signals (`waitForAnimation`, `waitForDialogue`) where appropriate.
- Identify important **commit points** at which world/quest rewards and flags are applied **exactly once**.
- On skip, execute an approved **finalization path** (move actors to final placements, apply required progress once, restore control, dispose VFX) rather than merely aborting the interpreter.
- Prefer saving only at safe points, or implement resumable event checkpoints. Do not invent mid-cutscene save recovery accidentally.
- Trap errors and release player lock/UI focus even when an optional asset or dialogue line fails.

### Escaping custom scripting

Occasionally cinematic behavior will not fit generic commands. Allow a reviewed registry key such as `customAction: "lamp.farm_gate_camera_reveal"`, implemented in a small isolated JS/TS module. Never allow arbitrary code strings in JSON. Keep bespoke actions exceptional and count how many exist.

## 5.6 Dialogue and branching / localization

### Minimal existing-JSON-friendly option

```json
{
  "id": "dialogue.lamp.kit_return",
  "startNode": "start",
  "nodes": {
    "start": {
      "speaker": "npc.kit",
      "textKey": "dialogue.lamp.kit_return.start",
      "next": "choice"
    },
    "choice": {
      "choices": [
        {
          "id": "ask_about_well",
          "textKey": "dialogue.lamp.kit_return.ask_well",
          "next": "well_answer"
        },
        {
          "id": "leave",
          "textKey": "dialogue.common.leave",
          "next": "end"
        }
      ]
    },
    "well_answer": {
      "speaker": "npc.kit",
      "textKey": "dialogue.lamp.kit_return.well_answer",
      "next": "end"
    },
    "end": { "type": "end" }
  }
}
```

**Ink option:** `.ink` becomes the narrative authoring source; `inklecate` compiles to JSON and `inkjs` runs it in the browser. Use Ink for elaborate branching if the current JSON format becomes unwieldy. Both file formats are agent-readable. Ink's variables and tags require a deliberate bridge into the authoritative RPG state registry; do not maintain two divergent copies of important game flags. [S13]

### Localization requirements

- Every player-visible string has a **stable key**, not an index or embedded markup fragment.
- Store optional variables/placeholders with named parameters and validate them across languages.
- Have fallbacks for missing locale strings in development; block shipping builds with critical missing text.
- Preserve original source wording and avoid using translated strings in gameplay conditions.
- Provide a string-extraction report, speaker/context notes, and max UI length checks where helpful.
- Keep narrative localization separate from logic; e.g. `locales/en/*.json`, `locales/es/*.json`.
- Test special characters, wrapping and mobile dialogue window sizing.

Example locale entries:

```json
{
  "dialogue.lamp.kit_return.start": "You're back. Did you find anything?",
  "dialogue.lamp.kit_return.ask_well": "What happened to the well?",
  "dialogue.lamp.kit_return.well_answer": "Not safe to drink from yet."
}
```

## 5.7 Quests: definitions and live progress are separate

```json
{
  "id": "quest.lamp.check_supplies",
  "schemaVersion": 1,
  "titleKey": "quest.lamp.check_supplies.title",
  "visibility": { "flag": "story.lamp.intro_seen", "eq": true },
  "objectives": [
    {
      "id": "collect_milk",
      "kind": "acquire_item",
      "itemId": "item.goat_milk",
      "count": 2,
      "source": "inventory_or_event"
    },
    {
      "id": "return_home",
      "kind": "visit_location",
      "mapId": "map.mar_farm.yard"
    }
  ],
  "onComplete": [
    { "type": "flag.set", "id": "story.lamp.supplies_quest_done", "value": true }
  ]
}
```

- `definition`: immutable quest design in content.
- `progress`: objective counters, states and branches in save data.
- `completion`: idempotent transition with rewards (same quest completion never grants the same reward twice).
- `availability`: evaluated from world/quest/story conditions.
- `journal`: a projection of quest definition plus state, not an independent progress database.

### Quest graph validation

For critical story paths, build a graph of prerequisites and outcomes and verify reachable goals. Flag impossible requirements, missing events, unreachable story nodes and dependencies that form accidental cycles. Dynamic complex quests may need scripted scenario tests; static graph validation alone cannot prove all conditions feasible.

## 5.8 Combat, part targeting, and timed parries

This is a **project-specific competitive advantage** that should survive all refactors.

Recommended decomposition:

```text
combat/
  CombatState        authoritative battle state
  InitiativeSystem   speed order, tie breaking, queue rules
  TurnSystem         allowed actions and turn consumption
  TargetSystem       enemy and sub-part legal target selection
  DamageSystem       mathematical resolution and modifiers
  StatusSystem       durations, stacking, removal
  ParrySystem        input windows, outcomes and timing policy
  RewardSystem       item/salvage/currency grants
  CombatPresenter    animations/sounds/UI integration outside core
```

Example **enemy part** declaration:

```json
{
  "id": "enemy.stray",
  "displayNameKey": "enemy.stray.name",
  "baseStats": { "hp": 80, "speed": 7, "defense": 3 },
  "parts": [
    {
      "id": "enemy.stray.head",
      "displayNameKey": "enemy.part.head",
      "targetable": true,
      "hpPool": "shared",
      "damageMultiplier": 1.1,
      "onBreak": []
    },
    {
      "id": "enemy.stray.left_arm",
      "displayNameKey": "enemy.part.left_arm",
      "targetable": true,
      "hpPool": "shared",
      "damageMultiplier": 1.0,
      "onBreak": []
    }
  ]
}
```

**Illustrative only:** Do not assume the current enemies have separate HP pools, break states, these exact body parts, XP, or any specific damage multipliers. Extract actual rules before establishing the schema.

### Determinism and reproducibility

- Use an injected seeded random number generator for procedural rolls where useful.
- Separate **simulated battle time** from render frame time.
- Timed parry windows depend on a stable clock/input event timestamp policy; benchmark touch latency on real phones.
- Establish invariant tests: legal target IDs only, predictable ties, no negative inventory, no multi-award of rewards, no dead actor turns, no destroyed-part targeting unless explicitly allowed.
- Save a battle action log in development to reproduce rare problems. It need not ship to players.
- Preserve current battle feel through video/screenshot tests plus deterministic mechanics tests.

## 5.9 Items, economy, shops and balancing — with feature restraint

For any economic systems that **actually exist**, separate:

```text
item definitions    fixed item properties and use effects
currency rules     type, units, icon, denominations, restrictions
loot sources       drops/salvage and quantity probabilities
shop definitions   stocked item IDs, conditional availability, price logic
transactions       atomic add/remove item and money operations
balance tables     editable CSV calculations and lookup tables
```

Illustrative CSV rows:

```csv
id,hp,speed,defense,lootTableId
enemy.stray,80,7,3,loot.stray
enemy.coyote,50,12,2,loot.coyote
```

Numeric values above are placeholders. If the existing economy treats **water as a shared survival resource** or uses in-world **tins of zinc paste (“white”)** rather than generic gold, **do not rename the game-world economy to `gold`** merely to mimic genre conventions. Instead implement types that reflect the authoritative current project design, once verified against the source. Likewise, salvage is not necessarily coin, and an inventory entry does not imply a functioning shop or crafting system.

**Balance table philosophy:**

- CSV is authoritative for flat numeric rows; build output is machine JSON.
- IDs are immutable and referenced by key.
- Content compiler checks each value's type, range, probability summation and valid references.
- Use unit-aware headers when helpful (`cooldownMs`, `durationTurns`, `weightKg`).
- Avoid two competing copies of the same stats in event files and global databases.
- Every item acquisition has a named source, useful for balance audits.

## 5.10 Save format: durable and explicitly versioned

```json
{
  "schemaVersion": 3,
  "gameVersion": "0.4.0",
  "slotId": "slot-01",
  "timestampUtc": "2026-10-10T12:00:00Z",
  "player": {
    "mapId": "map.mar_farm.yard",
    "spawnId": "south_gate",
    "position": { "x": 8.5, "y": 0, "z": 4.25 }
  },
  "story": {
    "chapterId": "chapter.lamp",
    "flags": { "story.lamp.intro_seen": true },
    "completedEvents": ["event.lamp.intro"]
  },
  "quests": {},
  "inventory": {},
  "world": { "timeOfDay": 14.5 },
  "combat": null
}
```

- **schemaVersion** means how to decode structure; **gameVersion** records the producing release and is not a replacement for migrations.
- Validate imported and stored saves with the schema, including the entire nested object and ID references.
- Migrate `v1 -> v2 -> v3` via pure migration functions with preserved fixtures.
- Use safe defaulting for *new optional fields* without turning invalid fields into silent data loss.
- Decide whether saved contents are snapshots (e.g., item ownership and world state) or references to current authored definitions (e.g., item name/stat). Do not duplicate every static definition in save files.
- On load, test whether the map/region IDs remain resolvable; use documented aliases/redirects for renamed IDs.
- Save writing is atomic at the application level: stage/validate/write, retain last known good copy where feasible; browser APIs have different guarantees than a native filesystem.
- Expose **Export Save** and **Import Save** for user-controlled recovery. Browser storage may be deleted or evicted. [S36]
- Separate profile-wide preferences from campaign save slots.
- Restrict save points during complex non-resumable cutscenes unless the engine can restore them correctly.

### Migration example

```ts
// Illustrative. Adapt exact fields to verified repository data.
function migrateV2ToV3(oldSave: SaveV2): SaveV3 {
  return {
    ...oldSave,
    schemaVersion: 3,
    story: {
      chapterId: oldSave.chapter ?? "chapter.lamp",
      flags: oldSave.flags ?? {},
      completedEvents: oldSave.completedEvents ?? []
    }
  };
}
```

**Never modify raw player saves in place without a recoverable copy.** Keep pre-migration fixtures and test with realistic saves from different progression points, not just a fresh-game template.

---
# 6. REUSE EXISTING TOOLS AND FORMATS — AN AI-EDITABILITY CATALOG

**Scoring:** `A` text source, excellent for terminal agent; `B` text output but visual authoring or generated structure is often useful; `C` binary or primarily editor-dependent. **AI-editability is not art-design quality.** An agent being able to modify tiled JSON is not proof that it has created a readable, beautifully composed map.

| Need | Tool / format | Cost/license notes | Source-edit rating | Adopt now? |
|---|---|---|---|---|
| Renderer | Existing Three.js JS/TS | MIT, free | **A** | **Yes, retain** |
| Development/build | Vite + npm scripts | MIT, free | **A** | After audit |
| Maps | Existing map JSON | Already part of project | **A** | **Preserve** |
| Maps option | Tiled JSON map + TSX/JSON tilesets | Free/open source | **A/B** | One-map pilot |
| Maps option | LDtk `.ldtk` and split `.ldtkl` | Free, permissive | **A/B** | Compare if needed |
| Dialogue | Existing JSON | Already part of project | **A** | **Preserve** |
| Branching dialogue | Ink `.ink` -> compiled JSON / inkjs | Open source, no paid editor required | **A** | One-dialogue pilot |
| Dialogue alternative | Yarn Spinner `.yarn` | Open-source ecosystem; check package compatibility | **A** | Defer |
| Pixel art | Aseprite source + CLI output | Paid app; compatible CLI possible | **C** source, **A** exports | Optional |
| Sprite metadata | PNG atlas + JSON frames | Already present | **A** metadata | **Keep** |
| Balancing | CSV -> JSON build | Free editors | **A** | **Yes** |
| Complex data | JSON + JSON Schema | Free | **A** | **Yes** |
| Validation | Ajv JSON Schema validation | Open source | **A** | **Yes** |
| Unit tests | Vitest | Free/open source | **A** | **Yes** |
| Browser testing | Playwright | Free/open source | **A** | **Yes** |
| Game-state machines | XState or small typed reducer | Open source | **A** | Only if complexity warrants |
| Audio abstraction | Howler.js | MIT, free | **A** | Optional, preserve synth SFX |
| Browser persistence | IndexedDB (+ optional Dexie) | Web platform / open source | **A** | **Yes** for durable saves |
| Asset pipelines | CLI scripts, Aseprite exporter, image optimizers | Tool-specific | **A/B** | As needed |
| CI | GitHub Actions | Usage-based limits/pricing may apply | **A** YAML | **Yes** |

## 6.1 Maps: Tiled

**Evidence:** Tiled officially documents a JSON map format with layers, tile grids, orientation, tilesets, objects and custom typed properties; its CLI can export maps. [S12]

**Why relevant:** The Long Noon needs authorable traversal/collision and map markers. JSON is natural for Claude Code and the game's JS runtime. Tiled supports orthogonal and isometric layouts and works well for 2D spatial annotation, even if the actual visible scene is 3D.

**What it does not do:** It is not a drop-in full 3D level composer. Separate descriptions of mesh elevation, occlusion, weather, camera setups, 3D materials and light sources from Tiled's 2D spatial authoring data. A tile grid may be only an abstract navigational/collision layer while Three.js renders full geometry.

**Recommended pilot:**

1. Select **one** small existing map and export its current traversable/collision/trigger data into a Tiled JSON source.
2. Build a **one-way importer** that maps Tiled layers/objects to existing runtime records. Do not discard the old map.
3. Confirm world-coordinate conversion, object IDs, layer heights, interactive triggers, mobile collision behavior and screenshots.
4. Measure merge-diff size and map-edit practicality. If worse than current source, reject Tiled.
5. Preserve source map file and deterministic generated runtime JSON; do not hand-edit generated output.

**AI rating:** A for named JSON objects; B for huge numeric tile arrays and visual spatial composition.

## 6.2 Maps alternative: LDtk

**Evidence:** LDtk documents JSON data and the option to store each level in a separate `.ldtkl` JSON file. [S37]

**Pros:** Well-defined entity definitions, grid layers, world organization, separation by level, user-friendly 2D workflows.

**Cons:** Also a 2D editor; still needs a Three.js scene adapter. Its JSON format can be verbose, and the main `.ldtk` project may contain schema/definition changes that affect many levels.

**Decision rule:** Compare the same sample map in Tiled and LDtk. Choose the tool that makes *owner edits + machine validations + clean diffs* easiest. **Do not adopt both** as competing authoritative map formats.

## 6.3 Dialogue: Ink + inkjs

**Evidence:** Ink is an open-source narrative language with an official command-line compiler `inklecate`; `inkjs` runs compiled stories in JavaScript/browser and exposes its own compiler tools. [S13][S38]

**Illustrative Ink source:**

```ink
=== arrival ===
Kit looks up from the gate.
* [Ask about the road]
    The eastern path isn't safe yet.
    -> END
* [Say nothing]
    Kit waits, then turns away.
    -> END
```

**Strengths:** Natural narrative authoring, branching, rerouting, tags, conditions, testable compilation, text diffs.

**Integration risks:**

- Ink's story state is separate from the game save unless explicitly serialized/mapped.
- Narrative tags/commands need an adapter and validation.
- A standalone dialogue runtime does not control world movement, camera and battle; do not expect it to replace event scripts.
- Version compatibility between Ink compilers and `inkjs` runtime must be pinned and tested.
- Localization extraction is a separate, deliberate design task.

**Pilot acceptance:** Convert a branching conversation, preserve its exact displayed text and outcomes, save in the middle of a conversation if supported, and test reload/flag changes. If this adds more complexity than it eliminates, keep JSON.

## 6.4 Dialogue alternative: Yarn Spinner

Its `.yarn` scripts and editor integrations are suitable for readable branching stories. Its ecosystem emphasizes integrations with established game engines. Verify the current JavaScript runtime/integration story before assuming the same low-friction web workflow as inkjs. Treat Yarn as an alternative to Ink, **not** an additional simultaneous script format.

## 6.5 Sprites: Aseprite and automated atlases

**Evidence:** Aseprite supports PNG sprite sheets, JSON metadata and CLI export. [S39]

**Pipeline:**

```text
editable .aseprite (binary source)
      |
      v
version-pinned CLI export
      |
      +----> atlas.png
      +----> atlas.json (named frames, pivots, dimensions, tags)
      |
      v
engine sprite adapter
```

**Agent limitation:** Aseprite originals are not meaningful line-editable text. Agents should read exported JSON, inspect the PNG as visual data, and only automate exports or create new assets using appropriate tools. Avoid corrupting original binary sprite projects with scripted text edits.

**Quality safeguards:** Explicit alpha modes, nearest-neighbor filtering where desired, padding to prevent atlas bleeding, frame/pivot verification, directional animation consistency and preserved reference screenshots.

## 6.6 Tables and content compilation

Use CSV for flat balance values with a script that:

1. Parses with type-aware column definitions.
2. Validates duplicates, missing required columns, invalid probabilities, out-of-range numbers.
3. Resolves every foreign ID into known records.
4. Sorts deterministically and outputs normalized runtime JSON.
5. Compares/generates balance reports (stat curves, item pricing changes, reward distribution) for review.

**Single-authority rule:** If `enemies.csv` is authoritative, do not allow humans and agents to also edit `generated/enemies.json` and hand-written `enemies.ts` arrays for the same data. Keep one source of truth.

### Spreadsheet recommendation for a nonprogrammer

A normal spreadsheet application is useful **as an editor**, not as a required live service. Keep the CSV in Git. Preserve text IDs as text to avoid accidental numeric/date conversions. Export via a controlled procedure. If using shared Google Sheets, make the export reproducible; do not silently pull mutable remote spreadsheet values during every production build without pinning a revision.

## 6.7 State machines, event buses and audio

**State machines:** Combat flow (`select action -> select target -> animation/parry -> resolve -> next turn`) and cutscenes benefit from explicit states/transitions. A small TypeScript discriminated-union state machine may be enough; XState only if it reduces rather than increases complexity.

**Event bus:** Useful for domain signals (`item.acquired`, `enemy.defeated`, `region.entered`, `time.changed`), but ensure there is one authoritative state writer and predictable ordering. Avoid invisible chains of mutable callbacks that make saves and replay nondeterministic.

**Audio:** Retain existing MP3 playback and synthesized sound effects. Howler.js could simplify music/SFX loading/fades/cross-browser support if evidence shows a maintenance issue. Never replace synthesis with prerecorded audio by default.

**Localization:** Prefer stable string IDs and a light runtime translator. Adopt ICU MessageFormat only if actual pluralization/gender/complex grammar demands it and the target browser bundle budget permits.

## 6.8 Automated browser playtesting

**Evidence:** Playwright supports browser automation, screenshots, touch simulation and mobile viewport/user-agent emulation. Emulation is **not** a substitute for native phone GPU profiling. [S40]

**Required debug hooks (only in development builds):**

- deterministic test-seed injection;
- safe fixture-save loading;
- ability to start in a selected region/chapter;
- explicit test-facing state snapshot (chapter, flags, inventory, active battle, event ID);
- a simple diagnostic log; no cheating APIs in production;
- optional test-only time controls for reproducible parry behavior.

Example test cases:

```text
Launch -> load initial state -> interact with NPC -> dialogue appears
Choose option B -> expected flag set -> changed line appears
Walk through transition -> correct region/spawn loads
Enter battle -> legal target parts -> take turn -> timed parry response
Win battle -> reward committed once -> save -> reload -> reward unchanged
Load v1 save -> migrate -> join at correct map -> intact flags and inventory
```

For visual regression, capture approved scenes at fixed camera settings and deterministic world time, with controlled GPU/browser rendering where possible. Avoid pixel-perfect CI tests for nondeterministic effects without masks/tolerances.

---

# 7. WEB, MOBILE AND HD-2D PERFORMANCE STRATEGY

## 7.1 Two distinct release artifacts

A **one-file demo** is excellent for quick sharing; a **full RPG** should prefer a website with chunked JavaScript plus region/asset bundles. Keep these as separate build targets generated from shared source. Vite provides an appropriate browser build/development pipeline, but verify any one-file inlining plugin for compatibility and output size. [S41]

```text
source code + authored content
           |
         build
           |
      +----+-------------------+
      |                        |
standalone demo           full web build
self-contained HTML       HTML + JS/CSS + regional assets
small content subset      hashed/versioned chunks
convenient sharing        lazy loading / caching
```

**Do not promise a 20–40-hour game compressed into one HTML file**. You *can* bundle its code and content but that may create unreasonable download size and mobile memory use. The source should never be one enormous HTML file again just to preserve the old sharing workflow.

**Browser file protocol warning:** `fetch()` of sibling JSON over `file://` is restricted/inconsistent. Standalone HTML must inline relevant content or load from a correctly hosted origin. A production multi-file web game should use HTTP(S).

## 7.2 HD-2D rendering pipeline — concrete proposals

1. **Pixel-art sprites:** world-space quads/planes or billboard components; defined pivot/foot anchor; nearest-neighbor sampling when necessary; stable animation frame metadata; intentional screen-space pixel density.
2. **3D environment:** low/medium geometry complexity, textured materials and chosen camera projection; procedural or baked geometry where useful.
3. **Layering/occlusion:** clear rules for roofs, transparent props, tall walls, overhangs, shadows, and foreground obstruction.
4. **Day/night:** a game clock drives environment presets (key light direction/color/intensity, ambient, fog, emissive accents, sky/background, music changes). Avoid excessive real-time recompilation or creating/destroying lights every tick.
5. **Lighting:** keep a fixed budget for shadow-casting lights per quality tier. Consider baked lightmaps or cheap fake local shadows where real-time shadows are expensive.
6. **Bloom:** limit bright highlights to purposeful elements; provide strength/quality switches.
7. **DOF/tilt shift:** do not blur text, controls or the plane on which interactive characters move. Consider reduced resolution passes, static-distance focus presets, or disabling on low-end phones.
8. **Color management:** preserve author-approved hue and contrast across Three.js upgrades. Modern Three.js rendering changes may alter appearance even when code compiles. [S15]
9. **UI/accessibility:** render crisp dialogue/menu text separately from world DOF/bloom; responsive touch hit targets; option to reduce camera effects and flashes.

**Evidence:** Three.js documents bloom and Bokeh depth-of-field passes. The Octopath interview details point lights added to battle VFX; Sabotage describes its custom dynamically lit 2D render pipeline. [S05][S06][S07][S32]

## 7.3 Phone quality tiers (design targets, not benchmark claims)

| Feature | Low mobile | Mid mobile | Desktop/high |
|---|---|---|---|
| Render resolution scale | 0.65–0.8 sample start | 0.8–1.0 sample start | 1.0 (cap by memory) |
| DOF | Disabled or simplified | Limited | Full where appropriate |
| Bloom | Off or cheap | Reduced resolution | Configurable full |
| Dynamic shadows | Sparse or baked | Limited | Higher budget |
| Particles | Low | Medium | Higher |
| Texture budget | Strict | Moderate | Larger |
| FPS goal | Stable 30 initial target | Stable 30–60 | Stable 60 where possible |

These are **candidate settings to tune by measurement**, not performance predictions. A phone can have a very high screen DPR, multiplying fragment cost; cap devicePixelRatio/render resolution. Measure CPU frame time, GPU timing when available, graphics memory approximations, and main-thread stalls during region transitions.

## 7.4 Mobile test matrix

At minimum:

- A real **iPhone Safari**, including touch interactions, audio gesture requirements and app background/foreground recovery.
- A real **Android Chrome** phone of modest capability.
- Desktop Chrome/Edge and at least one of desktop Firefox/Safari.
- Portrait/landscape orientation policy, resizing, virtual keyboard behavior if any, safe-area insets, long-session memory growth, device sleep/restore and audio focus.
- Slow network + cold cache + returning player cached assets.

Be particularly cautious with save recovery when a tab is suspended or killed. **Player progress must not depend on `beforeunload` firing.** Save at explicit safe moments and meaningful checkpoints.

## 7.5 Cross-platform wrapping later

- **Desktop/Steam:** Electron is straightforward for an existing web app and is related in spirit to CrossCode's desktop distribution; it increases application size. Tauri may be leaner but adds native packaging/dependency considerations.
- **Mobile store app:** Capacitor/WebView can wrap web code; confirm graphics, audio latency, input, storage and store rules on physical devices.
- **Never let wrappers dictate domain state code:** Browser remains the canonical platform target. Platform-specific adapters own storage/window/runtime differences.

---

# 8. TESTING AND CONTENT INTEGRITY

## 8.1 Required automated validation categories

| Category | Example failure a good validator catches |
|---|---|
| JSON schema | Encounter lacks required `enemies` array |
| IDs | Duplicate `npc.kit` or retired ID reused |
| References | Quest points to nonexistent `item.goat_milk` |
| Dialogue graph | Choice targets node that doesn't exist |
| Event commands | Unknown action `camera.teleprot` |
| Quest graph | Required objective depends on unreachable event |
| Map topology | Transition destination/spawn is missing |
| Currency/economy | Negative stock/price, invalid probability total |
| Enemy part models | Attack references a nonexistent part or illegal target |
| Locale completeness | Missing required English text ID |
| Save migrations | Old save cannot load into latest schema |
| Asset paths | Missing atlas frame, sound key or texture |
| Region manifest | Cyclic preload chain or unknown scene |

Validation should output **filename, record ID, field path, expected type, actual value, and a clear fix**. A long vague stack trace is not suitable for nonprogrammer editing.

### Suggested scripts (names are an API contract to implement incrementally)

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "validate:content": "node scripts/validate/index.mjs",
    "test:unit": "vitest run",
    "test:browser": "playwright test",
    "build": "vite build",
    "check": "npm run typecheck && npm run validate:content && npm run test:unit && npm run build"
  }
}
```

**This is a proposed package script plan.** If source is still JavaScript, initially run `tsc` with `allowJs/checkJs` carefully or defer typecheck until the toolchain is configured. The example assumes commands exist; do not paste it into `package.json` unchanged before implementing them.

## 8.2 Narrative regression tests

Build scenario fixtures from representative story states:

1. Fresh beginning of demo.
2. Mid-chapter before choice.
3. After choosing each meaningful branch.
4. Before/after a scripted battle.
5. After a region revisit or change in NPC dialogue.
6. At a chapter boundary.
7. After save/reload.
8. With optional quest completed *before* main objective.
9. With optional quest skipped entirely.
10. With a legacy save from an earlier schema.

**Useful graph reports:** quest dependency DAG, unreachable dialogue nodes, events never triggered by any reference, inventory sources/sinks, all currency changes, and map transition graph. Graph reports are diagnostics, not a proof that a story is good or fun.

## 8.3 Battle regression tests

- Turn order with equal speeds and buffs/debuffs.
- Target selection when a part is destroyed, disabled or temporarily unavailable.
- Parry boundary at earliest/latest frame and near-threshold touch timestamp.
- Knockout/death rules during multi-hit attacks.
- Damage rounding, resistances and defense math.
- Repeated rewards after reentering or reloading a scene.
- Victory/defeat interruption and event unlocks.
- No stray renderer import into pure combat math.

## 8.4 Save migration matrix

| Save created with | Expected current load behavior |
|---|---|
| Current schema | Exact load and resave |
| Previous schema | Auto-upgrade with verified parity |
| Several versions old | Sequential migration with preserved meanings |
| Unknown future schema | Refuse safely; do not corrupt data |
| Missing optional data | Restore documented default if safe |
| Missing required region ID | Explicit error or reviewed fallback redirect |
| Corrupted JSON | Report issue and offer last-known-good backup |
| Imported save with unexpected fields | Validate and ignore/reject only under documented policy |

## 8.5 AI code review quality bar

Every nontrivial agent change should include:

- Before/after description of behavior.
- Exact files changed and why.
- New/updated tests; explanation if tests cannot cover a visual change.
- Confirmation that existing demo parity was checked.
- Any newly created data IDs, schema fields or migrations.
- Screenshots for rendering/UI/map changes.
- A concise list of unresolved issues and next steps.

In CI, `npm run check` should run on pull requests. A slower browser smoke suite should run on pull requests or at least release branches; mobile device testing occurs on the release checklist.

---

# 9. TOP FIVE ORGANIZATIONAL MISTAKES — PREVENTION PLAN

## Mistake 1 — Treating one HTML file as the source architecture

**Symptom:** Every feature edits one massive script, changes are hard to review, hidden global coupling increases, and AI agents rewrite unrelated sections by accident.

**Prevention:** The HTML file becomes a generated distribution artifact, not the place where new features are implemented. Extract modules incrementally, retain a proven baseline, and use an explicit dependency direction. Establish source-map debug support.

**Warning sign:** A small dialogue adjustment changes rendering or battle code.

## Mistake 2 — Mixing content, display logic and gameplay rules

**Symptom:** Quest narrative text contains game logic, enemies carry bespoke damage functions, maps embed entire cutscenes, and UI widgets mutate progression directly.

**Prevention:** Reusable interpreters consume validated data. Every feature has a clear authoring definition and runtime responsibility. Use condition IDs and event commands, not arbitrary executable snippets in JSON.

**Warning sign:** Adding an NPC requires editing `src/combat`, `src/renderer` and a global event switch statement.

## Mistake 3 — Unstable IDs, uncontrolled flags and duplicated world geometry

**Symptom:** An old save breaks when a map/quest is renamed; region copies drift apart; dialogue choices refer to deleted IDs; a flag has three inconsistent spellings.

**Prevention:** Create registries, stable string IDs, aliases/migrations, schema checks, graph/reference validation, and reusable map/scene variants.

**Warning sign:** The same world fact appears in multiple globals, save fields and quest-specific booleans.

## Mistake 4 — Designing the save format only after story systems are mature

**Symptom:** Updates reset hours of progress, new chapter flags accidentally override prior player choices, event rewards duplicate after reload, and browsers lose saves with no recovery.

**Prevention:** Define a narrow save DTO with schemaVersion, migration functions and test fixtures. Support export/import and robust auto-save checkpoints early.

**Warning sign:** The save function simply serializes the entire in-memory engine object.

## Mistake 5 — Producing more content than the test infrastructure can handle

**Symptom:** Chapter 4 works only from one route; returning to a town duplicates triggers; optional quests block the main plot; mobile breaks when a certain NPC scene loads.

**Prevention:** Formal content contracts, critical-path playthrough fixtures, branch coverage, map/quest reachability reports, deterministic battle tests, and real-browser/mobile QA. No feature is done merely because it compiles.

**Warning sign:** Every update requires manually replaying a multi-hour campaign to gain confidence.

### Additional recurrent risks

- **Premature generalized framework building:** Spending months on a generic editor instead of shipping chapter content. Create only tools needed by the next production slice.
- **Tool proliferation:** Tiled + LDtk + two dialogue languages + three JSON variants at once. Pilot and choose one authoritative source per content type.
- **AI-generated architectural drift:** Multiple agents invent similar utilities, ID conventions and action types. Use `AGENTS.md`, documented ownership, schemas, tests and design decision records.
- **Blind dependency upgrades:** Render subtle color/lighting differences after a library upgrade. Pin versions and use visual baselines.
- **Unbounded visual ambition:** Layering expensive post effects until the mobile browser overheats. Set quality budgets and profile physical devices.

---

# 10. EXECUTION ROADMAP FOR CLAUDE CODE

The priority is **protect -> audit -> isolate -> validate -> improve authoring -> scale content**. Do not ship an enormous unreviewable refactor PR.

## Phase 0 — Source audit / no functional change

**Objective:** Document the existing game as it actually is.

Agent tasks:

1. Record current branch/commit, dependency versions, file tree and build/launch process.
2. Identify HTML entrypoint, shader/render loops, asset preloading, audio synth functions, touch handling, collision, quest storage, dialogue interpreters, combat modules and save behavior.
3. Enumerate all content JSON categories, their actual schemas, IDs, references and duplication.
4. Trace 3–5 representative flows: boot -> map -> NPC -> dialogue -> quest state; battle start -> initiative -> target-part attack -> parry -> victory -> reward; save -> reload.
5. Determine whether the current “single HTML” is generated or genuinely the authoritative source.
6. Create representative reference screenshots (day/night, exploration, dialogue, battle, mobile).
7. Inventory what works, what is stubbed, and what the research proposal conflicts with.
8. Produce `docs/architecture/current-state.md` and a **proposed change plan** ranked by risk.

**Deliverable:** Audit report and an implementation plan, **not** a rewrite.

**Acceptance:** Owner can review exact existing mechanic behavior and understand what will be preserved.

## Phase 1 — Preserve build and extract modules

**Objective:** Make source navigable without changing the runtime.

1. Create a stable branch/tag/archive of the original demo.
2. Introduce controlled dependencies and development server/bundler (Vite is proposed).
3. Start with one low-risk module extraction, such as audio utility or content loader.
4. Compare screenshots, dialogue, touch, audio and parry behavior before/after.
5. Extract the highest-cohesion subsystems in a conservative order; avoid coupling new abstractions to global state.
6. Introduce `src/` only where it helps, documenting actual code boundaries.
7. Preserve a standalone demo export through an optional generated build target if practicable.

**Acceptance:** Demonstrable gameplay parity, clean build from clone and no unexpected functional differences.

## Phase 2 — Content schemas and stable state

**Objective:** Make story data safe for humans and AI agents to edit.

1. Formalize existing JSON before inventing a new generalized syntax.
2. Add schemas for one map, dialogue type, quest and battle definition.
3. Build reference validation and clear filename/path diagnostics.
4. Extract a registry of saved flags/variables with correct scopes and defaults.
5. Define stable content IDs, aliases and owner-friendly formatting conventions.
6. Create small CLI commands to list, search and explain content IDs.
7. Define event script execution/skip semantics and explicit reward transactions where gaps exist.

**Acceptance:** A human can edit an item value, NPC line or quest condition and immediately learn if it is invalid via `npm run validate:content`.

## Phase 3 — Save durability and automated test harness

1. Establish `schemaVersion`, explicit save DTO and test fixtures.
2. Add an export/import save workflow and robust browser storage policy.
3. Add unit tests for battle invariants and state conditions.
4. Add at least one Playwright whole-demo smoke path and one mobile viewport smoke path.
5. Add deterministic test-state injection behind a development-only guard.
6. Configure CI checks on GitHub pull requests.

**Acceptance:** Reproducible CLI tests and a backward-compatible current-demo save/load path.

## Phase 4 — Authoring tool pilots

Run **independent** experiments:

- **Map pilot:** existing JSON versus Tiled/LDtk export on one tiny scene.
- **Dialogue pilot:** existing JSON versus Ink on one branch-heavy conversation.
- **Balance pilot:** CSV -> validated JSON on one existing stat table.
- **Atlas pilot:** automated sprite export if current manual steps are error-prone.

Measure usefulness, source readability, diffs, rebuild time and preservation of gameplay. Adopt only demonstrated improvements.

## Phase 5 — Full vertical-slice stress test

Create a **representative, deliberately limited** second slice, not dozens of new chapters:

- Two connected regions; one revisited with altered world state.
- Multiple NPCs whose dialogue changes with quest progress.
- One meaningful branching quest with mutually exclusive options if narratively appropriate.
- Several encounters exercising speed order, target parts and parry timing.
- A scripted scene with movement, camera, music and conditional dialogue.
- Save/load before and after a chapter transition.
- A mobile quality preset and performance measurements.

**Acceptance:** The data-driven pipeline can expand a real playable story without new bespoke code for every dialogue, map and enemy.

## Phase 6 — Scale the full 20–40-hour content production

- Establish chapter content budgets and production milestones.
- Divide authorship by **regions, chapters and reusable systems**, not by uncontrolled forks of global engine files.
- Track all active/referenced flags, currencies, quest IDs, map IDs and enemy records.
- Require content validation and scenario tests for each merged chapter.
- Add localization only when the English source and string ID pipeline are stable.
- Periodically playtest the whole campaign for pacing, not just mechanical correctness.
- Rebenchmark the game on real phones as maps/assets expand.

## Phase 7 — Rendering upgrade or platform packaging

Only after stabilization, evaluate staged Three.js version upgrades and desktop/mobile packaging. Keep each effort in separate commits/PRs with visual regression and rollback.

---

# 11. INSTRUCTIONS FOR MULTIPLE AI CODING AGENTS

## 11.1 Proposed `AGENTS.md` policy

```markdown
# Coding Agent Rules — The Long Noon

1. Preserve the working game. Do not replace features just to simplify code.
2. Treat `docs/architecture/current-state.md` as the verified current architecture.
3. Treat research documents as recommendations, not as a description of implemented APIs.
4. Separate authored content from reusable runtime code.
5. Prefer stable IDs and explicit interfaces. Avoid new global state.
6. Never rename a persistent ID without an alias/migration and tests.
7. Never hand-edit generated runtime content when source authoring data exists.
8. Never invent currencies, experience, shops or crafting requirements.
9. Keep browser/mobile support and current accessibility/input behavior.
10. Run the relevant tests before and after changing behavior.
11. Screenshot/render-check maps and UI; unit tests alone are not enough.
12. Small, reviewable PRs. Explain changes, tests and remaining risks.
13. Upgrades of Three.js or major dependencies require separate review.
14. Do not add a major library unless a documented problem and pilot justify it.
15. When uncertain, inspect files and record assumptions rather than inventing APIs.
```

## 11.2 Suggested agent division of responsibilities

| Role | Permitted typical work | Must coordinate on |
|---|---|---|
| Architecture agent | module boundaries, build, docs, contracts | cross-system changes, migration |
| Content tooling agent | schemas, manifest, validators, reports | canonical content formats |
| Narrative agent | dialogue, event scripts, quest JSON | stable state/ID changes |
| Combat agent | initiative, targeting, parry tests and balance | save/data effects and UI |
| Rendering agent | Three.js scene, HD-2D, camera/light/passes | asset formats, mobile budgets |
| QA/release agent | fixture generation, browser tests, CI | expected behavior, artifact formats |

**Rule for parallelism:** Concurrent agents can work on independent folders, but central ID registries, `package.json`, base interfaces and save schemas require an owner/review process. Conflicting agent changes in those files should be serialized or reconciled deliberately.

## 11.3 Default task-request template for coding agents

```text
TASK:
DESIRED USER-VISIBLE BEHAVIOR:
EXISTING BEHAVIOR TO PRESERVE:
FILES / MODULES EXPECTED:
NEW OR MODIFIED CONTENT IDS:
DATA SCHEMAS INVOLVED:
SAVE COMPATIBILITY EFFECT:
WEB / MOBILE / VISUAL EFFECT:
ACCEPTANCE TESTS:
SCREENSHOT OR VIDEO COMPARISON:
ROLLBACK PLAN:
OPEN QUESTIONS THAT REQUIRE DESIGNER APPROVAL:
```

Do not turn every small dialogue edit into a large ceremony. The template is chiefly for new systems and schema changes.

## 11.4 Suggested first instruction to give Claude Code

> Read `The_Long_Noon_Engineering_Research_and_Architecture_Brief.md`, then audit the current repository without changing its behavior. Produce `docs/architecture/current-state.md`, including the real file tree, build path, currently implemented battle/quest/dialogue/save systems, content IDs, global dependencies, actual engine version, how the standalone HTML is created, browser/mobile limitations and major regression risks. Compare the current repo to the recommendations in this research brief. Separate “already implemented,” “missing but important,” “optional future enhancement,” and “not appropriate” for each recommendation. Propose at most three small initial PRs that preserve the playable demo. Do not switch engines, upgrade Three.js, invent new gameplay systems, or rename saved IDs without explicit approval.

---

# 12. OPEN TECHNICAL DECISIONS / OPTIONS FOR THE OWNER

These are **choices** rather than secret assumptions for an agent to resolve without discussion.

| Decision | Recommended default | Alternative / deciding test |
|---|---|---|
| Remain on Three.js? | Yes | Only change with measured limitation and spike |
| Upgrade from r128 now? | Not during extraction | Incremental separately after parity harness |
| TypeScript all at once? | No; incremental | Faster conversion if source already modular |
| Tiled or current JSON? | Current JSON first; Tiled one-map pilot | Adopt Tiled if authoring is demonstrably easier |
| LDtk? | One comparison, no simultaneous formats | Choose if levels/entities flow much better |
| Ink or JSON dialogue? | Existing JSON unless branching pain is evident | Adopt Ink after one full test |
| How much main story in content versus code? | Declarative events and flags | Reviewed custom steps for uncommon cinematic needs |
| Quest system overhaul? | Inspect existing code first | Only replace deficient parts |
| Save during mid-cutscene? | Save at safe checkpoints first | Add resumability if player experience requires it |
| Backend/cloud saves? | Not required for first web release | Optional future account sync, never a prerequisite |
| Multiplayer? | Out of scope | Separate architecture RFC if introduced |
| Native launch? | Browser first | Packaging spike after demo stabilization |
| Economy/leveling expansion? | Preserve existing mechanics | Explicit game-design decision, not tech refactor |
| Procedural generation? | Not needed by default | Adopt selectively if world design benefits |

---

# 13. SOURCE BIBLIOGRAPHY AND EVIDENCE TRAIL

**How to use this section:** `[Sxx]` citations in the document point to these publicly reachable sources. URLs are included so the coding agent can inspect them directly. Documentation and pricing can change; recheck those details at implementation time. Commercial modding notes establish **shipped assets**, not the original development repository.

### Core case studies

- **[S01]** Radical Fish Games, *Architecture of CrossCode #1 – Overview* (developer): https://www.radicalfishgames.com/?p=277 — **DEV**; modular features, `data/`, async JSON maps, separation of data from code.
- **[S02]** Babylon.js, official documentation home: https://doc.babylonjs.com/ — **official docs**; general-purpose engine capabilities, API reference.
- **[S03]** Three.js, official documentation: https://threejs.org/docs/ — **official docs**; scope of rendering library and APIs.
- **[S04]** CrossCode developer Lach(sen), Steam developer response on HTML5/ImpactJS architecture (2017): https://steamcommunity.com/app/368340/discussions/0/1291817208507901095/ — **DEV**; game implemented in HTML5/JS; historical rendering specifics.
- **[S05]** Epic/Unreal Engine, *Octopath Traveler’s “HD-2D” art style and story...* (2019): https://www.unrealengine.com/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true — **DEV interview**; point lights, shadows, art pipeline and team structure.
- **[S06]** Three.js `UnrealBloomPass`: https://threejs.org/docs/pages/UnrealBloomPass.html — **official docs**; modern API; verify against r128 separately.
- **[S07]** Three.js `BokehPass`: https://threejs.org/docs/pages/BokehPass.html — **official docs**; modern DOF API; verify against r128 separately.
- **[S08]** Octopath Traveler II Nexus modding article on EnemyDB and Unreal packages: https://www.nexusmods.com/octopathtraveler2/articles/2 — **MOD**; cooked EnemyDB paths/drop data.
- **[S09]** Dragon Quest XI S Nexus, `DT_ItemTable` and CSV tool: https://www.nexusmods.com/dragonquestxisdefinitiveedition/articles/14 — **MOD**; structured item data.
- **[S10]** FFVI reverse-engineering project, event interpreter README: https://github.com/everything8215/ff6/blob/main/src/event/README.md — **RE**; command-based event system; original source caveat.
- **[S11]** Stardew Valley Wiki, Modding: Event data: https://stardewvalleywiki.com/Modding:Event_data — **documented game/modding API**; event IDs, conditions and commands.
- **[S23]** CrossCode mod loader installation, distributed `assets/data`, `js`, `media`: https://github.com/CCDirectLink/ccloader-installer — **MOD**.
- **[S24]** CrossCode map editor: https://github.com/CCDirectLink/crosscode-map-editor — **MOD**; JSON maps, entity editing.
- **[S25]** CrossCode save file documentation: https://crosscode.fandom.com/wiki/Savegame — **community reverse engineering**; `saveVersion`, `vars`, quests, position.
- **[S26]** Triangle Strategy Nexus, *Origin* mod contents: https://www.nexusmods.com/trianglestrategy/mods/11?tab=description — **MOD**; exact table and `LuaScriptBin` examples.
- **[S27]** Triangle Strategy Nexus, *LUA LUA LUA LUA LUA* (modding): https://www.nexusmods.com/trianglestrategy/articles/2 — **MOD**; compiled `.lub` script analysis.
- **[S28]** Stardew Valley Wiki, Modding: Dialogue: https://stardewvalleywiki.com/Modding:Dialogue — **documented game/modding API**; NPC and shared string structures.
- **[S29]** UndertaleModTool, documentation and models: https://github.com/UnderminersTeam/UndertaleModTool — **RE**; GameMaker shipped rooms, objects, code and textures.
- **[S30]** Pixpil's own *Dev tools* list for Eastward (2017): https://pixpilgames.tumblr.com/post/162191482022/dev-tools — **DEV**; MOAI, MOCK/Gii, Lua/C++, Aseprite and asset tools.
- **[S31]** Game Developer, *Eastward's creators share insights on making pixel art adventures*: https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures — **DEV interview**; layered art pipeline.
- **[S32]** Sabotage Studio's Sea of Stars official press kit: https://sabotagestudio.com/presskits/sea-of-stars/ — **DEV**; custom dynamic-lighting render pipeline.
- **[S33]** Sabotage developer/Steam FAQ about Sea of Stars engine: https://steamcommunity.com/app/1244090/discussions/0/5913784177847747164/ — **DEV**; Unity base engine (a custom *render* pipeline is not a custom game engine).
- **[S34]** RPGFan, Matthias Linda interview: https://www.rpgfan.com/feature/interview-with-matthias-linda-on-chained-echoes/ — **DEV interview**; RPG Maker roots and project history.
- **[S35]** Matthias Linda AMA (May 2022): https://www.reddit.com/r/JRPG/comments/uj1vut/im_matthias_linda_developer_of_chained_echoes_an/ — **DEV firsthand**; Unity, Photoshop, Aseprite and Tiled.

### Engines and tools

- **[S12]** Tiled, official JSON map format and CLI export: https://doc.mapeditor.org/en/stable/reference/json-map-format/ — **official docs**.
- **[S13]** Ink original project, inklecate and runtime guidance: https://github.com/inkle/ink — **official source**.
- **[S14]** Playwright documentation: https://playwright.dev/docs/intro — **official docs**.
- **[S15]** Three.js migration guide: https://github.com/mrdoob/three.js/wiki/Migration-Guide — **official**; upgrade incrementally; breaking changes.
- **[S16]** Babylon.js GUI docs: https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/gui.md — **official source**; integrated GUI.
- **[S17]** PlayCanvas official standalone engine guide: https://github.com/playcanvas/developer-site/blob/main/docs/user-manual/engine/standalone.md — **official**; no visual editor required, TypeScript/Vite/CLI.
- **[S18]** PlayCanvas standalone MIT engine: https://github.com/playcanvas/engine — **official source**.
- **[S19]** Godot text scene format: https://github.com/godotengine/godot-docs/blob/master/engine_details/file_formats/tscn.rst — **official docs**; text scenes and resource dependencies.
- **[S20]** Godot 4 web export guide: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html — **official docs**; WebGL 2, Compatibility renderer, C# and threading/mobile limitations.
- **[S21]** Unity 6 system requirements/mobile web browser support: https://docs.unity3d.com/6000.0/Documentation/Manual/system-requirements.html — **official docs**.
- **[S22]** Unity pricing changes (2026): https://web-prd.hexagon.unity.com/products/pricing-updates — **official pricing**; verify current terms before adoption.
- **[S36]** MDN, storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — **browser platform docs**; persistence risks.
- **[S37]** LDtk JSON format and separate level JSON: https://github.com/deepnight/ldtk/blob/master/docs/JSON_DOC.md — **official source**.
- **[S38]** Inkjs JavaScript port and compiler: https://github.com/y-lohse/inkjs — **official source**.
- **[S39]** Aseprite site and CLI/sprite sheet overview: https://www.aseprite.org/ — **official**.
- **[S40]** Playwright device emulation docs: https://playwright.dev/docs/emulation — **official**; browser/device emulation.
- **[S41]** Vite build guide: https://vite.dev/guide/build — **official**; production bundling.

### Further useful implementation references

- Tiled generic JSON export details: https://docs.mapeditor.org/en/latest/manual/export-generic/
- Inkjs compiler details and version compatibility: https://github.com/y-lohse/inkjs/blob/master/README.md
- Stardew Valley trigger actions: https://stardewvalleywiki.com/Modding:Trigger_actions
- Ajv schema validator: https://ajv.js.org/
- Vitest test runner: https://vitest.dev/
- Dexie IndexedDB wrapper: https://dexie.org/
- Howler.js audio: https://github.com/goldfire/howler.js
- XState state machines: https://stately.ai/docs/xstate
- Unity current licensing: https://unity.com/products/pricing
- Godot license: https://godotengine.org/license/
- Three.js installation/modular imports: https://threejs.org/manual/en/installation.html
- CrossCode map file layout (community): https://crosscode.fandom.com/wiki/Map_file_layout
- Chained Echoes developer profile: https://www.gamedeveloper.com/production/matthias-linda-s-seven-year-quest-to-make-retro-jrpg-chained-echoes

---

# 14. FINAL ARCHITECTURE POSITION

**Keep and protect the working Three.js game.** The right next investment is its **content production system**, not a new rendering engine. Build typed data contracts, story/quest/event state, explicit save migrations, region loading, CLI validation, meaningful automated playthroughs, and optional text-based authoring tools. Pilot new tooling rather than imposing it globally. The project's browser-and-mobile requirement and terminal-based AI development mode are durable reasons to favor this approach.

The coder's first obligation is not to implement the entire tree or every tool in this document. It is to **understand the real repo, identify the smallest high-leverage changes, and keep the current game playable at every milestone**.

**End of engineering brief.**
