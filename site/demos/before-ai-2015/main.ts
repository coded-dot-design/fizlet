// The two Fizlet columns of demos/before-ai-2015/ (the 2015 column is CSS and the page's 4-line
// toggle, untouched). The remake copies 2015, so under reduced motion it stays on its first frame
// like the 2015 column (the page's wrapper rule); the arcade handles reduced motion itself.
import { same } from "./same";
import { arcade } from "./arcade";

const root = (s: string) => document.querySelector<HTMLElement>(s);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const s = root(".bt-same"), a = root(".bt-arcade");
if (s && !still) same(s);
if (a) arcade(a);
