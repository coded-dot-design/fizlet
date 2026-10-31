// The stage aspect contract: every gallery stage is wide (w / h > 1.4), square (0.8–1.4) or tall
// (< 0.8). A piece reads its stage once, in its read phase after a resize (it already does), takes
// the class with aspect(w, h) and picks its layout from rows it declares per class (where actors
// spawn, the HUD, text scale, play bounds); nothing is read in a step. mark() puts the class on the
// stage as data-aspect through the engine's ledger (Recall gives it back), for tests and for CSS;
// the stage's own DOM lays itself out with container queries on the figure (container: stage).
// A rotate or resize is one more ResizeObserver tick: a new class, a new layout, same scene.
import type { Ledger } from "../../src/kernel/ledger";

/** 0 wide, 1 square, 2 tall. */
export type Aspect = 0 | 1 | 2;
export const ASPECTS = ["wide", "square", "tall"] as const;
export const aspect = (w: number, h: number): Aspect => (!(h > 0) || w > h * 1.4 ? 0 : w >= h * 0.8 ? 1 : 2);
/** The class on the stage (data-aspect="wide|square|tall"), through the ledger; call it in render. */
export const mark = (L: Ledger, el: HTMLElement, k: number) => L.attr(el, "data-aspect", ASPECTS[k as Aspect]);
