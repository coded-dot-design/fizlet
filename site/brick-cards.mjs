// Brick cards: one tiny live toy per brick, built with that brick, that shows what it does (site/cards/).
// This is the markup half: an astro-base-engine slot figure the loader (site/brick-cards.ts →
// brick-cards.js) mounts with fizlet/slot (lazy near the viewport, asleep off screen, a still
// labelled poster under reduced motion, Recall exact). Every number comes from the build: `bytes`
// is the brick's gzip size (scripts/sizes.mjs), `card` the card's own live chunk (scripts/live-bytes.mjs).
//
// Mount one anywhere (bricks page, a brick's page, a note card's slot, a gallery hero):
//   html:   brickCard({ brick, bytes, card, where: "notes" })   // brick: a site/bricks.mjs row
//   script: <script type="module" src="<base>brick-cards.js"></script>  (mounts every card on the page)
// The scenes themselves are fizlet/slot mounts (`export default` of site/cards/<id>.ts), so a page
// with its own loader can call slot(figure, () => import(".../cards/fx").then((m) => m.default)).
import { esc } from "./layout.mjs";
import { sizeBadge } from "./size-badge.mjs";

/** The bricks that have a card, and what each one does when you play with it. */
export const CARDS = {
  kernel: { play: "Tap the floor to drop a brick; tap a brick to knock it out.", what: "bricks drop, stack and settle; the engine sleeps the moment they stop" },
  fx: { play: "Tap near the crate, or tap the crate.", what: "a crate knocked around by small blasts until the hero blast takes it apart, from one fixed particle pool" },
  collide: { play: "Tap to fire a ball at that spot.", what: "balls knock bricks out of a wall; the spatial grid checks only the bricks a ball can touch" },
  grid: { play: "Tap a cell to walk there; tap a rock to break it.", what: "A* finds the way across a seeded board of rocks and the brick walks it" },
  steer: { play: "Bring the pointer near, or tap the tower.", what: "a tower of small bricks that flee the pointer and arrive back in their own slots" },
  input: { play: "Tap to start; whack a brick with a tap or its key (1–4, A S D F).", what: "whack-a-brick: keys and the pointer map to the same named intents, each hit true for one step" },
  sprite: { play: "Tap the bug. Four times.", what: "a pixel bug that flashes, gets angry and bursts into its own pixels" },
  camera: { play: "Tap anywhere to dive in; tap again to fly back.", what: "a tiny page of real DOM with fine print you can only read when the camera zooms in" },
  timeline: { play: "Tap to make the bricks dance into the next shape.", what: "six DOM bricks hop, then fly into a new arrangement on a scripted timeline" },
};
export const CARD_IDS = Object.keys(CARDS);
/** The bricks without a card yet (the roadmap), in catalog order. */
export const cardless = (bricks) => bricks.filter((b) => !CARDS[b.id]).map((b) => b.id);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/**
 * One card. `brick`: its site/bricks.mjs row; `bytes`: the brick's measured gzip size; `card`:
 * { bytes, live } of the card's own chunk (what the page loads for it); `where`: the page it sits
 * on, for the slot target ("<where>#card-<id>"); `title`: show the brick's name over the card.
 */
export function brickCard({ brick, bytes, card, where = "bricks", title = false }) {
  const c = CARDS[brick.id];
  if (!c) throw new Error(`brick ${brick.id}: no card (site/cards/${brick.id}.ts)`);
  const label = `${brick.name}, ${kb(bytes)} gzip: ${c.what}. ${c.play}`;
  return `<div class="bc" data-demo-host style="--tone: var(--k-${brick.role})">
  ${title ? `<p class="bc-name"><code>${esc(brick.name)}</code></p>` : ""}<figure class="ae-slot bc-fig" data-slot-target="${esc(where)}#card-${brick.id}" data-brick-card="${brick.id}" data-tag="${esc(brick.tag)}" data-bytes="${bytes}" role="img" aria-label="${esc(label)}">
    <span class="ae-slot__placeholder bc-poster" aria-hidden="true"><span class="bc-block"><b>${esc(brick.tag)}</b> ${kb(bytes)}</span><span class="bc-floor"></span></span>
  </figure>
  <p class="bc-cap"><span>${esc(c.play)}</span>${sizeBadge(card.bytes, card.live, `this card, with ${brick.name}`)}</p>
</div>`;
}
