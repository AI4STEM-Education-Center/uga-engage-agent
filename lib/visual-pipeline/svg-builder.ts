/**
 * Stage 2b: SVG Builder + rasterizer.
 *
 * Pure string concatenation for the SVG. sharp is used to rasterize it to PNG
 * so Stage 3 can feed it to OpenAI images.edit as a structural reference.
 */

import sharp from "sharp";

import type { LayoutObject, LayoutResult, SceneRelationship } from "./types";

const BACKGROUND_COLORS: Record<string, string> = {
  classroom: "#F8FAFC",
  outdoor: "#E0F2FE",
  lab: "#F5F3FF",
  road: "#E5E7EB",
  indoor: "#FEF3C7",
  playground: "#DCFCE7",
  default: "#F8FAFC",
};

const resolveBackground = (background: string): string => {
  const key = background.toLowerCase();
  for (const [bg, color] of Object.entries(BACKGROUND_COLORS)) {
    if (key.includes(bg)) return color;
  }
  return BACKGROUND_COLORS.default;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderObject = (obj: LayoutObject): string => {
  const fill = obj.color ?? "#64748B";
  const stroke = "#1E293B";
  if (obj.shape === "circle") {
    const cx = obj.x + obj.computedWidth / 2;
    const cy = obj.y + obj.computedHeight / 2;
    const r = Math.min(obj.computedWidth, obj.computedHeight) / 2;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }
  if (obj.shape === "ellipse") {
    const cx = obj.x + obj.computedWidth / 2;
    const cy = obj.y + obj.computedHeight / 2;
    const rx = obj.computedWidth / 2;
    const ry = obj.computedHeight / 2;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }
  if (obj.shape === "line") {
    return `<line x1="${obj.x}" y1="${obj.y + obj.computedHeight / 2}" x2="${obj.x + obj.computedWidth}" y2="${obj.y + obj.computedHeight / 2}" stroke="${fill}" stroke-width="6"/>`;
  }
  // rect (default)
  return `<rect x="${obj.x}" y="${obj.y}" width="${obj.computedWidth}" height="${obj.computedHeight}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
};

const findObject = (
  objects: LayoutObject[],
  id: string,
): LayoutObject | undefined => objects.find((o) => o.id === id);

const renderRelationship = (
  rel: SceneRelationship,
  objects: LayoutObject[],
  index: number,
): string => {
  const from = findObject(objects, rel.from);
  const to = findObject(objects, rel.to);
  if (!from || !to) return "";

  const fromCx = from.x + from.computedWidth / 2;
  const fromCy = from.y + from.computedHeight / 2;
  const toCx = to.x + to.computedWidth / 2;
  const toCy = to.y + to.computedHeight / 2;

  // Offset perpendicular so bidirectional pairs don't overlap.
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const perpOffset = index % 2 === 0 ? 0 : 20;
  const offsetX = (-dy / len) * perpOffset;
  const offsetY = (dx / len) * perpOffset;

  // Pull endpoints back from object edges (roughly).
  const edgePull = 0.25;
  const x1 = fromCx + dx * edgePull + offsetX;
  const y1 = fromCy + dy * edgePull + offsetY;
  const x2 = toCx - dx * edgePull + offsetX;
  const y2 = toCy - dy * edgePull + offsetY;

  const color = rel.type === "force" ? "#DC2626" : "#334155";
  const dash = rel.style === "dashed" ? 'stroke-dasharray="12,6"' : "";

  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" marker-end="url(#arrow)" ${dash}/>`;
};

export const buildSvg = (layout: LayoutResult): string => {
  const bgColor = resolveBackground(layout.background);
  const objectsSvg = layout.objects.map(renderObject).join("\n  ");
  const relsSvg = layout.relationships
    .map((r, i) => renderRelationship(r, layout.objects, i))
    .filter(Boolean)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.canvasWidth} ${layout.canvasHeight}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/>
    </marker>
  </defs>
  <rect width="${layout.canvasWidth}" height="${layout.canvasHeight}" fill="${bgColor}"/>
  ${objectsSvg}
  ${relsSvg}
  <!-- ${escapeXml(layout.background)} -->
</svg>`;
};

/** Rasterize an SVG string to a PNG Buffer using sharp. */
export const rasterizeSvg = async (svg: string): Promise<Buffer> => {
  return sharp(Buffer.from(svg)).png().toBuffer();
};

/** Convenience: convert SVG string to a data URL (for debugging / persistence). */
export const svgToDataUrl = (svg: string): string => {
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
};
