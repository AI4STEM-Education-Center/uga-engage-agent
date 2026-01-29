import OpenAI from "openai";
import { NextResponse } from "next/server";

type Answers = Record<string, string | undefined>;

type Plan = {
  name: string;
  strategy: string;
  relevance: Record<string, number>;
  summary: string;
  rationale: string;
  tactics: string[];
  cadence: string;
  checks: string[];
};

const buildPrompt = (answers: Answers, plan: Plan) => ({
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
Align the content to the plan strategy: ${plan.strategy}.
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
  console.info("OPENAI_API_KEY is set:", Boolean(process.env.OPENAI_API_KEY));
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { answers = {}, plan } = (await request.json()) as {
      answers?: Answers;
      plan: Plan;
    };
    const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
    const prompt = buildPrompt(answers, plan);

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    });

    const data = parseJson(completion.choices[0]?.message?.content);
    return NextResponse.json({ items: data.items ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate content.";
    console.error("engagement-content error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
