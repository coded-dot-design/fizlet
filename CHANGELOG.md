# Changelog

## 0.2.1

- `fizlet/embed`: `open: false` waits closed behind the toggle key (a PLAY key on the page) instead
  of opening right away.

## 0.2.0

E2, the first bricks (the ones Battlefield Blitz needs):
- `fizlet/input`: keys → intents with one-frame edges latched in the read phase, pointer, a touch
  stick, on-screen `press()`; keys typed in the host's fields never count.
- `fizlet/collide`: fixed-capacity spatial hash (`add` / `near` take typed arrays and indices so
  nothing boxes), `overlap`, `circles`, `circleRect`, `inRect`, swept `segCircle`.
- `fizlet/fx`: pooled particles (struct of arrays), the hero `blast()`, pop words, scorch, shake.
- `fizlet/sound`: the event ring → synth cues adapter (or your own player); gesture unlock.
- `fizlet/embed`: palette (hex only), easter-egg triggers (sequence, gesture, click; desktop /
  mobile scope), lazy load, the open / close toggle, Escape to close.
- Tests for every brick (Node and Chromium); budgets in CI.

## 0.1.0

E1, the kernel:
- `createEngine`: one shared `requestAnimationFrame` for every engine, fixed 60 Hz step with a
  catch-up cap, `read → step → render` phases, render alpha, `advance()` for headless runs.
- Auto-pause: hidden tab, page leaving, root off screen, typing in the host's fields; reduced
  motion opt-in. One `AbortSignal` tears everything down.
- `Pool` (bounded, prefilled, never grows), `EventRing` (fixed capacity, cleared each frame),
  `seeded` random (the DOM VIRUS core sequence, allocation-free, restorable state).
- `Ledger`: text, styles, attributes, classes and added nodes; change-only writes; `restore()` gives
  the page back exactly (style text byte for byte) and a newer host edit always wins.
- `stats()`: frames, steps, dropped time, frame ms, pools, events, ledger size, pause reasons.
- `fizlet/debug`: `guardLayout(engine)` counts layout reads during a step.
- `fizlet/ui`: the Board UI kit and spec, moved here from DOM Battlefield.
- Contract tests: one rAF for N engines, fixed step + cap, pause, bounded pools and events, seeded
  random, destroy, **zero allocation over 1M steps**, exact DOM restore, host edits win, auto-pause,
  layout guard. Size budgets in CI (kernel ~2.6 KB of 4 KB gzip).
