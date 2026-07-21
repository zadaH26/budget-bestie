import type { CSSProperties, InputHTMLAttributes } from "react";

type PremiumRangeProps = InputHTMLAttributes<HTMLInputElement>;

function toNumericValue(value: PremiumRangeProps["value"] | undefined, fallback: number) {
  if (Array.isArray(value)) return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function PremiumRange({ min = 0, max = 100, value, style, ...props }: PremiumRangeProps) {
  const minValue = toNumericValue(min, 0);
  const maxValue = toNumericValue(max, 100);
  const currentValue = toNumericValue(value, minValue);
  const rangeSize = Math.max(maxValue - minValue, 1);
  const progress = Math.min(100, Math.max(0, ((currentValue - minValue) / rangeSize) * 100));
  const rangeStyle = {
    "--bb-range-progress": `${progress}%`,
    ...style,
  } as CSSProperties;

  return <input {...props} type="range" min={min} max={max} value={value} style={rangeStyle} />;
}
