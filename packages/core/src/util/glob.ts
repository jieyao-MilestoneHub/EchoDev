export function matchesGlob(path: string, pattern: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  const rx = globToRegExp(pattern);
  return rx.test(normalised);
}

function globToRegExp(pattern: string): RegExp {
  let i = 0;
  let out = "^";
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      out += ".*";
      i += 2;
      if (pattern[i] === "/") i += 1;
    } else if (ch === "*") {
      out += "[^/]*";
      i += 1;
    } else if (ch === "?") {
      out += "[^/]";
      i += 1;
    } else if (".+^$(){}|[]\\".includes(ch as string)) {
      out += `\\${ch}`;
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  out += "$";
  return new RegExp(out);
}
