import { NextRequest, NextResponse } from "next/server";
import { getMedia, listMedia, upsertMedia } from "@/lib/nosql";

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

/**
 * PUT /api/media
 *
 * Persist or update a media record (e.g. when the teacher selects a
 * different image version to be the "active" one for gallery/video).
 */
export async function PUT(request: NextRequest) {
  try {
    const { classId, assignmentId, studentId, contentItemId, mediaType, mimeType, dataUrl } =
      (await request.json()) as {
        classId?: string;
        assignmentId?: string;
        studentId?: string;
        contentItemId?: string;
        mediaType?: "image" | "video";
        mimeType?: string;
        dataUrl?: string;
      };

    if (!classId || !assignmentId || !studentId || !contentItemId || !mediaType || !dataUrl) {
      return NextResponse.json(
        { error: "classId, assignmentId, studentId, contentItemId, mediaType, and dataUrl are required." },
        { status: 400 },
      );
    }

    await upsertMedia({
      classId,
      assignmentId,
      studentId,
      contentItemId,
      mediaType,
      mimeType: mimeType ?? "image/webp",
      dataUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to persist media.";
    console.error("media PUT error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
