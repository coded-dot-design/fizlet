/**
 * The origin hero's copy: why Fizlet exists, in Chris Cooley's words (2026-10-31). ONE source: the
 * scene's caption, the poster, the demo page and the Before AI page all import ORIGIN_WHY, so the
 * wording matches everywhere. Change it here only.
 */
export const ORIGIN_WHY =
  "There were a lot of animations before Fizlet, and in between. We kept writing the same thing over and over, a little different each time for a slightly different use. So we built Fizlet to make it easier for us. Then we figured other people could get something out of it too, so we open-sourced it.";

/** The same line as story beats, one sentence each (the scene shows one per part of the day). */
export const ORIGIN_WHY_BEATS = ORIGIN_WHY.split(/(?<=\.)\s+/);

/** The title and its design-mode twin. */
export const ORIGIN_TITLE = { code: "Code. Sleep. Drink. Repeat.", design: "Design. Sleep. Drink. Repeat." } as const;

/** What the scene is after: the caption under the why, the poster and the demo page. */
export const ORIGIN_CREDIT = "Inspired by the original 2015 portfolio, with Fizlet flair";

/** The two looks, as the look key names them: the 2015 portfolio's flat palette, or Fizlet's. */
export const ORIGIN_LOOKS = { "2015": "2015", fizlet: "Fizlet" } as const;
