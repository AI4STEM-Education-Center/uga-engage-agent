/**
 * Stage 3: Image Generator.
 *
 * Uses the rasterized SVG as a structural reference input to OpenAI
 * images.edit — GPT-image produces a polished, student-friendly illustration
 * while preserving the layout from the SVG.
 */

import OpenAI, { toFile } from "openai";

import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";
import type { ContentItem } from "@/lib/types";

const buildEditPrompt = (item: ContentItem, lessonNumber: number): string => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) {
    throw new Error(`Lesson ${lessonNumber} not found.`);
  }

  const strategyContext = getStrategyContext(item.strategy);
  const gradeLevel = "8th grade";
  const textModes = item.textModes?.length
    ? item.textModes.join(", ")
    : item.type;
  const visualBrief = item.visualBrief?.trim();

  return `The attached image is a schematic layout of the intended scene:
shapes and positions indicate where each object belongs and how they relate.
Transform it into a polished, student-friendly illustration for a ${gradeLevel} lesson.

Preserve the spatial layout exactly: the position, relative size, and
grouping of every shape. Use the shapes and colors in the schematic as hints
for where objects are and what they are, but render them as real-looking
illustrations appropriate for a science classroom.

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

export const generateFromSvg = async (
  client: OpenAI,
  svgPngBuffer: Buffer,
  item: ContentItem,
  lessonNumber: number,
): Promise<string> => {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const prompt = buildEditPrompt(item, lessonNumber);

  const imageInput = await toFile(svgPngBuffer, "layout.png", {
    type: "image/png",
  });

  const result = await client.images.edit({
    model,
    image: imageInput,
    prompt,
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
  });

  const data = result.data?.[0];
  const base64 = data?.b64_json;
  const url = data?.url;
  if (!base64 && !url) {
    throw new Error("Image generation returned empty data.");
  }
  return base64 ? `data:image/webp;base64,${base64}` : (url ?? "");
};
