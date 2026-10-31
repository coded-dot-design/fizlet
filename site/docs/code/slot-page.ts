// Docs code (shown on /guides/astro-slot/): the page script that fills the slot.
// ---
import { slot } from "@fzlt/core/slot";

// Loads only near the viewport, once the main thread is idle; never under reduced motion.
slot("home#hero", () => import("./hero-scene.js").then((m) => m.mount));
