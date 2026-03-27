import { describe, expect, it } from "vitest";

import {
  deserializeCachedPlan,
  invalidateSerializedCachedPlan,
  serializeCachedPlan,
} from "@/lib/strategy-plan-cache";

describe("strategy-plan-cache invalidation", () => {
  it("treats invalidated cache envelopes as cache misses", () => {
    const valid = serializeCachedPlan(
      {
        strategy: "analogy",
        summary: "Use analogy.",
      },
      2,
    );

    expect(
      deserializeCachedPlan(valid, {
        lessonNumber: 2,
        requireVersionMatch: true,
      }),
    ).toEqual({
      strategy: "analogy",
      summary: "Use analogy.",
    });

    const invalidated = invalidateSerializedCachedPlan(
      valid,
      "2026-03-27T00:00:00.000Z",
    );

    expect(
      deserializeCachedPlan(invalidated, {
        lessonNumber: 2,
        requireVersionMatch: true,
      }),
    ).toBeNull();
  });

  it("can soft-invalidate legacy cached plan payloads without deleting the plan", () => {
    const invalidated = invalidateSerializedCachedPlan(
      JSON.stringify({
        strategy: "cognitive conflict",
        summary: "Use the misconception directly.",
      }),
      "2026-03-27T00:00:00.000Z",
    );

    const parsed = JSON.parse(invalidated) as {
      promptVersion: number;
      invalidatedAt: string;
      plan: {
        strategy: string;
        summary: string;
      };
    };

    expect(parsed.invalidatedAt).toBe("2026-03-27T00:00:00.000Z");
    expect(parsed.plan).toEqual({
      strategy: "cognitive conflict",
      summary: "Use the misconception directly.",
    });
    expect(deserializeCachedPlan(invalidated)).toBeNull();
  });
});
