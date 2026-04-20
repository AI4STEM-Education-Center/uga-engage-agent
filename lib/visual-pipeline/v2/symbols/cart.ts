/**
 * Cart / car symbol — body + two wheels + window, sized to given bbox.
 * Placed with (x, y) as top-left of the bounding box including wheels.
 */

export const cart = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): string => {
  const wheelRadius = Math.min(width, height) * 0.12;
  const bodyH = height - wheelRadius * 2;
  const bodyY = y;
  const bodyW = width;
  const bodyX = x;

  // Subtle gradient id unique per invocation to avoid collisions
  const gradId = `cart-grad-${Math.floor(Math.random() * 1e9)}`;

  // Body with rounded top (cabin + hood silhouette for cars)
  const cabinInset = bodyW * 0.22;
  const cabinY = bodyY + bodyH * 0.15;
  const cabinH = bodyH * 0.5;
  const hoodRadius = Math.min(14, bodyH * 0.18);

  // Wheels
  const wheelY = bodyY + bodyH + wheelRadius;
  const wheelLX = bodyX + bodyW * 0.22;
  const wheelRX = bodyX + bodyW * 0.78;

  // Window
  const winX = bodyX + cabinInset + 4;
  const winY = cabinY + 4;
  const winW = bodyW - 2 * cabinInset - 8;
  const winH = cabinH - 8;

  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="1"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0.75"/>
      </linearGradient>
    </defs>
    <g>
      <!-- cabin roof -->
      <path d="M ${bodyX + cabinInset} ${cabinY + cabinH}
               L ${bodyX + cabinInset + 10} ${cabinY}
               L ${bodyX + bodyW - cabinInset - 10} ${cabinY}
               L ${bodyX + bodyW - cabinInset} ${cabinY + cabinH}
               Z"
            fill="url(#${gradId})"
            stroke="#0F172A"
            stroke-width="2"
            stroke-linejoin="round"/>
      <!-- window glass -->
      <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}"
            fill="#E0F2FE" stroke="#0F172A" stroke-width="1.5" rx="3"/>
      <!-- body (hood + trunk) -->
      <rect x="${bodyX}" y="${cabinY + cabinH}"
            width="${bodyW}" height="${bodyH - cabinH}"
            rx="${hoodRadius}" ry="${hoodRadius}"
            fill="url(#${gradId})" stroke="#0F172A" stroke-width="2"/>
      <!-- wheels -->
      <circle cx="${wheelLX}" cy="${wheelY}" r="${wheelRadius}"
              fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
      <circle cx="${wheelLX}" cy="${wheelY}" r="${wheelRadius * 0.45}"
              fill="#64748B"/>
      <circle cx="${wheelRX}" cy="${wheelY}" r="${wheelRadius}"
              fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
      <circle cx="${wheelRX}" cy="${wheelY}" r="${wheelRadius * 0.45}"
              fill="#64748B"/>
    </g>
  `;
};
