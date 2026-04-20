/**
 * Generic-scene layout.
 *
 * The escape hatch for non-physics-diagram content (dialogue, narrative,
 * abstract illustrations). Just places a central labeled subject and up
 * to three secondaries at left/right/below positions. The SVG builder
 * renders them as placeholders — GPT-image takes it from there.
 */

import type { GenericScene, SceneDescriptionV2 } from "../schema";
import {
  CANVAS,
  enforceCanvasMargins,
  resolveLabelPositions,
  type LayoutV2,
  type PlacedLabel,
  type PlacedSymbol,
} from "./helpers";

const BACKGROUND_BY_SETTING: Record<string, string> = {
  classroom: "#F8FAFC",
  outdoor: "#E0F2FE",
  lab: "#F5F3FF",
  playground: "#DCFCE7",
  indoor: "#FEF3C7",
};

export const layoutGenericScene = (scene: SceneDescriptionV2): LayoutV2 => {
  if (scene.scene.archetype !== "generic-scene") {
    throw new Error("layoutGenericScene called with non-generic-scene scene");
  }
  const gs = scene.scene as GenericScene;
  const W = CANVAS.width;
  const H = CANVAS.height;

  const symbols: PlacedSymbol[] = [];
  const labels: PlacedLabel[] = [];

  const bg =
    (gs.setting && BACKGROUND_BY_SETTING[gs.setting]) ?? BACKGROUND_BY_SETTING.classroom;

  // Generic-scene intentionally renders ZERO text in the SVG — any text
  // in the reference leaks into GPT-image's restyle and gets garbled
  // ("SPEED, MASS, AND COLLSION ENER" etc). The reference is purely a
  // position schematic for GPT-image to re-draw as a text-free scene.
  // The Stage 5 prompt still receives the scene labels + lesson context
  // so the model knows what to draw.

  // Central subject box.
  const subjectW = 260;
  const subjectH = 220;
  const sx = (W - subjectW) / 2;
  const sy = (H - subjectH) / 2 - 20;
  symbols.push({
    kind: "block",
    id: "subject",
    x: sx,
    y: sy,
    width: subjectW,
    height: subjectH,
    color: "#93C5FD",
  });

  // Secondaries.
  const secondaries = gs.secondaries ?? [];
  for (const s of secondaries) {
    const w = 160;
    const h = 140;
    let x = 0;
    let y = 0;
    if (s.position === "left") {
      x = sx - w - 60;
      y = sy + (subjectH - h) / 2;
    } else if (s.position === "right") {
      x = sx + subjectW + 60;
      y = sy + (subjectH - h) / 2;
    } else {
      // below
      x = (W - w) / 2;
      y = sy + subjectH + 70;
    }
    symbols.push({
      kind: "block",
      id: `sec-${s.label}`,
      x,
      y,
      width: w,
      height: h,
      color: "#BEF264",
    });
  }

  const layout: LayoutV2 = {
    canvas: { width: W, height: H, background: bg },
    symbols,
    labels,
    archetype: "generic-scene",
  };
  return enforceCanvasMargins({
    ...layout,
    labels: resolveLabelPositions(layout.labels),
  });
};
