/**
 * Arrow symbol — thick stroke for forces, medium for velocities,
 * with arrowhead and offset label.
 */

import { labelText } from "./text";

export type ArrowOpts = {
  color: string;
  label: string;
  weight: "force" | "velocity";
  style?: "solid" | "dashed";
  id: string;
};

export const arrow = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: ArrowOpts,
): string => {
  const strokeWidth = opts.weight === "force" ? 5 : 3.5;
  const headSize = opts.weight === "force" ? 14 : 11;
  const markerId = `arrowhead-${opts.id}`;
  const dash = opts.style === "dashed" ? `stroke-dasharray="10,6"` : "";

  // Arrow line
  const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${opts.color}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#${markerId})" ${dash}/>`;

  // Arrowhead marker
  const marker = `
    <defs>
      <marker id="${markerId}" viewBox="0 0 ${headSize} ${headSize}" refX="${headSize - 2}" refY="${headSize / 2}" markerWidth="${headSize}" markerHeight="${headSize}" orient="auto-start-reverse">
        <path d="M 0 0 L ${headSize} ${headSize / 2} L 0 ${headSize} z" fill="${opts.color}"/>
      </marker>
    </defs>`;

  // Label positioned perpendicular to the midpoint
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const offset = opts.weight === "force" ? 28 : 18;
  // Always place the label ABOVE horizontal arrows (perp up in screen space).
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  const labelX = mx + (isHorizontal ? 0 : perpX * offset);
  const labelY = isHorizontal ? my - offset : my + perpY * offset;
  const labelFontSize = opts.weight === "force" ? 18 : 15;
  const label = labelText(labelX, labelY, opts.label, {
    size: labelFontSize,
    weight: "bold",
    color: opts.color,
    align: "center",
  });

  return `${marker}${line}${label}`;
};
