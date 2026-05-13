export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeQualityScore(totalRows: number, weightedIssueCount: number) {
  if (!Number.isFinite(totalRows) || totalRows <= 0) return 100;
  if (!Number.isFinite(weightedIssueCount) || weightedIssueCount <= 0) return 100;
  return clamp(100 - (weightedIssueCount / totalRows) * 100, 0, 100);
}

export function computeConfidenceRange(params: {
  monthlySaveNeeded: number;
  historyVolatilityPct: number;
  manualVolatilityPct: number;
  confidencePct: number;
}) {
  const monthlySaveNeeded = Math.max(0, params.monthlySaveNeeded);
  const historyVolatilityPct = Math.max(0, params.historyVolatilityPct);
  const manualVolatilityPct = Math.max(0, params.manualVolatilityPct);
  const confidencePct = clamp(params.confidencePct, 1, 99);

  const usedVolatilityPct = Math.max(historyVolatilityPct, manualVolatilityPct);
  const confidenceScale = Math.max(0.2, (100 - confidencePct) / 100 + 0.2);
  const confidenceRangePct = usedVolatilityPct * confidenceScale;

  const monthlySaveLow = Math.max(0, monthlySaveNeeded * (1 - confidenceRangePct / 100));
  const monthlySaveHigh = monthlySaveNeeded * (1 + confidenceRangePct / 100);

  return {
    usedVolatilityPct,
    confidenceScale,
    confidenceRangePct,
    monthlySaveLow,
    monthlySaveHigh,
  };
}
