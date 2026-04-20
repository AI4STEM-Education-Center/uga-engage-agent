/**
 * Stage 2a: Layout Engine.
 *
 * Pure deterministic function that maps SceneDescription (semantic) to
 * LayoutResult (pixel coordinates on a 1024x1024 canvas). Given the same
 * input, it always produces the same output.
 */

import type {
  LayoutObject,
  LayoutResult,
  SceneDescription,
  SceneObject,
} from "./types";

const CANVAS_SIZE = 1024;
const MARGIN = 40;

type Zone = { centerX: number; centerY: number; width: number; height: number };

const computeZones = (
  composition: SceneDescription["composition"],
  count: number,
): Zone[] => {
  const usableWidth = CANVAS_SIZE - MARGIN * 2;
  const usableHeight = CANVAS_SIZE - MARGIN * 2;
  const centerX = CANVAS_SIZE / 2;
  const centerY = CANVAS_SIZE / 2;

  if (count === 0) return [];

  if (composition === "left-right") {
    const zoneWidth = usableWidth / count;
    return Array.from({ length: count }, (_, i) => ({
      centerX: MARGIN + zoneWidth * (i + 0.5),
      centerY,
      width: zoneWidth,
      height: usableHeight,
    }));
  }

  if (composition === "top-bottom") {
    const zoneHeight = usableHeight / count;
    return Array.from({ length: count }, (_, i) => ({
      centerX,
      centerY: MARGIN + zoneHeight * (i + 0.5),
      width: usableWidth,
      height: zoneHeight,
    }));
  }

  if (composition === "radial") {
    // First object at center, others arranged around it in a circle.
    const zones: Zone[] = [
      { centerX, centerY, width: usableWidth / 3, height: usableHeight / 3 },
    ];
    const orbiting = count - 1;
    const radius = Math.min(usableWidth, usableHeight) / 3;
    const zoneSize = Math.min(usableWidth, usableHeight) / 4;
    for (let i = 0; i < orbiting; i++) {
      const angle = (2 * Math.PI * i) / orbiting - Math.PI / 2;
      zones.push({
        centerX: centerX + radius * Math.cos(angle),
        centerY: centerY + radius * Math.sin(angle),
        width: zoneSize,
        height: zoneSize,
      });
    }
    return zones;
  }

  // "centered": first object centered large, remainder spread across the bottom.
  if (count === 1) {
    return [{ centerX, centerY, width: usableWidth * 0.6, height: usableHeight * 0.6 }];
  }
  const supportingCount = count - 1;
  const supportWidth = usableWidth / supportingCount;
  const zones: Zone[] = [
    {
      centerX,
      centerY: MARGIN + usableHeight * 0.3,
      width: usableWidth * 0.5,
      height: usableHeight * 0.5,
    },
  ];
  for (let i = 0; i < supportingCount; i++) {
    zones.push({
      centerX: MARGIN + supportWidth * (i + 0.5),
      centerY: MARGIN + usableHeight * 0.8,
      width: supportWidth * 0.8,
      height: usableHeight * 0.3,
    });
  }
  return zones;
};

const resolveSize = (
  relativeValue: number | undefined,
  zoneDimension: number,
  fallbackPct = 50,
): number => {
  const pct = relativeValue ?? fallbackPct;
  const clamped = Math.max(5, Math.min(100, pct));
  return (clamped / 100) * zoneDimension;
};

const placeObject = (obj: SceneObject, zone: Zone): LayoutObject => {
  const computedWidth = resolveSize(obj.width, zone.width);
  const computedHeight = resolveSize(obj.height, zone.height);
  return {
    ...obj,
    x: zone.centerX - computedWidth / 2,
    y: zone.centerY - computedHeight / 2,
    computedWidth,
    computedHeight,
  };
};

export const computeLayout = (scene: SceneDescription): LayoutResult => {
  const zones = computeZones(scene.composition, scene.objects.length);
  const objects: LayoutObject[] = scene.objects.map((obj, i) =>
    placeObject(obj, zones[i] ?? zones[zones.length - 1]),
  );

  return {
    canvasWidth: CANVAS_SIZE,
    canvasHeight: CANVAS_SIZE,
    background: scene.background,
    objects,
    relationships: scene.relationships,
  };
};
