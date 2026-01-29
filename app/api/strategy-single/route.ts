import OpenAI from "openai";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/sqlite";

type Answers = Record<string, string | undefined>;

type Student = {
  id: string;
  name: string;
  answers: Answers;
};

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

export const runtime = "nodejs";

const buildPrompt = (answers: Answers) => ({
  system: `You are an education engagement planner.
Return JSON only with keys: name, strategy, relevance, summary, rationale, tactics, cadence, checks.
The strategy must be exactly one of: cognitive conflict, analogy, experience bridging, engaged critiquing.
The relevance field is an object with those four strategies as keys and integer scores from 0-100.`,
  user: `Questionnaire answers:
${JSON.stringify(answers, null, 2)}

Return a plan:
- name: short label
- strategy: one of [cognitive conflict, analogy, experience bridging, engaged critiquing]
- relevance: scores 0-100 for each strategy
- summary: 1 sentence
- rationale: 1-2 sentences
- tactics: 3-5 bullets
- cadence: short phrase
- checks: 1-3 quick checks`,
});

const parseJson = (value: string | null | undefined) => {
  if (!value) {
    throw new Error("LLM returned empty response.");
  }
  return JSON.parse(value) as Plan;
};

const normalizeStrategy = (strategy: string) => strategy.trim().toLowerCase();

const ensureRelevance = (plan: Plan) => {
  if (!plan.relevance || typeof plan.relevance !== "object") {
    plan.relevance = {};
  }
  const keys = [
    "cognitive conflict",
    "analogy",
    "experience bridging",
    "engaged critiquing",
  ];
  keys.forEach((key) => {
    if (typeof plan.relevance[key] !== "number") {
      plan.relevance[key] = key === plan.strategy ? 100 : 0;
    }
  });
  return plan;
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
    const { student } = (await request.json()) as { student: Student };
    if (!student?.id) {
      return NextResponse.json(
        { error: "student.id is required." },
        { status: 400 },
      );
    }

    const db = getDb();
    const selectStmt = db.prepare(
      "SELECT plan_json FROM strategy_cache WHERE student_id = ?",
    );
    const upsertStmt = db.prepare(
      `INSERT INTO strategy_cache (student_id, plan_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(student_id) DO UPDATE SET plan_json = excluded.plan_json, updated_at = excluded.updated_at`,
    );

    const cached = selectStmt.get(student.id) as
      | { plan_json: string }
      | undefined;
    if (cached?.plan_json) {
      const plan = ensureRelevance(JSON.parse(cached.plan_json) as Plan);
      return NextResponse.json({ plan });
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
    const prompt = buildPrompt(student.answers);
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    });

    const plan = ensureRelevance(
      parseJson(completion.choices[0]?.message?.content),
    );
    plan.strategy = normalizeStrategy(plan.strategy);

    upsertStmt.run(
      student.id,
      JSON.stringify(plan),
      new Date().toISOString(),
    );

    return NextResponse.json({ plan });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze student.";
    console.error("strategy-single error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
