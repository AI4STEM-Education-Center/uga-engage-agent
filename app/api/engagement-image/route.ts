import OpenAI from "openai";
import { NextResponse } from "next/server";

type Answers = Record<string, string | undefined>;

type Plan = {
  name: string;
  summary: string;
  rationale: string;
  tactics: string[];
  cadence: string;
  checks: string[];
};

type ContentItem = {
  type: string;
  title: string;
  body: string;
};

const buildPrompt = (item: ContentItem, plan: Plan | null, answers: Answers) => {
  const topic = answers.topic?.trim() || "gravity";
  const gradeLevel = "8th grade";
  const planName = plan?.name ?? "Engagement plan";

  return `Create a simple, student-friendly illustration for an ${gradeLevel} physics lesson.
Topic: ${topic}
Content type: ${item.type}
Title: ${item.title}
Plan: ${planName}
Description: ${item.body}

Style: clean, minimal, classroom-friendly, no text labels.`;
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { item, plan, answers = {} } = (await request.json()) as {
      item: ContentItem;
      plan: Plan | null;
      answers?: Answers;
    };

    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
    const prompt = buildPrompt(item, plan, answers);

    const result = await client.images.generate({
      model,
      prompt,
      size: "1024x1024",
    });

    const data = result.data?.[0];
    const base64 = data?.b64_json;
    const url = data?.url;
    if (!base64 && !url) {
      throw new Error("Image generation returned empty data.");
    }

    return NextResponse.json({
      url: base64 ? `data:image/png;base64,${base64}` : url,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate image.";
    console.error("engagement-image error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
