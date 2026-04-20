#!/usr/bin/env tsx
/**
 * Rubric aggregator.
 *
 * Reads all *_review.json under an iter dir, writes scorecard.md with
 * per-case per-dimension numbers, stops-criteria check, and likely
 * stage-ownership of each failure.
 *
 *   tsx scripts/score-pipeline.ts output/pipeline-test-v2/iter2
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const iterDir = process.argv[2];
if (!iterDir) {
  console.error("Usage: tsx scripts/score-pipeline.ts <iter-dir>");
  process.exit(1);
}
if (!existsSync(iterDir)) {
  console.error(`Directory not found: ${iterDir}`);
  process.exit(1);
}

type ReviewScore = {
  structure: number;
  labels: number;
  physics: number;
  aesthetics: number;
  crop: number;
};
type ReviewIssue = {
  id: string;
  severity: "blocker" | "major" | "minor";
  category: "structure" | "labels" | "physics" | "aesthetics" | "crop";
  description: string;
  suggested_fix: { kind: string };
};
type ReviewReport = {
  pass: boolean;
  score: ReviewScore;
  issues: ReviewIssue[];
};
type CaseReport = {
  key: string;
  reviewPassed: boolean;
  regeneratedScene?: boolean;
  finalReport: ReviewReport;
};

const reviewFiles = readdirSync(iterDir)
  .filter((f) => f.endsWith("_review.json"))
  .sort();

const cases: CaseReport[] = reviewFiles.map((f) => {
  const raw = JSON.parse(readFileSync(join(iterDir, f), "utf-8"));
  return {
    key: f.replace(/_review\.json$/, ""),
    reviewPassed: raw.reviewPassed ?? raw.finalReport?.pass ?? false,
    regeneratedScene: raw.regeneratedScene,
    finalReport: raw.finalReport ?? raw,
  };
});

if (cases.length === 0) {
  console.error("No *_review.json files in " + iterDir);
  process.exit(1);
}

const seedPath = join(iterDir, "seed.json");
const seed = existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, "utf-8")) : null;

// ---------------------------------------------------------------------------
// Diagnose weakest stage per case (Plan Part C.4).
// ---------------------------------------------------------------------------

const stageForIssue = (i: ReviewIssue): string => {
  if (i.suggested_fix.kind === "regenerate_scene") return "Stage 1";
  if (i.category === "structure" && i.suggested_fix.kind === "add_missing") return "Stage 1";
  if (i.category === "labels" || i.category === "crop") return "Stage 2";
  if (i.category === "aesthetics") return "Stage 3";
  if (i.category === "physics") return "Stage 2 or 3";
  return "Stage ?";
};

// ---------------------------------------------------------------------------
// Stopping criteria (Plan Part C.3):
//   - >= 3/4 cases with all dims >= 4
//   - 0 cases with any dim <= 2
// ---------------------------------------------------------------------------

const allDims = (s: ReviewScore) => [s.structure, s.labels, s.physics, s.aesthetics, s.crop];
const minDim = (s: ReviewScore) => Math.min(...allDims(s));
const meanDim = (s: ReviewScore) => allDims(s).reduce((a, b) => a + b, 0) / 5;

const passCount = cases.filter((c) => minDim(c.finalReport.score) >= 4).length;
const anyCriticalFail = cases.some((c) => minDim(c.finalReport.score) <= 2);
const stoppingMet = passCount >= Math.ceil(cases.length * 0.75) && !anyCriticalFail;

// ---------------------------------------------------------------------------
// Build scorecard
// ---------------------------------------------------------------------------

const lines: string[] = [];
lines.push(`# Scorecard — ${iterDir}`);
lines.push("");
if (seed) {
  lines.push(`**Seed**: ${seed.seed}`);
  lines.push(`**Strategy**: ${seed.strategy}`);
  lines.push(`**Lessons**: ${seed.lessons.join(", ")}`);
  lines.push("");
}

// Per-case table
lines.push("## Per-case rubric");
lines.push("");
lines.push(
  "| Case | Structure | Labels | Physics | Aesthetics | Crop | Mean | Min | Pass | Iter-regen |",
);
lines.push(
  "|---|---:|---:|---:|---:|---:|---:|---:|---|---|",
);
for (const c of cases) {
  const s = c.finalReport.score;
  const m = meanDim(s).toFixed(1);
  const mn = minDim(s);
  const pass = mn >= 4 ? "✓" : "✗";
  lines.push(
    `| ${c.key} | ${s.structure} | ${s.labels} | ${s.physics} | ${s.aesthetics} | ${s.crop} | ${m} | ${mn} | ${pass} | ${c.regeneratedScene ? "yes" : "—"} |`,
  );
}
lines.push("");

// Stopping criteria
lines.push("## Stopping criteria");
lines.push("");
lines.push(`- Cases with all dims ≥ 4:       **${passCount}/${cases.length}**   (need ≥ ${Math.ceil(cases.length * 0.75)})`);
lines.push(`- Any case with a dim ≤ 2:       **${anyCriticalFail ? "yes" : "no"}**   (need: no)`);
lines.push(`- **${stoppingMet ? "MET — v2 ready" : "NOT met — iterate"}**`);
lines.push("");

// Failure stage breakdown
lines.push("## Failures by stage");
lines.push("");
const stageCount: Record<string, number> = {};
for (const c of cases) {
  for (const i of c.finalReport.issues) {
    if (i.severity === "minor") continue;
    const s = stageForIssue(i);
    stageCount[s] = (stageCount[s] ?? 0) + 1;
  }
}
const sortedStages = Object.entries(stageCount).sort((a, b) => b[1] - a[1]);
if (sortedStages.length === 0) {
  lines.push("(no major/blocker issues)");
} else {
  for (const [s, n] of sortedStages) lines.push(`- ${s}: ${n}`);
  lines.push("");
  lines.push(`**Weakest stage**: ${sortedStages[0]![0]}. Fix one narrow thing here before iterating.`);
}
lines.push("");

// Detailed issues per case
lines.push("## Issues detail");
for (const c of cases) {
  lines.push(`\n### ${c.key}`);
  const issues = c.finalReport.issues;
  if (issues.length === 0) {
    lines.push("_No issues_");
    continue;
  }
  for (const i of issues) {
    lines.push(
      `- **[${i.severity}]** \`${i.id}\` (${i.category}, fix=${i.suggested_fix.kind}): ${i.description}`,
    );
  }
}

const outPath = join(iterDir, "scorecard.md");
writeFileSync(outPath, lines.join("\n"));
console.log(`Wrote ${outPath}`);
console.log();
console.log(
  `Summary: ${passCount}/${cases.length} cases passed all dims; stopping criteria ${stoppingMet ? "MET" : "NOT met"}.`,
);
if (!stoppingMet && sortedStages.length > 0) {
  console.log(`Weakest stage: ${sortedStages[0]![0]} (${sortedStages[0]![1]} issues across cases)`);
}
