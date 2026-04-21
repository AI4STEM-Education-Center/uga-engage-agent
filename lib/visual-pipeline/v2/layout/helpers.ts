/**
 * Shared layout utilities — canvas geometry, direction unit vectors,
 * label-overlap resolution, margin enforcement.
 */

import type { Direction } from "../schema";

export const CANVAS = {
  width: 1024,
  height: 768, // landscape — physics diagrams prefer wide aspect
  margin: 48,
};

// ---------------------------------------------------------------------------
// Direction -> unit vector
// ---------------------------------------------------------------------------

export const directionToUnit = (d: Direction): { dx: number; dy: number } => {
  if (typeof d === "string") {
    switch (d) {
      case "left":
        return { dx: -1, dy: 0 };
      case "right":
        return { dx: 1, dy: 0 };
      case "up":
        return { dx: 0, dy: -1 };
      case "down":
        return { dx: 0, dy: 1 };
    }
  }
  const rad = (d.angle_deg * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: -Math.sin(rad) }; // y flipped (screen coords)
};

// ---------------------------------------------------------------------------
// Placed elements consumed by the SVG builder
// ---------------------------------------------------------------------------

export type PlacedSymbol =
  | {
      kind: "cart" | "block" | "ball" | "person";
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }
  | {
      kind: "spring";
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      coils?: number;
    }
  | {
      kind: "arrow";
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      label: string;
      weight: "force" | "velocity";
      style?: "solid" | "dashed";
    }
  | {
      kind: "track";
      y: number;
      x1: number;
      x2: number;
    };

export type PlacedLabel = {
  id: string;
  text: string;
  anchor: { x: number; y: number };
  align: "center" | "left" | "right";
  size: number;
  role: "measurement" | "caption" | "equation" | "label";
};

export type LayoutV2 = {
  canvas: { width: number; height: number; background: string };
  symbols: PlacedSymbol[];
  labels: PlacedLabel[];
  archetype: string;
};

// ---------------------------------------------------------------------------
// Label collision resolution (simple axis-aligned nudge).
//
// Two passes: label-vs-label AND label-vs-symbol. Symbol-overlap catches
// the cases user reported: force/velocity arrows with labels sitting on
// a body/block, or an equation caption that lands on a downward arrow.
// ---------------------------------------------------------------------------

type Rect = { x: number; y: number; w: number; h: number };

const labelBounds = (l: PlacedLabel): Rect => {
  const approxWidth = l.text.length * l.size * 0.55;
  const approxHeight = l.size * 1.1;
  const x =
    l.align === "center"
      ? l.anchor.x - approxWidth / 2
      : l.align === "right"
        ? l.anchor.x - approxWidth
        : l.anchor.x;
  const y = l.anchor.y - approxHeight;
  return { x, y, w: approxWidth, h: approxHeight };
};

// Treat each symbol as a bounding rect for overlap checks. Arrows/springs
// are thin diagonals — approximate with their axis-aligned bbox plus a
// small margin since labels shouldn't sit near the shaft either.
const symbolBounds = (s: PlacedSymbol): Rect => {
  if (s.kind === "arrow" || s.kind === "spring") {
    const x = Math.min(s.x1, s.x2) - 4;
    const y = Math.min(s.y1, s.y2) - 4;
    const w = Math.abs(s.x2 - s.x1) + 8;
    const h = Math.abs(s.y2 - s.y1) + 8;
    return { x, y, w, h };
  }
  if (s.kind === "track") {
    // thin line — don't over-claim space
    return { x: s.x1, y: s.y - 3, w: s.x2 - s.x1, h: 6 };
  }
  return { x: s.x, y: s.y, w: s.width, h: s.height };
};

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const resolveLabelPositions = (
  labels: PlacedLabel[],
  symbols: PlacedSymbol[] = [],
): PlacedLabel[] => {
  const out = labels.map((l) => ({ ...l }));
  const maxPasses = 8;
  const nudge = 14;
  const symRects = symbols.map(symbolBounds);
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    // label-vs-label
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = labelBounds(out[i]);
        const b = labelBounds(out[j]);
        if (overlap(a, b)) {
          // push whichever is lower further down
          if (out[j].anchor.y >= out[i].anchor.y) {
            out[j].anchor.y += nudge;
          } else {
            out[i].anchor.y += nudge;
          }
          moved = true;
        }
      }
    }
    // label-vs-symbol — push label away from the symbol along shortest axis.
    for (let i = 0; i < out.length; i++) {
      for (let k = 0; k < symRects.length; k++) {
        const lr = labelBounds(out[i]);
        const sr = symRects[k]!;
        if (!overlap(lr, sr)) continue;
        // Which direction requires the least movement to escape?
        const pushDown = sr.y + sr.h - lr.y + 4;       // move label down to below symbol
        const pushUp = lr.y + lr.h - sr.y + 4;          // move label up to above symbol
        if (pushUp <= pushDown) {
          out[i].anchor.y -= pushUp;
        } else {
          out[i].anchor.y += pushDown;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Margin enforcement — uniform scale-down if anything hangs over the edge.
// ---------------------------------------------------------------------------

export const enforceCanvasMargins = (
  layout: LayoutV2,
  margin = CANVAS.margin,
): LayoutV2 => {
  const { width, height } = layout.canvas;
  const xs: number[] = [];
  const ys: number[] = [];

  for (const s of layout.symbols) {
    if (s.kind === "arrow" || s.kind === "spring") {
      xs.push(s.x1, s.x2);
      ys.push(s.y1, s.y2);
    } else if (s.kind === "track") {
      xs.push(s.x1, s.x2);
      ys.push(s.y);
    } else {
      xs.push(s.x, s.x + s.width);
      ys.push(s.y, s.y + s.height);
    }
  }
  for (const l of layout.labels) {
    const b = labelBounds(l);
    xs.push(b.x, b.x + b.w);
    ys.push(b.y, b.y + b.h);
  }
  if (xs.length === 0) return layout;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const overLeft = margin - minX;
  const overRight = maxX - (width - margin);
  const overTop = margin - minY;
  const overBottom = maxY - (height - margin);

  if (overLeft <= 0 && overRight <= 0 && overTop <= 0 && overBottom <= 0) {
    return layout;
  }

  // Simple uniform shrink toward canvas center.
  const usableW = width - 2 * margin;
  const usableH = height - 2 * margin;
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const scale = Math.min(usableW / contentW, usableH / contentH, 1);
  if (scale >= 0.98) return layout;

  const cx = width / 2;
  const cy = height / 2;
  const sx = (x: number) => cx + (x - (minX + maxX) / 2) * scale;
  const sy = (y: number) => cy + (y - (minY + maxY) / 2) * scale;

  const scaled: LayoutV2 = {
    ...layout,
    symbols: layout.symbols.map((s) => {
      if (s.kind === "arrow" || s.kind === "spring") {
        return { ...s, x1: sx(s.x1), y1: sy(s.y1), x2: sx(s.x2), y2: sy(s.y2) };
      }
      if (s.kind === "track") {
        return { ...s, x1: sx(s.x1), x2: sx(s.x2), y: sy(s.y) };
      }
      return {
        ...s,
        x: sx(s.x),
        y: sy(s.y),
        width: s.width * scale,
        height: s.height * scale,
      };
    }),
    labels: layout.labels.map((l) => ({
      ...l,
      anchor: { x: sx(l.anchor.x), y: sy(l.anchor.y) },
      size: l.size * Math.max(scale, 0.7),
    })),
  };
  return scaled;
};
