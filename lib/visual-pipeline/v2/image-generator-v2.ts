/**
 * Stage 5 — Image generation from the Stage-3 SVG (restyle only).
 *
 * v2 inverts v1's prompt: the SVG is no longer a "hint" for GPT-image
 * to reinterpret. It is the scientifically-correct source of truth, and
 * GPT-image's job is to restyle it into a polished classroom-friendly
 * illustration while preserving every element verbatim (labels,
 * arrows, equations, positions).
 *
 * Text-free constraint from v1 is DROPPED for physics archetypes — the
 * target image MUST contain labels like F_AB, m = 1200 kg, v = 15 m/s.
 * Only generic-scene keeps the text-free constraint.
 */

import { toFile } from "openai";
import type OpenAI from "openai";

import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";
import type { ResolvedContentItem } from "@/lib/content-generator";

import type { SceneDescriptionV2 } from "./schema";

const PHYSICS_PROMPT_TEMPLATE = (args: {
  lessonTitle: string;
  learningObjective: string;
  strategyLabel: string;
  strategyDescription: string;
  itemTitle: string;
  itemBody: string;
  archetype: string;
  preservedLabels: string[];
}): string => {
  const labelsList = args.preservedLabels.length
    ? args.preservedLabels.map((l) => `"${l}"`).join(", ")
    : "(none — preserve whatever text appears in the reference)";
  return `The attached image is a publication-quality physics diagram that is already scientifically correct. This is a ${args.archetype} diagram for an 8th-grade science lesson.

YOUR JOB IS ONLY TO RESTYLE this diagram into a polished, classroom-friendly illustration. DO NOT add, remove, reinterpret, or reposition any element. Preserve:
- every body (car, block, ball, etc.) in its exact position and size
- every arrow — direction, length, and color
- every text label, measurement, and equation — VERBATIM
- the ground line, spring, and all scaffolding lines

RESTYLE ONLY: soften colors, add subtle shading, replace the generic shapes with illustrated versions of the same object in the same pose (a cartoon-style cart instead of a schematic cart, for example).

HARD CONSTRAINTS:
- Labels to preserve verbatim (these MUST appear in the output exactly): ${labelsList}
- The output must remain a physics diagram. Do NOT turn it into a photograph, a cartoon scene, or a narrative illustration.
- Do NOT add any text that is not in the reference.
- Do NOT remove any text that is in the reference.

Context (for style/mood only, NOT for changing content):
Lesson: ${args.lessonTitle}
Learning objective: ${args.learningObjective}
Strategy: ${args.strategyLabel} — ${args.strategyDescription}
Student-facing text title: ${args.itemTitle}
Student-facing body (do NOT try to depict this — your reference image is the truth):
${args.itemBody}`;
};

const GENERIC_PROMPT_TEMPLATE = (args: {
  lessonTitle: string;
  learningObjective: string;
  strategyLabel: string;
  strategyDescription: string;
  itemTitle: string;
  itemBody: string;
}): string => {
  return `Create a simple, student-friendly classroom illustration for an 8th-grade science lesson based on the attached schematic reference and the text below.

The attached image is a layout placeholder: it shows where the main subject and secondary elements should go, with their labels. Use the positions as hints but draw the actual scene implied by the student-facing text.

Lesson: ${args.lessonTitle}
Learning objective: ${args.learningObjective}
Strategy: ${args.strategyLabel} — ${args.strategyDescription}
Title: ${args.itemTitle}
Student-facing text:
${args.itemBody}

Style: clean, minimal, classroom-friendly, warm colors.
Hard requirement: the image must contain ZERO text of any kind. No labels, captions, numbers, equations, speech bubbles with text, or watermarks.`;
};

const collectPreservedLabels = (scene: SceneDescriptionV2): string[] => {
  const labels = new Set<string>();
  const push = (s: string | undefined) => s && labels.add(s);

  // Bodies (measurement captions are derived from their mass/velocity
  // but the actual rendered text lives in the SVG — be defensive and
  // include both).
  if (scene.scene.archetype === "collision") {
    for (const b of scene.scene.bodies) {
      if (b.mass_kg !== undefined) push(`m = ${b.mass_kg} kg`);
      if (b.velocity_ms !== undefined) push(`v = ${b.velocity_ms} m/s`);
    }
    for (const f of scene.scene.forces) push(f.label);
    push(scene.scene.caption_equation);
  } else if (scene.scene.archetype === "free-body") {
    const b = scene.scene.body;
    if (b.mass_kg !== undefined) push(`m = ${b.mass_kg} kg`);
    for (const f of scene.scene.forces) push(f.label);
    for (const a of scene.scene.annotations) {
      if (a.kind === "equation") push(a.tex);
      if (a.kind === "measurement") push(a.text);
    }
  }
  push(scene.title);
  return [...labels].filter(Boolean);
};

export type Stage5Result = {
  dataUrl: string; // data:image/webp;base64,...
  prompt: string;
  model: string;
};

export const generateFromSvgV2 = async (
  client: OpenAI,
  referencePng: Buffer,
  scene: SceneDescriptionV2,
  item: ResolvedContentItem,
  lessonNumber: number,
): Promise<Stage5Result> => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) throw new Error(`Lesson ${lessonNumber} not found.`);
  const strategyContext = getStrategyContext(item.strategy);

  const isGeneric = scene.scene.archetype === "generic-scene";
  const prompt = isGeneric
    ? GENERIC_PROMPT_TEMPLATE({
        lessonTitle: lessonContext.lessonTitle,
        learningObjective: lessonContext.learningObjective,
        strategyLabel: strategyContext.label,
        strategyDescription: strategyContext.description,
        itemTitle: item.title,
        itemBody: item.body,
      })
    : PHYSICS_PROMPT_TEMPLATE({
        lessonTitle: lessonContext.lessonTitle,
        learningObjective: lessonContext.learningObjective,
        strategyLabel: strategyContext.label,
        strategyDescription: strategyContext.description,
        itemTitle: item.title,
        itemBody: item.body,
        archetype: scene.scene.archetype,
        preservedLabels: collectPreservedLabels(scene),
      });

  // Default to gpt-image-1.5 — OpenAI's current state-of-the-art image
  // model. Compared to gpt-image-1 it has significantly better text
  // rendering and reference-following, both of which matter for a
  // pipeline that needs to preserve labels and arrow geometry verbatim.
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
  const quality = (process.env.OPENAI_IMAGE_QUALITY as "low" | "medium" | "high") ||
    (isGeneric ? "low" : "medium");

  const file = await toFile(referencePng, "reference.png", { type: "image/png" });
  const response = await client.images.edit({
    model,
    image: file,
    prompt,
    size: "1024x1024",
    quality,
  });

  const base64 = response.data?.[0]?.b64_json;
  const url = response.data?.[0]?.url;
  if (!base64 && !url) {
    throw new Error("Stage 5 image generation returned empty response.");
  }
  let dataUrl: string;
  if (base64) {
    dataUrl = `data:image/webp;base64,${base64}`;
  } else {
    // Fetch URL content and re-encode.
    const r = await fetch(url!);
    const buf = Buffer.from(await r.arrayBuffer());
    dataUrl = `data:image/webp;base64,${buf.toString("base64")}`;
  }
  return { dataUrl, prompt, model };
};

export const dataUrlToBuffer = (dataUrl: string): Buffer => {
  const parts = dataUrl.split(",");
  return Buffer.from(parts[1] ?? "", "base64");
};
