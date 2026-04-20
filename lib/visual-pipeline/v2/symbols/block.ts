/**
 * Block — rounded rectangle with soft gradient.
 */

export const block = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): string => {
  const gradId = `block-grad-${Math.floor(Math.random() * 1e9)}`;
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="1"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0.65"/>
      </linearGradient>
    </defs>
    <rect x="${x}" y="${y}" width="${width}" height="${height}"
          rx="8" ry="8"
          fill="url(#${gradId})" stroke="#0F172A" stroke-width="2"/>
  `;
};
