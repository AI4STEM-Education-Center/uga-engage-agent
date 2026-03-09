import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SignJWT } from "jose";
import { verifySSOToken, extractSSOToken } from "@/lib/auth";

const TEST_SECRET = "test-sso-secret-for-testing";
const SECRET_BYTES = new TextEncoder().encode(TEST_SECRET);

beforeAll(() => {
  vi.stubEnv("SSO_SECRET", TEST_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

async function createToken(payload: Record<string, unknown>, options?: { expiresIn?: string }) {
  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("genius-learning-platform")
    .setIssuedAt();
  if (options?.expiresIn) {
    builder = builder.setExpirationTime(options.expiresIn);
  } else {
    builder = builder.setExpirationTime("1h");
  }
  return builder.sign(SECRET_BYTES);
}

describe("verifySSOToken", () => {
  it("should verify a valid teacher token", async () => {
    const token = await createToken({
      sub: "teacher-123",
      email: "teacher@example.com",
      name: "Dr. Smith",
      role: "teacher",
      classId: "class-abc",
      className: "Physics 101",
      assignmentId: "assign-xyz",
    });

    const user = await verifySSOToken(token);
    expect(user.userId).toBe("teacher-123");
    expect(user.email).toBe("teacher@example.com");
    expect(user.name).toBe("Dr. Smith");
    expect(user.role).toBe("teacher");
    expect(user.classId).toBe("class-abc");
    expect(user.className).toBe("Physics 101");
    expect(user.assignmentId).toBe("assign-xyz");
  });

  it("should verify a valid student token", async () => {
    const token = await createToken({
      sub: "student-456",
      email: "student@example.com",
      name: "Jane Doe",
      role: "student",
      classId: "class-abc",
      assignmentId: "assign-xyz",
    });

    const user = await verifySSOToken(token);
    expect(user.userId).toBe("student-456");
    expect(user.role).toBe("student");
  });

  it("should verify a guest token with null email", async () => {
    const token = await createToken({
      sub: "guest-789",
      email: null,
      name: "Guest User",
      role: "guest",
    });

    const user = await verifySSOToken(token);
    expect(user.userId).toBe("guest-789");
    expect(user.email).toBeNull();
    expect(user.role).toBe("guest");
  });

  it("should reject a token with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ sub: "user-1", role: "teacher", name: "Test" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("genius-learning-platform")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);

    await expect(verifySSOToken(token)).rejects.toThrow();
  });

  it("should reject a token with wrong issuer", async () => {
    const token = await new SignJWT({ sub: "user-1", role: "teacher", name: "Test" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("wrong-issuer")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(SECRET_BYTES);

    await expect(verifySSOToken(token)).rejects.toThrow();
  });

  it("should reject a token without sub", async () => {
    const token = await createToken({
      role: "teacher",
      name: "Test",
    });

    await expect(verifySSOToken(token)).rejects.toThrow("missing sub");
  });

  it("should reject a token with invalid role", async () => {
    const token = await createToken({
      sub: "user-1",
      role: "admin",
      name: "Test",
    });

    await expect(verifySSOToken(token)).rejects.toThrow("invalid role");
  });

  it("should handle optional fields gracefully", async () => {
    const token = await createToken({
      sub: "user-1",
      role: "teacher",
      name: "Test",
    });

    const user = await verifySSOToken(token);
    expect(user.classId).toBeUndefined();
    expect(user.assignmentId).toBeUndefined();
    expect(user.taskId).toBeUndefined();
  });
});

describe("extractSSOToken", () => {
  it("should extract token from query parameter", () => {
    const req = new Request("http://localhost:3000/?sso_token=abc123");
    expect(extractSSOToken(req)).toBe("abc123");
  });

  it("should extract token from Authorization header", () => {
    const req = new Request("http://localhost:3000/", {
      headers: { Authorization: "Bearer xyz789" },
    });
    expect(extractSSOToken(req)).toBe("xyz789");
  });

  it("should prefer query parameter over header", () => {
    const req = new Request("http://localhost:3000/?sso_token=from-query", {
      headers: { Authorization: "Bearer from-header" },
    });
    expect(extractSSOToken(req)).toBe("from-query");
  });

  it("should return null when no token is present", () => {
    const req = new Request("http://localhost:3000/");
    expect(extractSSOToken(req)).toBeNull();
  });
});
