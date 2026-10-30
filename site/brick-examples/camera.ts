// The usage example on bricks/camera.html (see pad.ts).
import { createEngine } from "../../src/index";
import { camera, zoomAt } from "../../src/camera";
const e = createEngine();
declare const stage: HTMLElement, x: number, y: number;
// ---
const cam = camera(e, stage, { min: 1, max: 4 }); // any DOM element
cam.to(320, 180, 2);   // eased; the engine settles when it lands
zoomAt(cam, x, y, 3);  // helpers stand alone: zoomAt, flyTo, fit, toScreen
cam.home();            // e.destroy() gives the transform back exactly
