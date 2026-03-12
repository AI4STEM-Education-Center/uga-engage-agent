import { NextResponse } from "next/server";
import type { UserContext } from "@/lib/auth";

export type MockUserRole = "teacher" | "student";

export const MOCK_USER_QUERY_PARAM = "mock_user";
export const MOCK_USER_STORAGE_KEY = "engage-mock-user-role";

const MOCK_USERS: Record<MockUserRole, UserContext> = {
  teacher: {
    userId: "test-teacher",
    email: "teacher@example.com",
    name: "Test Teacher",
    role: "teacher",
    classId: "demo-class",
    className: "Demo Physics",
    assignmentId: "demo-assignment",
    taskId: "demo-teacher-task",
  },
  student: {
    userId: "test-student",
    email: "student@example.com",
    name: "Test Student",
    role: "student",
    classId: "demo-class",
    className: "Demo Physics",
    assignmentId: "demo-assignment",
    taskId: "demo-student-task",
  },
};

export function parseMockUserRole(
  value: string | null | undefined,
): MockUserRole | null {
  if (value === "teacher" || value === "student") {
    return value;
  }

  return null;
}

export function getMockUser(role: MockUserRole): UserContext {
  return MOCK_USERS[role];
}

export function createMockUserRedirect(_request: Request, role: MockUserRole) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      location: `/?${MOCK_USER_QUERY_PARAM}=${role}`,
    },
  });
}
