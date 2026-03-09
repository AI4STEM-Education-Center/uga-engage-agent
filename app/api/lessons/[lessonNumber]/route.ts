import { NextResponse } from "next/server";
import { getLesson } from "@/lib/quiz-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonNumber: string }> },
) {
  const { lessonNumber: lessonStr } = await params;
  const lessonNumber = parseInt(lessonStr, 10);

  if (isNaN(lessonNumber) || lessonNumber < 1 || lessonNumber > 8) {
    return NextResponse.json(
      { error: "lessonNumber must be between 1 and 8." },
      { status: 400 },
    );
  }

  const lesson = getLesson(lessonNumber);
  if (!lesson) {
    return NextResponse.json(
      { error: `Lesson ${lessonNumber} not found.` },
      { status: 404 },
    );
  }

  return NextResponse.json(lesson);
}
