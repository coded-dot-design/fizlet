// src/touch.ts
var SURFACES = "[data-fizlet-slot],[data-fizlet-host],[data-touch-lock],.bui-pad,.bui-grip";
var TYPES = ["gesturestart", "gesturechange", "touchstart", "touchmove"];
function lockTouch(doc = document, sel = SURFACES) {
  const opt = { capture: true, passive: false };
  const on = (ev) => {
    const t = ev.target;
    if ((ev.type[0] == "g" || ev.touches.length > 1) && (sel == null || t?.closest?.(sel))) ev.preventDefault();
  };
  for (const t of TYPES) doc.addEventListener(t, on, opt);
  return () => {
    for (const t of TYPES) doc.removeEventListener(t, on, opt);
  };
}

export {
  SURFACES,
  lockTouch
};
