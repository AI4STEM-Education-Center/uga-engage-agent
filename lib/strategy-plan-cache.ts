const STRATEGY_PLAN_CACHE_VERSION = 2;

type CachedPlanEnvelope<TPlan> = {
  promptVersion: number;
  lessonNumber: number | null;
  invalidatedAt?: string | null;
  plan: TPlan;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCachedPlanEnvelope = <TPlan>(
  value: unknown,
): value is CachedPlanEnvelope<TPlan> =>
  isRecord(value) && "promptVersion" in value && "plan" in value;

export const serializeCachedPlan = <TPlan>(
  plan: TPlan,
  lessonNumber?: number,
) =>
  JSON.stringify({
    promptVersion: STRATEGY_PLAN_CACHE_VERSION,
    lessonNumber: typeof lessonNumber === "number" ? lessonNumber : null,
    plan,
  } satisfies CachedPlanEnvelope<TPlan>);

export const invalidateSerializedCachedPlan = (
  planJson: string,
  invalidatedAt = new Date().toISOString(),
) => {
  const parsed = JSON.parse(planJson) as unknown;

  if (isCachedPlanEnvelope(parsed)) {
    return JSON.stringify({
      ...parsed,
      invalidatedAt,
    } satisfies CachedPlanEnvelope<unknown>);
  }

  return JSON.stringify({
    promptVersion: STRATEGY_PLAN_CACHE_VERSION,
    lessonNumber: null,
    invalidatedAt,
    plan: parsed,
  } satisfies CachedPlanEnvelope<unknown>);
};

export const deserializeCachedPlan = <TPlan>(
  planJson: string,
  options?: {
    lessonNumber?: number;
    requireVersionMatch?: boolean;
  },
): TPlan | null => {
  const parsed = JSON.parse(planJson) as unknown;

  if (isCachedPlanEnvelope<TPlan>(parsed)) {
    const promptVersion =
      typeof parsed.promptVersion === "number" ? parsed.promptVersion : null;
    if (promptVersion !== STRATEGY_PLAN_CACHE_VERSION) {
      return null;
    }

    if (typeof parsed.invalidatedAt === "string" && parsed.invalidatedAt.length > 0) {
      return null;
    }

    if (
      typeof options?.lessonNumber === "number" &&
      parsed.lessonNumber !== options.lessonNumber
    ) {
      return null;
    }

    return parsed.plan as TPlan;
  }

  if (options?.requireVersionMatch) {
    return null;
  }

  return parsed as TPlan;
};
