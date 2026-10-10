# Screens, devices and input

**Owner's targets:** a 1080p computer screen is the primary target. Phones are where the
game is played and tested day to day, so the game has to stay fully playable on them.

## How the screen works today (keep this)

- **Design grid: 960×540.** All UI sizes are multiples of `--u`, where `--u` = stage height ÷ 540
  (`01-stage-renderer.js` `layout()`). At **1080p, `--u` = 2px exactly**, a clean 2× scale of
  the design grid, so pixel fonts and UI edges land on whole pixels. 1440p is ×2.67 and 4K is ×4.
- **Aspect ratio:** the stage is 16:9 to 2.35:1. Narrower screens get black bars top and bottom,
  wider ones get bars at the sides. Typical phones in landscape (about 2.16:1) fill the
  whole screen.
- **Held upright:** the game asks you to turn the phone sideways, with a "Play upright
  anyway" option.
- **Notches:** CSS already uses `env(safe-area-inset-*)`, and the page sets `viewport-fit=cover`.
- **Render resolution:** device pixel ratio (DPR) is capped by quality tier (high 2, medium 1.5,
  low 1.25), so high-DPR phones don't render at 3×. Phones start on **medium**, desktops on
  **high** (shadows, tilt-shift, bloom).
- **Input:** keyboard (WASD or arrows, E/Space/Z/Enter to act, B/Tab book, Esc/Q menu),
  mouse or tap for menus, and on touch screens a floating stick plus A, book and menu buttons.
  There's a "Play full screen" option on touch devices.

## Automated checks (`npm test`)

Every test runs on three screens, the same ones CI uses:

| Project | Viewport | Checks |
|---|---|---|
| `desktop-1080p` | 1920×1080 | Stage is exactly 1920×1080, no touch controls, scenes load |
| `phone-landscape` | 844×390 at 3× DPR, touch | Stage fits, touch controls visible, scenes load |
| `phone-portrait` | 390×844 at 3× DPR, touch | Rotate prompt shown |

The software rendering used in CI says nothing about speed. **Performance has to be checked on
real devices.** The in-game frame counter (pause menu, or F) shows FPS, draw calls and pixel ratio.

## Known gaps to address as the game grows

- **Gamepad:** not supported. Desktop and Steam players will expect it. Add it alongside keyboard
  through one input-mapping layer (brief §4 `src/input/`).
- **Mouse in the world:** menus are clickable, but there's no click-to-walk or click-to-talk.
  Keyboard first is fine for a JRPG; it's a design decision for later.
- **Text size on small phones:** everything is sized on the 540 grid, so a 390px-tall phone
  shows the UI at 0.72× the design size in CSS pixels. Check readability on real
  phones as more text appears.
- **Settings:** add a text-size option and a "reduce effects" option (the brief's
  accessibility notes, §7.2).
