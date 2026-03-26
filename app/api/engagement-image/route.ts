import OpenAI from "openai";
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
Hard requirement: the image must contain zero text of any kind.
Do not render words, letters, numbers, equations, symbols, speech bubbles with text, captions, labels, posters, signs, UI text, or watermarks.`;
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
    } = (await request.json()) as {
      item: ContentItem;
      lessonNumber?: number;
      classId?: string;
      assignmentId?: string;
      studentId?: string;
    };

    if (typeof lessonNumber !== "number") {
      return NextResponse.json(
        { error: "lessonNumber is required." },
        { status: 400 },
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
    const prompt = buildPrompt(item, lessonNumber);

    // webp + low quality = fast generation + small payload (avoids Amplify 30s timeout)
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
    console.error("engagement-image error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
