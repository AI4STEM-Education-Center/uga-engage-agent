/**
 * Collision archetype — deterministic Stage 2 + 3 test.
 *
 * Loads the canonical collision fixture (matches Arne slide 3 values)
 * and verifies that the layout + SVG builder produce a scientifically
 * complete diagram: both bodies present, the action-reaction force pair
 * labeled F_AB / F_BA, mass and velocity captions, and the equation.
 */

import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import { computeLayoutV2 } from "../../../../lib/visual-pipeline/v2/layout";
import { SceneDescriptionV2 } from "../../../../lib/visual-pipeline/v2/schema";
import { buildSvgV2 } from "../../../../lib/visual-pipeline/v2/svg/build";

const loadFixture = () => {
  const raw = JSON.parse(
    readFileSync(
      __dirname + "/fixtures/collision.json",
      "utf-8",
    ),
  );
  return SceneDescriptionV2.parse(raw);
};

describe("collision archetype", () => {
  it("parses the canonical fixture without error", () => {
    const scene = loadFixture();
    expect(scene.scene.archetype).toBe("collision");
  });

  it("produces a layout with both bodies, force pair, velocity pair, spring, and ground", () => {
    const layout = computeLayoutV2(loadFixture());
    const kinds = layout.symbols.map((s) => s.kind);
    // Two body symbols (cart for cars)
    expect(kinds.filter((k) => k === "cart").length).toBe(2);
    // Ground track
    expect(kinds).toContain("track");
    // Contact spring
    expect(kinds).toContain("spring");
    // Arrows = 2 forces + 2 velocities
    expect(kinds.filter((k) => k === "arrow").length).toBe(4);
  });

  it("SVG contains the expected scientific labels", () => {
    const svg = buildSvgV2(computeLayoutV2(loadFixture()));
    // Both force labels (F_AB / F_BA rendered with subscripts)
    expect(svg).toMatch(/F<tspan[^>]*>AB<\/tspan>/);
    expect(svg).toMatch(/F<tspan[^>]*>BA<\/tspan>/);
    // Measurements
    expect(svg).toContain("m = 1200 kg");
    expect(svg).toContain("v = 15 m/s");
    // Equation caption
    expect(svg).toMatch(/F<tspan[^>]*>AB<\/tspan> = -F<tspan[^>]*>BA<\/tspan>/);
  });

  it("SVG output is valid XML framing", () => {
    const svg = buildSvgV2(computeLayoutV2(loadFixture()));
    expect(svg).toMatch(/^<\?xml/);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
