import { createMockUserRedirect } from "@/lib/mock-auth";

export async function GET(request: Request) {
  return createMockUserRedirect(request, "teacher");
}
