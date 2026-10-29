/** The scene's styles, inlined on the host page with the poster (so the live chunk carries no CSS). */
import { CELL, BW, BH } from "./data";

export const SCENE_CSS = `.lz{position:absolute;inset:0;perspective:2200px;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#f6f3ff;user-select:none}
.lz-s{position:absolute;left:50%;top:50%;width:${BW}px;height:${BH}px;margin:-${BH / 2}px 0 0 -${BW / 2}px;transform-style:preserve-3d;will-change:transform}
.lz-l{position:absolute;inset:0;transform-style:preserve-3d;border:2px solid transparent;border-radius:6px}
.lz-l>*{position:absolute}
.lz-g{background-color:#110d22;background-image:linear-gradient(#3b3170 1px,transparent 1px),linear-gradient(90deg,#3b3170 1px,transparent 1px);background-size:${CELL}px ${CELL}px;outline:6px solid #07060f;box-shadow:0 10px 0 #3f296a}
.lz-w{width:${CELL}px;height:${CELL}px;background:#3f296a;box-shadow:inset 0 -5px 0 #1d1738}
.lz-c{width:${CELL - 8}px;height:${CELL - 8}px;margin:4px;background:#ffc21a;box-shadow:inset 0 -4px 0 #b07400}
.lz-t{width:27px;height:27px;left:0;top:0;image-rendering:pixelated}
.lz-b{width:6px;height:6px;left:-3px;top:-3px;background:#ffc21a;border-radius:1px}
.lz-d{width:4px;height:4px;left:-2px;top:-2px;background:#19f0ff}
.lz-h{border:1px solid #19f0ff;border-radius:50%;width:22px;height:22px;left:-11px;top:-11px}
.lz-k{width:${CELL}px;height:${CELL}px;border:1px dashed #19f0ff}
.lz-x{left:0;top:0;width:100%;height:0;overflow:hidden}
.lz-scan{left:-6px;right:-6px;height:4px;top:0;background:#19f0ff;box-shadow:0 2px 0 #07060f}
.lz-p{width:${CELL}px;height:${CELL}px;border:2px solid #ffc21a}
.lz-r{width:34px;height:34px;left:-17px;top:-17px;border:2px solid #19f0ff;border-radius:50%}
.lz-a{height:2px;left:0;top:-1px;background:#19f0ff;transform-origin:0 50%}
.lz-hud{left:6px;right:6px;top:6px;display:flex;justify-content:space-between;padding:5px 7px;background:#07060f;border:2px solid #3b3170;border-radius:6px}
.lz-hud b{color:#39ffb0}.lz-hud i{font-style:normal;color:#ff5c8f}
.lz-cv{inset:0;width:100%;height:100%}
.lz-tag{left:100%;top:100%;white-space:nowrap;transform-origin:0 0;padding:4px 7px;background:#07060f;border:2px solid #3b3170;border-radius:5px;opacity:0;margin:-2px 0 0 10px}
.lz-tag u{text-decoration:none;color:#aea4d6}`;
