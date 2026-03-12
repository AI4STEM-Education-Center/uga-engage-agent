import { describe, expect, it } from "vitest";
import { GET as GETStudent } from "@/app/test/student/route";
import { GET as GETTeacher } from "@/app/test/teacher/route";

describe("test auth routes", () => {
  it("redirects /test/teacher into mock teacher mode", async () => {
    const response = await GETTeacher(
      new Request("http://localhost:3000/test/teacher"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?mock_user=teacher",
    );
  });

  it("redirects /test/student into mock student mode", async () => {
    const response = await GETStudent(
      new Request("http://localhost:3000/test/student"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?mock_user=student",
    );
  });
});
