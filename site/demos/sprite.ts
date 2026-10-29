// sprite demo: one sprite written as data, drawn at three scales in three palettes (side A, side B,
// hit flash), and the same pixels as an SVG <img> on the page.
import { sprites, spriteURL, type SpriteDef } from "../../src/sprite";
import { stage } from "./common";

export default function spriteDemo(host: HTMLElement) {
  const W = 640, H = 200;
  const bug: SpriteDef = {
    colors: { o: "rim", b: "team", e: "#fff6d6" },
    frames: [
      [".o.o.", "obbbo", "obebo", ".o.o."],
      ["o...o", "obbbo", "obebo", "o...o"],
    ],
  };
  const palettes: Record<string, string>[] = [{ team: "#39ffb0", rim: "#07060f" }, { team: "#ff5c8f" }, { "*": "#ffffff" }];
  const art = sprites({ bug }, { palettes });
  const { ctx } = stage(host, W, H, "A pixel bug drawn at three scales in three palettes");
  for (let pal = 0; pal < 3; pal++)
    for (let k = 0; k < 3; k++) art.draw(ctx, "bug", k % 2, 90 + pal * 200 + k * 50 - 50, 100, 0, 3 + k * 2, pal);
  const img = document.createElement("img");
  img.src = spriteURL(bug, 0, palettes);
  img.alt = "The same bug as an SVG image";
  img.width = 60;
  img.height = 48;
  img.className = "bd-img";
  host.querySelector("[data-stage]")!.append(img);
}
