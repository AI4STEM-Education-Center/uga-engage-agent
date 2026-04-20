/**
 * Spring — zigzag polyline between two endpoints.
 */

export const spring = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  coils = 8,
): string => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 10) return "";

  const nx = dx / len; // tangent unit
  const ny = dy / len;
  const px = -ny; // perpendicular unit
  const py = nx;

  const amplitude = Math.max(6, Math.min(14, len * 0.06));
  // Straight end segments take up 15% each, zigzag in the middle 70%.
  const endRatio = 0.15;
  const zigzagStart = endRatio;
  const zigzagEnd = 1 - endRatio;

  const points: string[] = [];
  const segs = coils * 2;
  for (let i = 0; i <= segs; i++) {
    const tRaw = i / segs;
    const t = zigzagStart + tRaw * (zigzagEnd - zigzagStart);
    const side = i % 2 === 0 ? 1 : -1;
    const cx = x1 + dx * t + px * amplitude * side;
    const cy = y1 + dy * t + py * amplitude * side;
    points.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
  }
  // Add straight start and end caps
  const startX = x1 + dx * zigzagStart;
  const startY = y1 + dy * zigzagStart;
  const endX = x1 + dx * zigzagEnd;
  const endY = y1 + dy * zigzagEnd;
  const allPoints = [
    `${x1},${y1}`,
    `${startX.toFixed(1)},${startY.toFixed(1)}`,
    ...points,
    `${endX.toFixed(1)},${endY.toFixed(1)}`,
    `${x2},${y2}`,
  ];

  return `<polyline points="${allPoints.join(" ")}" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
};
