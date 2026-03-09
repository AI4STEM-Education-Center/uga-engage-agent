import { NextResponse } from "next/server";
import { upsertStudentAnswer, listStudentAnswers, getStudentAnswer } from "@/lib/nosql";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const assignmentId = searchParams.get("assignmentId");
  const studentId = searchParams.get("studentId");

  if (!classId || !assignmentId) {
    return NextResponse.json(
      { error: "classId and assignmentId are required." },
      { status: 400 },
    );
  }

  if (studentId) {
    const answer = await getStudentAnswer(classId, assignmentId, studentId);
    return NextResponse.json({ answer });
  }

  const answers = await listStudentAnswers(classId, assignmentId);
  return NextResponse.json({ answers });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { classId, assignmentId, studentId, studentName, lessonNumber, answers } = body;

  if (!classId || !assignmentId || !studentId || !lessonNumber || !answers) {
    return NextResponse.json(
      { error: "classId, assignmentId, studentId, lessonNumber, and answers are required." },
      { status: 400 },
    );
  }

  if (typeof answers !== "object" || Object.keys(answers).length === 0) {
    return NextResponse.json(
      { error: "answers must be a non-empty object." },
      { status: 400 },
    );
  }

  const record = await upsertStudentAnswer({
    class_id: classId,
    assignment_id: assignmentId,
    student_id: studentId,
    student_name: studentName ?? "Student",
    lesson_number: lessonNumber,
    answers,
    submitted_at: new Date().toISOString(),
  });

  return NextResponse.json({ answer: record }, { status: 201 });
}
