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

  // Find which directions have forces so we can place labels where
  // arrows are NOT drawn.
  const dirHas = { up: false, down: false, left: false, right: false };
  for (const f of fb.forces) {
    const u = directionToUnit(f.direction);
    if (Math.abs(u.dx) >= Math.abs(u.dy)) {
      if (u.dx > 0) dirHas.right = true;
      else if (u.dx < 0) dirHas.left = true;
    } else {
      if (u.dy > 0) dirHas.down = true;
      else if (u.dy < 0) dirHas.up = true;
    }
  }

  // Body measurement — pick a side that doesn't collide with force arrows.
  // When all four sides have forces, place in a diagonal gap (below-right
  // corner of the body) where arrow shafts don't reach.
  if (body.mass_kg !== undefined) {
    const measureLabel = `m = ${body.mass_kg} kg`;
    let mx: number, my: number;
    if (!dirHas.down) {
      mx = cx;
      my = (hasGround ? groundY : cy + bodySize / 2) + 36;
    } else if (!dirHas.up) {
      mx = cx;
      my = cy - bodySize / 2 - 16;
    } else if (!dirHas.right) {
      mx = cx + bodySize / 2 + 90;
      my = cy;
    } else if (!dirHas.left) {
      mx = cx - bodySize / 2 - 90;
      my = cy;
    } else {
      // All 4 cardinals taken — drop it in the below-right diagonal gap
      // between the down and right arrows.
      mx = cx + bodySize / 2 + 60;
      my = cy + bodySize / 2 + 40;
    }
    labels.push({
      id: `${body.id}-mass`,
      text: measureLabel,
      anchor: { x: mx, y: my },
      align: "center",
      size: 15,
      role: "measurement",
    });
  }

  // Equation caption — prefer the bottom unless a downward force lives
  // there, otherwise place above title row.
  const eq = fb.annotations.find(
    (a): a is Extract<typeof a, { kind: "equation" }> => a.kind === "equation",
  );
  if (eq) {
    const eqY = dirHas.down ? 80 : H - 36;
    labels.push({
      id: "caption-equation",
      text: eq.tex,
      anchor: { x: W / 2, y: eqY },
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
    labels: resolveLabelPositions(layout.labels, layout.symbols),
  });
};
