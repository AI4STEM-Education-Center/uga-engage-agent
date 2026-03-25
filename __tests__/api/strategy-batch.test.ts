import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCompletion, MockAPIConnectionTimeoutError } = vi.hoisted(() => {
  const createCompletion = vi.fn();

  class MockAPIConnectionTimeoutError extends Error {
    constructor(message = "Request timed out.") {
      super(message);
      this.name = "Error";
    }
  }

  return { createCompletion, MockAPIConnectionTimeoutError };
});

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: createCompletion,
      },
    };
  }

  return {
    default: MockOpenAI,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
  };
});

vi.mock("@/lib/nosql", () => {
  const cache = new Map<string, string>();

  return {
    getCachedPlanJson: vi.fn(async (classId: string, assignmentId: string, studentId: string) => {
      return cache.get(`${classId}:${assignmentId}:${studentId}`) ?? null;
    }),
    upsertCachedPlanJson: vi.fn(async (classId: string, assignmentId: string, studentId: string, planJson: string) => {
      cache.set(`${classId}:${assignmentId}:${studentId}`, planJson);
    }),
    __resetCache: () => {
      cache.clear();
    },
  };
});

const { POST } = await import("@/app/api/strategy-batch/route");
const { __resetCache } = (await import("@/lib/nosql")) as unknown as {
  __resetCache: () => void;
};

const buildRequest = (students: Array<Record<string, unknown>>) =>
  new Request("http://localhost:3000/api/strategy-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: "class-1",
      assignmentId: "assignment-1",
      students,
    }),
  });

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  createCompletion.mockReset();
  __resetCache();
});

const buildCompletion = (strategy = "experience bridging") => ({
  choices: [
    {
      message: {
        content: JSON.stringify({
          name: "Bridge to prior knowledge",
          strategy,
          relevance: {
            "cognitive conflict": strategy === "cognitive conflict" ? 90 : 10,
            analogy: strategy === "analogy" ? 90 : 15,
            "experience bridging": strategy === "experience bridging" ? 90 : 20,
            "engaged critiquing": strategy === "engaged critiquing" ? 90 : 25,
          },
          overallRecommendation: "Connect the concept to the student's experience.",
          recommendationReason: "This fits the student because they referenced a concrete real-world example.",
          summary: "Use prior experience to ground the lesson.",
          tldr: "Anchor the lesson in familiar experiences.",
          rationale: "The student named a concrete example from daily life.",
          tactics: ["Start with a familiar example."],
          cadence: "At lesson launch",
          checks: ["Ask the student to compare the example to the new concept."],
        }),
      },
    },
  ],
});

describe("POST /api/strategy-batch", () => {
  it("returns 504 and normalized timeout errors when every student times out", async () => {
    createCompletion
      .mockRejectedValueOnce(new MockAPIConnectionTimeoutError())
      .mockRejectedValueOnce(new MockAPIConnectionTimeoutError());

    const res = await POST(buildRequest([
      { id: "student-1", name: "Jon", answers: { q1: "A", q2: "B" } },
      { id: "student-2", name: "David", answers: { q1: "C", q2: "D" } },
    ]));

    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.error).toBe("Strategy generation timed out before the model returned.");
    expect(data.errors).toEqual([
      {
        id: "student-1",
        name: "Jon",
        error: "Strategy generation timed out before the model returned.",
      },
      {
        id: "student-2",
        name: "David",
        error: "Strategy generation timed out before the model returned.",
      },
    ]);
  });

  it("returns partial results when one student succeeds and another times out", async () => {
    createCompletion
      .mockResolvedValueOnce(buildCompletion("experience bridging"))
      .mockRejectedValueOnce(new MockAPIConnectionTimeoutError());

    const res = await POST(buildRequest([
      { id: "student-1", name: "Ava", answers: { q1: "A", q2: "B" } },
      { id: "student-2", name: "Jon", answers: { q1: "C", q2: "D" } },
    ]));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toMatchObject({
      id: "student-1",
      name: "Ava",
      plan: {
        strategy: "experience bridging",
      },
    });
    expect(data.distribution).toEqual({ "experience bridging": 1 });
    expect(data.errors).toEqual([
      {
        id: "student-2",
        name: "Jon",
        error: "Strategy generation timed out before the model returned.",
      },
    ]);
  });

  it("starts multiple student generations in parallel within a batch", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    createCompletion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const requestPromise = POST(buildRequest([
      { id: "student-1", name: "Ava", answers: { q1: "A", q2: "B" } },
      { id: "student-2", name: "Jon", answers: { q1: "C", q2: "D" } },
      { id: "student-3", name: "David", answers: { q1: "E", q2: "F" } },
      { id: "student-4", name: "Mia", answers: { q1: "G", q2: "H" } },
    ]));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createCompletion).toHaveBeenCalledTimes(4);

    resolvers.forEach((resolve, index) => {
      resolve(buildCompletion(index % 2 === 0 ? "experience bridging" : "analogy"));
    });

    const res = await requestPromise;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(4);
    expect(data.errors).toEqual([]);
  });
});
