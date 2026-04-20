/**
 * Shared content generation logic.
 *
 * Extracted from `app/api/engagement-content/route.ts` so it can be reused by
 * standalone scripts (e.g. scripts/test-pipeline.ts) without going through the
 * Next.js API layer. The route uses this module; scripts import from it
 * directly.
 */

import type OpenAI from "openai";

import {
  getLessonGenerationContext,
  getStrategyContext,
  type LessonGenerationContext,
  type StrategyContext,
} from "@/lib/lesson-context";
import type { ContentItem, TextMode } from "@/lib/types";

export type GeneratedContentItem = Pick<
  ContentItem,
  "type" | "title" | "body" | "textModes" | "visualBrief"
>;

export type ResolvedContentItem = Omit<ContentItem, "id">;

const ALLOWED_TEXT_MODES = [
  "questions",
  "phenomenon",
  "dialogue",
] as const satisfies readonly TextMode[];

const isTextMode = (value: string): value is TextMode =>
  (ALLOWED_TEXT_MODES as readonly string[]).includes(value);

export const normalizeTextModes = (value: unknown): TextMode[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((mode): mode is string => typeof mode === "string")
    .map((mode) => mode.trim().toLowerCase())
    .filter(isTextMode);
};

export const buildContentPrompt = (
  lessonContext: LessonGenerationContext,
  strategyContext: StrategyContext,
) => ({
  system: `You are an education content designer creating short, student-facing science materials.
Return JSON only with key: items (array).
Return exactly 1 item in the array.
Each item must include:
- type: a short label such as "Questions", "Phenomenon", "Dialogue", or a short combination label
- title: a concise, student-facing title
- body: the exact text students will read directly
- textModes: an array using only "questions", "phenomenon", and/or "dialogue"
- visualBrief: one short sentence describing what the illustration should show
Do not include teacher directions, facilitation notes, or implementation instructions.`,
  user: `Lesson:
- Title: ${lessonContext.lessonTitle}
- Learning objective: ${lessonContext.learningObjective}

Engagement strategy:
- Name: ${strategyContext.label}
- Description: ${strategyContext.description}

Create exactly 1 student-facing content item aligned to the lesson objective and strategy.
The text can use one or a combination of:
(a) questions,
(b) a short description of a phenomenon, or
(c) a dialogue between two virtual students or between a teacher and a student.

Requirements:
- This will be shared directly with students, so write to students instead of to teachers.
- Make the objective visible in the thinking students are asked to do; do not drift into a generic physics scene.
- Avoid phrases such as "ask students", "have students", "teacher note", or lesson-delivery instructions.
- Keep it concrete, vivid, and age-appropriate for middle-school physics learners.
- The image must clearly reflect the scene or interaction described in the text.
- Keep the body concise, around 70-140 words, with line breaks if helpful.
- Do not mention the engagement strategy by name to students.

Return exactly 1 item in items.`,
});

export const parseContentResponse = (
  value: string | null | undefined,
): { items: GeneratedContentItem[] } => {
  if (!value) {
    throw new Error("LLM returned empty response.");
  }
  return JSON.parse(value) as { items: GeneratedContentItem[] };
};

/**
 * Generate a single ContentItem for (lessonNumber, strategy). Mirrors the
 * per-strategy logic inside `engagement-content/route.ts`. Returns a
 * ResolvedContentItem without an id (id is assigned later by the caller).
 */
export const generateContentItem = async (
  client: OpenAI,
  lessonNumber: number,
  strategy: string,
): Promise<ResolvedContentItem> => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) {
    throw new Error(`Lesson ${lessonNumber} not found.`);
  }
  const strategyContext = getStrategyContext(strategy);
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
  const prompt = buildContentPrompt(lessonContext, strategyContext);

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  });

  const data = parseContentResponse(completion.choices[0]?.message?.content);
  const first = data.items?.[0];
  if (!first) {
    throw new Error("LLM returned no content items.");
  }

  const textModes = normalizeTextModes(first.textModes);
  const title = first.title?.trim() || `${strategy} activity`;
  const body = first.body?.trim();
  if (!body) {
    throw new Error("Generated content body was empty.");
  }

  return {
    type:
      first.type?.trim() ||
      (textModes.length > 0 ? textModes.join(" + ") : "Student material"),
    title,
    body,
    strategy,
    ...(textModes.length > 0 ? { textModes } : {}),
    ...(first.visualBrief?.trim()
      ? { visualBrief: first.visualBrief.trim() }
      : {}),
  };
};
