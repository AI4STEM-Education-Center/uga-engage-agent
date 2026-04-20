#!/usr/bin/env tsx
/**
 * Smoke test — builds SVG + PNG for each Tier-1 fixture. No API.
 *
 *   tsx scripts/smoke-v2.ts
 *
 * Writes to output/v2-smoke/.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { computeLayoutV2 } from "../lib/visual-pipeline/v2/layout";
import { SceneDescriptionV2 } from "../lib/visual-pipeline/v2/schema";
import { buildSvgV2, rasterizeSvgV2 } from "../lib/visual-pipeline/v2/svg/build";

const OUT = "output/v2-smoke";
mkdirSync(OUT, { recursive: true });

const FIXTURES = ["collision", "free-body", "generic-scene"] as const;

const run = async () => {
  for (const key of FIXTURES) {
    const raw = JSON.parse(
      readFileSync(
        `__tests__/lib/visual-pipeline/v2/fixtures/${key}.json`,
        "utf-8",
      ),
    );
    const scene = SceneDescriptionV2.parse(raw); // Zod validation

    const layout = computeLayoutV2(scene);
    const svg = buildSvgV2(layout);
    const png = await rasterizeSvgV2(svg);

    writeFileSync(join(OUT, `${key}.svg`), svg);
    writeFileSync(join(OUT, `${key}.png`), png);
    console.log(
      `[smoke] ${key}: archetype=${scene.scene.archetype} symbols=${layout.symbols.length} labels=${layout.labels.length} svg=${svg.length}B png=${png.length}B`,
    );
  }
  console.log(`\nDone. Open ${OUT}/*.png to inspect.`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
