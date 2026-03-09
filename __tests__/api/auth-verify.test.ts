import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SignJWT } from "jose";
import { POST } from "@/app/api/auth/verify/route";

const TEST_SECRET = "test-sso-secret-for-testing";
const SECRET_BYTES = new TextEncoder().encode(TEST_SECRET);

beforeAll(() => {
  vi.stubEnv("SSO_SECRET", TEST_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/verify", () => {
  it("should verify a valid token and return user context", async () => {
    const token = await new SignJWT({
      sub: "teacher-123",
      email: "teacher@example.com",
      name: "Dr. Smith",
      role: "teacher",
      classId: "class-abc",
      assignmentId: "assign-xyz",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("genius-learning-platform")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(SECRET_BYTES);

    const req = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user.userId).toBe("teacher-123");
    expect(data.user.role).toBe("teacher");
    expect(data.user.classId).toBe("class-abc");
    expect(data.user.assignmentId).toBe("assign-xyz");
  });

  it("should reject missing token", async () => {
    const req = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should reject invalid token", async () => {
    const req = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-jwt-string" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should reject expired token", async () => {
    const token = await new SignJWT({
      sub: "user-1",
      name: "Test",
      role: "teacher",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("genius-learning-platform")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(SECRET_BYTES);

    const req = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
