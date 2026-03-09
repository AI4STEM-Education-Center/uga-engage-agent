import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "@/app/api/content-publish/route";

vi.mock("@/lib/nosql", () => {
  let items: Array<Record<string, unknown>> = [];
  return {
    upsertContentPublish: vi.fn(async (input: Record<string, unknown>) => {
      const idx = items.findIndex(
        (c) => c.class_id === input.class_id && c.assignment_id === input.assignment_id && c.content_item_id === input.content_item_id,
      );
      if (idx >= 0) items[idx] = input;
      else items.push(input);
      return input;
    }),
    listPublishedContent: vi.fn(async (classId: string, assignmentId: string) => {
      return items.filter((c) => c.class_id === classId && c.assignment_id === assignmentId && c.published);
    }),
    __resetStore: () => { items = []; },
  };
});

const { __resetStore } = await import("@/lib/nosql") as unknown as { __resetStore: () => void };

beforeEach(() => {
  __resetStore();
});

describe("POST /api/content-publish", () => {
  it("should publish content items", async () => {
    const req = new Request("http://localhost:3000/api/content-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: "c1",
        assignmentId: "a1",
        publishedBy: "teacher-1",
        contentItems: [
          { id: "item-1", type: "warm-up", title: "Test", body: "Body", strategy: "analogy" },
          { id: "item-2", type: "mini-lesson", title: "Test 2", body: "Body 2", strategy: "analogy" },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.published).toHaveLength(2);
  });

  it("should reject empty content items", async () => {
    const req = new Request("http://localhost:3000/api/content-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: "c1", assignmentId: "a1", contentItems: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should reject missing fields", async () => {
    const req = new Request("http://localhost:3000/api/content-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: "c1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/content-publish", () => {
  it("should list published content", async () => {
    await POST(new Request("http://localhost:3000/api/content-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: "c1",
        assignmentId: "a1",
        publishedBy: "teacher-1",
        contentItems: [{ id: "item-1", type: "warm-up", title: "Test", body: "Body", strategy: "analogy" }],
      }),
    }));

    const req = new Request("http://localhost:3000/api/content-publish?classId=c1&assignmentId=a1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
  });

  it("should return empty when nothing published", async () => {
    const req = new Request("http://localhost:3000/api/content-publish?classId=c1&assignmentId=a1");
    const res = await GET(req);
    const data = await res.json();
    expect(data.items).toHaveLength(0);
  });
});
