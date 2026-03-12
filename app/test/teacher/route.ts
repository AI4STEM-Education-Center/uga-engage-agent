import { createTestAuthRedirect } from "@/lib/test-auth";

export async function GET(request: Request) {
  return createTestAuthRedirect(request, "teacher");
}
