# Origin: the home page's origin hero

The Origin section sits on the home page right after the hero band (the "Logic and style." hero
and its stats strip). It holds:
- the title loop, "Code. Sleep. Drink. Repeat.", with a switch to "Design. Sleep. Drink. Repeat.";
- the Sound key;
- the hero stage, which runs the origin scene;
- below the stage, 2015 by hand against Fizlet and Chris's why line.

By Chris Cooley.

| File | What |
|---|---|
| `section.mjs` | The section's HTML (the home page module calls `originSection()`) |
| `contract.ts` | The mount contract, as types |
| `main.ts` → `origin/main.js` | The loader: the switch, the Sound key, `@fzlt/core/slot` |
| `build.mjs` | Picks the scene, builds the loader, measures everything in gzip |
| `scene.ts` → `origin/scene.js` | **The placeholder scene**, the fallback when the origin scene is missing from the tree |
| `poster.mjs` | The placeholder's poster SVG |

The CSS lives in `site/site.css`, between `ORIGIN` and `END ORIGIN`, with the `ogs-` class prefix. The
scene's own classes are `og-`.

## The mount contract (adopted from the origin scene, fizlet#218)

The brief asked for this signature:

```ts
mount(figure, { reduced, sound: SoundGate }) => { destroy() }
```

The origin scene (`site/demos/origin/scene.ts`) shipped a richer API first. The section uses **that
API**, and the placeholder (`scene.ts` here) has the same shape. The types are in `contract.ts`:

```ts
// What the loader imports: @fzlt/core/slot's mount, from demos/origin/scene.js (or origin/scene.js).
export const mountSlot: SlotMount; // (stage, figure, first) => OriginScene
interface OriginScene {
  destroy(): void;                // Recall: the figure's outerHTML comes back byte for byte
  setMode(m: "code" | "design"): void;
  setSound(on: boolean): void;    // arms sound; @fzlt/core/sound still waits for a trusted gesture
  pause(): void; play(): void;    // while paused: 0 requestAnimationFrame calls
  readonly state: { mode; open; bricks; sound; paused };
  accessible?: boolean;           // true when the scene has real buttons
}
```

| Brief | As built |
|---|---|
| `mount(figure, opts)` | `mountSlot(stage, figure)` through `@fzlt/core/slot`. It reads `data-mode` and `data-sound` from the figure when it mounts |
| `opts.sound: SoundGate` | `data-sound="0"/"1"` plus `setSound()`. The loader saves the choice in `localStorage` (`fizlet:origin-sound`, inside try/catch). `@fzlt/core/sound` creates the AudioContext only on a trusted gesture. Sound is off by default |
| `opts.reduced` | The loader never mounts the scene under reduced motion. The scene also checks for reduced motion itself (`reducedMotion`) |
| `data-mode` on the figure | Kept. Mode changes go to `setMode()`. The scene reports its own changes with a bubbling `origin:state` event (`detail`: the state), and the section's keys follow it |
| Settles: 0 rAF when idle or off screen | 0 rAF/s when off screen, when the tab is hidden, or after `pause()`. **On screen it plays a 24 s day loop at 30 fps**, because it is ambient, not idle. The placeholder settles after 4.5 s |
| Recall exact | Yes. **The figure has no `role="img"`**: the scene's buttons make it `accessible: true`, and slot does not hand `role` back byte for byte (fizlet#215) |
| Poster | The scene's `poster()` and `POSTER_CSS` (`demos/origin/build.mjs`), inline. Under reduced motion the Code/Design switch swaps the poster's screens |

The scene's own key row stays on (`controls: true`): Design mode, Show bricks, Sound, Pause. It
duplicates mode and sound, but it is what makes the scene `accessible: true`. With `controls: false`,
the slot would hide the whole stage from assistive tech, the laptop button included. The scene's keys
and the section's keys stay in step through `origin:state`.

**Fallback.** `build.mjs` uses the origin scene when `site/demos/origin/scene.ts` exists. Without it,
the build makes the placeholder `origin/scene.js`, with its own poster (`poster.mjs`). The why line
follows the same rule: it is `ORIGIN_WHY` from `site/demos/origin/copy.ts`, or a copy of the same
text when that file is missing.

`tests/site.mjs` ("origin") checks that:
- the section sits in the right place on the page;
- there is no scene script tag;
- the switch drives `scene.state.mode`, by mouse and by keyboard;
- the scene's own mode key moves the switch;
- no AudioContext exists before a gesture;
- the Sound key arms the scene;
- the page asks for 0 frames when the scene is paused or off screen;
- Recall is exact;
- the mute choice persists;
- reduced motion keeps the poster and never requests the scene;
- nothing scrolls sideways at 390 px.

## The grid

`.has-grid` and the `--grid-*` tokens live in `site/site.css`, in the `GRID` block. `page()` in
`site/layout.mjs` adds the class to every page's first section or article, which is its hero. The
same values are exported as `grid` in `src/ui/tokens.json`, for Battlefield, Blitz and DOM VIRUS to
reuse. Moving them over is a follow-up.
