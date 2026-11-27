const ACCENTS: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};
const VOWELS = new Set("aeiouAEIOU");

/** Accent every letter and double every other vowel: about a third longer, like German or French. */
function stretch(text: string): string {
  let vowel = 0;
  let out = "";
  for (const char of text) {
    const accented = ACCENTS[char] ?? char;
    out += VOWELS.has(char) && vowel++ % 2 === 0 ? accented + accented : accented;
  }
  return out;
}

/** Index just past the brace that closes the one at `open`. */
function closingBrace(message: string, open: number): number {
  let depth = 0;
  for (let index = open; index < message.length; index++) {
    if (message[index] === "{") depth++;
    else if (message[index] === "}" && --depth === 0) return index + 1;
  }
  return message.length;
}

/** `{count, plural, one {# item} other {# items}}`: keep the header and keys, stretch each branch. */
function pseudoArgument(argument: string): string {
  const parts = argument.slice(1, -1).split(",");
  const type = parts[1]?.trim();
  if (parts.length < 3 || !["plural", "select", "selectordinal"].includes(type ?? "")) return argument;
  const header = `${parts[0]},${parts[1]},`;
  const body = argument.slice(header.length + 1, -1);
  let out = "";
  let index = 0;
  while (index < body.length) {
    const open = body.indexOf("{", index);
    if (open === -1) { out += body.slice(index); break; }
    const close = closingBrace(body, open);
    out += body.slice(index, open) + "{" + pseudoText(body.slice(open + 1, close - 1)) + "}";
    index = close;
  }
  return `{${header}${out}}`;
}

/** Stretch the text of an ICU message, leaving {arguments}, # and <tags> as they are. */
function pseudoText(message: string): string {
  let out = "";
  let index = 0;
  while (index < message.length) {
    const char = message[index];
    if (char === "{") {
      const close = closingBrace(message, index);
      out += pseudoArgument(message.slice(index, close));
      index = close;
    } else if (char === "<") {
      const close = message.indexOf(">", index) + 1 || message.length;
      out += message.slice(index, close);
      index = close;
    } else if (char === "#") {
      out += char;
      index++;
    } else {
      const next = message.slice(index).search(/[{<#]/);
      const end = next === -1 ? message.length : index + next;
      out += stretch(message.slice(index, end));
      index = end;
    }
  }
  return out;
}

/** One message in the pseudo-locale: brackets show where it starts and ends, so clipping is visible. */
export function pseudoMessage(message: string): string {
  return `⟦${pseudoText(message)}⟧`;
}

type Catalogue = { readonly [key: string]: string | Catalogue };

/** The pseudo-locale catalogue: the English one with every message run through pseudoMessage. */
export function pseudoCatalogue<T extends Catalogue>(messages: T): T {
  return Object.fromEntries(Object.entries(messages).map(([key, value]) =>
    [key, typeof value === "string" ? pseudoMessage(value) : pseudoCatalogue(value)])) as T;
}
