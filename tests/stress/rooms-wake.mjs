// What a fizlet-rooms Room forgets when its Durable Object wakes from hibernation (Node fakes, no
// wrangler): rooms/test/wake.mjs.   npm run test:stress -- rooms-wake [--self-test]
import { spawnSync } from "node:child_process";
const rooms = new URL("../../rooms/", import.meta.url).pathname;
process.exit(spawnSync(process.execPath, ["test/wake.mjs", ...process.argv.slice(2)], { cwd: rooms, stdio: "inherit" }).status ?? 1);
