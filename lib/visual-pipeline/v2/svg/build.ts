/**
 * SVG builder — renders a LayoutV2 into a full SVG document, then
 * optionally rasterizes it via sharp.
 */

import sharp from "sharp";

import type { LayoutV2, PlacedLabel, PlacedSymbol } from "../layout";
import { arrow } from "../symbols/arrow";
import { ball } from "../symbols/ball";
import { block } from "../symbols/block";
import { cart } from "../symbols/cart";
import { spring } from "../symbols/spring";
import { track } from "../symbols/track";
import { caption, equationText, labelText } from "../symbols/text";

const renderSymbol = (s: PlacedSymbol): string => {
  switch (s.kind) {
    case "cart":
      return cart(s.x, s.y, s.width, s.height, s.color);
    case "block":
      return block(s.x, s.y, s.width, s.height, s.color);
    case "ball":
      return ball(
        s.x + s.width / 2,
        s.y + s.height / 2,
        Math.min(s.width, s.height) / 2,
        s.color,
      );
    case "person":
      // Minimal placeholder for person; SVG is meant to be a structural
      // reference only so GPT-image can re-draw.
      return block(s.x, s.y, s.width, s.height, s.color);
    case "spring":
      return spring(s.x1, s.y1, s.x2, s.y2, s.coils ?? 8);
    case "arrow":
      return arrow(s.x1, s.y1, s.x2, s.y2, {
        color: s.color,
        label: s.label,
        weight: s.weight,
        style: s.style,
        id: s.id,
      });
    case "track":
      return track(s.y, s.x1, s.x2);
  }
};

const renderLabel = (l: PlacedLabel): string => {
  if (l.role === "caption") {
    return caption(l.anchor.x, l.anchor.y, l.text, { size: l.size });
  }
  if (l.role === "equation") {
    return equationText(l.anchor.x, l.anchor.y, l.text, { size: l.size });
  }
  return labelText(l.anchor.x, l.anchor.y, l.text, {
    size: l.size,
    align: l.align,
    weight: l.role === "measurement" ? "bold" : "normal",
  });
};

export const buildSvgV2 = (layout: LayoutV2): string => {
  const { width, height, background } = layout.canvas;
  const symbols = layout.symbols.map(renderSymbol).join("\n");
  const labels = layout.labels.map(renderLabel).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>
  <g id="symbols">
    ${symbols}
  </g>
  <g id="labels">
    ${labels}
  </g>
</svg>`;
};

export const rasterizeSvgV2 = async (svg: string): Promise<Buffer> => {
  return sharp(Buffer.from(svg)).png().toBuffer();
};

export const svgToDataUrl = (svg: string): string => {
  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
};
