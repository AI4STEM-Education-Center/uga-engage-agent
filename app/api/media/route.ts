import { NextRequest, NextResponse } from "next/server";
import { getMedia, listMedia } from "@/lib/nosql";

/**
 * GET /api/media
 *
 * Retrieve stored media (images & videos) from the database.
 *
 * Query parameters:
 *   - classId (required)
 *   - assignmentId (required)
 *   - studentId (required)
 *   - contentItemId (optional) — filter to a specific content item
 *   - mediaType (optional) — "image" or "video"
 *
 * If contentItemId + mediaType are both provided, returns a single record.
 * Otherwise returns a list of matching media records.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const classId = params.get("classId");
  const assignmentId = params.get("assignmentId");
  const studentId = params.get("studentId");
  const contentItemId = params.get("contentItemId");
  const mediaType = params.get("mediaType") as
    | "image"
    | "video"
    | null;

  if (!classId || !assignmentId || !studentId) {
    return NextResponse.json(
      { error: "classId, assignmentId, and studentId are required." },
      { status: 400 },
    );
  }

  try {
    // Single record lookup
    if (contentItemId && mediaType) {
      const record = await getMedia(
        classId,
        assignmentId,
        studentId,
        contentItemId,
        mediaType,
      );
      if (!record) {
        return NextResponse.json({ found: false }, { status: 404 });
      }
      return NextResponse.json({ found: true, media: record });
    }

    // List media
    const records = await listMedia(
      classId,
      assignmentId,
      studentId,
      contentItemId ?? undefined,
      mediaType ?? undefined,
    );
    return NextResponse.json({ results: records });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve media.";
    console.error("media route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
