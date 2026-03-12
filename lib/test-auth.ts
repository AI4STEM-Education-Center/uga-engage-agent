import { NextResponse } from "next/server";
import { createSSOToken, type UserContext } from "@/lib/auth";

type TestAuthRole = Extract<UserContext["role"], "teacher" | "student">;

function isTestAuthEnabled() {
  return process.env.TEST_AUTH_ENABLED === "true";
}

function getRequiredTestAuthKey() {
  const key = process.env.TEST_AUTH_KEY?.trim();
  if (!key) {
    throw new Error("TEST_AUTH_KEY environment variable is not set.");
  }
  return key;
}

function getParam(url: URL, key: string, fallback: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : fallback;
}

function getRedirectPath(url: URL, role: TestAuthRole) {
  const redirect = url.searchParams.get("redirect")?.trim();
  if (!redirect) {
    return role === "teacher" ? "/" : "/";
  }
  return redirect.startsWith("/") ? redirect : "/";
}

function getDefaultUser(role: TestAuthRole, url: URL) {
  const roleLabel = role === "teacher" ? "Teacher" : "Student";

  return {
    sub: getParam(url, "userId", `test-${role}`),
    email: getParam(url, "email", `${role}@example.com`),
    name: getParam(url, "name", `Test ${roleLabel}`),
    role,
    classId: getParam(url, "classId", "demo-class"),
    className: getParam(url, "className", "Demo Physics"),
    assignmentId: getParam(url, "assignmentId", "demo-assignment"),
    taskId: getParam(url, "taskId", `demo-${role}-task`),
  } as const;
}

export async function createTestAuthRedirect(
  request: Request,
  role: TestAuthRole,
) {
  const requestUrl = new URL(request.url);

  if (!isTestAuthEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const providedKey = requestUrl.searchParams.get("key");
  const expectedKey = getRequiredTestAuthKey();
  if (providedKey !== expectedKey) {
    return NextResponse.json(
      { error: "Invalid test auth key." },
      { status: 403 },
    );
  }

  const token = await createSSOToken(getDefaultUser(role, requestUrl), {
    expiresIn: "8h",
  });

  const redirectUrl = new URL(getRedirectPath(requestUrl, role), requestUrl);
  redirectUrl.searchParams.set("sso_token", token);

  return NextResponse.redirect(redirectUrl);
}
