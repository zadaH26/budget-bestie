import test from 'node:test';
import assert from 'node:assert/strict';
import { computeConfidenceRange, computeQualityScore } from '../dist-test/portfolioMath.js';

test('computeQualityScore returns 100 when rows are zero', () => {
  assert.equal(computeQualityScore(0, 50), 100);
});

test('computeQualityScore declines with issue density', () => {
  const score = computeQualityScore(100, 15);
  assert.equal(score, 85);
});

test('computeConfidenceRange produces low/high bounds around target', () => {
  const result = computeConfidenceRange({
    monthlySaveNeeded: 400,
    historyVolatilityPct: 18,
    manualVolatilityPct: 12,
    confidencePct: 80,
  });

  assert.ok(result.monthlySaveLow >= 0);
  assert.ok(result.monthlySaveHigh >= result.monthlySaveLow);
  assert.ok(result.usedVolatilityPct >= 18);
});
