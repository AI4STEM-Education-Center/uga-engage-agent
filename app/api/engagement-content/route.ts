import OpenAI from "openai";
import { NextResponse } from "next/server";

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

const buildPrompt = (answers: Answers, plan: Plan, strategy: string) => ({
  system: `You are an education engagement content designer.
Return JSON only with key: items (array). Each item has type, title, body.`,
  user: `Student profile:
${JSON.stringify(answers, null, 2)}

Engagement plan:
${JSON.stringify(plan, null, 2)}

Generate 3 content items:
- Warm-up (short hook)
- Mini lesson (core idea)
- Practice (quick application)
Align the content to the strategy: ${strategy}.
Keep each body 1-3 sentences.`,
});

const parseJson = (value: string | null | undefined) => {
  if (!value) {
    throw new Error("LLM returned empty response.");
  }
  return JSON.parse(value) as {
    items: Array<{ type: string; title: string; body: string }>;
  };
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { answers = {}, plan, selectedStrategies = [] } =
      (await request.json()) as {
      answers?: Answers;
      plan: Plan;
      selectedStrategies?: string[];
    };
    const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
    const strategies =
      selectedStrategies.length > 0 ? selectedStrategies : [plan.strategy];
    const items: Array<{
      type: string;
      title: string;
      body: string;
      strategy: string;
    }> = [];

    for (const strategy of strategies) {
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
      const taggedItems = (data.items ?? []).map((item) => ({
        ...item,
        strategy,
      }));
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
