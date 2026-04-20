/**
 * Free-body diagram layout.
 *
 * Single body centered, forces radiating outward. If a surface is set,
 * draw it underneath the body.
 */

import type { FreeBodyScene, SceneDescriptionV2 } from "../schema";
import {
  CANVAS,
  directionToUnit,
  enforceCanvasMargins,
  resolveLabelPositions,
  type LayoutV2,
  type PlacedLabel,
  type PlacedSymbol,
} from "./helpers";

const BACKGROUND = "#F8FAFC";

export const layoutFreeBody = (scene: SceneDescriptionV2): LayoutV2 => {
  if (scene.scene.archetype !== "free-body") {
    throw new Error("layoutFreeBody called with non-free-body scene");
  }
  const fb = scene.scene as FreeBodyScene;
  const W = CANVAS.width;
  const H = CANVAS.height;

  const symbols: PlacedSymbol[] = [];
  const labels: PlacedLabel[] = [];

  // Surface.
  const hasGround = fb.surface?.kind === "ground";
  const groundY = Math.round(H * 0.72);
  if (hasGround) {
    symbols.push({ kind: "track", y: groundY, x1: 120, x2: W - 120 });
  }

  // Body — use a square-ish box ~20% of canvas.
  const bodySize = 180;
  const cx = W / 2;
  const cy = hasGround ? groundY - bodySize / 2 - 4 : H / 2;
  const bodyX = cx - bodySize / 2;
  const bodyY = cy - bodySize / 2;

  const body = fb.body;
  symbols.push({
    kind: body.kind === "ball" ? "ball" : body.kind === "car" || body.kind === "cart" ? "cart" : "block",
    id: body.id,
    x: bodyX,
    y: bodyY,
    width: bodySize,
    height: bodySize,
    color: body.color,
  });

  // Forces — normalize magnitudes so longest = 150 px.
  const maxMag = Math.max(
    1,
    ...fb.forces.map((f) => f.magnitude_N ?? 1),
  );
  const forceMaxLen = 170;
  const forceMinLen = 90;

  for (const f of fb.forces) {
    const u = directionToUnit(f.direction);
    const mag = f.magnitude_N ?? maxMag;
    const len =
      forceMinLen +
      ((forceMaxLen - forceMinLen) * (mag / maxMag));
    // Start from body edge (approx) along direction u.
    const startOffset = bodySize / 2 + 6;
    const x1 = cx + u.dx * startOffset;
    const y1 = cy + u.dy * startOffset;
    const x2 = cx + u.dx * (startOffset + len);
    const y2 = cy + u.dy * (startOffset + len);
    symbols.push({
      kind: "arrow",
      id: f.id,
      x1,
      y1,
      x2,
      y2,
      color: "#DC2626",
      label: f.label,
      weight: "force",
    });
  }

  // Title top.
  labels.push({
    id: "title",
    text: scene.title,
    anchor: { x: W / 2, y: 44 },
    align: "center",
    size: 22,
    role: "caption",
  });

  // Body measurement below.
  const measureY = (hasGround ? groundY : cy + bodySize / 2) + 36;
  if (body.mass_kg !== undefined) {
    labels.push({
      id: `${body.id}-mass`,
      text: `m = ${body.mass_kg} kg`,
      anchor: { x: cx, y: measureY },
      align: "center",
      size: 15,
      role: "measurement",
    });
  }

  // Equation caption if provided.
  const eq = fb.annotations.find(
    (a): a is Extract<typeof a, { kind: "equation" }> => a.kind === "equation",
  );
  if (eq) {
    labels.push({
      id: "caption-equation",
      text: eq.tex,
      anchor: { x: W / 2, y: H - 36 },
      align: "center",
      size: 18,
      role: "equation",
    });
  }

  const layout: LayoutV2 = {
    canvas: { width: W, height: H, background: BACKGROUND },
    symbols,
    labels,
    archetype: "free-body",
  };
  return enforceCanvasMargins({
    ...layout,
    labels: resolveLabelPositions(layout.labels),
  });
};
