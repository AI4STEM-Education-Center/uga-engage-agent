import { jwtVerify, type JWTPayload } from "jose";

export type UserContext = {
  userId: string;
  email: string | null;
  name: string;
  role: "student" | "teacher" | "guest";
  classId?: string;
  className?: string;
  assignmentId?: string;
  taskId?: string;
};

export type SSOPayload = JWTPayload & {
  sub: string;
  email: string | null;
  name: string;
  role: "student" | "teacher" | "guest";
  classId?: string;
  className?: string;
  assignmentId?: string;
  taskId?: string;
  iss: string;
};

const getSecret = () => {
  const raw = process.env.SSO_SECRET;
  if (!raw) {
    throw new Error("SSO_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(raw);
};

export async function verifySSOToken(token: string): Promise<UserContext> {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret, {
    issuer: "genius-learning-platform",
    algorithms: ["HS256"],
  });

  const sso = payload as SSOPayload;

  if (!sso.sub) {
    throw new Error("Invalid SSO token: missing sub claim.");
  }
  if (!sso.role || !["student", "teacher", "guest"].includes(sso.role)) {
    throw new Error("Invalid SSO token: missing or invalid role.");
  }

  return {
    userId: sso.sub,
    email: sso.email ?? null,
    name: sso.name ?? "User",
    role: sso.role,
    classId: sso.classId,
    className: sso.className,
    assignmentId: sso.assignmentId,
    taskId: sso.taskId,
  };
}

export function extractSSOToken(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sso_token");
  if (fromQuery) return fromQuery;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}
