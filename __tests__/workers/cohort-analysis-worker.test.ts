import { afterAll, describe, expect, it } from "vitest";

const originalDynamoTable = process.env.DYNAMODB_TABLE;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalQueueMaxReceiveCount =
  process.env.COHORT_ANALYSIS_QUEUE_MAX_RECEIVE_COUNT;

process.env.DYNAMODB_TABLE = "test-table";
process.env.OPENAI_API_KEY = "test-key";
delete process.env.COHORT_ANALYSIS_QUEUE_MAX_RECEIVE_COUNT;

const {
  getApproximateReceiveCount,
  getJobCounterDeltas,
  getMaxReceiveCount,
  isFinalReceiveAttempt,
} = await import("../../workers/cohort-analysis-worker/index.mjs");

afterAll(() => {
  if (originalDynamoTable === undefined) {
    delete process.env.DYNAMODB_TABLE;
  } else {
    process.env.DYNAMODB_TABLE = originalDynamoTable;
  }

  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  if (originalQueueMaxReceiveCount === undefined) {
    delete process.env.COHORT_ANALYSIS_QUEUE_MAX_RECEIVE_COUNT;
  } else {
    process.env.COHORT_ANALYSIS_QUEUE_MAX_RECEIVE_COUNT =
      originalQueueMaxReceiveCount;
  }
});

describe("cohort-analysis worker retry helpers", () => {
  it("does not count retrying attempts as processed students", () => {
    expect(getJobCounterDeltas(null, "retrying")).toEqual({
      processedDelta: 0,
      completedDelta: 0,
      failedDelta: 0,
    });
    expect(getJobCounterDeltas("retrying", "completed")).toEqual({
      processedDelta: 1,
      completedDelta: 1,
      failedDelta: 0,
    });
    expect(getJobCounterDeltas("retrying", "failed")).toEqual({
      processedDelta: 1,
      completedDelta: 0,
      failedDelta: 1,
    });
  });

  it("keeps terminal student statuses idempotent", () => {
    expect(getJobCounterDeltas("completed", "completed")).toEqual({
      processedDelta: 0,
      completedDelta: 0,
      failedDelta: 0,
    });
    expect(getJobCounterDeltas("failed", "failed")).toEqual({
      processedDelta: 0,
      completedDelta: 0,
      failedDelta: 0,
    });
  });

  it("classifies final receive attempts from SQS receive counts", () => {
    expect(getMaxReceiveCount()).toBe(3);
    expect(
      getApproximateReceiveCount({
        attributes: { ApproximateReceiveCount: "2" },
      }),
    ).toBe(2);
    expect(isFinalReceiveAttempt({ attributes: { ApproximateReceiveCount: "2" } }, 3)).toBe(
      false,
    );
    expect(isFinalReceiveAttempt({ attributes: { ApproximateReceiveCount: "3" } }, 3)).toBe(
      true,
    );
  });
});
