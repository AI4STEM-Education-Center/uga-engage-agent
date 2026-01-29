"use client";

import { useEffect, useMemo, useState } from "react";

import mockStudents from "@/mock-data/students.json";

type Answers = Record<string, string>;

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

type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string;
};

type ImageState = {
  status: "idle" | "loading" | "ready" | "error";
  url?: string;
  error?: string;
};

type MockStudent = {
  id: string;
  name: string;
  answers: Answers;
};

type StudentStrategyResult = {
  id: string;
  name: string;
  plan: Plan;
};

const questions = [
  {
    id: "gravityDefinition",
    label:
      "In your own words, what is gravity? Describe it as if you were teaching a friend.",
    type: "textarea",
    placeholder: "Write 2-4 sentences.",
  },
  {
    id: "everydayExample",
    label:
      "Think about a time you noticed gravity in real life. What happened?",
    type: "textarea",
    placeholder: "Example: dropping a ball, jumping, riding a swing.",
  },
  {
    id: "fallingObjects",
    label:
      "If you drop a heavy book and a light notebook at the same time, what do you think will happen? Why?",
    type: "textarea",
    placeholder: "Explain your reasoning.",
  },
  {
    id: "directionOfGravity",
    label:
      "Which direction does gravity pull objects, and how do you know?",
    type: "text",
    placeholder: "One or two sentences.",
  },
  {
    id: "massVsWeight",
    label:
      "What do you think is the difference between mass and weight?",
    type: "textarea",
    placeholder: "Use your own words.",
  },
  {
    id: "spaceQuestion",
    label:
      "What do you think happens to gravity on the Moon or in space? Why?",
    type: "textarea",
    placeholder: "Share what you believe and why.",
  },
  {
    id: "confidence",
    label:
      "How confident do you feel about understanding gravity right now?",
    type: "select",
    options: ["Not confident", "A little confident", "Very confident"],
  },
  {
    id: "confusion",
    label:
      "Is there anything about gravity that feels confusing or surprising? (optional)",
    type: "textarea",
    placeholder: "It is okay to say 'not sure' or leave blank.",
    optional: true,
  },
];

const featureCatalog = [
  {
    code: "F1",
    name: "Conceptual Accuracy",
    values: "Correct / Incorrect",
    derived: "MCQ correctness + explanation alignment",
  },
  {
    code: "F2",
    name: "Misconception Identified",
    values: "Yes / No",
    derived: "Distractor mapping + explanation keywords",
  },
  {
    code: "F3",
    name: "Misconception Strength",
    values: "Weak / Strong",
    derived: "Confidence × consistency of misconception",
  },
  {
    code: "F4",
    name: "Reasoning Level",
    values: "Recall / Descriptive / Relational / Mechanistic",
    derived: "NLP classification of explanation",
  },
  {
    code: "F5",
    name: "Everyday Experience Available",
    values: "High / Low",
    derived: "Item tag + explanation references",
  },
  {
    code: "F6",
    name: "Knowledge Coherence",
    values: "Integrated / Fragmented",
    derived: "Cross-item consistency",
  },
  {
    code: "F7",
    name: "Abstractness",
    values: "High / Low",
    derived: "Lessons or curriculum mapping",
  },
];

const strategies = [
  {
    id: "cognitive conflict",
    label: "Cognitive Conflict",
    color: "bg-violet-500",
    ring: "ring-violet-400",
  },
  {
    id: "analogy",
    label: "Analogy",
    color: "bg-sky-500",
    ring: "ring-sky-400",
  },
  {
    id: "experience bridging",
    label: "Experience Bridging",
    color: "bg-emerald-500",
    ring: "ring-emerald-400",
  },
  {
    id: "engaged critiquing",
    label: "Engaged Critiquing",
    color: "bg-amber-500",
    ring: "ring-amber-400",
  },
];

export default function Home() {
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [images, setImages] = useState<Record<string, ImageState>>({});
  const [focusImage, setFocusImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [mockIndex, setMockIndex] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cohortResults, setCohortResults] = useState<StudentStrategyResult[]>(
    [],
  );
  const [cohortDistribution, setCohortDistribution] = useState<
    Record<string, number>
  >({});
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [cohortProgress, setCohortProgress] = useState<{
    processed: number;
    total: number;
    currentName: string;
  }>({ processed: 0, total: 0, currentName: "" });
  const [showStudentRecommendations, setShowStudentRecommendations] =
    useState(false);

  const mockStudentList = mockStudents as MockStudent[];
  const currentMock = mockStudentList[mockIndex];

  const completion = useMemo(() => {
    const requiredIds = questions
      .filter((question) => !question.optional)
      .map((question) => question.id);
    const answered = requiredIds.filter((id) => answers[id]?.trim()).length;
    return Math.round((answered / requiredIds.length) * 100);
  }, [answers]);

  const handleChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  const requestPlan = async () => {
    setLoadingPlan(true);
    setError(null);
    setPlan(null);
    try {
      const response = await fetch("/api/engagement-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          cohortDistribution,
          cohortStudents: mockStudentList,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create engagement plan.");
      }
      setPlan(data.plan);
      setContent([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoadingPlan(false);
    }
  };

  const requestContent = async () => {
    if (!plan) {
      return;
    }
    setLoadingContent(true);
    setError(null);
    setContent([]);
    try {
      const response = await fetch("/api/engagement-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, plan }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to generate engagement content.");
      }
      const items = (data.items ?? []).map(
        (item: Omit<ContentItem, "id">, index: number) => ({
          ...item,
          id: `${index}-${item.title}`,
        }),
      );
      setContent(items);
      setImages({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoadingContent(false);
    }
  };

  const requestCohortAnalysis = async () => {
    setLoadingCohort(true);
    setError(null);
    setCohortResults([]);
    setCohortDistribution({});
    setCohortProgress({
      processed: 0,
      total: mockStudentList.length,
      currentName: "",
    });
    try {
      const results: StudentStrategyResult[] = [];
      for (let index = 0; index < mockStudentList.length; index += 1) {
        const student = mockStudentList[index];
        setCohortProgress({
          processed: index,
          total: mockStudentList.length,
          currentName: student.name,
        });
        const response = await fetch("/api/strategy-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error ?? `Failed to analyze ${student.name}.`,
          );
        }
        results.push({ id: student.id, name: student.name, plan: data.plan });
        setCohortResults([...results]);
      }

      const distribution: Record<string, number> = {};
      results.forEach((result) => {
        const key = result.plan.strategy;
        distribution[key] = (distribution[key] ?? 0) + 1;
      });
      setCohortDistribution(distribution);
      setCohortProgress({
        processed: mockStudentList.length,
        total: mockStudentList.length,
        currentName: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoadingCohort(false);
    }
  };

  useEffect(() => {
    if (!content.length) {
      return;
    }

    content.forEach((item) => {
      if (images[item.id]?.status) {
        return;
      }

      setImages((prev) => ({
        ...prev,
        [item.id]: { status: "loading" },
      }));

      fetch("/api/engagement-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, plan, answers }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error ?? "Failed to generate image.");
          }
          return data;
        })
        .then((data) => {
          setImages((prev) => ({
            ...prev,
            [item.id]: { status: "ready", url: data.url },
          }));
        })
        .catch((err) => {
          setImages((prev) => ({
            ...prev,
            [item.id]: {
              status: "error",
              error: err instanceof Error ? err.message : "Image failed.",
            },
          }));
        });
    });
  }, [answers, content, images, plan]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
        <header className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Engage Agent Prototype
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-900">
            Step-by-step engagement workflow
          </h1>
          <p className="max-w-3xl text-lg text-slate-600">
            Collect a student questionnaire, select an engagement plan with a
            backend API, then generate content aligned to the plan.
          </p>
          <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              EngageAgent alignment
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              Asking Questions and Defining Problems
            </p>
            <p className="mt-2">
              A practice of science is to ask and refine questions that lead to
              descriptions and explanations of how the natural and designed
              world works and which can be empirically tested.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-56 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-sm text-slate-600">
              {completion}% questionnaire complete
            </span>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Step 1
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Student questionnaire
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Required
              </span>
            </div>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Mock student responses
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {currentMock?.name ?? "Student"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMockIndex((prev) => Math.max(0, prev - 1))
                      }
                      disabled={mockIndex === 0}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMockIndex((prev) =>
                          Math.min(mockStudentList.length - 1, prev + 1),
                        )
                      }
                      disabled={mockIndex >= mockStudentList.length - 1}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3">
                  {questions
                    .filter((question) => {
                      const value = currentMock?.answers?.[question.id]?.trim();
                      return Boolean(value);
                    })
                    .map((question) => (
                      <div key={question.id} className="grid gap-1">
                        <p className="text-xs font-semibold text-slate-500">
                          {question.label}
                        </p>
                        <p className="text-sm text-slate-700">
                          {currentMock?.answers?.[question.id]}
                        </p>
                      </div>
                    ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {mockIndex + 1} of {mockStudentList.length}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Live questionnaire
                </p>
                <button
                  type="button"
                  onClick={() => setShowQuestionnaire((prev) => !prev)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {showQuestionnaire ? "Hide form" : "Enter new responses"}
                </button>
              </div>
              {showQuestionnaire && (
                <>
                  {questions.map((question) => (
                    <label key={question.id} className="grid gap-2 text-sm">
                      <span className="font-medium text-slate-700">
                        {question.label}
                      </span>
                      {question.type === "select" ? (
                        <select
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                          value={answers[question.id] ?? ""}
                          onChange={(event) =>
                            handleChange(question.id, event.target.value)
                          }
                          required={!question.optional}
                        >
                          <option value="" disabled>
                            Select an option
                          </option>
                          {question.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : question.type === "textarea" ? (
                        <textarea
                          className="min-h-[120px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                          placeholder={question.placeholder}
                          value={answers[question.id] ?? ""}
                          onChange={(event) =>
                            handleChange(question.id, event.target.value)
                          }
                          required={!question.optional}
                        />
                      ) : (
                        <input
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                          placeholder={question.placeholder}
                          value={answers[question.id] ?? ""}
                          onChange={(event) =>
                            handleChange(question.id, event.target.value)
                          }
                          required={!question.optional}
                        />
                      )}
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={submitted}
                    className="mt-2 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {submitted ? "Saved" : "Save questionnaire"}
                  </button>
                </>
              )}
            </form>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Step 2
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Engagement strategy recommendation
                </h2>
                <p className="text-sm text-slate-600">
                  Based on the student’s responses, you’ll get a recommended
                  engagement strategy with a short teaching plan and rationale.
                </p>
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Cohort analysis
                    </p>
                    <p className="text-sm text-slate-600">
                      Analyze the full mock cohort one by one and view the
                      strategy distribution.
                    </p>
                    <button
                      type="button"
                      onClick={requestCohortAnalysis}
                      disabled={loadingCohort}
                      className="mt-2 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {loadingCohort
                        ? "Analyzing cohort..."
                        : "Analyze 20 students"}
                    </button>
                    {loadingCohort && (
                      <div className="mt-3 grid gap-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                          Analyzing {cohortProgress.currentName || "student"}...
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-slate-700 transition-all"
                            style={{
                              width: `${Math.round(
                                (cohortProgress.processed /
                                  Math.max(1, cohortProgress.total)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          {Math.round(
                            (cohortProgress.processed /
                              Math.max(1, cohortProgress.total)) *
                              100,
                          )}
                          % complete ·{" "}
                          {Math.max(
                            0,
                            cohortProgress.total - cohortProgress.processed,
                          )}{" "}
                          remaining
                        </p>
                      </div>
                    )}
                  </div>
                  {cohortResults.length > 0 && !loadingCohort && (
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Strategy distribution
                        </p>
                        {strategies.map((strategy) => {
                          const count =
                            cohortDistribution[strategy.id] ?? 0;
                          const percent = Math.round(
                            (count / cohortResults.length) * 100,
                          );
                          return (
                            <div
                              key={strategy.id}
                              className="rounded-2xl border border-slate-200 bg-white p-3"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-slate-800">
                                  {strategy.label}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {count} students · {percent}%
                                </span>
                              </div>
                              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full ${strategy.color}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Student recommendations
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setShowStudentRecommendations((prev) => !prev)
                            }
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            {showStudentRecommendations
                              ? "Hide"
                              : "Show all"}
                          </button>
                        </div>
                        {showStudentRecommendations && (
                          <div className="grid gap-2">
                            {cohortResults.map((result) => (
                              <div
                                key={result.id}
                                className="rounded-2xl border border-slate-200 bg-white p-3"
                              >
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-semibold text-slate-800">
                                    {result.name}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                    {result.plan.strategy}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">
                                  {result.plan.summary}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {result.plan.rationale}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={requestPlan}
                  disabled={loadingPlan}
                  className="mt-2 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loadingPlan ? "Creating plan..." : "Create engagement plan"}
                </button>
                {loadingPlan && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    Generating plan...
                  </div>
                )}
                {!submitted && (
                  <p className="text-xs text-slate-400">
                    You can create a plan from the live questionnaire or review
                    cohort results above.
                  </p>
                )}
                {plan && !loadingPlan && (
                  <div className="mt-4 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Plan
                      </p>
                      <p className="text-base font-semibold text-slate-900">
                        {plan.name}
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        Strategy: {plan.strategy}
                      </p>
                      <p className="text-sm text-slate-600">{plan.summary}</p>
                    </div>
                    <div className="grid gap-3">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Strategy relevance
                      </p>
                      <div className="grid gap-3">
                        {strategies.map((strategy) => {
                          const score = Math.min(
                            100,
                            Math.max(
                              0,
                              plan.relevance?.[strategy.id] ?? 0,
                            ),
                          );
                          const isSelected = plan.strategy === strategy.id;
                          return (
                            <div
                              key={strategy.id}
                              className={`rounded-2xl border border-slate-200 bg-white p-3 ${
                                isSelected
                                  ? `ring-2 ${strategy.ring}`
                                  : "ring-1 ring-transparent"
                              }`}
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-slate-800">
                                  {strategy.label}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {score}%
                                </span>
                              </div>
                              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full ${strategy.color}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                              <div className="mt-2 flex justify-end">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    isSelected
                                      ? "bg-slate-900 text-white"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {isSelected ? "Selected" : "Not selected"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Rationale
                      </p>
                      <p>{plan.rationale}</p>
                    </div>
                    <div className="grid gap-2">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Tactics
                      </p>
                      <ul className="list-disc pl-5 text-sm text-slate-600">
                        {plan.tactics.map((tactic) => (
                          <li key={tactic}>{tactic}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-1 text-xs text-slate-500">
                      <span>Cadence: {plan.cadence}</span>
                      <span>Checks: {plan.checks.join(", ")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Step 3
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Engagement content generation
                </h2>
                <p className="text-sm text-slate-600">
                  Generate content aligned to the selected plan and student
                  profile. Use this to engage the learner in-session.
                </p>
                <button
                  type="button"
                  onClick={requestContent}
                  disabled={!plan || loadingContent}
                  className="mt-2 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {loadingContent ? "Generating..." : "Generate content"}
                </button>
                {loadingContent && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    Generating content...
                  </div>
                )}
                {!plan && (
                  <p className="text-xs text-slate-400">
                    Create a plan before generating content.
                  </p>
                )}
                {content.length > 0 && !loadingContent && (
                  <div className="mt-4 grid gap-3">
                    {content.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"
                      >
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          {item.type}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="text-sm text-slate-600">{item.body}</p>
                        <div className="mt-3">
                          {images[item.id]?.status === "loading" && (
                            <p className="text-xs text-slate-400">
                              Generating illustration...
                            </p>
                          )}
                          {images[item.id]?.status === "error" && (
                            <p className="text-xs text-rose-500">
                              {images[item.id]?.error}
                            </p>
                          )}
                          {images[item.id]?.status === "ready" &&
                            images[item.id]?.url && (
                              <button
                                type="button"
                                className="mt-2 w-full cursor-zoom-in rounded-xl border border-slate-200 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                                onClick={() =>
                                  setFocusImage({
                                    url: images[item.id]?.url ?? "",
                                    title: item.title,
                                  })
                                }
                              >
                                <img
                                  className="h-auto w-full rounded-lg object-contain"
                                  src={images[item.id]?.url}
                                  alt={`Illustration for ${item.title}`}
                                />
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Feature catalog
              </p>
              <h2 className="text-2xl font-semibold text-slate-900">
                Engagement features and variables
              </h2>
              <p className="text-sm text-slate-600">
                Use these features to label student responses, inform routing,
                and refine the engagement plan selection.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Feature name</th>
                    <th className="px-4 py-3 font-semibold">Values</th>
                    <th className="px-4 py-3 font-semibold">How it is derived</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {featureCatalog.map((feature) => (
                    <tr key={feature.code}>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {feature.code}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {feature.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {feature.values}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {feature.derived}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {focusImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Illustration focus view"
            onClick={() => setFocusImage(null)}
          >
            <div
              className="relative w-full max-w-4xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow"
                onClick={() => setFocusImage(null)}
              >
                Close
              </button>
              <img
                className="max-h-[80vh] w-full rounded-2xl bg-white object-contain shadow-2xl"
                src={focusImage.url}
                alt={`Focused illustration for ${focusImage.title}`}
              />
              <p className="mt-3 text-center text-sm text-slate-100">
                {focusImage.title}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
