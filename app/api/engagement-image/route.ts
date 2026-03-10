import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";
import { getMedia, upsertMedia } from "@/lib/nosql";

type ContentItem = {
  id?: string;
  type: string;
  strategy: string;
  title: string;
  body: string;
  textModes?: string[];
  visualBrief?: string;
};

const buildPrompt = (item: ContentItem, lessonNumber: number) => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) {
    throw new Error(`Lesson ${lessonNumber} not found.`);
  }

  const strategyContext = getStrategyContext(item.strategy);
  const gradeLevel = "8th grade";
  const textModes = item.textModes?.length ? item.textModes.join(", ") : item.type;
  const visualBrief = item.visualBrief?.trim();

  return `Create a simple, student-friendly illustration for an ${gradeLevel} physics lesson.
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
If the material includes dialogue, clearly show the speakers and what they are reacting to.
If the material includes questions, show the scene students should reason about.
If the material describes a phenomenon, make that phenomenon visually central.
Style: clean, minimal, classroom-friendly.
When it helps understanding, add concise annotations directly on the image:
- Use simple arrows to indicate direction of motion, forces, cause-and-effect, or relationships between objects.
- Add short text labels (1-4 words max) next to key objects or arrows to name forces, objects, or concepts (e.g. "gravity", "friction", "push", "before", "after").
- Keep labels in plain sans-serif font, high contrast against the background.
- Do not add paragraphs, sentences, captions, watermarks, or decorative text. Only functional labels and arrows.
If the scene is self-explanatory without annotations, omit them.`;
};

const MAX_REFINEMENT_PROMPT_LENGTH = 500;

const isSafetyRejection = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("safety") || msg.includes("content_policy") || msg.includes("policy") || msg.includes("moderation");
};

const prepareImageInput = async (
  client: OpenAI,
  imageUrl: string,
) => {
  if (imageUrl.startsWith("data:")) {
    const base64Part = imageUrl.split(",")[1];
    const buffer = Buffer.from(base64Part, "base64");
    return toFile(buffer, "image.webp", { type: "image/webp" });
  }
  const imgRes = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  return toFile(imgBuffer, "image.webp", { type: "image/webp" });
};

export const maxDuration = 60; // seconds – image generation can take 15-30s

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const {
      item,
      lessonNumber,
      classId,
      assignmentId,
      studentId,
      refinementPrompt,
      previousImageUrl,
    } = (await request.json()) as {
      item: ContentItem;
      lessonNumber?: number;
      classId?: string;
      assignmentId?: string;
      studentId?: string;
      refinementPrompt?: string;
      previousImageUrl?: string;
    };

    if (typeof lessonNumber !== "number") {
      return NextResponse.json(
        { error: "lessonNumber is required." },
        { status: 400 },
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
    const trimmedRefine = refinementPrompt?.trim().slice(0, MAX_REFINEMENT_PROMPT_LENGTH);
    const isRefine = !!(trimmedRefine && previousImageUrl);

    let result;
    if (isRefine) {
      const imageInput = await prepareImageInput(client, previousImageUrl);
      result = await client.images.edit({
        model,
        image: imageInput,
        prompt: trimmedRefine,
        size: "1024x1024",
      });
    } else {
      const prompt = buildPrompt(item, lessonNumber);
      result = await client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        quality: "high",
        output_format: "webp",
      });
    }

    const data = result.data?.[0];
    const base64 = data?.b64_json;
    const url = data?.url;
    if (!base64 && !url) {
      throw new Error("Image generation returned empty data.");
    }

    let dataUrl = base64 ? `data:image/webp;base64,${base64}` : (url ?? "");

    // Persist to DB if we have enough context
    if (item.id && classId && assignmentId && studentId) {
      try {
        await upsertMedia({
          classId,
          assignmentId,
          studentId,
          contentItemId: item.id,
          mediaType: "image",
          mimeType: "image/webp",
          dataUrl,
        });
        // Prefer a shareable URL (e.g., presigned S3) for downstream video APIs.
        const persisted = await getMedia(
          classId,
          assignmentId,
          studentId,
          item.id,
          "image",
        );
        if (persisted?.data_url) {
          dataUrl = persisted.data_url;
        }
      } catch (err) {
        console.error("Failed to persist image to DB:", err);
        // Don't fail the response — return the image anyway
      }
    }

    return NextResponse.json({ url: dataUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate image.";
    const isSafety = isSafetyRejection(error);
    console.error("engagement-image error:", message);
    return NextResponse.json({
      error: isSafety
        ? "Your refinement instruction was flagged by content policy. Please rephrase and try again."
        : message,
    }, { status: isSafety ? 422 : 500 });
  }
}
