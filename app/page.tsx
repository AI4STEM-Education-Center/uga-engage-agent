"use client";

import { useEffect, useState } from "react";

import mockStudents from "@/mock-data/students.json";

type Answers = Record<string, string>;

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

type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  strategy: string;
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

const assignmentLabel =
  "Gravity warm-up: explain gravity + describe a real-life gravity experience.";

const questions = [
  {
    id: "conceptUnderstanding",
    label:
      "In your own words, how would you explain gravity right now?",
    type: "textarea",
    placeholder: "Write 2-4 sentences.",
  },
  {
    id: "pastExperiences",
    label:
      "Describe a past experience where you noticed gravity in real life.",
    type: "textarea",
    placeholder: "Example: dropping a ball, jumping, riding a swing.",
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
  const [plan, setPlan] = useState<Plan | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [images, setImages] = useState<Record<string, ImageState>>({});
  const [focusImage, setFocusImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [classId] = useState("physics-1a");
  const [sessionId] = useState("week-03");
  const [annotationDecision, setAnnotationDecision] = useState<
    "agree" | "disagree" | null
  >(null);
  const [annotationReason, setAnnotationReason] = useState("");
  const [annotationStatus, setAnnotationStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [mockIndex, setMockIndex] = useState(0);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
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
  const getStrategyLabel = (strategyId: string) =>
    strategies.find((strategy) => strategy.id === strategyId)?.label ??
    strategyId;
  const stepLabels = [
    "Student questionnaire",
    "Strategy recommendation",
    "Content generation",
  ];

  const requestPlan = async () => {
    setLoadingPlan(true);
    setError(null);
    setPlan(null);
    try {
      const response = await fetch("/api/engagement-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: currentMock?.answers ?? {},
          studentName: currentMock?.name ?? null,
          studentId: currentMock?.id ?? null,
          assignment: assignmentLabel,
          classId: classId.trim(),
          sessionId: sessionId.trim(),
          cohortDistribution,
          cohortStudents: mockStudentList.map((student) => ({
            ...student,
            assignment: assignmentLabel,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create engagement plan.");
      }
      if (data.cached) {
        console.info("Plan loaded from cache — no OpenAI call needed.");
      }
      setPlan(data.plan);
      setSelectedStrategies([data.plan.strategy]);
      setAnnotationDecision(null);
      setAnnotationReason("");
      setAnnotationStatus("idle");
      setAnnotationError(null);
      setContent([]);
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoadingPlan(false);
    }
  };

  const requestContent = async () => {
    if (!plan || selectedStrategies.length === 0) {
      return;
    }
    setLoadingContent(true);
    setError(null);
    setContent([]);
    try {
      const response = await fetch("/api/engagement-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: currentMock?.answers ?? {}, plan, selectedStrategies }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to generate engagement content.");
      }
      const items = (data.items ?? []).map(
        (item: Omit<ContentItem, "id">, index: number) => ({
          ...item,
          id: `${item.strategy ?? "strategy"}-${index}-${item.title}`,
        }),
      );
      setContent(items);
      setImages({});
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoadingContent(false);
    }
  };

  const requestCohortAnalysis = async () => {
    if (!classId.trim() || !sessionId.trim()) {
      setError("Class ID and session ID are required for cohort analysis.");
      return;
    }
    setLoadingCohort(true);
    setError(null);
    setCohortResults([]);
    setCohortDistribution({});
    setCohortProgress({
      processed: 0,
      total: mockStudentList.length,
      currentName: "Loading cache...",
    });
    try {
      /* ---- 1. Fetch all cached plans for this session in one call ---- */
      const cacheUrl = `/api/strategy-cache?classId=${encodeURIComponent(classId.trim())}&sessionId=${encodeURIComponent(sessionId.trim())}`;
      const cacheResponse = await fetch(cacheUrl);
      let cacheData: { results?: Array<{ studentId?: string; plan?: unknown }>; error?: string } = { results: [] };
      if (cacheResponse.ok) {
        cacheData = await cacheResponse.json();
      } else {
        const errBody = await cacheResponse.json().catch(() => ({}));
        console.warn("Strategy cache fetch failed:", cacheResponse.status, errBody?.error ?? cacheResponse.statusText);
      }
      const cachedMap = new Map<string, Plan>();
      for (const entry of cacheData.results ?? []) {
        if (entry.studentId && entry.plan) {
          cachedMap.set(entry.studentId, entry.plan as Plan);
        }
      }
      const cachedCount = cachedMap.size;

      /* ---- 2. Fast path: all cached — build results in one shot, no loop ---- */
      if (cachedCount === mockStudentList.length) {
        const results: StudentStrategyResult[] = mockStudentList.map((s) => ({
          id: s.id,
          name: s.name,
          plan: cachedMap.get(s.id)!,
        }));
        const distribution: Record<string, number> = {};
        results.forEach((r) => {
          const key = r.plan.strategy;
          distribution[key] = (distribution[key] ?? 0) + 1;
        });
        setCohortResults(results);
        setCohortDistribution(distribution);
        setCohortProgress({
          processed: mockStudentList.length,
          total: mockStudentList.length,
          currentName: "",
        });
        console.info(`Cohort: all ${cachedCount} students loaded from cache.`);
        return;
      }

      if (cachedCount > 0) {
        console.info(
          `Cohort: ${cachedCount} from cache, ${mockStudentList.length - cachedCount} need generation.`,
        );
      } else {
        console.warn(
          `Cohort: cache empty for classId=${classId} sessionId=${sessionId}. Generating all ${mockStudentList.length} students.`,
        );
      }

      /* ---- 3. Mixed or empty cache — loop, generate only for misses ---- */
      const results: StudentStrategyResult[] = [];
      const generatingLabel =
        cachedCount === 0 ? "No cache, generating" : "Generating";
      for (let index = 0; index < mockStudentList.length; index += 1) {
        const student = mockStudentList[index];
        const cachedPlan = cachedMap.get(student.id);

        if (cachedPlan) {
          results.push({ id: student.id, name: student.name, plan: cachedPlan });
          setCohortProgress({
            processed: index + 1,
            total: mockStudentList.length,
            currentName: `Loaded ${student.name} (from cache)`,
          });
          setCohortResults([...results]);
          continue;
        }

        setCohortProgress({
          processed: index,
          total: mockStudentList.length,
          currentName: `${generatingLabel} ${student.name}...`,
        });
        const response = await fetch("/api/strategy-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student: { ...student, assignment: assignmentLabel },
            classId: classId.trim(),
            sessionId: sessionId.trim(),
          }),
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

  const toggleStrategySelection = (strategyId: string) => {
    setSelectedStrategies((prev) => {
      if (prev.includes(strategyId)) {
        return prev.filter((item) => item !== strategyId);
      }
      return [...prev, strategyId];
    });
  };

  const submitAnnotation = async () => {
    if (!plan) {
      return;
    }
    if (!annotationDecision) {
      setAnnotationError("Please choose agree or disagree.");
      setAnnotationStatus("error");
      return;
    }
    if (annotationDecision === "disagree" && !annotationReason.trim()) {
      setAnnotationError("Please add the reason you disagree.");
      setAnnotationStatus("error");
      return;
    }

    setAnnotationStatus("saving");
    setAnnotationError(null);
    try {
      const response = await fetch("/api/teacher-annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: currentMock?.name ?? null,
          assignment: assignmentLabel,
          overallRecommendation: plan.overallRecommendation,
          recommendationReason: plan.recommendationReason,
          decision: annotationDecision,
          reason: annotationReason.trim() || null,
          aiPlan: plan,
          selectedStrategies,
          answers: currentMock?.answers ?? {},
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save annotation.");
      }
      setAnnotationStatus("saved");
    } catch (err) {
      setAnnotationError(
        err instanceof Error ? err.message : "Failed to save annotation.",
      );
      setAnnotationStatus("error");
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
        body: JSON.stringify({ item, plan, answers: currentMock?.answers ?? {} }),
      })
        .then(async (response) => {
          const text = await response.text();
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(
              response.ok
                ? "Image response was empty (possible timeout)."
                : `Image request failed (${response.status}).`,
            );
          }
          if (!response.ok) {
            throw new Error((data?.error as string) ?? "Failed to generate image.");
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
  }, [currentMock?.answers, content, images, plan]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Engage Agent
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                process.env.NODE_ENV === "production"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {process.env.NODE_ENV === "production" ? "Production" : "Development"}
            </span>
          </div>
          {/* EngageAgent alignment card hidden
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
          */}
          {/* Progress bar removed — mock student answers are pre-filled */}
          <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Class context
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-400">Class ID</p>
                <p className="text-sm font-semibold text-slate-800">
                  {classId}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-400">
                  Session ID
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {sessionId}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Locked for this walkthrough.
            </p>
          </div>
        </header>

        <section className="grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Workflow steps
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Step-by-step flow
                </h2>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {stepLabels.map((label, index) => {
                  const stepNumber = index + 1;
                  const isActive = currentStep === stepNumber;
                  const isComplete = currentStep > stepNumber;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setCurrentStep(stepNumber)}
                      className={`flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                          isActive
                            ? "bg-white text-slate-900"
                            : isComplete
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {stepNumber}
                      </span>
                      <span className="font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {currentStep === 1 && (
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
              <div className="grid gap-5">
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
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
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
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {questions
                      .filter((question) => {
                        const value =
                          currentMock?.answers?.[question.id]?.trim();
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
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-300"
                >
                  Previous step
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  Next step
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
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
                          {cohortProgress.currentName || "Loading..."}
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
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
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
                                  TLDR: {result.plan.tldr}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Reason: {result.plan.recommendationReason}
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
                    <div className="grid gap-2">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Overall recommendation
                      </p>
                      <p className="text-sm text-slate-700">
                        {plan.overallRecommendation}
                      </p>
                      <p className="text-sm text-slate-600">
                        Reason: {plan.recommendationReason}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        TLDR: {plan.tldr}
                      </p>
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
                          const isRecommended = plan.strategy === strategy.id;
                          const isSelected = selectedStrategies.includes(
                            strategy.id,
                          );
                          return (
                            <div
                              key={strategy.id}
                              className={`rounded-2xl border border-slate-200 bg-white p-3 ${
                                isRecommended
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
                              <div className="mt-3 flex items-center justify-between">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    isRecommended
                                      ? "bg-slate-900 text-white"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {isRecommended
                                    ? "Recommended"
                                    : "Alternate"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleStrategySelection(strategy.id)
                                  }
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    isSelected
                                      ? "bg-slate-900 text-white"
                                      : "border border-slate-200 text-slate-600"
                                  }`}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </button>
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
                    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Teacher annotation
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          Required to log
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        Do you accept the recommended strategy:{" "}
                        <span className="font-semibold text-slate-900">
                          {getStrategyLabel(plan.strategy)}
                        </span>
                        ?
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAnnotationDecision("agree")}
                          className={`rounded-full px-4 py-2 text-xs font-semibold ${
                            annotationDecision === "agree"
                              ? "bg-emerald-600 text-white"
                              : "border border-slate-200 text-slate-600"
                          }`}
                        >
                          Accept recommendation
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnotationDecision("disagree")}
                          className={`rounded-full px-4 py-2 text-xs font-semibold ${
                            annotationDecision === "disagree"
                              ? "bg-rose-600 text-white"
                              : "border border-slate-200 text-slate-600"
                          }`}
                        >
                          Disagree
                        </button>
                      </div>
                      {annotationDecision === "disagree" && (
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Which strategies do you think should be used and why?
                          <p className="text-[11px] font-normal text-slate-400">
                            You can select different strategies above, then
                            explain your reasoning below.
                          </p>
                          <textarea
                            className="min-h-[96px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                            value={annotationReason}
                            onChange={(event) =>
                              setAnnotationReason(event.target.value)
                            }
                            placeholder="e.g. Experience bridging and analogy — the student has strong real-world examples that could be leveraged."
                            required
                          />
                        </label>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={submitAnnotation}
                          disabled={annotationStatus === "saving"}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {annotationStatus === "saving"
                            ? "Saving..."
                            : "Save annotation"}
                        </button>
                        {annotationStatus === "saved" && (
                          <span className="text-xs font-semibold text-emerald-600">
                            Annotation saved.
                          </span>
                        )}
                        {annotationStatus === "error" && annotationError && (
                          <span className="text-xs font-semibold text-rose-600">
                            {annotationError}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  Previous step
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  Next step
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Step 3
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Engagement content generation
                </h2>
                <p className="text-sm text-slate-600">
                  Generate content aligned to the selected strategies and
                  student profile. Use this to engage the learner in-session.
                </p>
                <p className="text-xs text-slate-500">
                  Selected strategies:{" "}
                  {selectedStrategies.length
                    ? selectedStrategies.map(getStrategyLabel).join(", ")
                    : "None"}
                </p>
                <button
                  type="button"
                  onClick={requestContent}
                  disabled={!plan || loadingContent || !selectedStrategies.length}
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
                {(!plan || !selectedStrategies.length) && (
                  <p className="text-xs text-slate-400">
                    Create a plan and select at least one strategy.
                  </p>
                )}
                {content.length > 0 && !loadingContent && (
                  <div className="mt-4 grid gap-4">
                    {content.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 sm:flex-row sm:items-stretch"
                      >
                        <div className="shrink-0">
                          {images[item.id]?.status === "loading" && (
                            <div className="flex aspect-square w-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 sm:w-44">
                              <p className="text-xs text-slate-400">
                                Generating...
                              </p>
                            </div>
                          )}
                          {images[item.id]?.status === "error" && (
                            <div className="flex aspect-square w-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 sm:w-44">
                              <p className="text-xs text-rose-500">
                                {images[item.id]?.error}
                              </p>
                            </div>
                          )}
                          {images[item.id]?.status === "ready" &&
                            images[item.id]?.url && (
                              <button
                                type="button"
                                className="block aspect-square w-40 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 sm:w-44"
                                onClick={() =>
                                  setFocusImage({
                                    url: images[item.id]?.url ?? "",
                                    title: item.title,
                                  })
                                }
                              >
                                <img
                                  className="h-full w-full object-cover"
                                  src={images[item.id]?.url}
                                  alt={`Illustration for ${item.title}`}
                                />
                              </button>
                            )}
                          {!images[item.id]?.status && (
                            <div className="aspect-square w-40 rounded-xl border border-slate-200 bg-slate-100 sm:w-44" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase text-slate-400">
                            Strategy: {getStrategyLabel(item.strategy)}
                          </p>
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            {item.type}
                          </p>
                          <p className="text-base font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    Previous step
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-300"
                  >
                    Next step
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
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
