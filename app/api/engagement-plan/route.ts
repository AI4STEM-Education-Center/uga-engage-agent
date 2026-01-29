import OpenAI from "openai";
import { NextResponse } from "next/server";

type Answers = Record<string, string | undefined>;

const buildPrompt = (
  answers: Answers,
  cohortDistribution?: Record<string, number>,
  cohortStudents?: Array<{ id: string; name: string; answers: Answers }>,
) => ({
  system: `You are an education engagement planner.
The plan will be used by teachers to engage students at the beginning of class.
Return JSON only with keys: name, strategy, relevance, summary, rationale, tactics, cadence, checks.
The strategy must be exactly one of: cognitive conflict, analogy, experience bridging, engaged critiquing.
The relevance field is an object with those four strategies as keys and integer scores from 0-100.
Keep it concise and aligned to the student profile.`,
  user: `Questionnaire answers:
${JSON.stringify(answers, null, 2)}

${cohortDistribution ? `Cohort strategy distribution:\n${JSON.stringify(cohortDistribution, null, 2)}\n\n` : ""}${cohortStudents ? `Cohort student answers:\n${JSON.stringify(cohortStudents, null, 2)}\n\n` : ""}Return a plan:
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
  return JSON.parse(value) as {
    name: string;
    strategy: string;
    relevance: Record<string, number>;
    summary: string;
    rationale: string;
    tactics: string[];
    cadence: string;
    checks: string[];
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
    const { answers = {}, cohortDistribution, cohortStudents } =
      (await request.json()) as {
        answers?: Answers;
        cohortDistribution?: Record<string, number>;
        cohortStudents?: Array<{ id: string; name: string; answers: Answers }>;
      };
    const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
    const prompt = buildPrompt(answers, cohortDistribution, cohortStudents);

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    });

    const plan = parseJson(completion.choices[0]?.message?.content);
    return NextResponse.json({ plan });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create plan.";
    console.error("engagement-plan error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
