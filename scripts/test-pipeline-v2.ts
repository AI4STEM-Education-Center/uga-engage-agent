#!/usr/bin/env tsx
/**
 * v2 Visual Generation Pipeline — end-to-end test harness.
 *
 * Everything downstream of (lessonNumber, strategy) is LLM-generated —
 * no hand-authored ContentItems or scenes anywhere in the evaluation
 * path. This mirrors real platform behavior.
 *
 *   tsx scripts/test-pipeline-v2.ts content   # Phase 0: real ContentItem
 *   tsx scripts/test-pipeline-v2.ts scenes    # Phase A: real SceneDescriptionV2
 *   tsx scripts/test-pipeline-v2.ts stage2    # Phase B: no-API layout + SVG + raster
 *   tsx scripts/test-pipeline-v2.ts review    # Phase C: Stage 4 vision review
 *   tsx scripts/test-pipeline-v2.ts full      # Phase D: end-to-end orchestrator
 *
 * Sampling options for scenes/review/full:
 *   --strategy=<id>       fix strategy (default: rotate by iteration)
 *   --lessons=1,4,6,8     explicit lesson list (default: 4 random from 1-8)
 *   --seed=<int>          deterministic RNG for lesson sampling
 *   --iter=<N>            iteration number (defaults to now timestamp)
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
import OpenAI from "openai";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

loadEnv({ path: ".env.local" });

import { generateContentItem, type ResolvedContentItem } from "../lib/content-generator";
import { describeSceneV2 } from "../lib/visual-pipeline/v2/scene-describer-v2";
import { computeLayoutV2 } from "../lib/visual-pipeline/v2/layout";
import { buildSvgV2, rasterizeSvgV2 } from "../lib/visual-pipeline/v2/svg/build";
import { SceneDescriptionV2 } from "../lib/visual-pipeline/v2/schema";

// ----------------------------------------------------------------------------
// CLI arg parsing
// ----------------------------------------------------------------------------

type Args = {
  mode: string;
  strategy?: string;
  lessons?: number[];
  seed?: number;
  iter?: string;
};

const parseArgs = (argv: string[]): Args => {
  const mode = argv[2] ?? "stage2";
  const rest = argv.slice(3);
  const args: Args = { mode };
  for (const a of rest) {
    const [k, v] = a.split("=");
    if (k === "--strategy") args.strategy = v;
    else if (k === "--lessons")
      args.lessons = v!.split(",").map((n) => parseInt(n, 10)).filter(Number.isFinite);
    else if (k === "--seed") args.seed = parseInt(v!, 10);
    else if (k === "--iter") args.iter = v;
  }
  return args;
};

// ----------------------------------------------------------------------------
// Sampling — strategy fixed per run, lessons randomly picked from 1..8.
// Replicates platform runtime: seed only (lesson, strategy); generate all else.
// ----------------------------------------------------------------------------

const STRATEGIES = [
  "analogy",
  "cognitive conflict",
  "experience bridging",
  "engaged critiquing",
];

// Mulberry32 — small deterministic PRNG for reproducible sampling.
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const sampleLessons = (n: number, rng: () => number): number[] => {
  const all = [1, 2, 3, 4, 5, 6, 7, 8];
  const picked: number[] = [];
  while (picked.length < n && all.length > 0) {
    const idx = Math.floor(rng() * all.length);
    picked.push(all.splice(idx, 1)[0]!);
  }
  return picked;
};

const pickStrategy = (iter: string): string => {
  // Rotate by iteration hash.
  let h = 0;
  for (const ch of iter) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STRATEGIES[h % STRATEGIES.length]!;
};

const resolveCases = (args: Args): {
  iter: string;
  seed: number;
  strategy: string;
  lessons: number[];
} => {
  const iter = args.iter ?? `iter${Date.now()}`;
  const seed = args.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = mulberry32(seed);
  const strategy = args.strategy ?? pickStrategy(iter);
  const lessons = args.lessons ?? sampleLessons(4, rng);
  return { iter, seed, strategy, lessons };
};

// ----------------------------------------------------------------------------
// Paths
// ----------------------------------------------------------------------------

const OUT_ROOT = "output/pipeline-test-v2";
const fixturesDir = () => join(OUT_ROOT, "fixtures");
const stage2Dir = () => join(OUT_ROOT, "stage2");
const iterDir = (iter: string) => join(OUT_ROOT, iter);

const ensureDir = (p: string) => mkdirSync(p, { recursive: true });
const caseKey = (idx: number, lesson: number, strategy: string) =>
  `case${String.fromCharCode(65 + idx)}_L${lesson}_${strategy.replace(/\s+/g, "-")}`;

// ----------------------------------------------------------------------------
// Phases
// ----------------------------------------------------------------------------

const runContent = async (client: OpenAI, args: Args) => {
  const { iter, seed, strategy, lessons } = resolveCases(args);
  const dir = iterDir(iter);
  ensureDir(dir);
  writeFileSync(
    join(dir, "seed.json"),
    JSON.stringify({ iter, seed, strategy, lessons }, null, 2),
  );
  console.log(
    `[content] iter=${iter} seed=${seed} strategy=${strategy} lessons=${lessons.join(",")}`,
  );
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    const key = caseKey(i, lesson, strategy);
    console.log(`[content] ${key} — calling content-gen LLM...`);
    const item = await generateContentItem(client, lesson, strategy);
    const withId = { ...item, id: key };
    writeFileSync(join(dir, `${key}_item.json`), JSON.stringify(withId, null, 2));
    const words = item.body.split(/\s+/).length;
    console.log(`           → title="${item.title}" body=${words}w`);
  }
  console.log(`\n[content] Done. ${dir}/`);
};

const runScenes = async (client: OpenAI, args: Args) => {
  if (!args.iter) throw new Error("scenes mode requires --iter=<existing iter>");
  const dir = iterDir(args.iter);
  const seedRaw = JSON.parse(
    readFileSync(join(dir, "seed.json"), "utf-8"),
  ) as { strategy: string; lessons: number[] };
  const { strategy, lessons } = seedRaw;

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    const key = caseKey(i, lesson, strategy);
    const itemPath = join(dir, `${key}_item.json`);
    if (!existsSync(itemPath)) {
      throw new Error(`Missing ${itemPath}; run content mode first.`);
    }
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as ResolvedContentItem & { id: string };
    console.log(`[scenes] ${key} — calling scene-describer LLM...`);
    const scene = await describeSceneV2(client, item, lesson, { retryOnParseFail: true });
    writeFileSync(join(dir, `${key}_scene.json`), JSON.stringify(scene, null, 2));
    console.log(`           → archetype=${scene.scene.archetype} title="${scene.title}"`);
  }
  console.log(`\n[scenes] Done. ${dir}/`);
};

const runStage2 = async (args: Args) => {
  if (!args.iter) {
    // Standalone stage2 — run on canonical fixtures.
    ensureDir(stage2Dir());
    for (const key of ["collision", "free-body", "generic-scene"]) {
      const raw = JSON.parse(
        readFileSync(`__tests__/lib/visual-pipeline/v2/fixtures/${key}.json`, "utf-8"),
      );
      const scene = SceneDescriptionV2.parse(raw);
      const layout = computeLayoutV2(scene);
      const svg = buildSvgV2(layout);
      const png = await rasterizeSvgV2(svg);
      writeFileSync(join(stage2Dir(), `${key}.svg`), svg);
      writeFileSync(join(stage2Dir(), `${key}.png`), png);
      console.log(
        `[stage2] ${key}: archetype=${scene.scene.archetype} symbols=${layout.symbols.length} labels=${layout.labels.length}`,
      );
    }
    return;
  }
  // Stage2 from a specific iter's scenes.
  const dir = iterDir(args.iter);
  const seedRaw = JSON.parse(readFileSync(join(dir, "seed.json"), "utf-8")) as { strategy: string; lessons: number[] };
  const { strategy, lessons } = seedRaw;
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    const key = caseKey(i, lesson, strategy);
    const scenePath = join(dir, `${key}_scene.json`);
    if (!existsSync(scenePath)) {
      throw new Error(`Missing ${scenePath}; run scenes mode first.`);
    }
    const scene = SceneDescriptionV2.parse(JSON.parse(readFileSync(scenePath, "utf-8")));
    const layout = computeLayoutV2(scene);
    const svg = buildSvgV2(layout);
    const png = await rasterizeSvgV2(svg);
    writeFileSync(join(dir, `${key}_layout.svg`), svg);
    writeFileSync(join(dir, `${key}_reference.png`), png);
    console.log(
      `[stage2] ${key}: archetype=${scene.scene.archetype} symbols=${layout.symbols.length}`,
    );
  }
  console.log(`\n[stage2] Done. ${dir}/`);
};

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

const main = async () => {
  const args = parseArgs(process.argv);
  const needsApi = args.mode !== "stage2" || !!args.iter;
  if (needsApi && !process.env.OPENAI_API_KEY) {
    console.error(`OPENAI_API_KEY not set (required for mode: ${args.mode})`);
    process.exit(1);
  }
  const client = needsApi
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : (null as unknown as OpenAI);

  switch (args.mode) {
    case "content":
      await runContent(client, args);
      break;
    case "scenes":
      await runScenes(client, args);
      break;
    case "stage2":
      await runStage2(args);
      break;
    // review + full added when Stage 4/5 land.
    default:
      console.error(
        `Unknown mode: ${args.mode}. Use: content | scenes | stage2 (review/full coming next).`,
      );
      process.exit(1);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
