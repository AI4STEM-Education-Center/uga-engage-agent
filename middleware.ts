import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {};

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization";
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  const response = NextResponse.next();

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const cors = getCorsHeaders(origin);
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
