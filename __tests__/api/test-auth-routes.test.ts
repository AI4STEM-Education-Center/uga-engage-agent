import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as GETStudent } from "@/app/test/student/route";
import { GET as GETTeacher } from "@/app/test/teacher/route";
import { verifySSOToken } from "@/lib/auth";

const TEST_SECRET = "test-sso-secret-for-testing";
const TEST_KEY = "let-me-in";

beforeEach(() => {
  vi.stubEnv("SSO_SECRET", TEST_SECRET);
  vi.stubEnv("TEST_AUTH_ENABLED", "true");
  vi.stubEnv("TEST_AUTH_KEY", TEST_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("test auth routes", () => {
  it("redirects /test/teacher with a valid teacher token", async () => {
    const response = await GETTeacher(
      new Request(`http://localhost:3000/test/teacher?key=${TEST_KEY}`),
    );

    expect(response.status).toBe(307);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe("/");

    const token = redirectUrl.searchParams.get("sso_token");
    expect(token).toBeTruthy();

    const user = await verifySSOToken(token!);
    expect(user.role).toBe("teacher");
    expect(user.userId).toBe("test-teacher");
    expect(user.classId).toBe("demo-class");
    expect(user.assignmentId).toBe("demo-assignment");
  });

  it("redirects /test/student with override params", async () => {
    const response = await GETStudent(
      new Request(
        `http://localhost:3000/test/student?key=${TEST_KEY}&name=Ada%20Student&userId=student-42&classId=physics-a&assignmentId=lesson-3`,
      ),
    );

    expect(response.status).toBe(307);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    const token = redirectUrl.searchParams.get("sso_token");
    expect(token).toBeTruthy();

    const user = await verifySSOToken(token!);
    expect(user.role).toBe("student");
    expect(user.userId).toBe("student-42");
    expect(user.name).toBe("Ada Student");
    expect(user.classId).toBe("physics-a");
    expect(user.assignmentId).toBe("lesson-3");
  });

  it("rejects requests with the wrong test auth key", async () => {
    const response = await GETTeacher(
      new Request("http://localhost:3000/test/teacher?key=wrong-key"),
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when test auth routes are disabled", async () => {
    vi.stubEnv("TEST_AUTH_ENABLED", "false");

    const response = await GETStudent(
      new Request(`http://localhost:3000/test/student?key=${TEST_KEY}`),
    );

    expect(response.status).toBe(404);
  });
});
