/**
 * Free-body archetype — deterministic Stage 2 + 3 test.
 */

import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import { computeLayoutV2 } from "../../../../lib/visual-pipeline/v2/layout";
import { SceneDescriptionV2 } from "../../../../lib/visual-pipeline/v2/schema";
import { buildSvgV2 } from "../../../../lib/visual-pipeline/v2/svg/build";

const loadFixture = () => {
  const raw = JSON.parse(
    readFileSync(__dirname + "/fixtures/free-body.json", "utf-8"),
  );
  return SceneDescriptionV2.parse(raw);
};

describe("free-body archetype", () => {
  it("produces a layout with body, four forces, ground, and mass label", () => {
    const layout = computeLayoutV2(loadFixture());
    const kinds = layout.symbols.map((s) => s.kind);
    expect(kinds.filter((k) => k === "arrow").length).toBe(4);
    expect(kinds).toContain("track");
    // One body block
    expect(kinds.filter((k) => k === "block").length).toBe(1);
    // Mass label present
    const labelTexts = layout.labels.map((l) => l.text);
    expect(labelTexts).toContain("m = 10 kg");
  });

  it("SVG contains all four force labels", () => {
    const svg = buildSvgV2(computeLayoutV2(loadFixture()));
    // Fg, FN, F_app, Ff are all rendered (F_app uses subscript; others don't).
    expect(svg).toContain("Fg");
    expect(svg).toContain("FN");
    expect(svg).toMatch(/F<tspan[^>]*>app<\/tspan>/);
    expect(svg).toContain("Ff");
  });
});
