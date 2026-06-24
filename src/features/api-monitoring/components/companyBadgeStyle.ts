import type { CSSProperties } from "react";

export function companyBadgeStyle(code: string): CSSProperties {
  const source = (code || "N/A").trim();
  const hash = source.split("").reduce((acc, ch, index) => ((acc * 33) + ch.charCodeAt(0) + index) >>> 0, 5381);

  const hue = hash % 360;
  const saturation = 58 + (hash % 10);
  const backgroundLightness = 96 + (hash % 2);
  const textLightness = 30 + (hash % 6);
  const borderLightness = 84 + (hash % 6);

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${backgroundLightness}%)`,
    color: `hsl(${hue} ${Math.max(42, saturation - 10)}% ${textLightness}%)`,
    borderColor: `hsl(${hue} ${Math.max(40, saturation - 14)}% ${borderLightness}%)`,
  };
}
