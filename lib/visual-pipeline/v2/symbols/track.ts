/**
 * Track / ground — horizontal baseline with short hatched ticks below.
 */

export const track = (y: number, x1: number, x2: number): string => {
  const hatchSpacing = 20;
  const hatchLength = 12;
  const hatchAngle = 35; // degrees
  const rad = (hatchAngle * Math.PI) / 180;
  const dx = Math.cos(rad) * hatchLength;
  const dy = Math.sin(rad) * hatchLength;

  const hatches: string[] = [];
  for (let x = x1; x <= x2; x += hatchSpacing) {
    hatches.push(
      `<line x1="${x}" y1="${y}" x2="${x - dx}" y2="${y + dy}" stroke="#64748B" stroke-width="1.5"/>`,
    );
  }
  return `
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
    ${hatches.join("")}
  `;
};
