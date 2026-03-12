import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SSO_ISSUER = "genius-learning-platform";

export type SSORole = "student" | "teacher" | "guest";

export type UserContext = {
  userId: string;
  email: string | null;
  name: string;
  role: SSORole;
  classId?: string;
  className?: string;
  assignmentId?: string;
  taskId?: string;
};

export type SSOPayload = JWTPayload & {
  sub: string;
  email: string | null;
  name: string;
  role: SSORole;
  classId?: string;
  className?: string;
  assignmentId?: string;
  taskId?: string;
  iss: string;
};

export type SSOTokenInput = {
  sub: string;
  email?: string | null;
  name: string;
  role: SSORole;
  classId?: string;
  className?: string;
  assignmentId?: string;
  taskId?: string;
};

const getSecret = () => {
  const raw = process.env.SSO_SECRET;
  if (!raw) {
    throw new Error("SSO_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(raw);
};

export async function createSSOToken(
  payload: SSOTokenInput,
  options?: { expiresIn?: string | number | Date },
): Promise<string> {
  const secret = getSecret();

  return new SignJWT({
    sub: payload.sub,
    email: payload.email ?? null,
    name: payload.name,
    role: payload.role,
    ...(payload.classId ? { classId: payload.classId } : {}),
    ...(payload.className ? { className: payload.className } : {}),
    ...(payload.assignmentId ? { assignmentId: payload.assignmentId } : {}),
    ...(payload.taskId ? { taskId: payload.taskId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SSO_ISSUER)
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? "1h")
    .sign(secret);
}

export async function verifySSOToken(token: string): Promise<UserContext> {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret, {
    issuer: SSO_ISSUER,
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
