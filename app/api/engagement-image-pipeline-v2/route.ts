import OpenAI from "openai";
import { NextResponse } from "next/server";

import { runVisualPipelineV2 } from "@/lib/visual-pipeline/v2/orchestrator-v2";
import type { ResolvedContentItem } from "@/lib/content-generator";

// v2 route intentionally does NOT handle DB persistence or refinement
// yet — those layers will be re-attached after the visual quality bar
// is met. During the v2 stabilization phase this route is for
// evaluation only.

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
    const body = (await request.json()) as {
      item?: ResolvedContentItem;
      lessonNumber?: number;
    };
    if (!body.item) {
      return NextResponse.json({ error: "item is required." }, { status: 400 });
    }
    if (typeof body.lessonNumber !== "number") {
      return NextResponse.json(
        { error: "lessonNumber is required." },
        { status: 400 },
      );
    }

    const result = await runVisualPipelineV2(
      client,
      body.item,
      body.lessonNumber,
    );

    return NextResponse.json({
      url: result.url,
      usedFallback: result.usedFallback,
      reviewPassed: result.reviewPassed,
      regeneratedScene: result.regeneratedScene,
      archetype: result.scene?.scene.archetype,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate image.";
    if (message.toLowerCase().includes("safety")) {
      return NextResponse.json(
        { error: "The request was rejected by content policy.", detail: message },
        { status: 422 },
      );
    }
    console.error("engagement-image-pipeline-v2 error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
