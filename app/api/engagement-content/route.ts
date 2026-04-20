import OpenAI from "openai";
import { NextResponse } from "next/server";

import {
  generateContentItem,
  type ResolvedContentItem,
} from "@/lib/content-generator";
import { getLessonGenerationContext } from "@/lib/lesson-context";

export const maxDuration = 60;

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
      lessonNumber,
      selectedStrategies = [],
    } = (await request.json()) as {
      lessonNumber?: number;
      selectedStrategies?: string[];
    };
    if (typeof lessonNumber !== "number") {
      return NextResponse.json(
        { error: "lessonNumber is required." },
        { status: 400 },
      );
    }

    const lessonContext = getLessonGenerationContext(lessonNumber);
    if (!lessonContext) {
      return NextResponse.json(
        { error: `Lesson ${lessonNumber} not found.` },
        { status: 400 },
      );
    }

    const strategies = selectedStrategies.filter(Boolean);
    if (strategies.length === 0) {
      return NextResponse.json(
        { error: "selectedStrategies must contain at least one strategy." },
        { status: 400 },
      );
    }

    const items: ResolvedContentItem[] = await Promise.all(
      strategies.map((strategy) =>
        generateContentItem(client, lessonNumber, strategy),
      ),
    );

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate content.";
    console.error("engagement-content error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
