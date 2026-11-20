// The Fizlet mark, one source: pixel bubbles fizzing up a square frame, one popping (in --k-attack, the brand pink). Rects on its
// 64-unit grid, [x, y, w, h] (ported from the legacy site/layout.mjs MARK).
type Rect = [number, number, number, number];
export const MARK: { frame: Rect[]; ink: Rect[]; pop: Rect[] } = {
  frame: [[0, 0, 64, 2], [0, 62, 64, 2], [0, 2, 2, 60], [62, 2, 2, 60]],
  ink: [[8, 30, 26, 7], [8, 49, 26, 7], [8, 37, 7, 12], [27, 37, 7, 12], [36, 18, 14, 14], [40, 40, 8, 8]],
  pop: [[52, 6, 6, 6], [46, 6, 3, 3], [58, 14, 3, 3]],
};
export const rectPath = (list: Rect[]) => list.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}Z`).join("");
