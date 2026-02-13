import { NextRequest, NextResponse } from "next/server";
import { upsertMedia } from "@/lib/nosql";

export const maxDuration = 60; // Poll + return URL (no download in request)

const XAI_VIDEO_BASE = "https://api.x.ai/v1/videos";

export async function GET(request: NextRequest) {
  const xaiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  if (!xaiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY or GROK_API_KEY is not set." },
      { status: 500 },
    );
  }

  const requestId = request.nextUrl.searchParams.get("requestId");
  const contentItemId = request.nextUrl.searchParams.get("contentItemId");
  const classId = request.nextUrl.searchParams.get("classId");
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const studentId = request.nextUrl.searchParams.get("studentId");

  if (!requestId) {
    return NextResponse.json(
      { error: "Missing requestId parameter." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${XAI_VIDEO_BASE}/${requestId}`, {
      headers: {
        Authorization: `Bearer ${xaiKey}`,
      },
    });

    const data = (await res.json()) as {
      status?: string;
      video?: { url?: string };
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data?.error?.message ?? `x.ai poll failed: ${res.status}`);
    }

    if (data.status === "expired") {
      return NextResponse.json(
        { done: false, error: "Video request expired. Try again." },
        { status: 410 },
      );
    }
    // x.ai may return either:
    // 1) { status: "done", video: { url: ... } }
    // 2) { video: { url: ... }, model: ... } (no status field)
    const isDone = data.status === "done" || Boolean(data.video?.url);
    if (!isDone) {
      return NextResponse.json({ done: false });
    }

    const videoUrl = data.video?.url;
    if (!videoUrl) {
      return NextResponse.json(
        { error: "Video generation completed but returned no URL." },
        { status: 500 },
      );
    }

    // Return x.ai URL directly (per docs: GET returns video.url when done)
    // Optionally persist to storage in background (don't block response)
    if (contentItemId && classId && sessionId && studentId) {
      fetch(videoUrl)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          const base64 = Buffer.from(buf).toString("base64");
          const dataUrl = `data:video/mp4;base64,${base64}`;
          return upsertMedia({
            classId,
            sessionId,
            studentId,
            contentItemId,
            mediaType: "video",
            mimeType: "video/mp4",
            dataUrl,
          });
        })
        .catch((err) => console.error("Background video persist failed:", err));
    }

    return NextResponse.json({
      done: true,
      url: videoUrl,
      contentItemId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check video status.";
    console.error("engagement-video/status error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
