/**
 * Types for the Visual Generation Pipeline (JSON -> SVG -> Image).
 *
 * Stage 1 (scene-describer) produces SceneDescription — purely semantic,
 * no coordinates. Stage 2 (layout-engine + svg-builder) produces LayoutResult
 * and an SVG string. Stage 3 (image-generator) rasterizes the SVG via sharp
 * and passes it to OpenAI images.edit as a structural reference.
 */

export type SceneObjectType =
  | "person"
  | "object"
  | "arrow"
  | "force"
  | "surface"
  | "container";

export type SceneShape = "rect" | "circle" | "ellipse" | "line";

export type SceneObject = {
  id: string;
  type: SceneObjectType;
  name: string;
  shape: SceneShape;
  color?: string;
  /** Relative size on a 0-100 scale of the containing zone. */
  width?: number;
  /** Relative size on a 0-100 scale of the containing zone. */
  height?: number;
};

export type SceneRelationshipType = "arrow" | "force" | "contact" | "distance";

export type SceneRelationship = {
  from: string;
  to: string;
  type: SceneRelationshipType;
  label?: string;
  style?: "solid" | "dashed";
};

export type SceneComposition =
  | "centered"
  | "left-right"
  | "top-bottom"
  | "radial";

export type SceneDescription = {
  title: string;
  background: string;
  objects: SceneObject[];
  relationships: SceneRelationship[];
  composition: SceneComposition;
};

/** Object with pixel coordinates resolved by the layout engine. */
export type LayoutObject = SceneObject & {
  x: number;
  y: number;
  computedWidth: number;
  computedHeight: number;
};

export type LayoutResult = {
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  objects: LayoutObject[];
  relationships: SceneRelationship[];
};
