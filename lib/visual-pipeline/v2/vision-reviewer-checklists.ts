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

const GENERIC_SCENE = `For this GENERIC-SCENE (non-physics-diagram), reviewing a LAYOUT SCHEMATIC:

  1. A central subject placeholder BLOCK is present.
  2. Any secondary placeholder BLOCKS are at the stated positions (left /
     right / below the subject).
  3. Nothing cropped at the canvas edges.

  IMPORTANT CONTEXT:
  - This is a generic-scene archetype, NOT a physics diagram. The SVG
    is INTENTIONALLY text-free: no labels, no title, no captions. The
    reason is that any text baked into the reference SVG gets garbled
    by GPT-image's restyle step (diffusion models cannot render text
    reliably). The placeholders are pure position hints for GPT-image
    to re-draw as a labeled scene.
  - DO NOT flag "missing labels" / "missing title" as an issue. The
    absence of text is the correct design.
  - DO NOT compare against the scene JSON's subject.label or
    secondaries[i].label for text legibility. Those labels are passed
    to Stage 5 via the prompt, not rendered in the SVG.
  - The physics-rigor bar does not apply. Only flag structural or
    layout problems (missing placeholder, overlap, crop).`;

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
