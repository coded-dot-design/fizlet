// A comic panel wipes across every heading. Made by fe anim from the prompt: "a comic panel wipes across every heading"
// Recipe wipe (2026-10-30). By Chris Cooley. Generated: change the spec, not this file.
import { scene, wipe } from "../scenes/decor";
export const mount = scene(wipe, {"effect":"wipe","select":"h1,h2,h3,h4,h5,h6,[data-fizlet-heading]","colors":["#ffc21a","#19f0ff"],"count":60,"seconds":1,"glow":1.2,"loop":0,"scale":1});
