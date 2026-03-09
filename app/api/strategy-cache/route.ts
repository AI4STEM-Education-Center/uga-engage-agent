import { NextRequest, NextResponse } from "next/server";

import { listCachedPlans } from "@/lib/nosql";

export const runtime = "nodejs";

/**
 * GET /api/strategy-cache?classId=...&assignmentId=...&studentId=...
 *
 * Returns cached strategy plans from DynamoDB (or local fallback).
 * - classId + assignmentId are required
 * - studentId is optional — omit to get all students in the session
 *
 * Response shape:
 *   { results: [{ studentId, plan, updatedAt }], count: number }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get("classId")?.trim();
  const assignmentId = searchParams.get("assignmentId")?.trim();
  const studentId = searchParams.get("studentId")?.trim() || undefined;

  if (!classId || !assignmentId) {
    return NextResponse.json(
      { error: "classId and assignmentId are required query parameters." },
      { status: 400 },
    );
  }

  try {
    const records = await listCachedPlans(classId, assignmentId, studentId);
    console.info(
      `strategy-cache: classId=${classId} assignmentId=${assignmentId} → ${records.length} cached plan(s)`,
    );

    const results = records.map((record) => {
      let plan: unknown = null;
      try {
        plan = JSON.parse(record.plan_json);
      } catch {
        plan = record.plan_json;
      }
      return {
        studentId: record.student_id,
        plan,
        updatedAt: record.updated_at,
      };
    });

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve cached plans.";
    console.error("strategy-cache GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
