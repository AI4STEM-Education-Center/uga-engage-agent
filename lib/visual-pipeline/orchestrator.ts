/**
 * Pipeline orchestrator: Stage 1 -> 2 -> 3.
 *
 * If any stage fails, falls back to the direct `images.generate()` approach
 * using the existing buildPrompt from the engagement-image route.
 */

import type OpenAI from "openai";

import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";
import type { ContentItem } from "@/lib/types";

import { generateFromSvg } from "./image-generator";
import { computeLayout } from "./layout-engine";
import { describeScene } from "./scene-describer";
import { buildSvg, rasterizeSvg, svgToDataUrl } from "./svg-builder";
import type { SceneDescription } from "./types";

type PipelineResult = {
  url: string;
  svgDataUrl?: string;
  sceneDescription?: SceneDescription;
  usedFallback: boolean;
};

const buildFallbackPrompt = (
  item: ContentItem,
  lessonNumber: number,
): string => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) {
    throw new Error(`Lesson ${lessonNumber} not found.`);
  }
  const strategyContext = getStrategyContext(item.strategy);
  const textModes = item.textModes?.length
    ? item.textModes.join(", ")
    : item.type;
  const visualBrief = item.visualBrief?.trim();

  return `Create a simple, student-friendly illustration for a 8th grade lesson.
This image will be shown directly to students next to the material below.
Lesson: ${lessonContext.lessonTitle}
Learning objective: ${lessonContext.learningObjective}
Strategy: ${strategyContext.label} - ${strategyContext.description}
Text style: ${textModes}
Title: ${item.title}
Student-facing text:
${item.body}
${visualBrief ? `Visual brief: ${visualBrief}` : "Visual brief: Show the main scene, phenomenon, or conversation implied by the text."}

Ensure the image supports the lesson objective through the scene students will analyze.
Style: clean, minimal, classroom-friendly.
Hard requirement: the image must contain zero text of any kind.
Do not render words, letters, numbers, equations, symbols, speech bubbles with text, captions, labels, posters, signs, UI text, or watermarks.`;
};

const generateDirect = async (
  client: OpenAI,
  item: ContentItem,
  lessonNumber: number,
): Promise<string> => {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const prompt = buildFallbackPrompt(item, lessonNumber);
  const result = await client.images.generate({
    model,
    prompt,
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
  });
  const data = result.data?.[0];
  const base64 = data?.b64_json;
  const url = data?.url;
  if (!base64 && !url) {
    throw new Error("Fallback image generation returned empty data.");
  }
  return base64 ? `data:image/webp;base64,${base64}` : (url ?? "");
};

export const runVisualPipeline = async (
  client: OpenAI,
  item: ContentItem,
  lessonNumber: number,
): Promise<PipelineResult> => {
  try {
    const scene = await describeScene(client, item, lessonNumber);
    const layout = computeLayout(scene);
    const svg = buildSvg(layout);
    const svgPng = await rasterizeSvg(svg);
    const url = await generateFromSvg(client, svgPng, item, lessonNumber);
    return {
      url,
      svgDataUrl: svgToDataUrl(svg),
      sceneDescription: scene,
      usedFallback: false,
    };
  } catch (err) {
    console.error(
      "[visual-pipeline] Falling back to direct generation:",
      err instanceof Error ? err.message : err,
    );
    const url = await generateDirect(client, item, lessonNumber);
    return { url, usedFallback: true };
  }
};
