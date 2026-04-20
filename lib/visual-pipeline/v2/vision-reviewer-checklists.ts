/**
 * Per-archetype checklists for Stage 4 — what the reviewer should verify.
 * These are plain-English strings embedded directly into the reviewer
 * prompt so the LLM has explicit acceptance criteria.
 */

import type { Archetype } from "./schema";

const COLLISION = `For this COLLISION diagram, verify:
  1. Two body shapes visible on a ground line (carts, blocks, or balls).
  2. Between them is a contact symbol (a spring zigzag if contact.kind === "spring",
     or they touch directly otherwise).
  3. One action-reaction force pair is present and labeled (F_AB and F_BA, or
     similar). The two force arrows must point in OPPOSITE directions.
  4. Force arrows are drawn above/around the bodies — not hidden behind them.
     Force labels must be legible and not overlap the arrow shaft.
  5. Velocity arrows above each body, labeled with "v = X m/s" values from
     the scene JSON.
  6. Mass and velocity measurements printed below each body (e.g. "m = 1200 kg"),
     matching the values in the scene JSON.
  7. Equation caption at the bottom if present in scene (e.g. "F_AB = -F_BA").
  8. Nothing cropped at the canvas edges.
  9. No two labels overlap each other.`;

const FREE_BODY = `For this FREE-BODY diagram, verify:
  1. A single central body.
  2. All forces from the scene JSON are drawn as labeled arrows radiating
     outward from the body in the correct direction. Each arrow has a
     visible label (e.g. "Fg", "FN", "F_app").
  3. Arrow lengths roughly reflect magnitudes (longer arrow = larger force)
     if magnitudes are given.
  4. No force arrow is hidden behind another arrow or behind the body.
  5. Mass measurement (if present in scene) is clearly visible and readable.
  6. Equation caption (if present in annotations) is visible and not
     overlapping other elements.
  7. Nothing cropped at the canvas edges.
  8. Labels do not overlap each other.`;

const GENERIC_SCENE = `For this GENERIC-SCENE (non-physics-diagram):
  1. A central subject placeholder with its label.
  2. Any secondary placeholders with their labels at the stated positions.
  3. Labels fit within the canvas and do not overlap.
  4. Nothing cropped at the canvas edges.
  NOTE: This archetype is a layout placeholder for GPT-image to render; the
  physics-rigor bar from collision/free-body does not apply. Only flag
  structural/layout issues.`;

export const checklistForArchetype = (archetype: Archetype): string => {
  switch (archetype) {
    case "collision":
      return COLLISION;
    case "free-body":
      return FREE_BODY;
    case "generic-scene":
      return GENERIC_SCENE;
  }
};
