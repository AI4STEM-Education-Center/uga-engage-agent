import { NextResponse } from "next/server";

import { recordTeacherAnnotation } from "@/lib/nosql";

export const runtime = "nodejs";

type AnnotationRequest = {
  studentName?: string | null;
  assignment?: string | null;
  overallRecommendation?: string;
  recommendationReason?: string | null;
  decision?: "agree" | "disagree";
  reason?: string | null;
  aiPlan?: Record<string, unknown>;
  selectedStrategies?: string[];
  answers?: Record<string, string | undefined>;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AnnotationRequest;
    const overallRecommendation = payload.overallRecommendation?.trim();
    const decision = payload.decision;
    const reason = payload.reason?.trim() || null;

    if (!overallRecommendation || !decision) {
      return NextResponse.json(
        {
          error: "overallRecommendation and decision are required.",
        },
        { status: 400 },
      );
    }

    if (decision === "disagree" && !reason) {
      return NextResponse.json(
        { error: "reason is required when decision is disagree." },
        { status: 400 },
      );
    }

    const record = await recordTeacherAnnotation({
      student_name: payload.studentName ?? null,
      assignment: payload.assignment ?? null,
      overall_recommendation: overallRecommendation,
      recommendation_reason: payload.recommendationReason ?? null,
      decision,
      reason,
      ai_plan: payload.aiPlan ?? {},
      selected_strategies: payload.selectedStrategies ?? [],
      answers: payload.answers ?? {},
    });

    return NextResponse.json({ annotation: record });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save annotation.";
    console.error("teacher-annotation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
