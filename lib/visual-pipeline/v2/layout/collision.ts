/**
 * Collision archetype layout.
 *
 * Two bodies on a ground line, contact symbol between them (spring or
 * direct), velocity arrows above each body, opposite force pair at the
 * contact point, measurement captions below each body, equation at the
 * bottom.
 *
 * Target look: Arne's slide 4.
 */

import type {
  CollisionScene,
  SceneDescriptionV2,
} from "../schema";
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

export const layoutCollision = (scene: SceneDescriptionV2): LayoutV2 => {
  if (scene.scene.archetype !== "collision") {
    throw new Error("layoutCollision called with non-collision scene");
  }
  const col = scene.scene as CollisionScene;
  const [A, B] = col.bodies;

  const W = CANVAS.width;
  const H = CANVAS.height;

  // Ground baseline at ~70% down.
  const groundY = Math.round(H * 0.68);

  // Body geometry.
  const bodyW = 200;
  const bodyH = 120; // includes wheels for cart
  const gap = col.contact.kind === "spring" ? 180 : 80;
  const totalW = bodyW * 2 + gap;
  const startX = Math.round((W - totalW) / 2);

  // Identify left/right body by `role` if given, else by order.
  const leftBody = A.role === "right" ? B : A;
  const rightBody = A.role === "right" ? A : B;

  const symbols: PlacedSymbol[] = [];
  const labels: PlacedLabel[] = [];

  // Ground track (extends edge-to-edge with padding).
  symbols.push({
    kind: "track",
    y: groundY,
    x1: 60,
    x2: W - 60,
  });

  // Left body.
  const leftX = startX;
  const leftY = groundY - bodyH;
  symbols.push({
    kind: leftBody.kind === "car" || leftBody.kind === "cart" ? "cart" : "block",
    id: leftBody.id,
    x: leftX,
    y: leftY,
    width: bodyW,
    height: bodyH,
    color: leftBody.color,
  });

  // Right body.
  const rightX = startX + bodyW + gap;
  const rightY = groundY - bodyH;
  symbols.push({
    kind:
      rightBody.kind === "car" || rightBody.kind === "cart" ? "cart" : "block",
    id: rightBody.id,
    x: rightX,
    y: rightY,
    width: bodyW,
    height: bodyH,
    color: rightBody.color,
  });

  // Contact symbol between bodies.
  const contactY = groundY - bodyH * 0.55;
  const contactX1 = leftX + bodyW;
  const contactX2 = rightX;
  if (col.contact.kind === "spring") {
    symbols.push({
      kind: "spring",
      id: "contact-spring",
      x1: contactX1,
      y1: contactY,
      x2: contactX2,
      y2: contactY,
      coils: 8,
    });
  }

  // Force arrows — drawn above the bodies, outside/away from the contact.
  // Slide 4 convention: F_AB and F_BA point AWAY from the contact point
  // (since each body's force is opposite to its velocity — decelerating it).
  // A collision diagram focuses on the action-reaction CONTACT pair; we
  // deliberately skip gravity/normal forces (they balance out and clutter
  // the Newton's Third Law visualization).
  const forceY = leftY - 46;
  const forceLen = 130;
  const forces = col.forces
    .filter((f) => f.kind === "contact" || f.kind === "spring")
    .slice(0, 4);
  for (const f of forces) {
    const u = directionToUnit(f.direction);
    const onLeft = f.on === leftBody.id;
    // Anchor near the far edge of the body (the edge pointing away from
    // contact) — this reads as "force acting on this body, pushing it away
    // from the other body".
    const anchorX = onLeft ? leftX + bodyW * 0.35 : rightX + bodyW * 0.65;
    const x1 = anchorX;
    const y1 = forceY;
    const x2 = anchorX + u.dx * forceLen;
    const y2 = forceY + u.dy * forceLen;
    const color = onLeft ? "#DC2626" : "#2563EB"; // red for F_BA (on A), blue for F_AB (on B) — matches slide 4
    symbols.push({
      kind: "arrow",
      id: f.id,
      x1,
      y1,
      x2,
      y2,
      color,
      label: f.label,
      weight: "force",
    });
  }

  // Velocity arrows — below force arrows, above the bodies. Point in
  // direction of motion (inward toward contact for a head-on collision).
  const velArrowLen = 100;
  const velArrowY = leftY - 16;
  for (const body of [leftBody, rightBody]) {
    if (body.velocity_ms === undefined || body.velocity_ms === 0) continue;
    const dir = body.direction ?? (body === leftBody ? "right" : "left");
    const u = directionToUnit(dir);
    const bodyCx =
      body === leftBody ? leftX + bodyW / 2 : rightX + bodyW / 2;
    const x1 = bodyCx - (u.dx * velArrowLen) / 2;
    const y1 = velArrowY - (u.dy * velArrowLen) / 2;
    const x2 = bodyCx + (u.dx * velArrowLen) / 2;
    const y2 = velArrowY + (u.dy * velArrowLen) / 2;
    symbols.push({
      kind: "arrow",
      id: `v_${body.id}`,
      x1,
      y1,
      x2,
      y2,
      color: "#059669", // emerald — velocity
      label: `v = ${body.velocity_ms} m/s`,
      weight: "velocity",
    });
  }

  // Measurement labels below each body. Pull from annotations or body props.
  const measureY = groundY + 28;
  const pushMeasurement = (
    bodyId: string,
    cx: number,
    bodyProps: { mass_kg?: number; velocity_ms?: number },
  ) => {
    const anns = col.annotations.filter(
      (a) => a.kind === "measurement" && a.attached_to === bodyId,
    );
    const lines: string[] = [];
    for (const a of anns) if (a.kind === "measurement") lines.push(a.text);
    if (lines.length === 0) {
      if (bodyProps.mass_kg !== undefined)
        lines.push(`m = ${bodyProps.mass_kg} kg`);
      if (bodyProps.velocity_ms !== undefined)
        lines.push(`v = ${bodyProps.velocity_ms} m/s`);
    }
    lines.forEach((text, idx) => {
      labels.push({
        id: `${bodyId}-measure-${idx}`,
        text,
        anchor: { x: cx, y: measureY + idx * 22 },
        align: "center",
        size: 15,
        role: "measurement",
      });
    });
  };
  pushMeasurement(leftBody.id, leftX + bodyW / 2, {
    mass_kg: leftBody.mass_kg,
    velocity_ms: leftBody.velocity_ms,
  });
  pushMeasurement(rightBody.id, rightX + bodyW / 2, {
    mass_kg: rightBody.mass_kg,
    velocity_ms: rightBody.velocity_ms,
  });

  // Title at top.
  labels.push({
    id: "title",
    text: scene.title,
    anchor: { x: W / 2, y: 44 },
    align: "center",
    size: 22,
    role: "caption",
  });

  // Equation captions at bottom. Render caption_equation (the canonical
  // law anchor, e.g. "F_AB = -F_BA") PLUS any equation annotations (e.g.
  // scenario-specific: "KE_before - KE_after = E_def + E_heat"). They
  // stack from the bottom up.
  const equations: string[] = [];
  if (col.caption_equation) equations.push(col.caption_equation);
  for (const a of col.annotations) {
    if (a.kind === "equation" && a.tex !== col.caption_equation) {
      equations.push(a.tex);
    }
  }
  const eqLineHeight = 24;
  equations.forEach((text, idx) => {
    // Stack from the bottom: last equation sits at y=H-36, earlier
    // equations sit above it.
    const y = H - 36 - (equations.length - 1 - idx) * eqLineHeight;
    labels.push({
      id: `caption-equation-${idx}`,
      text,
      anchor: { x: W / 2, y },
      align: "center",
      size: 18,
      role: "equation",
    });
  });

  const layout: LayoutV2 = {
    canvas: { width: W, height: H, background: BACKGROUND },
    symbols,
    labels,
    archetype: "collision",
  };

  const resolvedLabels = resolveLabelPositions(layout.labels);
  return enforceCanvasMargins({ ...layout, labels: resolvedLabels });
};
