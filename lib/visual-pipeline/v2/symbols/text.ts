/**
 * Text symbols — measurements, captions, labeled equations with
 * subscript support (no TeX runtime).
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Parse "F_AB" / "F_{AB}" / "v_0" into a TSpan sequence.
// Rule: "_" binds to the immediately-following braced group, or to the
// maximal alphanumeric run. Everything else passes through as plain text.
const withSubscripts = (text: string): string => {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const underscore = text.indexOf("_", i);
    if (underscore === -1) {
      out += escape(text.slice(i));
      break;
    }
    // Find a base identifier immediately before the underscore.
    let baseStart = underscore;
    while (baseStart > i && /[A-Za-z0-9]/.test(text[baseStart - 1]!)) {
      baseStart--;
    }
    if (baseStart === underscore) {
      // No base — treat underscore as literal.
      out += escape(text.slice(i, underscore + 1));
      i = underscore + 1;
      continue;
    }
    out += escape(text.slice(i, baseStart));
    const base = text.slice(baseStart, underscore);
    // Find subscript.
    let subStart = underscore + 1;
    let subEnd: number;
    let sub: string;
    if (text[subStart] === "{") {
      const close = text.indexOf("}", subStart);
      if (close === -1) {
        // Unclosed brace — treat literally.
        out += escape(base) + escape(text.slice(underscore));
        break;
      }
      sub = text.slice(subStart + 1, close);
      subEnd = close + 1;
    } else {
      let j = subStart;
      while (j < text.length && /[A-Za-z0-9]/.test(text[j]!)) j++;
      sub = text.slice(subStart, j);
      subEnd = j;
    }
    if (sub.length === 0) {
      out += escape(base) + "_";
      i = underscore + 1;
      continue;
    }
    out += `${escape(base)}<tspan baseline-shift="sub" font-size="0.7em">${escape(sub)}</tspan>`;
    i = subEnd;
  }
  return out;
};

export const labelText = (
  x: number,
  y: number,
  text: string,
  opts: {
    size?: number;
    align?: "center" | "left" | "right";
    weight?: "normal" | "bold";
    color?: string;
    italic?: boolean;
  } = {},
): string => {
  const size = opts.size ?? 14;
  const align = opts.align ?? "center";
  const weight = opts.weight ?? "normal";
  const color = opts.color ?? "#0F172A";
  const anchor =
    align === "center" ? "middle" : align === "right" ? "end" : "start";
  const fontStyle = opts.italic ? "italic" : "normal";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="${size}" font-weight="${weight}" font-style="${fontStyle}" fill="${color}">${withSubscripts(
    text,
  )}</text>`;
};

export const caption = (
  x: number,
  y: number,
  text: string,
  opts: { size?: number; color?: string } = {},
): string =>
  labelText(x, y, text, {
    size: opts.size ?? 18,
    align: "center",
    weight: "bold",
    color: opts.color ?? "#0F172A",
  });

export const equationText = (
  x: number,
  y: number,
  text: string,
  opts: { size?: number; color?: string } = {},
): string =>
  labelText(x, y, text, {
    size: opts.size ?? 17,
    align: "center",
    weight: "normal",
    color: opts.color ?? "#0F172A",
    italic: true,
  });
