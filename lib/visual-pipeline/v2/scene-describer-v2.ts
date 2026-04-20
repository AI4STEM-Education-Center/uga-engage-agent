/**
 * Stage 1 — Scene Description (v2, domain-semantic).
 *
 * The LLM picks an archetype (collision / free-body / generic-scene) and
 * fills in physics objects (bodies, forces, annotations). Output is
 * strictly validated by Zod.
 *
 * Slides anchor: slide 3's collision JSON is the reference shape for how
 * a two-body collision should be described.
 */

import type OpenAI from "openai";

import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";
import type { ResolvedContentItem } from "@/lib/content-generator";

import { SceneDescriptionV2 } from "./schema";

const SYSTEM_PROMPT = `You are a physics diagram planner for middle-school (8th grade) science materials.

Your job: given a student-facing lesson content item, describe the scene as a DOMAIN-SEMANTIC JSON object (not as shapes). A downstream deterministic layout engine + symbol library renders the diagram from this JSON — you do NOT specify pixel coordinates, shapes, or sizes.

STEP 1 — Pick ONE archetype that fits the scene:

  "collision"     Two bodies interacting at a contact (head-on or rear-end).
                  Use for anything about action-reaction force pairs,
                  Newton's Third Law, impact, momentum transfer.
  "free-body"     One body with multiple labeled forces acting on it. Use
                  for net-force, balanced/unbalanced forces, friction,
                  normal force, gravity analysis.
  "generic-scene" Fallback for non-diagrammatic content: dialogues,
                  narrative setups, classroom scenes. Use ONLY when the
                  content is not a physics diagram.

STEP 2 — Fill the payload matching the archetype:

Shared leaf types:
  direction: "left" | "right" | "up" | "down" | { "angle_deg": <number> }
  body: {
    id: string,                      // short id: "A", "B", "block", etc.
    kind: "car" | "block" | "ball" | "cart" | "person" | "spring" | "custom",
    label: string,                   // human-readable, e.g. "Blue Car"
    color: string,                   // hex, e.g. "#3B82F6"
    mass_kg?: number,                // optional but strongly preferred
    velocity_ms?: number,
    direction?: direction,
    role?: string                    // archetype slot: "left" / "right" / "primary"
  }
  force: {
    id: string,                      // e.g. "F_AB"
    on: string,                      // body id this force acts on
    by?: string,                     // for action-reaction pairs
    label: string,                   // what gets rendered, e.g. "F_AB"
    kind: "contact" | "gravity" | "normal" | "friction" | "applied" | "spring",
    direction: direction,
    magnitude_N?: number
  }
  annotation: union of
    { "kind": "equation", "tex": string, "position": "caption"|"top"|"bottom" }
    { "kind": "measurement", "attached_to": string /* body id */, "text": string }

Archetype payloads:

  collision:
    { "archetype": "collision",
      "bodies": [body, body],        // exactly two, A left, B right
      "forces": [force, ...],        // typically an action-reaction pair
      "contact": { "kind": "direct"|"spring", "between": [bodyIdA, bodyIdB] },
      "annotations": [...],
      "caption_equation"?: string    // e.g. "F_{AB} = -F_{BA}"
    }

  free-body:
    { "archetype": "free-body",
      "body": body,
      "forces": [force, ...],
      "surface"?: { "kind": "ground"|"wall"|"none" },
      "annotations": [...]
    }

  generic-scene:
    { "archetype": "generic-scene",
      "subject": { "label": string, "kind": string },
      "secondaries"?: [ { "label": string, "kind": string, "position": "left"|"right"|"below" } ],
      "setting"?: "classroom" | "outdoor" | "lab" | "playground" | "indoor"
    }

Top-level output:
  { "title": string, "lesson_concept": string, "scene": <archetype payload> }

RULES
- Output JSON only. No prose, no markdown fence.
- For collisions: both bodies must have mass_kg and velocity_ms; the force list
  should contain at least the action-reaction pair (F_AB on B by A, F_BA on A by B).
- Force directions should reflect the physics: during a head-on collision,
  each force on a body points OPPOSITE to that body's velocity (it is the
  force decelerating the body).
- Use short labels (e.g. "F_AB" not "Force from A on B"). Subscripts render.
- Prefer concrete numbers over vague descriptions.
- Stick to Tier-1 archetypes. Do not invent new archetypes.
- If the content is clearly not a physics diagram, use "generic-scene".
- Measurement annotations must be SHORT quantities like "m = 1200 kg",
  "v = 15 m/s", "Δt = 0.02 s". Narrative explanations go in lesson_concept,
  NOT in measurement annotations.
- Use plain ASCII in equation/annotation text. Do NOT use LaTeX commands
  like \\rightarrow — use "→" or "->" instead. Subscripts use _ notation
  ("F_AB", "v_0", "Δx") which the renderer handles.
- For collisions: do NOT list gravity/normal forces. Focus only on the
  contact/spring force pair that demonstrates Newton's Third Law.
- For free-body: keep forces roughly horizontal/vertical ("left", "right",
  "up", "down"). Reserve angled directions for truly oblique scenarios;
  if the scene is a ramp/incline, this is beyond Tier-1 — use
  "generic-scene" instead.

FEW-SHOT EXAMPLE (collision — two cars head-on):

{
  "title": "Newton's Third Law — Head-on Collision",
  "lesson_concept": "Action-reaction force pair in a two-body collision",
  "scene": {
    "archetype": "collision",
    "bodies": [
      { "id": "A", "kind": "car", "label": "Blue Car", "color": "#3B82F6",
        "mass_kg": 1200, "velocity_ms": 15, "direction": "right", "role": "left" },
      { "id": "B", "kind": "car", "label": "Red Car", "color": "#EF4444",
        "mass_kg": 1200, "velocity_ms": 15, "direction": "left", "role": "right" }
    ],
    "forces": [
      { "id": "F_AB", "on": "B", "by": "A", "label": "F_AB",
        "kind": "contact", "direction": "right" },
      { "id": "F_BA", "on": "A", "by": "B", "label": "F_BA",
        "kind": "contact", "direction": "left" }
    ],
    "contact": { "kind": "spring", "between": ["A", "B"] },
    "annotations": [],
    "caption_equation": "F_{AB} = -F_{BA}"
  }
}`;

const buildUserPrompt = (
  item: ResolvedContentItem,
  lessonTitle: string,
  learningObjective: string,
  strategyLabel: string,
  strategyDescription: string,
): string => {
  const visualBrief = item.visualBrief?.trim() || "(none — infer from the body)";
  return `Lesson: ${lessonTitle}
Learning objective: ${learningObjective}
Engagement strategy: ${strategyLabel} — ${strategyDescription}

Content item title: ${item.title}
Student-facing body:
${item.body}

Visual brief: ${visualBrief}

Produce the scene description JSON that best supports this content.`;
};

export const describeSceneV2 = async (
  client: OpenAI,
  item: ResolvedContentItem,
  lessonNumber: number,
  opts: { retryOnParseFail?: boolean } = {},
): Promise<SceneDescriptionV2> => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) {
    throw new Error(`Lesson ${lessonNumber} not found.`);
  }
  const strategyContext = getStrategyContext(item.strategy);
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";

  const userPrompt = buildUserPrompt(
    item,
    lessonContext.lessonTitle,
    lessonContext.learningObjective,
    strategyContext.label,
    strategyContext.description,
  );

  const call = async (extraInstruction?: string) => {
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];
    if (extraInstruction) {
      messages.push({ role: "user", content: extraInstruction });
    }
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Scene describer returned empty response.");
    return JSON.parse(raw);
  };

  let parsed: unknown;
  try {
    parsed = await call();
  } catch (e) {
    if (!opts.retryOnParseFail) throw e;
    parsed = await call(
      "Previous response was not valid JSON. Return JSON only, no prose.",
    );
  }

  const result = SceneDescriptionV2.safeParse(parsed);
  if (!result.success) {
    // One retry with the validation errors as feedback.
    const retry = await call(
      `Previous JSON failed schema validation with these issues:\n${result.error.toString()}\nFix the JSON to match the schema exactly. Return JSON only.`,
    );
    const retryResult = SceneDescriptionV2.safeParse(retry);
    if (!retryResult.success) {
      throw new Error(
        `Scene describer failed schema validation twice: ${retryResult.error.toString()}`,
      );
    }
    return retryResult.data;
  }
  return result.data;
};
