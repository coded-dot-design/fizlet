// The "how it works" labs: each one's figure markup (live, or a still poster) and its mount.
// Markup functions touch no DOM, so a build script or a server can render them.
export { boardFigure, board, BUG_CAP } from "./board";
export { duelFigure, duel } from "./duel";
export { pipelineFigure, pipeline, STAGES } from "./pipeline";
export { poolFigure, pool, POOL_CAP } from "./pool";
export { recallFigure, recall, RECALL_CAP } from "./recall";
export { ATTRACT, type Lab, type LabMount, type LabOptions } from "./lab";
