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
  it("places subject + secondaries as blocks with NO text labels", () => {
    const layout = computeLayoutV2(loadFixture());
    const blocks = layout.symbols.filter((s) => s.kind === "block").length;
    expect(blocks).toBe(3); // subject + 2 secondaries
    // Text is intentionally stripped for generic-scene so the SVG is
    // truly text-free — prevents text leaks into Stage-5 restyle.
    expect(layout.labels.length).toBe(0);
  });

  it("renders a valid SVG document with no text elements", () => {
    const svg = buildSvgV2(computeLayoutV2(loadFixture()));
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("Experiment setup");
    expect(svg).not.toContain("<text");
  });
});
