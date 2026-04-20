/**
 * Ball — circle with radial gradient for a bit of 3D feel.
 */

export const ball = (cx: number, cy: number, r: number, color: string): string => {
  const gradId = `ball-grad-${Math.floor(Math.random() * 1e9)}`;
  return `
    <defs>
      <radialGradient id="${gradId}" cx="0.35" cy="0.35" r="0.8">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/>
        <stop offset="0.35" stop-color="${color}" stop-opacity="1"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0.75"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}"
            fill="url(#${gradId})" stroke="#0F172A" stroke-width="2"/>
  `;
};
