import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

import { getMedia, upsertMedia } from "@/lib/nosql";
import type { ContentItem } from "@/lib/types";
import { runVisualPipeline } from "@/lib/visual-pipeline/orchestrator";

const MAX_REFINEMENT_PROMPT_LENGTH = 500;

const isSafetyRejection = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("safety") ||
    msg.includes("content_policy") ||
    msg.includes("policy") ||
    msg.includes("moderation")
  );
};

const prepareImageInput = async (imageUrl: string) => {
  if (imageUrl.startsWith("data:")) {
    const base64Part = imageUrl.split(",")[1];
    const buffer = Buffer.from(base64Part, "base64");
    return toFile(buffer, "image.webp", { type: "image/webp" });
  }
  const imgRes = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  return toFile(imgBuffer, "image.webp", { type: "image/webp" });
};

const VLM_SYSTEM_PROMPT = `You are an image-editing assistant. You receive an image with a RED RECTANGLE drawn on it, plus a short user instruction.

Your job:
1. Identify what is inside the red rectangle.
2. Combine your understanding of the selected region with the user's instruction.
3. Output a single, detailed image-editing prompt (1-3 sentences) that tells an image generation model EXACTLY what to change and where, using natural language spatial descriptions (e.g., "in the upper-left corner", "the figure on the right side").
4. The prompt must describe the edit for the clean image (no red rectangle). Do NOT mention the red rectangle or annotations.
5. Emphasize that the rest of the image must remain unchanged.
6. The resulting prompt must maintain the instruction: the image must contain zero text of any kind.

Respond with ONLY the editing prompt, nothing else.`;

const generateVlmEditPrompt = async (
  client: OpenAI,
  annotatedImageUrl: string,
  userPrompt: string,
): Promise<string> => {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_VLM_MODEL ?? "gpt-4o",
    max_tokens: 300,
    messages: [
      { role: "system", content: VLM_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: `User instruction: ${userPrompt}` },
          { type: "image_url", image_url: { url: annotatedImageUrl, detail: "high" } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? userPrompt;
};

export const maxDuration = 120;

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
      annotatedImageUrl,
    } = (await request.json()) as {
      item: ContentItem;
      lessonNumber?: number;
      classId?: string;
      assignmentId?: string;
      studentId?: string;
      refinementPrompt?: string;
      previousImageUrl?: string;
      annotatedImageUrl?: string;
    };

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const trimmedRefine = refinementPrompt?.trim().slice(0, MAX_REFINEMENT_PROMPT_LENGTH);
    const isRefine = !!(trimmedRefine && previousImageUrl);

    if (!isRefine && typeof lessonNumber !== "number") {
      return NextResponse.json(
        { error: "lessonNumber is required." },
        { status: 400 },
      );
    }

    let dataUrl: string;

    if (isRefine) {
      // Refinement: same logic as engagement-image (not pipeline).
      const [editPrompt, imageInput] = await Promise.all([
        annotatedImageUrl
          ? generateVlmEditPrompt(client, annotatedImageUrl, trimmedRefine)
          : Promise.resolve(trimmedRefine),
        prepareImageInput(previousImageUrl),
      ]);

      const result = await client.images.edit({
        model,
        image: imageInput,
        prompt: editPrompt,
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
      dataUrl = base64 ? `data:image/webp;base64,${base64}` : (url ?? "");
    } else {
      // New generation: run the JSON -> SVG -> Image pipeline.
      const pipeline = await runVisualPipeline(
        client,
        item,
        lessonNumber as number,
      );
      dataUrl = pipeline.url;
    }

    // Persist to DB if we have enough context (same as engagement-image).
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
          refinementPrompt: trimmedRefine,
        });
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
      }
    }

    return NextResponse.json({ url: dataUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate image.";
    const isSafety = isSafetyRejection(error);
    console.error("engagement-image-pipeline error:", message);
    return NextResponse.json(
      {
        error: isSafety
          ? "Your refinement instruction was flagged by content policy. Please rephrase and try again."
          : message,
      },
      { status: isSafety ? 422 : 500 },
    );
  }
}
