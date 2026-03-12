import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ContentItem, TextMode } from "@/lib/types";

type Answers = Record<string, string | undefined>;

type Plan = {
  name: string;
  strategy: string;
  relevance: Record<string, number>;
  overallRecommendation: string;
  recommendationReason: string;
  summary: string;
  tldr: string;
  rationale: string;
  tactics: string[];
  cadence: string;
  checks: string[];
};

type GeneratedContentItem = Pick<
  ContentItem,
  "type" | "title" | "body" | "textModes" | "visualBrief"
>;

type GeneratedResponseItem = Omit<ContentItem, "id">;

const ALLOWED_TEXT_MODES = [
  "questions",
  "phenomenon",
  "dialogue",
] as const satisfies readonly TextMode[];

const isTextMode = (value: string): value is TextMode =>
  (ALLOWED_TEXT_MODES as readonly string[]).includes(value);

const normalizeTextModes = (value: unknown): TextMode[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((mode): mode is string => typeof mode === "string")
    .map((mode) => mode.trim().toLowerCase())
    .filter(isTextMode);
};

const buildPrompt = (answers: Answers, plan: Plan, strategy: string) => ({
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
  user: `Student profile:
${JSON.stringify(answers, null, 2)}

Engagement plan:
${JSON.stringify(plan, null, 2)}

Create exactly 1 student-facing content item aligned to the strategy: ${strategy}.
The text can use one or a combination of:
(a) questions,
(b) a short description of a phenomenon, or
(c) a dialogue between two virtual students or between a teacher and a student.

Requirements:
- This will be shared directly with students, so write to students instead of to teachers.
- Avoid phrases such as "ask students", "have students", "teacher note", or lesson-delivery instructions.
- Keep it concrete, vivid, and age-appropriate for middle-school physics learners.
- The image must clearly reflect the scene or interaction described in the text.
- Keep the body concise, around 70-140 words, with line breaks if helpful.
- Do not mention the engagement strategy by name to students.

Return exactly 1 item in items.`,
});

const parseJson = (value: string | null | undefined) => {
  if (!value) {
    throw new Error("LLM returned empty response.");
  }
  return JSON.parse(value) as {
    items: GeneratedContentItem[];
  };
};

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const {
      answers = {},
      plan,
      selectedStrategies = [],
    } = (await request.json()) as {
      answers?: Answers;
      plan: Plan;
      selectedStrategies?: string[];
    };
    const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
    const strategies =
      selectedStrategies.length > 0 ? selectedStrategies : [plan.strategy];
    const items: GeneratedResponseItem[] = [];

    const strategyResults = await Promise.all(
      strategies.map(async (strategy) => {
        const prompt = buildPrompt(answers, plan, strategy);
        const completion = await client.chat.completions.create({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });

        const data = parseJson(completion.choices[0]?.message?.content);
        return (data.items ?? []).slice(0, 1).map((item) => {
          const textModes = normalizeTextModes(item.textModes);
          const title = item.title?.trim() || `${strategy} activity`;
          const body = item.body?.trim();

          if (!body) {
            throw new Error("Generated content body was empty.");
          }

          return {
            type: item.type?.trim() || (textModes.length > 0 ? textModes.join(" + ") : "Student material"),
            title,
            body,
            strategy,
            ...(textModes.length > 0 ? { textModes } : {}),
            ...(item.visualBrief?.trim() ? { visualBrief: item.visualBrief.trim() } : {}),
          } satisfies GeneratedResponseItem;
        });
      }),
    );

    for (const taggedItems of strategyResults) {
      items.push(...taggedItems);
    }

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate content.";
    console.error("engagement-content error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
