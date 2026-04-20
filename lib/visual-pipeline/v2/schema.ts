/**
 * v2 scene schema — domain-semantic, archetype-first.
 *
 * Shape primitives (v1 rect/circle/line) are gone. The LLM picks an
 * archetype; the payload carries physics objects (bodies, forces,
 * annotations) that downstream stages can reason about.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Leaf types
// ---------------------------------------------------------------------------

export const Direction = z.union([
  z.enum(["left", "right", "up", "down"]),
  z.object({ angle_deg: z.number() }),
]);
export type Direction = z.infer<typeof Direction>;

export const BodyKind = z.enum([
  "car",
  "block",
  "ball",
  "cart",
  "person",
  "spring",
  "custom",
]);
export type BodyKind = z.infer<typeof BodyKind>;

export const Body = z.object({
  id: z.string(),
  kind: BodyKind,
  label: z.string(),
  color: z.string(), // hex like "#3b82f6"
  mass_kg: z.number().optional(),
  velocity_ms: z.number().optional(),
  direction: Direction.optional(),
  role: z.string().optional(),
});
export type Body = z.infer<typeof Body>;

export const ForceKind = z.enum([
  "contact",
  "gravity",
  "normal",
  "friction",
  "applied",
  "spring",
]);
export type ForceKind = z.infer<typeof ForceKind>;

export const ForceVector = z.object({
  id: z.string(), // e.g. "F_AB"
  on: z.string(), // body id this force acts on
  by: z.string().optional(), // body id exerting (for 3rd-law pairs)
  label: z.string(),
  kind: ForceKind,
  direction: Direction,
  magnitude_N: z.number().optional(),
});
export type ForceVector = z.infer<typeof ForceVector>;

export const Annotation = z.union([
  z.object({
    kind: z.literal("equation"),
    tex: z.string(),
    position: z.enum(["caption", "top", "bottom"]),
  }),
  z.object({
    kind: z.literal("measurement"),
    attached_to: z.string(), // body id
    text: z.string(), // e.g. "m = 1200 kg"
  }),
]);
export type Annotation = z.infer<typeof Annotation>;

// ---------------------------------------------------------------------------
// Archetype payloads
// ---------------------------------------------------------------------------

export const CollisionScene = z.object({
  archetype: z.literal("collision"),
  bodies: z.tuple([Body, Body]),
  forces: z.array(ForceVector),
  contact: z.object({
    kind: z.enum(["direct", "spring"]),
    between: z.tuple([z.string(), z.string()]),
  }),
  annotations: z.array(Annotation),
  caption_equation: z.string().optional(), // e.g. "F_{AB} = -F_{BA}"
});
export type CollisionScene = z.infer<typeof CollisionScene>;

export const FreeBodyScene = z.object({
  archetype: z.literal("free-body"),
  body: Body,
  forces: z.array(ForceVector),
  surface: z
    .object({ kind: z.enum(["ground", "wall", "none"]) })
    .optional(),
  annotations: z.array(Annotation),
});
export type FreeBodyScene = z.infer<typeof FreeBodyScene>;

export const GenericScene = z.object({
  archetype: z.literal("generic-scene"),
  subject: z.object({ label: z.string(), kind: z.string() }),
  secondaries: z
    .array(
      z.object({
        label: z.string(),
        kind: z.string(),
        position: z.enum(["left", "right", "below"]),
      }),
    )
    .optional(),
  setting: z.string().optional(), // "classroom" | "outdoor" | "lab" | ...
});
export type GenericScene = z.infer<typeof GenericScene>;

// ---------------------------------------------------------------------------
// Top-level scene description
// ---------------------------------------------------------------------------

export const Archetype = z.enum([
  "collision",
  "free-body",
  "generic-scene",
]);
export type Archetype = z.infer<typeof Archetype>;

export const SceneDescriptionV2 = z.object({
  title: z.string(),
  lesson_concept: z.string(),
  scene: z.discriminatedUnion("archetype", [
    CollisionScene,
    FreeBodyScene,
    GenericScene,
  ]),
});
export type SceneDescriptionV2 = z.infer<typeof SceneDescriptionV2>;

// Helper narrowing — downstream stages dispatch on this.
export const sceneArchetype = (s: SceneDescriptionV2): Archetype =>
  s.scene.archetype;
