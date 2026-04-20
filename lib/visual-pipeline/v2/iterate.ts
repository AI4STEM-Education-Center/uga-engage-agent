/**
 * Stage 4 iteration loop — build → rasterize → review → auto-fix → rebuild.
 *
 * Fixes are applied to the LayoutV2 structure (not to the SVG string),
 * then the SVG is rebuilt fresh. Bounded at MAX_ITERATIONS to control
 * cost. One optional scene-level regenerate per run.
 */

import type OpenAI from "openai";

import { computeLayoutV2 } from "./layout";
import { CANVAS, enforceCanvasMargins } from "./layout/helpers";
import type { LayoutV2, PlacedSymbol } from "./layout/helpers";
import type { SceneDescriptionV2 } from "./schema";
import { describeSceneV2 } from "./scene-describer-v2";
import { buildSvgV2, rasterizeSvgV2 } from "./svg/build";
import type { SuggestedFix } from "./vision-reviewer";
import { reviewDiagram, type ReviewReport } from "./vision-reviewer";
import type { ResolvedContentItem } from "@/lib/content-generator";

export const MAX_ITERATIONS = 2;

type HistoryEntry = {
  iteration: number;
  report: ReviewReport;
  appliedFixes: SuggestedFix[];
};

export type IterateResult = {
  scene: SceneDescriptionV2;
  layout: LayoutV2;
  svg: string;
  rasterPng: Buffer;
  finalReport: ReviewReport;
  history: HistoryEntry[];
  reviewPassed: boolean;
  regeneratedScene: boolean;
};

// ---------------------------------------------------------------------------
// applyFix — mutate a layout in response to one suggested_fix.
// Returns true if the fix was actionable.
// ---------------------------------------------------------------------------

const findSymbol = (layout: LayoutV2, id: string): PlacedSymbol | undefined =>
  layout.symbols.find(
    (s) =>
      ("id" in s && s.id === id) ||
      ("label" in s && s.label === id),
  );

const scaleArrow = (sym: PlacedSymbol, factor: number) => {
  if (sym.kind !== "arrow") return;
  const mx = (sym.x1 + sym.x2) / 2;
  const my = (sym.y1 + sym.y2) / 2;
  sym.x1 = mx + (sym.x1 - mx) * factor;
  sym.y1 = my + (sym.y1 - my) * factor;
  sym.x2 = mx + (sym.x2 - mx) * factor;
  sym.y2 = my + (sym.y2 - my) * factor;
};

export const applyFix = (layout: LayoutV2, fix: SuggestedFix): boolean => {
  switch (fix.kind) {
    case "scale": {
      const sym = findSymbol(layout, fix.target);
      if (!sym) return false;
      if (sym.kind === "arrow") {
        scaleArrow(sym, fix.factor);
        return true;
      }
      if (sym.kind === "block" || sym.kind === "cart" || sym.kind === "ball" || sym.kind === "person") {
        const oldW = sym.width;
        const oldH = sym.height;
        sym.width *= fix.factor;
        sym.height *= fix.factor;
        // keep centered on original anchor
        sym.x -= (sym.width - oldW) / 2;
        sym.y -= (sym.height - oldH) / 2;
        return true;
      }
      return false;
    }
    case "reposition": {
      const label = layout.labels.find((l) => l.id === fix.target || l.text === fix.target);
      if (label) {
        const { width, height } = layout.canvas;
        switch (fix.to) {
          case "above":
            label.anchor.y = Math.max(40, label.anchor.y - 60);
            break;
          case "below":
            label.anchor.y = Math.min(height - 40, label.anchor.y + 60);
            break;
          case "left":
            label.anchor.x = Math.max(60, label.anchor.x - 120);
            break;
          case "right":
            label.anchor.x = Math.min(width - 60, label.anchor.x + 120);
            break;
          case "center":
            label.anchor.x = width / 2;
            break;
        }
        return true;
      }
      return false;
    }
    case "increase_margin": {
      return layout.symbols.length > 0 && (() => {
        const scaled = enforceCanvasMargins(layout, CANVAS.margin * 1.6);
        layout.symbols = scaled.symbols;
        layout.labels = scaled.labels;
        return true;
      })();
    }
    case "add_missing":
    case "remove":
    case "regenerate_scene":
    case "other":
      return false; // handled at iterate-level or skipped
  }
};

// ---------------------------------------------------------------------------
// Iterate — the main loop.
// ---------------------------------------------------------------------------

type IterateDeps = {
  client: OpenAI;
  item: ResolvedContentItem;
  lessonNumber: number;
};

export const iterateWithReview = async (
  scene: SceneDescriptionV2,
  deps: IterateDeps,
): Promise<IterateResult> => {
  let currentScene = scene;
  let currentLayout = computeLayoutV2(currentScene);
  let currentSvg = buildSvgV2(currentLayout);
  let currentPng = await rasterizeSvgV2(currentSvg);
  let regeneratedScene = false;

  const history: HistoryEntry[] = [];

  for (let iter = 0; iter < MAX_ITERATIONS + 1; iter++) {
    let report: ReviewReport;
    try {
      report = await reviewDiagram(deps.client, currentScene, currentPng);
    } catch (err) {
      // Reviewer failures (bad JSON shape from gpt-4o, network, etc.) must
      // not kill the whole pipeline. Skip review and proceed with current
      // SVG. Stage 5 still runs; caller sees reviewPassed=false.
      console.error(`[iterate] vision review failed on iter ${iter}: ${err}`);
      return {
        scene: currentScene,
        layout: currentLayout,
        svg: currentSvg,
        rasterPng: currentPng,
        finalReport: {
          pass: false,
          issues: [],
          score: { structure: 3, labels: 3, physics: 3, aesthetics: 3, crop: 3 },
          notes: "review unavailable — proceeded without feedback",
        },
        history,
        reviewPassed: false,
        regeneratedScene,
      };
    }
    const entry: HistoryEntry = { iteration: iter, report, appliedFixes: [] };
    history.push(entry);
    if (report.pass || iter >= MAX_ITERATIONS) {
      return {
        scene: currentScene,
        layout: currentLayout,
        svg: currentSvg,
        rasterPng: currentPng,
        finalReport: report,
        history,
        reviewPassed: report.pass,
        regeneratedScene,
      };
    }

    // Apply the most aggressive actionable fix first — blockers over majors.
    const blockers = report.issues.filter((i) => i.severity === "blocker");
    const majors = report.issues.filter((i) => i.severity === "major");
    const ordered = [...blockers, ...majors];

    // If any fix is regenerate_scene AND we haven't done so, regenerate
    // scene once with the reason fed back.
    const regen = ordered.find((i) => i.suggested_fix.kind === "regenerate_scene");
    if (regen && regen.suggested_fix.kind === "regenerate_scene" && !regeneratedScene) {
      regeneratedScene = true;
      entry.appliedFixes.push(regen.suggested_fix);
      currentScene = await describeSceneV2(deps.client, deps.item, deps.lessonNumber, {
        retryOnParseFail: true,
      });
      currentLayout = computeLayoutV2(currentScene);
      currentSvg = buildSvgV2(currentLayout);
      currentPng = await rasterizeSvgV2(currentSvg);
      continue;
    }

    let anyApplied = false;
    for (const issue of ordered) {
      if (applyFix(currentLayout, issue.suggested_fix)) {
        entry.appliedFixes.push(issue.suggested_fix);
        anyApplied = true;
      }
    }
    if (!anyApplied) {
      // Nothing actionable at layout level; break to avoid wasting review calls.
      return {
        scene: currentScene,
        layout: currentLayout,
        svg: currentSvg,
        rasterPng: currentPng,
        finalReport: report,
        history,
        reviewPassed: false,
        regeneratedScene,
      };
    }
    currentSvg = buildSvgV2(currentLayout);
    currentPng = await rasterizeSvgV2(currentSvg);
  }

  // Unreachable — the loop returns inside.
  throw new Error("iterateWithReview exited unexpectedly");
};
