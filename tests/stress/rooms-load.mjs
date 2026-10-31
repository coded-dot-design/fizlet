// fizlet-rooms under load on `wrangler dev --local`: N rooms × 4 lockstep players (N = 1, 8, 16, 17),
// latency, desyncs, every cap, bursts, reconnect, hostile input, memory. The test lives with the room
// server (rooms/test/load.mjs, its own package): needs `npm run build` here and `npm ci` in rooms/.
//   npm run test:stress -- rooms-load [--rooms 1,8,16,17] [--seconds 10] [--soak 60] [--seed 1]
//                                     [--phases load,caps,hostile,wake,gate] [--json out.json] [--self-test]
import { spawnSync } from "node:child_process";
const rooms = new URL("../../rooms/", import.meta.url).pathname;
process.exit(spawnSync(process.execPath, ["test/load.mjs", ...process.argv.slice(2)], { cwd: rooms, stdio: "inherit" }).status ?? 1);
