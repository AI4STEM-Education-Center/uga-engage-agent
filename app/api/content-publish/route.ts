import { NextResponse } from "next/server";
import { upsertContentPublish, listPublishedContent } from "@/lib/nosql";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const assignmentId = searchParams.get("assignmentId");

  if (!classId || !assignmentId) {
    return NextResponse.json(
      { error: "classId and assignmentId are required." },
      { status: 400 },
    );
  }

  const items = await listPublishedContent(classId, assignmentId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { classId, assignmentId, contentItems, publishedBy } = body;

  if (!classId || !assignmentId || !Array.isArray(contentItems) || contentItems.length === 0) {
    return NextResponse.json(
      { error: "classId, assignmentId, and contentItems array are required." },
      { status: 400 },
    );
  }

  const publishedAt = new Date().toISOString();
  const results = [];

  for (const item of contentItems) {
    if (!item.id) continue;
    const record = await upsertContentPublish({
      class_id: classId,
      assignment_id: assignmentId,
      content_item_id: item.id,
      content_json: JSON.stringify(item),
      published: true,
      published_at: publishedAt,
      published_by: publishedBy ?? "unknown",
    });
    results.push(record);
  }

  return NextResponse.json({ published: results }, { status: 201 });
}
