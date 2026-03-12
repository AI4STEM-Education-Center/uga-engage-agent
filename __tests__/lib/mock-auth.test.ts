import { describe, expect, it } from "vitest";
import { getMockUser, parseMockUserRole } from "@/lib/mock-auth";

describe("parseMockUserRole", () => {
  it("accepts teacher and student", () => {
    expect(parseMockUserRole("teacher")).toBe("teacher");
    expect(parseMockUserRole("student")).toBe("student");
  });

  it("rejects anything else", () => {
    expect(parseMockUserRole(null)).toBeNull();
    expect(parseMockUserRole("guest")).toBeNull();
    expect(parseMockUserRole("admin")).toBeNull();
  });
});

describe("getMockUser", () => {
  it("returns matching demo teacher and student users", () => {
    const teacher = getMockUser("teacher");
    const student = getMockUser("student");

    expect(teacher.role).toBe("teacher");
    expect(student.role).toBe("student");
    expect(teacher.classId).toBe(student.classId);
    expect(teacher.assignmentId).toBe(student.assignmentId);
  });
});
