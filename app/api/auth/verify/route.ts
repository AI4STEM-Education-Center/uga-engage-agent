import { NextResponse } from "next/server";
import { verifySSOToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string };

    if (!token) {
      return NextResponse.json(
        { error: "Token is required." },
        { status: 400 },
      );
    }

    const user = await verifySSOToken(token);
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid or expired token.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
