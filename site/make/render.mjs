// What "Make one" shows about a match, as HTML: shared by the page build (the default prompt,
// rendered before any script) and the page script (every prompt after), so both read the same.
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const PARTS = [["recipe", "Recipe"], ["kind", "Particle"], ["colors", "Colour"], ["amount", "Amount"], ["loop", "Loop"], ["select", "Reads"], ["tap", "Input"]];
const bold = (list) => list.map((w) => `<b>${esc(w)}</b>`).join(" ");

/** The recipe line: name, scene, bricks. */
export const recipeText = (spec) => `${spec.recipe.toUpperCase()} · ${spec.scene} scene · ${spec.bricks.join(" + ")}`;
/** One <li> per part a word chose (recipe, particle, colour…). */
export const matchedHtml = (spec) =>
  PARTS.filter(([k]) => spec.matched[k].length).map(([k, label]) => `<li><span class="bui-label">${label}</span> ${bold(spec.matched[k])}</li>`).join("") ||
  `<li>No word matched: the default recipe (${esc(spec.recipe)}).</li>`;
/** The words no table knew: shown to the person who typed them, logged nowhere. */
export const missHtml = (spec) => (spec.matched.miss.length ? `Not matched yet: ${bold(spec.matched.miss)}. Shown to you only, logged nowhere.` : "Every word matched.");
