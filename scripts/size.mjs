// Size budgets (contract 9): each entry minified + gzipped, everything it pulls in included.
import { measure } from "./sizes.mjs";

let failed = false;
for (const { name, budget, gzip } of await measure()) {
  const ok = gzip <= budget;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${name.padEnd(30)} ${String(gzip).padStart(5)} / ${budget} bytes gzip`);
}
if (failed) process.exit(1);
