// Gallery numbers (#047) are given at land time, the way versions are: a PR never picks one.
// Parallel PRs that each took "the next number" kept claiming the same one. One rule, used by the
// site build (provisional numbers, so a PR still builds) and by the engine's land step
// (`fe anim number --write`, which writes them): no dependencies, pure.
//
// - Numbers that are already set are kept. When two entries share one, the entry that arrived first
//   (merge order) keeps it, and the others are numbered again.
// - Live entries (`approved`) without a number take the next free numbers in a stable order: the
//   approval date, then the merge order (`arrival`: id → index, earliest first), then the id.
// - Pending entries get no number until they are approved. `reserved` numbers (pulled entries
//   that once held them) are never given again.

/** [{ no, ids }] for every number held by more than one entry, ids in arrival order. */
export function duplicateNumbers(list, arrival = {}) {
  const by = new Map();
  for (const e of list) if (e.no !== undefined) by.set(e.no, [...(by.get(e.no) ?? []), e]);
  return [...by].filter(([, es]) => es.length > 1).sort(([a], [b]) => a - b).map(([no, es]) => ({ no, ids: es.sort(byArrival(arrival)).map((e) => e.id) }));
}

const rank = (arrival, id) => (id in arrival ? arrival[id] : Infinity);
const byArrival = (arrival) => (a, b) => rank(arrival, a.id) - rank(arrival, b.id) || a.id.localeCompare(b.id);

/** The numbers to give: { id: no } for live entries without a number and for the later holders of a shared one. */
export function assignNumbers(list, { arrival = {}, reserved = [] } = {}) {
  const dupes = duplicateNumbers(list, arrival);
  const renumber = new Set(dupes.flatMap((d) => d.ids.slice(1)));
  const need = list.filter((e) => typeof e.approved === "string" && (e.no === undefined || renumber.has(e.id)));
  const kept = list.filter((e) => e.no !== undefined && !renumber.has(e.id)).map((e) => e.no);
  let next = Math.max(0, ...kept, ...reserved);
  const order = (a, b) => a.approved.localeCompare(b.approved) || byArrival(arrival)(a, b);
  return Object.fromEntries(need.sort(order).map((e) => [e.id, ++next]));
}

/** The message for shared numbers: which entries, and the command that fixes them. */
export const duplicateMessage = (what, dupes) =>
  `${what}: ${dupes.map((d) => `#${String(d.no).padStart(3, "0")} is claimed by ${d.ids.join(", ")}`).join("; ")}. ` +
  "Numbers are given at land time, never in a PR: drop `no` from the PR's entry, or run `node factory/fe.mjs anim number --fizlet <checkout> --write` (fizlet-engine).";
