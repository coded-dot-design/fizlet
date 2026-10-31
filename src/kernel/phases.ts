/** The frame phases as a const enum, for the kernel and the bricks: esbuild inlines it across files
 *  (and in the unminified dist build), where an imported `const` stays a variable. The public values
 *  are `IDLE`, `READ`, `STEP` and `RENDER` from the kernel (engine.ts keeps its own copy: importing
 *  this one there cost the page build 14 B gz); tests/kernel.test.mjs holds the two equal. */
export const enum P { IDLE, READ, STEP, RENDER }
