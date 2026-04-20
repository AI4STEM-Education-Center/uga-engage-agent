/**
 * Stage 1: Scene Description.
 *
 * Calls an LLM to decompose a ContentItem into a structured SceneDescription
 * (semantic objects + relationships, no coordinates). Layout is deferred to
 * the layout engine.
 */

import type OpenAI from "openai";

import {
  getLessonGenerationContext,
  getStrategyContext,
} from "@/lib/lesson-context";
import type { ContentItem } from "@/lib/types";

import type { SceneDescription } from "./types";

const SYSTEM_PROMPT = `You are a scene composition assistant for educational science diagrams.

Given a student-facing lesson content item, decompose the visual scene into a
structured JSON description of semantic objects and their relationships.

DO NOT include pixel coordinates. Use relative sizes (0-100) and a composition
hint — a deterministic layout engine will place the objects.

Return JSON only, matching this schema:
{
  "title": string,
  "background": string,         // e.g. "classroom", "outdoor", "lab", "road"
  "composition": "centered" | "left-right" | "top-bottom" | "radial",
  "objects": [
    {
      "id": string,             // unique identifier, e.g. "cart_a"
      "type": "person" | "object" | "arrow" | "force" | "surface" | "container",
      "name": string,            // short label, e.g. "Blue Car"
      "shape": "rect" | "circle" | "ellipse" | "line",
      "color": string,           // hex like "#3B82F6"
      "width": number,           // relative 0-100 within its zone
      "height": number
    }
  ],
  "relationships": [
    {
      "from": string,            // object id
      "to": string,              // object id
      "type": "arrow" | "force" | "contact" | "distance",
      "label": string,           // short label (not rendered as text)
      "style": "solid" | "dashed"
    }
  ]
}

Guidance:
- Choose "left-right" for comparisons, collisions, dialogues.
- Choose "top-bottom" for cause/effect, before/after.
- Choose "centered" when there is a main subject with supporting elements.
- Choose "radial" for cycles or multiple forces acting on one center.
- Keep object count between 2 and 6. Prefer fewer, clearer elements.
- Every relationship must reference valid object ids.`;

const buildUserPrompt = (item: ContentItem, lessonNumber: number): string => {
  const lessonContext = getLessonGenerationContext(lessonNumber);
  if (!lessonContext) {
    throw new Error(`Lesson ${lessonNumber} not found.`);
  }
  const strategyContext = getStrategyContext(item.strategy);
  const visualBrief = item.visualBrief?.trim();

  return `Lesson: ${lessonContext.lessonTitle}
Learning objective: ${lessonContext.learningObjective}
Strategy: ${strategyContext.label} — ${strategyContext.description}

Content item title: ${item.title}
Student-facing body:
${item.body}

${visualBrief ? `Visual brief: ${visualBrief}` : "Visual brief: (none — infer the main visible scene from the body)"}

Produce the scene description JSON.`;
};

export const describeScene = async (
  client: OpenAI,
  item: ContentItem,
  lessonNumber: number,
): Promise<SceneDescription> => {
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(item, lessonNumber) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Scene describer returned empty response.");
  }
  const parsed = JSON.parse(raw) as SceneDescription;

  if (!Array.isArray(parsed.objects) || parsed.objects.length === 0) {
    throw new Error("Scene describer returned no objects.");
  }
  if (!Array.isArray(parsed.relationships)) {
    parsed.relationships = [];
  }
  return parsed;
};
