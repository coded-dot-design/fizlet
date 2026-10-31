// Docs code (shown on /docs/recall/): every page change through the ledger.
import { createEngine } from "@fzlt/core";
declare const heading: HTMLElement, word: Text;
// ---
const e = createEngine({ root: document.body });
e.add({
  render(e) {
    e.ledger.style(heading, "transform", "rotate(-4deg)"); // one inline property
    e.ledger.cls(heading, "smashed", true);                // one class
    e.ledger.attr(heading, "data-hp", "2");                // an attribute (null removes)
    e.ledger.text(word, "0101");                           // a text node's value
  },
});
const canvas = e.ledger.add(document.createElement("canvas")); // a node you add
document.body.append(canvas);
e.start();

// Recall: the page comes back exactly; a newer edit by the page wins.
e.destroy(); // or e.ledger.restore() to keep the engine
