import { NextRequest, NextResponse } from "next/server";
import { listAllMedia } from "@/lib/nosql";

export const maxDuration = 60;

/**
 * GET /api/gallery
 *
 * List all generated images (or videos) for the community gallery.
 *
 * Query parameters:
 *   - type     — "image" (default) or "video"
 *   - search   — free-text filter against content/student/class IDs
 *   - limit    — page size (default 12, max 60)
 *   - cursor   — opaque pagination cursor from a previous response
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mediaType =
    params.get("type") === "video" ? "video" : "image";
  const search = params.get("search")?.trim() || undefined;
  const limit = Math.min(60, Math.max(1, Number(params.get("limit")) || 12));
  const cursor = params.get("cursor") || undefined;

  try {
    const page = await listAllMedia({ mediaType, search, limit, cursor });
    return NextResponse.json(page);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load gallery.";
    console.error("gallery route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
