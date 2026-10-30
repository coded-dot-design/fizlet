// A halftone dot wave reveals every heading. Made by fe anim from the prompt: "a halftone dot wave reveals every heading"
// Recipe halftone (2026-10-30). By Chris Cooley. Generated: change the spec, not this file.
import { scene, halftone } from "../scenes/decor";
export const mount = scene(halftone, {"effect":"halftone","select":"h1,h2,h3,h4,h5,h6,[data-fizlet-heading]","colors":["#ffc21a","#ff2e88"],"count":12,"seconds":1,"glow":1.2,"loop":0,"scale":1});
