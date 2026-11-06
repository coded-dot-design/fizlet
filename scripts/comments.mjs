const KEYWORDS_BEFORE_REGEX = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const isWord = (c) => /[A-Za-z0-9_$]/.test(c) || c > "\x7f";

export function scanComments(text) {
  const found = [];
  const braces = [];
  let i = 0;
  let prev = "";
  const line = (at) => text.slice(0, at).split("\n").length;
  if (text.startsWith("#!")) while (i < text.length && text[i] !== "\n") i++;
  const template = () => {
    while (i < text.length) {
      const c = text[i];
      if (c === "\\") i += 2;
      else if (c === "`") {
        i++;
        prev = "`";
        return;
      } else if (c === "$" && text[i + 1] === "{") {
        i += 2;
        braces.push("t");
        prev = "{";
        return;
      } else i++;
    }
  };
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === "/" && n === "/") {
      let j = i;
      while (j < text.length && text[j] !== "\n") j++;
      found.push({ start: i, end: j, line: line(i), text: text.slice(i, j) });
      i = j;
    } else if (c === "/" && n === "*") {
      const e = text.indexOf("*/", i + 2);
      const j = e < 0 ? text.length : e + 2;
      found.push({ start: i, end: j, line: line(i), text: text.slice(i, j) });
      i = j;
    } else if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1;
      i++;
      prev = '"';
    } else if (c === "`") {
      i++;
      template();
    } else if (c === "/") {
      const regex = prev === "" || (!/[A-Za-z0-9_$)\]}"`]/.test(prev) && !/^[0-9]/.test(prev)) || KEYWORDS_BEFORE_REGEX.has(prev);
      if (regex) {
        i++;
        let cls = false;
        while (i < text.length && text[i] !== "\n" && (cls || text[i] !== "/")) {
          if (text[i] === "\\") i++;
          else if (text[i] === "[") cls = true;
          else if (text[i] === "]") cls = false;
          i++;
        }
        i++;
        while (i < text.length && isWord(text[i])) i++;
        prev = '"';
      } else {
        i++;
        prev = "/";
      }
    } else if (isWord(c)) {
      let j = i;
      while (j < text.length && isWord(text[j])) j++;
      prev = text.slice(i, j);
      i = j;
    } else if (/\s/.test(c)) i++;
    else {
      if (c === "{") braces.push("b");
      if (c === "}") {
        if (braces.pop() === "t") {
          i++;
          template();
          continue;
        }
      }
      prev = c;
      i++;
    }
  }
  return found;
}

export function stripJsComments(text) {
  const found = scanComments(text);
  if (!found.length) return text;
  let out = "", at = 0;
  for (const c of found) {
    out += text.slice(at, c.start) + "\u0001";
    at = c.end;
  }
  out += text.slice(at);
  const lines = [];
  for (const l of out.split("\n")) {
    if (!l.includes("\u0001")) {
      lines.push(l);
      continue;
    }
    const cleaned = l.replace(/(.?)\u0001(.?)/g, (m, a, b) => (a && b && !/\s/.test(a) && !/\s/.test(b) ? a + " " + b : a + b)).replace(/\u0001/g, "");
    if (cleaned.trim() !== "") lines.push(cleaned.trimEnd());
  }
  return lines.join("\n");
}
