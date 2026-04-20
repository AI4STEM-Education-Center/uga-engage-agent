/**
 * Stage 4 — Vision Review.
 *
 * Takes the rasterized Stage-3 SVG plus the scene JSON and asks a
 * vision model to verify that the render actually matches the intent,
 * producing a structured issues list + per-dimension scores.
 *
 * The reviewer gets BOTH the image AND the scene JSON so it can check
 * "does this image contain every element I specified?" — that framing
 * is far more reliable than "is this image good?".
 */

import type OpenAI from "openai";
import { z } from "zod";

import type { SceneDescriptionV2 } from "./schema";
import { checklistForArchetype } from "./vision-reviewer-checklists";

const ScaleFix = z.object({
  kind: z.literal("scale"),
  target: z.string(),
  factor: z.number(),
});
const RepositionFix = z.object({
  kind: z.literal("reposition"),
  target: z.string(),
  to: z.enum(["above", "below", "left", "right", "center"]),
});
const AddMissingFix = z.object({
  kind: z.literal("add_missing"),
  element: z.string(),
});
const RemoveFix = z.object({
  kind: z.literal("remove"),
  target: z.string(),
});
const IncreaseMarginFix = z.object({ kind: z.literal("increase_margin") });
const RegenerateSceneFix = z.object({
  kind: z.literal("regenerate_scene"),
  reason: z.string(),
});
const OtherFix = z.object({
  kind: z.literal("other"),
  note: z.string(),
});

// The reviewer sometimes returns "to" values outside the enum ("near A",
// "correct opposite bodies", etc.). Coerce invalid reposition and any
// unrecognized shapes to { kind: "other" } so schema validation doesn't
// throw on otherwise-usable reports.
export const SuggestedFix = z
  .unknown()
  .transform((val): unknown => {
    if (!val || typeof val !== "object") return { kind: "other", note: String(val) };
    const kind = (val as { kind?: unknown }).kind;
    if (kind === "reposition") {
      const parsed = RepositionFix.safeParse(val);
      if (parsed.success) return parsed.data;
      // Keep the idea but drop the invalid `to`.
      const v = val as Record<string, unknown>;
      return {
        kind: "other",
        note: `reposition ${String(v.target ?? "?")}: ${String(v.to ?? "?")}`,
      };
    }
    for (const schema of [
      ScaleFix,
      AddMissingFix,
      RemoveFix,
      IncreaseMarginFix,
      RegenerateSceneFix,
      OtherFix,
    ]) {
      const p = schema.safeParse(val);
      if (p.success) return p.data;
    }
    return { kind: "other", note: JSON.stringify(val).slice(0, 200) };
  })
  .pipe(
    z.discriminatedUnion("kind", [
      ScaleFix,
      RepositionFix,
      AddMissingFix,
      RemoveFix,
      IncreaseMarginFix,
      RegenerateSceneFix,
      OtherFix,
    ]),
  );
export type SuggestedFix = z.infer<typeof SuggestedFix>;

export const ReviewIssue = z.object({
  id: z.string(),
  severity: z.enum(["blocker", "major", "minor"]),
  category: z.enum(["structure", "labels", "physics", "aesthetics", "crop"]),
  description: z.string(),
  target: z.string().optional(),
  suggested_fix: SuggestedFix,
});
export type ReviewIssue = z.infer<typeof ReviewIssue>;

export const ReviewScore = z.object({
  structure: z.number().min(1).max(5),
  labels: z.number().min(1).max(5),
  physics: z.number().min(1).max(5),
  aesthetics: z.number().min(1).max(5),
  crop: z.number().min(1).max(5),
});
export type ReviewScore = z.infer<typeof ReviewScore>;

export const ReviewReport = z.object({
  pass: z.boolean(),
  issues: z.array(ReviewIssue),
  score: ReviewScore,
  notes: z.string().optional(),
});
export type ReviewReport = z.infer<typeof ReviewReport>;

const REVIEW_SYSTEM_PROMPT = `You are a physics-diagram QA reviewer. You will be shown:
1. A rendered physics diagram image.
2. The scene JSON it was meant to depict.
3. A checklist of what to verify for this archetype.

Your job: compare image vs. JSON vs. checklist. Produce a structured
review report in JSON. DO NOT rewrite the image. DO NOT re-describe the
scene. Only flag real problems.

Output JSON schema:
{
  "pass": boolean,                    // true if NO blockers and ≤1 major
  "issues": [
    {
      "id": "short_slug",             // e.g. "labels_overlap_arrows"
      "severity": "blocker"|"major"|"minor",
      "category": "structure"|"labels"|"physics"|"aesthetics"|"crop",
      "description": "what's wrong, plain English",
      "target": "F_AB" | "body A" | ...  // optional: which element
      "suggested_fix": <one of the fix types below>
    }
  ],
  "score": {
    "structure": 1-5,                 // required elements present?
    "labels": 1-5,                    // labels legible and non-overlapping?
    "physics": 1-5,                   // physically meaningful (directions, magnitudes)?
    "aesthetics": 1-5,                // clean, readable, professional?
    "crop": 1-5                       // nothing cut off, good margins?
  },
  "notes": "optional free-text summary"
}

Suggested fix types (pick the most actionable):
- { "kind": "scale", "target": "<id>", "factor": <number> }
   Multiply size or length of an element by factor.
- { "kind": "reposition", "target": "<id>", "to": "above"|"below"|"left"|"right"|"center" }
   Move element to a different quadrant/side.
- { "kind": "add_missing", "element": "<description>" }
   Element required by the scene JSON is missing from the image.
- { "kind": "remove", "target": "<id>" }
   Redundant or wrong element that should be removed.
- { "kind": "increase_margin" }
   Content is cropped or hits the edge.
- { "kind": "regenerate_scene", "reason": "<why>" }
   The scene JSON itself is fundamentally wrong and needs a fresh Stage-1 call.
- { "kind": "other", "note": "<free text>" }
   Escape hatch for anything else.

Scoring rubric (1-5 per dimension):
5 = no issues in this category
4 = only minor issues
3 = one major issue
2 = multiple majors or one blocker
1 = multiple blockers

Set "pass": true iff there are no blockers AND at most one major issue.

Return JSON only.`;

const buildReviewUserMessage = (
  scene: SceneDescriptionV2,
): string => {
  const checklist = checklistForArchetype(scene.scene.archetype);
  return `Scene JSON:
\`\`\`json
${JSON.stringify(scene, null, 2)}
\`\`\`

Checklist for archetype "${scene.scene.archetype}":
${checklist}

Now review the attached image against the JSON and checklist.`;
};

export const reviewDiagram = async (
  client: OpenAI,
  scene: SceneDescriptionV2,
  imagePng: Buffer,
): Promise<ReviewReport> => {
  const model = process.env.OPENAI_VLM_MODEL ?? "gpt-4o";
  const imageDataUrl = `data:image/png;base64,${imagePng.toString("base64")}`;
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: buildReviewUserMessage(scene) },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Vision reviewer returned empty response.");
  const parsed = JSON.parse(raw);
  const result = ReviewReport.safeParse(parsed);
  if (!result.success) {
    // Best-effort coercion if model returned close-but-not-exact shape.
    throw new Error(
      `Vision review failed schema: ${result.error.toString()}\nRaw: ${raw.slice(0, 400)}`,
    );
  }
  return result.data;
};

export const summarizeReport = (r: ReviewReport): string => {
  const mean =
    (r.score.structure +
      r.score.labels +
      r.score.physics +
      r.score.aesthetics +
      r.score.crop) /
    5;
  const worst = r.issues
    .filter((i) => i.severity !== "minor")
    .map((i) => `${i.severity}:${i.id}`)
    .slice(0, 3)
    .join(", ");
  return `pass=${r.pass} mean=${mean.toFixed(1)} ${worst ? `| ${worst}` : ""}`;
};
