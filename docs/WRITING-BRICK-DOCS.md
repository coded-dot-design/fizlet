# Writing brick docs

A brick's docs are its TSDoc comments in `src/`. `tsc` copies them into `dist/*.d.ts`, so they show
up in editor hovers and on the API pages. The `api/*.api.txt` snapshots strip comments, so you can
change a doc without touching a snapshot or adding a CHANGELOG line.

## What gets a comment

Every public declaration of every subpath in `package.json` `exports` needs a comment:

- each exported function, class, const, type and interface;
- each member of an exported interface, class or object type: every option and every field of a
  return value;
- each property of the object literal that a function returns, when the return type is inferred.
  Put the comment right above the property in the `return { … }` literal.

`npm run docs:coverage` lists every declaration that has no comment. CI runs it with `--check`, and
the check fails on any undocumented declaration that is not in `scripts/docs-coverage.json`. That
file lists the old gaps and only ever shrinks: after you document some of them, run
`npm run docs:coverage -- --write`.

## What a comment says

Put the summary first, as one sentence that still reads well when it's the only thing in a hover.
Add these only when they apply, and only when the code shows them:

- **Units**: seconds (never frames), px, px/s, px/s², cells, radians, 0..1.
- **Default**: written as `(default 420)`. If the default depends on something, say what it is.
- **Limits**: caps and ranges, and what happens past them. For example: refused and counted in
  `dropped`, throws a `RangeError`, or clamped.
- **Allocation**: say "no allocation" when a call is safe in `step`. When a call allocates, say when
  it does (on the first call, at build, on resize). Nothing a step calls may allocate.
- **Settling and Recall**: say whether it keeps the engine awake (`e.busy()`) or lets it settle.
  Say what `engine.destroy()` undoes: listeners, page changes, pools.

Doc comments ship in the package's types (`dist/*.d.ts`), so write them for every user of the
package: never name a private repository, a private project or a person (the publish gate scans
them, as `tests/private-names.test.mjs` scans the repo).

Keep it short. One line is the norm, and more lines only pay when a reader would otherwise guess
wrong. Write the house style: plain sentences, code in backticks, and no `@param` lists where a
sentence does the job. Never document what you haven't read in the implementation.

## One comment per line

TypeScript attaches a comment only to the declaration on the line right below it. If several
members share a line (`x, y, a,` or `bg: string; surface: string;`), only the first one gets the
comment. Put each member on its own line, with its own comment.

## A worked example

`@fzlt/core/fx`, `FxOptions`:

```ts
/** Options for `effects()`: the particle cap, the colour and word tables, scorch marks and gravity. */
export interface FxOptions {
  /** Max live particles (default 420). New ones are refused (and counted in `dropped`) when full. */
  cap?: number;
  /** Colour table, at most 256; particles store an index (default: the Battlefield blast palette). */
  colors?: string[];
  /** Max scorch marks kept on the ground (default 36; 0 turns them off). */
  scorch?: number;
  /** Gravity in px/s² down (default 0); each kind takes its own share of it. */
  gravity?: number;
}
```

The interface comment says what the options are for. Each member comment gives the default, the
unit or limit, and what happens at the edge (refused when full, 0 turns it off).

## Examples in the docs

Every ```` ```ts ```` and ```` ```js ```` block in README.md and in the brick docs listed in
`scripts/doc-examples.mjs` is typechecked against the source and run in Chromium for a few frames by
`npm test` (tests/doc-examples.test.mjs). A fragment may use names it never defines (`engine`,
`ctx`, `player`); the test gives each one a value. A brick function the example calls must be
imported.

A block that needs a server or a network gets `<!-- doc-test: typecheck -->` on the line above its
fence. A block that is not code the bricks run gets `<!-- doc-test: skip -->`.
