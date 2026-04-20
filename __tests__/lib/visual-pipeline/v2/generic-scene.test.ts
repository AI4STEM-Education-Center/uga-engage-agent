/**
 * Generic-scene archetype — deterministic Stage 2 + 3 test.
 */

import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import { computeLayoutV2 } from "../../../../lib/visual-pipeline/v2/layout";
import { SceneDescriptionV2 } from "../../../../lib/visual-pipeline/v2/schema";
import { buildSvgV2 } from "../../../../lib/visual-pipeline/v2/svg/build";

const loadFixture = () => {
  const raw = JSON.parse(
    readFileSync(__dirname + "/fixtures/generic-scene.json", "utf-8"),
  );
  return SceneDescriptionV2.parse(raw);
};

describe("generic-scene archetype", () => {
  it("places subject + secondaries as blocks with labels", () => {
    const layout = computeLayoutV2(loadFixture());
    const blocks = layout.symbols.filter((s) => s.kind === "block").length;
    expect(blocks).toBe(3); // subject + 2 secondaries
    const labels = layout.labels.map((l) => l.text);
    expect(labels).toContain("Experiment setup");
    expect(labels).toContain("Student A");
    expect(labels).toContain("Student B");
  });

  it("renders a valid SVG document", () => {
    const svg = buildSvgV2(computeLayoutV2(loadFixture()));
    expect(svg).toContain("<svg");
    expect(svg).toContain("Experiment setup");
  });
});
