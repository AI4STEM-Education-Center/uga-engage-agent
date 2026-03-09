import { NextResponse } from "next/server";
import { getQuizStatus, upsertQuizStatus } from "@/lib/nosql";

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

  const record = await getQuizStatus(classId, assignmentId);
  return NextResponse.json({ quizStatus: record });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { classId, assignmentId, lessonNumber, status, publishedBy } = body;

  if (!classId || !assignmentId || !lessonNumber || !status) {
    return NextResponse.json(
      { error: "classId, assignmentId, lessonNumber, and status are required." },
      { status: 400 },
    );
  }

  if (!["draft", "published", "closed"].includes(status)) {
    return NextResponse.json(
      { error: "status must be draft, published, or closed." },
      { status: 400 },
    );
  }

  const record = await upsertQuizStatus(
    classId,
    assignmentId,
    lessonNumber,
    status,
    publishedBy,
  );
  return NextResponse.json({ quizStatus: record });
}
