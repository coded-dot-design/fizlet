/** The scene's styles, inlined on the host page with the poster (so the live chunk carries no CSS). */
import { CELL, BW, BH } from "./data";

export const SCENE_CSS = `.lz{position:absolute;inset:0;perspective:2200px;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink);user-select:none}
.lz-s{position:absolute;left:50%;top:50%;width:${BW}px;height:${BH}px;margin:-${BH / 2}px 0 0 -${BW / 2}px;transform-style:preserve-3d;will-change:transform}
.lz-l{position:absolute;inset:0;transform-style:preserve-3d;border:2px solid transparent;border-radius:6px}
.lz-l>*{position:absolute}
.lz-g{background-color:var(--surface);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:${CELL}px ${CELL}px;outline:6px solid var(--rim);box-shadow:0 10px 0 var(--k-cmd-base)}
.lz-w{width:${CELL}px;height:${CELL}px;background:var(--k-cmd-base);box-shadow:inset 0 -5px 0 var(--raised)}
.lz-c{width:${CELL - 8}px;height:${CELL - 8}px;margin:4px;background:var(--hurt);box-shadow:inset 0 -4px 0 color-mix(in srgb,var(--hurt) 45%,var(--rim))}
.lz-t{width:27px;height:27px;left:0;top:0;image-rendering:pixelated}
.lz-b{width:6px;height:6px;left:-3px;top:-3px;background:var(--hurt);border-radius:1px}
.lz-d{width:4px;height:4px;left:-2px;top:-2px;background:var(--k-sys)}
.lz-h{border:1px solid var(--k-sys);border-radius:50%;width:22px;height:22px;left:-11px;top:-11px}
.lz-k{width:${CELL}px;height:${CELL}px;border:1px dashed var(--k-sys)}
.lz-x{left:0;top:0;width:100%;height:0;overflow:hidden}
.lz-scan{left:-6px;right:-6px;height:4px;top:0;background:var(--k-sys);box-shadow:0 2px 0 var(--rim)}
.lz-p{width:${CELL}px;height:${CELL}px;border:2px solid var(--hurt)}
.lz-r{width:34px;height:34px;left:-17px;top:-17px;border:2px solid var(--k-sys);border-radius:50%}
.lz-a{height:2px;left:0;top:-1px;background:var(--k-sys);transform-origin:0 50%}
.lz-fire{--u:.7px;right:8px;bottom:8px;pointer-events:none}
.lz-hud{left:6px;right:6px;top:6px;display:flex;justify-content:space-between;padding:5px 7px;background:var(--card);border:2px solid var(--line);border-radius:6px;box-shadow:0 3px 0 var(--k-cmd-base)}
.lz-hud b{color:var(--team-a)}.lz-hud i{font-style:normal;color:var(--team-b)}
.lz-cv{inset:0;width:100%;height:100%}
.lz-tag{left:100%;top:100%;white-space:nowrap;transform-origin:0 0;padding:4px 7px;background:var(--card);border:2px solid var(--line);border-radius:5px;opacity:0;margin:-2px 0 0 10px}
.lz-tag u{text-decoration:none;color:var(--muted)}`;
