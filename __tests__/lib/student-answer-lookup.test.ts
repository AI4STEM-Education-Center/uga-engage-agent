import { describe, expect, it, vi } from "vitest";

import {
  findExistingStudentAnswer,
  getCandidateStudentIds,
} from "@/lib/student-answer-lookup";

describe("getCandidateStudentIds", () => {
  it("includes the logged-in user id first", () => {
    expect(getCandidateStudentIds("user-123", "other@example.com")).toEqual([
      "user-123",
    ]);
  });

  it("adds the configured test-student id when the email matches", () => {
    expect(
      getCandidateStudentIds("mongo-user-id", "maya@test-student.com"),
    ).toEqual(["mongo-user-id", "test-student-maya-chen"]);
  });
});

describe("findExistingStudentAnswer", () => {
  it("returns the direct user answer when present", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          answer: {
            answers: {
              L1_Q1: "A",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await findExistingStudentAnswer({
      classId: "class-1",
      assignmentId: "assignment-1",
      lessonNumber: 1,
      userId: "user-123",
      email: "maya@test-student.com",
      fetchImpl,
    });

    expect(result).toEqual({
      matchedStudentId: "user-123",
      answer: {
        answers: {
          L1_Q1: "A",
        },
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the configured test-student id when the direct lookup is empty", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            answer: {
              answers: {
                L1_Q1: "C",
                L1_Q1_confidence: "B",
              },
            },
          }),
          { status: 200 },
        ),
      );

    const result = await findExistingStudentAnswer({
      classId: "class-1",
      assignmentId: "assignment-1",
      lessonNumber: 1,
      userId: "real-genius-user-id",
      email: "maya@test-student.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain(
      "studentId=real-genius-user-id",
    );
    expect(fetchImpl.mock.calls[1]?.[0]).toContain(
      "studentId=test-student-maya-chen",
    );
    expect(result).toEqual({
      matchedStudentId: "test-student-maya-chen",
      answer: {
        answers: {
          L1_Q1: "C",
          L1_Q1_confidence: "B",
        },
      },
    });
  });
});
