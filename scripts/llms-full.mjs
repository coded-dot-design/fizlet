// llms-full.txt: the whole API in plain text for AI agents, from the same declarations as the brick
// pages (scripts/api.mjs, run at site build time), so it never drifts from the code. One section per
// brick (its import, status, measured size and summary), then every export: kind, status flag, doc
// comment, signatures with parameters and return types, and the declaration as published.
import { STATUS, BETA_LINE, IN_HOUSE, brickPath, exportStatus, inHouse } from "../site/bricks.mjs";

/** `bricks`: the catalog with `mods` ([{ name, summary, decls }]); `sizes` from scripts/sizes.mjs. */
export function llmsFull({ bricks, sizes, version, site, description }) {
  const out = [`# Fizlet API v${version}`, "", `> ${description}`, "",
    `Every public export of every brick, generated from the published type declarations (dist/*.d.ts) of v${version} by the TypeScript compiler at site build time. Each brick's page on ${site}bricks/ shows the same, with live demos.`, "",
    BETA_LINE, "", "Status flags:", ...Object.entries(STATUS).map(([, s]) => `- ${s.label}: ${s.line}`), ""];
  for (const b of bricks) {
    const size = sizes.find((s) => s.name === b.sizes[0]);
    out.push(`## ${b.name}`, "", `Status: ${STATUS[b.status].label}. Size: ${size.gzip} B gzip (budget ${size.budget} B). Page: ${site}${brickPath(b)}`, "");
    if (inHouse(b)) out.push(`${IN_HOUSE.label}: ${IN_HOUSE.line} Build your own room server: ${site}${IN_HOUSE.guide}`, "");
    for (const m of b.mods) {
      out.push(`Import: \`import { … } from "${m.name}"\``, "", m.summary, "");
      for (const d of m.decls) {
        out.push(`### ${d.names.join(", ")} (${d.kind}, ${STATUS[exportStatus(b, d)].label})`, "", d.doc, "");
        for (const t of d.tags) out.push(`@${t.name} ${t.text}`.trim());
        if (d.tags.length) out.push("");
        for (const s of d.sigs) {
          out.push(`Signature: \`${s.text}\``);
          for (const p of s.params) out.push(`- ${p.rest ? "..." : ""}${p.name}${p.optional ? " (optional)" : ""}: \`${p.type}\`${p.doc ? ` ${p.doc}` : ""}`);
          out.push(`- returns: \`${s.returns}\``, "");
        }
        if (d.type) out.push(`Type: \`${d.type}\``, "");
        out.push("```ts", d.code, "```", "");
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
