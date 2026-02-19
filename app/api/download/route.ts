import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const filename = request.nextUrl.searchParams.get("filename") ?? "download";

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return new Response("Failed to fetch file", { status: upstream.status });
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Failed to fetch file", { status: 502 });
  }
}
