/**
 * Stage 1 → 2 → 3 → 4 (iterate) → 5 orchestrator.
 *
 * Chains the v2 pipeline end-to-end. Falls back to a direct gpt-image
 * generation only on THROWN exceptions — review failures propagate
 * through with reviewPassed=false so callers can log them loudly.
 */

import { toFile } from "openai";
import type OpenAI from "openai";

import type { ResolvedContentItem } from "@/lib/content-generator";
import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";

import { iterateWithReview } from "./iterate";
import { describeSceneV2 } from "./scene-describer-v2";
import {
  dataUrlToBuffer,
  generateFromSvgV2,
} from "./image-generator-v2";
import type { SceneDescriptionV2 } from "./schema";
import type { LayoutV2 } from "./layout/helpers";
import type { ReviewReport } from "./vision-reviewer";

export type PipelineV2Result = {
  url: string; // data URL or persisted URL (caller's concern)
  svgDataUrl?: string;
  referencePng?: Buffer;
  scene?: SceneDescriptionV2;
  layout?: LayoutV2;
  finalReport?: ReviewReport;
  usedFallback: boolean;
  reviewPassed: boolean;
  regeneratedScene: boolean;
};

export const runVisualPipelineV2 = async (
  client: OpenAI,
  item: ResolvedContentItem,
  lessonNumber: number,
): Promise<PipelineV2Result> => {
  try {
    const scene = await describeSceneV2(client, item, lessonNumber, {
      retryOnParseFail: true,
    });

    const iter = await iterateWithReview(scene, {
      client,
      item,
      lessonNumber,
    });

    const stage5 = await generateFromSvgV2(
      client,
      iter.rasterPng,
      iter.scene,
      item,
      lessonNumber,
    );

    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(iter.svg, "utf-8").toString("base64")}`;
    return {
      url: stage5.dataUrl,
      svgDataUrl,
      referencePng: iter.rasterPng,
      scene: iter.scene,
      layout: iter.layout,
      finalReport: iter.finalReport,
      usedFallback: false,
      reviewPassed: iter.reviewPassed,
      regeneratedScene: iter.regeneratedScene,
    };
  } catch (err) {
    console.error(
      "[v2 orchestrator] Pipeline failed; falling back to direct gpt-image.",
      err,
    );
    const url = await generateDirect(client, item, lessonNumber);
    return { url, usedFallback: true, reviewPassed: false, regeneratedScene: false };
  }
};

// ---------------------------------------------------------------------------
// Fallback — direct gpt-image.generate (no SVG reference).
// Kept for production safety when any stage throws.
// ---------------------------------------------------------------------------

const generateDirect = async (
  client: OpenAI,
  item: ResolvedContentItem,
  lessonNumber: number,
): Promise<string> => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) throw new Error(`Lesson ${lessonNumber} not found.`);
  const strategyContext = getStrategyContext(item.strategy);
  const visualBrief =
    item.visualBrief?.trim() ||
    "Show the main scene, phenomenon, or conversation implied by the text.";

  const prompt = `Create a simple, student-friendly illustration for an 8th-grade lesson.
Lesson: ${lessonContext.lessonTitle}
Learning objective: ${lessonContext.learningObjective}
Strategy: ${strategyContext.label} - ${strategyContext.description}
Title: ${item.title}
Student-facing text:
${item.body}
Visual brief: ${visualBrief}

Style: clean, minimal, classroom-friendly.
Hard requirement: the image must contain zero text of any kind.
Do not render words, letters, numbers, equations, symbols, speech bubbles with text, captions, labels, posters, signs, UI text, or watermarks.`;

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const response = await client.images.generate({
    model,
    prompt,
    size: "1024x1024",
    quality: "low",
  });
  const base64 = response.data?.[0]?.b64_json;
  const url = response.data?.[0]?.url;
  if (base64) return `data:image/webp;base64,${base64}`;
  if (url) {
    const r = await fetch(url);
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:image/webp;base64,${buf.toString("base64")}`;
  }
  throw new Error("Direct image generation returned empty response.");
};

export { dataUrlToBuffer };
