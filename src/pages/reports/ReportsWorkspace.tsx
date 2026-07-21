/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, Bar, BarChart, Brush, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computeConfidenceRange, computeQualityScore } from "../../portfolioMath";
import { PALETTE,  colorWithAlpha, copyTextToClipboard, currencyTooltip, directionHintFromDescription, formatMoney, monthBounds, parseDateFlexible, toISODate, triggerFileDownload } from "../../app/appCore";
import type { Expense } from "../../app/appCore";
import { useBudgetBestie } from "../../app/BudgetBestieContext";
import { PremiumRange } from "../../components/PremiumRange";
import { BehaviorPatternsCard, DataQualityCard, InteractiveFiltersCard, KpiDictionaryCard, ReportsHeader, SavingsPotentialCard, ShareDownloadCard } from "./ReportSummaryCards";

type PerformanceView = "week" | "month" | "year";

type PerformanceChartRow = {
  label: string;
  value: number;
  avg: number;
};

const PERFORMANCE_VIEW_TABS: Array<{ label: string; value: PerformanceView }> = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

function withRollingAverage(rows: Array<Omit<PerformanceChartRow, "avg">>): PerformanceChartRow[] {
  return rows.map((row, index) => {
    const sampleStart = Math.max(0, index - 2);
    const sample = rows.slice(sampleStart, index + 1);
    const avg = sample.reduce((sum, item) => sum + item.value, 0) / Math.max(1, sample.length);
    return { ...row, avg };
  });
}

function performanceTickLabel(value: unknown, view: PerformanceView) {
  const raw = String(value ?? "");
  if (view === "week") {
    const parts = raw.split("-W");
    return parts.length === 2 ? `W${parts[1]}` : raw;
  }
  if (view === "month") {
    const [yearText, monthText] = raw.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return new Date(year, month - 1, 1).toLocaleDateString("en-CA", { month: "short" });
    }
  }
  return raw;
}

export function ReportsWorkspace() {
  const {
    activeAccount,
    activeThemePresetId,
    appTitle,
    areLikelyDuplicateNames,
    budgets,
    catById,
    categories,
    chartCategoryFilter,
    chartTheme,
    dateFrom,
    dateTo,
    excludeCCPayFromCharts,
    excludeInvestingSavingsFromCharts,
    excludeTransfersFromCharts,
    expenseOnly,
    expenses,
    exportToCSV,
    exportToXLSX,
    filteredExpenses,
    getWeekNumber,
    openExpensesWithFilters,
    removeDuplicates,
    s,
    setChartCategoryFilter,
    setExcludeInvestingSavingsFromCharts,
    softLayer,
    themeMode,
    totals,
  } = useBudgetBestie();

    const [merchantMonthFilter, setMerchantMonthFilter] = useState<string>("all");
    const [plannerMonthFilter, setPlannerMonthFilter] = useState<string>("all");
    const [savingsTargetInput, setSavingsTargetInput] = useState("500");
    const [forecastMonthsAhead, setForecastMonthsAhead] = useState(6);
    const [forecastSavingsGoal, setForecastSavingsGoal] = useState(1200);
    const [plannerExecutionPct, setPlannerExecutionPct] = useState(85);
    const [riskBufferPct, setRiskBufferPct] = useState(10);
    const [forecastConfidencePct, setForecastConfidencePct] = useState(80);
    const [manualVolatilityPct, setManualVolatilityPct] = useState(15);
    const [categoryCutPercents, setCategoryCutPercents] = useState<Record<string, number>>({});
    const [lockedCategories, setLockedCategories] = useState<Record<string, boolean>>({});
    const [canCutText, setCanCutText] = useState("");
    const [cannotCutText, setCannotCutText] = useState("");
    const [planReply, setPlanReply] = useState("");
    const [planNotice, setPlanNotice] = useState("");
    const [shareNotice, setShareNotice] = useState("");
    const planReplyRef = useRef<HTMLDivElement | null>(null);
    const [interactiveCategoryId, setInteractiveCategoryId] = useState<string>("all");
    const [interactiveMonth, setInteractiveMonth] = useState<string>("all");
    const [interactiveMerchant, setInteractiveMerchant] = useState<string>("all");
    const [performanceView, setPerformanceView] = useState<PerformanceView>("month");

    const reportRowsBase = useMemo(() => {
      return expenseOnly.filter((row) => {
        if (interactiveCategoryId !== "all" && row.categoryId !== interactiveCategoryId) return false;
        if (interactiveMonth !== "all" && row.date.slice(0, 7) !== interactiveMonth) return false;
        return true;
      });
    }, [expenseOnly, interactiveCategoryId, interactiveMonth]);

    useEffect(() => {
      if (interactiveMerchant === "all") return;
      if (!reportRowsBase.some((row) => row.notes === interactiveMerchant)) {
        setInteractiveMerchant("all");
      }
    }, [interactiveMerchant, reportRowsBase]);

    const reportRows = useMemo(() => {
      if (interactiveMerchant === "all") return reportRowsBase;
      return reportRowsBase.filter((row) => row.notes === interactiveMerchant);
    }, [reportRowsBase, interactiveMerchant]);

    const weekly = useMemo(() => {
      const map = new Map<string, number>();
      for (const e of reportRows) {
        const d = new Date(e.date + "T00:00:00");
        const weekKey = `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, "0")}`;
        map.set(weekKey, (map.get(weekKey) ?? 0) + Math.abs(e.amount));
      }
      const arr = [...map.entries()].map(([week, value]) => ({ week, value }));
      arr.sort((a, b) => a.week.localeCompare(b.week));
      const sliced = arr.slice(-12);
      return withRollingAverage(sliced.map((row) => ({ label: row.week, value: row.value }))).map((row) => ({
        week: row.label,
        value: row.value,
        avg: row.avg,
      }));
    }, [getWeekNumber, reportRows]);

    const monthly = useMemo(() => {
      const map = new Map<string, number>();
      for (const e of reportRows) {
        const m = e.date.slice(0, 7);
        map.set(m, (map.get(m) ?? 0) + Math.abs(e.amount));
      }
      const arr = [...map.entries()].map(([month, value]) => ({ month, value }));
      arr.sort((a, b) => a.month.localeCompare(b.month));
      return arr.slice(-12);
    }, [reportRows]);

    const yearly = useMemo(() => {
      const map = new Map<string, number>();
      for (const expense of reportRows) {
        const year = expense.date.slice(0, 4);
        map.set(year, (map.get(year) ?? 0) + Math.abs(expense.amount));
      }
      const rows = [...map.entries()].map(([year, value]) => ({ year, value }));
      rows.sort((a, b) => a.year.localeCompare(b.year));
      return rows.slice(-8);
    }, [reportRows]);

    const performanceRows = useMemo(() => {
      if (performanceView === "week") {
        return weekly.map((row) => ({ label: row.week, value: row.value, avg: row.avg }));
      }
      if (performanceView === "year") {
        return withRollingAverage(yearly.map((row) => ({ label: row.year, value: row.value })));
      }
      return withRollingAverage(monthly.map((row) => ({ label: row.month, value: row.value })));
    }, [monthly, performanceView, weekly, yearly]);

    const performanceDeltaPct = useMemo(() => {
      if (performanceRows.length < 2) return 0;
      const latest = performanceRows[performanceRows.length - 1]?.value ?? 0;
      const prior = performanceRows[performanceRows.length - 2]?.value ?? 0;
      if (prior <= 0) return 0;
      return Math.round(((latest - prior) / prior) * 100);
    }, [performanceRows]);
    const performanceBadge = `${performanceDeltaPct >= 0 ? "+" : ""}${performanceDeltaPct}%`;
    const performanceMidLabel = performanceRows[Math.floor(performanceRows.length / 2)]?.label ?? null;

    const historicalMonthly = useMemo(() => {
      const map = new Map<string, number>();
      for (const e of reportRows) {
        const m = e.date.slice(0, 7);
        map.set(m, (map.get(m) ?? 0) + Math.abs(e.amount));
      }
      const arr = [...map.entries()].map(([month, value]) => ({ month, value }));
      arr.sort((a, b) => a.month.localeCompare(b.month));
      return arr;
    }, [reportRows]);

    const reportSpendByCategory = useMemo(() => {
      const map = new Map<string, number>();
      for (const e of reportRows) map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + Math.abs(e.amount));
      return [...map.entries()]
        .map(([categoryId, value]) => ({
          categoryId,
          name: catById.get(categoryId)?.name ?? "Unknown",
          value,
        }))
        .sort((a, b) => b.value - a.value)
        .map((row, idx) => ({
          ...row,
          color: chartTheme.pie[idx % chartTheme.pie.length],
        }));
    }, [reportRows, catById, chartTheme]);

    const savingsPotential = useMemo(() => {
      const top = reportSpendByCategory.slice(0, 2);
      const potential = top.reduce((sum, row) => sum + row.value * 0.1, 0);
      return { top, potential };
    }, [reportSpendByCategory]);

    const availableMonths = useMemo(() => {
      return [...new Set(expenseOnly.map((e) => e.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
    }, [expenseOnly]);

    const dataQuality = useMemo(() => {
      const rows = filteredExpenses;
      const duplicateIds = new Set<string>();
      const byDayAmount = new Map<string, Expense[]>();

      for (const row of rows) {
        const key = `${row.date}|${Math.abs(row.amount).toFixed(2)}`;
        const bucket = byDayAmount.get(key);
        if (bucket) bucket.push(row);
        else byDayAmount.set(key, [row]);
      }

      for (const bucket of byDayAmount.values()) {
        if (bucket.length < 2) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          for (let j = i + 1; j < bucket.length; j += 1) {
            if (areLikelyDuplicateNames(bucket[i].notes, bucket[j].notes)) {
              duplicateIds.add(bucket[i].id);
              duplicateIds.add(bucket[j].id);
            }
          }
        }
      }

      let invalidDateCount = 0;
      let missingFieldCount = 0;
      let signAnomalyCount = 0;
      let uncategorizedCount = 0;
      let zeroAmountCount = 0;

      for (const row of rows) {
        if (!parseDateFlexible(row.date)) invalidDateCount += 1;
        if (!row.notes.trim() || !row.date || !Number.isFinite(row.amount)) missingFieldCount += 1;
        if (Math.abs(row.amount) < 0.00001) zeroAmountCount += 1;
        if (!catById.has(row.categoryId)) uncategorizedCount += 1;

        const directionHint = directionHintFromDescription(row.notes, row.sourceGroup);
        if (directionHint === "outflow" && row.amount > 0) signAnomalyCount += 1;
        if (directionHint === "inflow" && row.amount < 0) signAnomalyCount += 1;
      }

      const duplicateCandidateCount = duplicateIds.size;
      const totalRows = rows.length;
      const weightedIssueCount =
        duplicateCandidateCount * 2.2 +
        signAnomalyCount * 2 +
        missingFieldCount * 1.4 +
        invalidDateCount * 1.5 +
        uncategorizedCount * 1.2 +
        zeroAmountCount * 2.2;
      const score = computeQualityScore(totalRows, weightedIssueCount);
      const grade = score >= 92 ? "A" : score >= 82 ? "B" : score >= 70 ? "C" : "D";

      return {
        totalRows,
        duplicateCandidateCount,
        signAnomalyCount,
        missingFieldCount,
        invalidDateCount,
        uncategorizedCount,
        zeroAmountCount,
        score,
        grade,
      };
    }, [filteredExpenses, catById, areLikelyDuplicateNames]);

    const weekdayWeekendStats = useMemo(() => {
      let weekdaySpend = 0;
      let weekendSpend = 0;
      let weekdayCount = 0;
      let weekendCount = 0;

      for (const row of reportRows) {
        const d = new Date(row.date + "T00:00:00");
        if (Number.isNaN(d.getTime())) continue;
        const day = d.getDay();
        const value = Math.abs(row.amount);
        if (day === 0 || day === 6) {
          weekendSpend += value;
          weekendCount += 1;
        } else {
          weekdaySpend += value;
          weekdayCount += 1;
        }
      }

      const weekendAvg = weekendCount > 0 ? weekendSpend / weekendCount : 0;
      const weekdayAvg = weekdayCount > 0 ? weekdaySpend / weekdayCount : 0;
      const weekendLiftPct = weekdayAvg > 0 ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0;

      return { weekdaySpend, weekendSpend, weekdayCount, weekendCount, weekendAvg, weekdayAvg, weekendLiftPct };
    }, [reportRows]);

    const merchantConcentration = useMemo(() => {
      const totalSpend = reportRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
      if (totalSpend <= 0) {
        return {
          totalSpend: 0,
          top1SharePct: 0,
          top5SharePct: 0,
          hhi: 0,
          topMerchants: [] as Array<{ merchant: string; spend: number; sharePct: number }>,
        };
      }

      const allMerchantTotals = new Map<string, number>();
      for (const row of reportRows) {
        allMerchantTotals.set(row.notes, (allMerchantTotals.get(row.notes) ?? 0) + Math.abs(row.amount));
      }
      const grouped = [...allMerchantTotals.entries()]
        .map(([merchant, spend]) => ({
          merchant,
          spend,
          sharePct: (spend / totalSpend) * 100,
        }))
        .sort((a, b) => b.spend - a.spend);
      const top1SharePct = grouped[0]?.sharePct ?? 0;
      const top5SharePct = grouped.slice(0, 5).reduce((sum, row) => sum + row.sharePct, 0);

      let hhi = 0;
      for (const spend of allMerchantTotals.values()) {
        const share = spend / totalSpend;
        hhi += share * share;
      }

      return {
        totalSpend,
        top1SharePct,
        top5SharePct,
        hhi: hhi * 10000,
        topMerchants: grouped.slice(0, 5),
      };
    }, [reportRows]);

    const varianceMonthKey = useMemo(() => {
      if (interactiveMonth !== "all") return interactiveMonth;
      return availableMonths[0] ?? toISODate(new Date()).slice(0, 7);
    }, [interactiveMonth, availableMonths]);

    const budgetVarianceRows = useMemo(() => {
      const monthExpenses = expenseOnly.filter((row) => row.date.slice(0, 7) === varianceMonthKey);
      const actualByCategory = new Map<string, number>();
      for (const row of monthExpenses) {
        actualByCategory.set(row.categoryId, (actualByCategory.get(row.categoryId) ?? 0) + Math.abs(row.amount));
      }

      const monthlyBudgets = budgets.filter((b) => b.period === "monthly");
      return monthlyBudgets
        .map((budget) => {
          const actual = actualByCategory.get(budget.categoryId) ?? 0;
          const variance = actual - budget.amount;
          const variancePct = budget.amount > 0 ? (variance / budget.amount) * 100 : 0;
          return {
            categoryId: budget.categoryId,
            categoryName: catById.get(budget.categoryId)?.name ?? budget.categoryId,
            budgetAmount: budget.amount,
            actual,
            variance,
            variancePct,
            status: variance > 0 ? "over" : "within",
          };
        })
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    }, [expenseOnly, budgets, varianceMonthKey, catById]);

    const merchantMonthGate = interactiveMonth !== "all" ? interactiveMonth : merchantMonthFilter;
    const merchantSpend = useMemo(() => {
      const merchantMap = new Map<string, number>();
      for (const row of reportRowsBase) {
        if (merchantMonthGate !== "all" && row.date.slice(0, 7) !== merchantMonthGate) continue;
        merchantMap.set(row.notes, (merchantMap.get(row.notes) ?? 0) + Math.abs(row.amount));
      }
      return [...merchantMap.entries()]
        .map(([merchant, value]) => ({ merchant, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
    }, [reportRowsBase, merchantMonthGate]);
    const monthlyChartRows = useMemo(() => {
      return monthly.map((row) => ({
        ...row,
        selected: interactiveMonth === "all" || row.month === interactiveMonth,
      }));
    }, [monthly, interactiveMonth]);
    const merchantChartRows = useMemo(() => {
      return merchantSpend.map((row) => ({
        ...row,
        selected: interactiveMerchant === "all" || row.merchant === interactiveMerchant,
      }));
    }, [merchantSpend, interactiveMerchant]);

    const plannerExpenses = useMemo(() => {
      if (plannerMonthFilter === "all") return expenseOnly;
      return expenseOnly.filter((row) => row.date.slice(0, 7) === plannerMonthFilter);
    }, [expenseOnly, plannerMonthFilter]);

    const plannerByCategory = useMemo(() => {
      const map = new Map<string, number>();
      for (const row of plannerExpenses) {
        map.set(row.categoryId, (map.get(row.categoryId) ?? 0) + Math.abs(row.amount));
      }
      return [...map.entries()]
        .map(([categoryId, baseline]) => ({
          categoryId,
          name: catById.get(categoryId)?.name ?? categoryId,
          baseline,
          cutPct: Math.max(0, Math.min(100, categoryCutPercents[categoryId] ?? 10)),
          locked: Boolean(lockedCategories[categoryId]),
        }))
        .sort((a, b) => b.baseline - a.baseline);
    }, [plannerExpenses, catById, categoryCutPercents, lockedCategories]);

    useEffect(() => {
      setCategoryCutPercents((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const row of plannerByCategory) {
          if (!Number.isFinite(next[row.categoryId])) {
            next[row.categoryId] = 10;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, [plannerByCategory]);

    const plannerRows = useMemo(() => {
      return plannerByCategory.map((row) => {
        const pct = row.locked ? 0 : row.cutPct;
        const save = row.baseline * (pct / 100);
        return {
          ...row,
          effectiveCutPct: pct,
          projectedSave: save,
          projectedSpend: row.baseline - save,
        };
      });
    }, [plannerByCategory]);

    const plannerTotals = useMemo(() => {
      const baseline = plannerRows.reduce((sum, row) => sum + row.baseline, 0);
      const save = plannerRows.reduce((sum, row) => sum + row.projectedSave, 0);
      const spendAfterCuts = baseline - save;
      const target = Number(savingsTargetInput.replace(/,/g, "").trim());
      const targetValue = Number.isFinite(target) && target > 0 ? target : 0;
      const gap = Math.max(0, targetValue - save);
      return { baseline, save, spendAfterCuts, target: targetValue, gap };
    }, [plannerRows, savingsTargetInput]);

    function monthLabel(monthKey: string) {
      const m = monthKey.match(/^(\d{4})-(\d{2})$/);
      if (!m) return monthKey;
      const year = Number(m[1]);
      const month = Number(m[2]);
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
    }

    function shiftMonthKey(monthKey: string, offset: number) {
      const m = monthKey.match(/^(\d{4})-(\d{2})$/);
      if (!m) return monthKey;
      const year = Number(m[1]);
      const month = Number(m[2]);
      const d = new Date(year, month - 1 + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    const maxForecastGoal = useMemo(() => {
      const observedMonths = Math.max(1, new Set(reportRows.map((row) => row.date.slice(0, 7))).size);
      const totalSpend = reportRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
      const monthlySpend = totalSpend / observedMonths;
      const projectedSpend = monthlySpend * forecastMonthsAhead;
      const base = Math.ceil((projectedSpend * (1 + riskBufferPct / 100)) / 100) * 100;
      return Math.max(1000, Math.min(50000, base || 1000));
    }, [reportRows, forecastMonthsAhead, riskBufferPct]);

    const forecast = useMemo(() => {
      if (!reportRows.length || forecastMonthsAhead <= 0) return null;
      const observedMonths = Math.max(1, new Set(reportRows.map((row) => row.date.slice(0, 7))).size);
      const totalSpend = reportRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
      const avgMonthlySpend = totalSpend / observedMonths;
      const monthlyPlannerSaveRaw =
        plannerTotals.baseline > 0 ? (plannerTotals.save / Math.max(1, observedMonths)) : 0;
      const monthlyPlannerSave = monthlyPlannerSaveRaw * (plannerExecutionPct / 100);

      const goal = Math.max(0, forecastSavingsGoal) * (1 + riskBufferPct / 100);
      const maxPossibleSaveTotal = avgMonthlySpend * forecastMonthsAhead;
      const reachableGoal = Math.min(goal, maxPossibleSaveTotal);
      const isGoalTooHigh = goal > maxPossibleSaveTotal + 0.01;

      const monthlySaveNeeded = reachableGoal / forecastMonthsAhead;
      const weeklySaveNeeded = monthlySaveNeeded / 4.345;
      const monthlySpendTarget = Math.max(0, avgMonthlySpend - monthlySaveNeeded);
      const requiredCutPercent = avgMonthlySpend > 0 ? (monthlySaveNeeded / avgMonthlySpend) * 100 : 0;
      const currentPlanTotal = monthlyPlannerSave * forecastMonthsAhead;
      const planGap = Math.max(0, reachableGoal - currentPlanTotal);

      const monthlyValues = historicalMonthly.map((row) => row.value);
      const mean = monthlyValues.length
        ? monthlyValues.reduce((sum, value) => sum + value, 0) / monthlyValues.length
        : 0;
      const variance = monthlyValues.length
        ? monthlyValues.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / monthlyValues.length
        : 0;
      const stdDev = Math.sqrt(Math.max(0, variance));
      const historyVolatilityPct = mean > 0 ? (stdDev / mean) * 100 : manualVolatilityPct;
      const confidenceRange = computeConfidenceRange({
        monthlySaveNeeded,
        historyVolatilityPct,
        manualVolatilityPct,
        confidencePct: forecastConfidencePct,
      });

      const lastMonth = historicalMonthly.length
        ? historicalMonthly[historicalMonthly.length - 1].month
        : toISODate(new Date()).slice(0, 7);
      const chartRows = Array.from({ length: forecastMonthsAhead }, (_, idx) => {
        const month = shiftMonthKey(lastMonth, idx + 1);
        const step = idx + 1;
        const goalCumulative = monthlySaveNeeded * step;
        const plannerCumulative = monthlyPlannerSave * step;
        return {
          month,
          label: monthLabel(month),
          goalCumulative,
          plannerCumulative,
          gapCumulative: Math.max(0, goalCumulative - plannerCumulative),
          lowCumulative: confidenceRange.monthlySaveLow * step,
          highCumulative: confidenceRange.monthlySaveHigh * step,
        };
      });

      const focusCategories = reportSpendByCategory.slice(0, 5);
      const focusTotal = focusCategories.reduce((sum, row) => sum + row.value, 0);
      const categoryTargets = focusCategories.map((row) => {
        const monthlyShare = focusTotal > 0 ? (row.value / focusTotal) * monthlySaveNeeded : 0;
        const avgMonthlyCategorySpend = row.value / observedMonths;
        const cutPct = avgMonthlyCategorySpend > 0 ? Math.min(100, (monthlyShare / avgMonthlyCategorySpend) * 100) : 0;
        return {
          categoryId: row.categoryId,
          name: row.name,
          color: row.color,
          monthlySave: monthlyShare,
          cutPct,
        };
      });

      return {
        goal,
        reachableGoal,
        isGoalTooHigh,
        maxPossibleSaveTotal,
        avgMonthlySpend,
        monthlySpendTarget,
        monthlySaveNeeded,
        weeklySaveNeeded,
        requiredCutPercent,
        currentPlanMonthlySave: monthlyPlannerSave,
        currentPlanTotal,
        planGap,
        monthlySaveLow: confidenceRange.monthlySaveLow,
        monthlySaveHigh: confidenceRange.monthlySaveHigh,
        confidenceRangePct: confidenceRange.confidenceRangePct,
        assumptions: {
          plannerExecutionPct,
          riskBufferPct,
          forecastConfidencePct,
          manualVolatilityPct,
          historyVolatilityPct,
          usedVolatilityPct: confidenceRange.usedVolatilityPct,
        },
        chartRows,
        categoryTargets,
      };
    }, [
      reportRows,
      forecastMonthsAhead,
      forecastSavingsGoal,
      plannerTotals.baseline,
      plannerTotals.save,
      historicalMonthly,
      reportSpendByCategory,
      plannerExecutionPct,
      riskBufferPct,
      forecastConfidencePct,
      manualVolatilityPct,
    ]);

    const selectedCategoryName =
      interactiveCategoryId === "all" ? "All categories" : catById.get(interactiveCategoryId)?.name ?? "Category";
    const selectedMonthName = interactiveMonth === "all" ? "All months" : monthLabel(interactiveMonth);
    const selectedMerchantName = interactiveMerchant === "all" ? "All merchants" : interactiveMerchant;
    const performanceCardStyle = (() => {
      const roseLike = activeThemePresetId === "rose_mist" || activeThemePresetId === "frost_lilac";
      const mainLine = chartTheme.pie[0] ?? chartTheme.trend;
      const avgLine = chartTheme.pie[1] ?? chartTheme.trendSoft;

      if (themeMode === "dark") {
        return {
          cardBackground: `linear-gradient(180deg, ${colorWithAlpha(PALETTE.panel2, 0.95)} 0%, ${colorWithAlpha(PALETTE.panel, 0.96)} 100%)`,
          cardBorder: colorWithAlpha(chartTheme.trendSoft, 0.34),
          plotBackground: colorWithAlpha(PALETTE.bg, 0.44),
          plotBorder: colorWithAlpha(chartTheme.trendSoft, 0.28),
          stripeFill: colorWithAlpha(chartTheme.band, 0.2),
          stripeLine: colorWithAlpha(chartTheme.band, 0.52),
          mainLine,
          avgLine,
          badgeBackground: `linear-gradient(180deg, ${colorWithAlpha(chartTheme.pie[2] ?? chartTheme.trendSoft, 0.86)} 0%, ${colorWithAlpha(chartTheme.pie[0] ?? chartTheme.trend, 0.84)} 100%)`,
          badgeText: "#081629",
          badgeSub: "rgba(8, 22, 41, 0.74)",
          tabInactiveBg: colorWithAlpha(PALETTE.card, 0.92),
          tabActiveBg: "linear-gradient(180deg, #111111 0%, #050505 100%)",
          legend: [
            { label: "Theory", color: chartTheme.pie[2] ?? chartTheme.trendSoft },
            { label: "Practice", color: chartTheme.pie[0] ?? chartTheme.trend },
            { label: "Lexicon", color: chartTheme.pie[1] ?? chartTheme.trendSoft },
          ],
        };
      }

      if (roseLike) {
        return {
          cardBackground: `linear-gradient(180deg, ${colorWithAlpha(PALETTE.panel2, 0.96)} 0%, ${colorWithAlpha(PALETTE.panel, 0.94)} 100%)`,
          cardBorder: colorWithAlpha(chartTheme.pie[1] ?? chartTheme.trendSoft, 0.42),
          plotBackground: colorWithAlpha("#ffffff", 0.7),
          plotBorder: colorWithAlpha(chartTheme.pie[0] ?? chartTheme.trend, 0.28),
          stripeFill: colorWithAlpha(chartTheme.pie[2] ?? chartTheme.band, 0.16),
          stripeLine: colorWithAlpha(chartTheme.pie[1] ?? chartTheme.trendSoft, 0.56),
          mainLine: chartTheme.pie[0] ?? "#e2a6cd",
          avgLine: chartTheme.pie[1] ?? "#bcaeea",
          badgeBackground: `linear-gradient(180deg, ${colorWithAlpha(chartTheme.pie[3] ?? chartTheme.pie[0] ?? chartTheme.trend, 0.88)} 0%, ${colorWithAlpha(chartTheme.pie[2] ?? chartTheme.pie[1] ?? chartTheme.trendSoft, 0.84)} 100%)`,
          badgeText: "#2b1b3e",
          badgeSub: "rgba(43, 27, 62, 0.72)",
          tabInactiveBg: colorWithAlpha("#ffffff", 0.86),
          tabActiveBg: "linear-gradient(180deg, #161616 0%, #0a0a0a 100%)",
          legend: [
            { label: "Theory", color: chartTheme.pie[1] ?? "#bcaeea" },
            { label: "Practice", color: chartTheme.pie[0] ?? "#e2a6cd" },
            { label: "Lexicon", color: chartTheme.pie[2] ?? "#d8bae8" },
          ],
        };
      }

      return {
        cardBackground: "linear-gradient(180deg, rgba(249,248,252,0.95) 0%, rgba(244,241,250,0.95) 100%)",
        cardBorder: PALETTE.border,
        plotBackground: "rgba(255,255,255,0.6)",
        plotBorder: PALETTE.border,
        stripeFill: colorWithAlpha(chartTheme.band, 0.2),
        stripeLine: colorWithAlpha(chartTheme.band, 0.58),
        mainLine,
        avgLine,
        badgeBackground: `linear-gradient(180deg, ${colorWithAlpha(chartTheme.pie[0] ?? chartTheme.trend, 0.86)} 0%, ${colorWithAlpha(chartTheme.pie[2] ?? chartTheme.trendSoft, 0.8)} 100%)`,
        badgeText: "#1f132f",
        badgeSub: "rgba(31, 19, 47, 0.75)",
        tabInactiveBg: "rgba(255,255,255,0.86)",
        tabActiveBg: "linear-gradient(180deg, #131313 0%, #060606 100%)",
        legend: [
          { label: "Theory", color: chartTheme.pie[2] ?? "#bfc4ff" },
          { label: "Practice", color: chartTheme.pie[0] ?? "#f0b6c8" },
          { label: "Lexicon", color: chartTheme.pie[1] ?? "#e5b8d8" },
        ],
      };
    })();

    function setForecastHorizonMonths(raw: number) {
      if (!Number.isFinite(raw)) return;
      setForecastMonthsAhead(Math.max(1, Math.min(60, Math.round(raw))));
    }

    function setForecastSavingsGoalValue(raw: number) {
      if (!Number.isFinite(raw)) return;
      setForecastSavingsGoal(Math.max(0, Math.min(200000, Math.round(raw))));
    }

    function savingsForecastSeriesLabel(raw: string) {
      if (raw === "goalCumulative") return "Goal";
      if (raw === "plannerCumulative") return "Your Plan";
      if (raw === "gapCumulative") return "Behind By";
      if (raw === "lowCumulative") return "Confidence Low";
      if (raw === "highCumulative") return "Confidence High";
      return raw;
    }

    function toggleInteractiveCategory(categoryId: string) {
      setInteractiveCategoryId((prev) => {
        const next = prev === categoryId ? "all" : categoryId;
        return next;
      });
      setInteractiveMerchant("all");
    }

    function toggleInteractiveMonth(month: string) {
      setInteractiveMonth((prev) => {
        const next = prev === month ? "all" : month;
        return next;
      });
      setInteractiveMerchant("all");
    }

    function toggleInteractiveMerchant(merchant: string) {
      setInteractiveMerchant((prev) => (prev === merchant ? "all" : merchant));
    }

    function resetInteractiveFilters() {
      setInteractiveCategoryId("all");
      setInteractiveMonth("all");
      setInteractiveMerchant("all");
    }

    function openInteractiveRows() {
      const filters: { categoryId?: string; search?: string; from?: string; to?: string } = {};
      if (interactiveCategoryId !== "all") filters.categoryId = interactiveCategoryId;
      if (interactiveMerchant !== "all") filters.search = interactiveMerchant;
      if (interactiveMonth !== "all") {
        const bounds = monthBounds(interactiveMonth);
        if (bounds) {
          filters.from = bounds.from;
          filters.to = bounds.to;
        }
      }
      openExpensesWithFilters(filters);
    }

    function applyConstraintsFromText() {
      const canTokens = canCutText
        .toLowerCase()
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const cannotTokens = cannotCutText
        .toLowerCase()
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (!canTokens.length && !cannotTokens.length) return;

      setLockedCategories((prev) => {
        const next = { ...prev };
        for (const row of plannerRows) {
          const name = row.name.toLowerCase();
          if (cannotTokens.some((token) => name.includes(token))) next[row.categoryId] = true;
          if (canTokens.some((token) => name.includes(token))) next[row.categoryId] = false;
        }
        return next;
      });
    }

    function setAllCuts(percent: number) {
      const bounded = Math.max(0, Math.min(100, percent));
      setCategoryCutPercents((prev) => {
        const next = { ...prev };
        for (const row of plannerRows) {
          if (lockedCategories[row.categoryId]) continue;
          next[row.categoryId] = bounded;
        }
        return next;
      });
    }

    function buildLocalPlanFallback() {
      if (!plannerRows.length) return "Add spending data first so I can build a savings plan.";

      const target = plannerTotals.target;
      let remaining = target > 0 ? target : plannerTotals.save;
      const ranked = plannerRows
        .filter((row) => !row.locked)
        .sort((a, b) => b.baseline - a.baseline);

      const lines: string[] = [];
      for (const row of ranked) {
        if (remaining <= 0) break;
        const maxReasonable = row.baseline * 0.2;
        const planned = Math.min(maxReasonable, remaining);
        if (planned <= 0) continue;
        const pct = Math.max(1, Math.round((planned / row.baseline) * 100));
        lines.push(`${row.name}: cut about ${pct}% (save ~${formatMoney(planned)})`);
        remaining -= planned;
      }

      if (!lines.length) {
        return "Most categories are locked as 'cannot cut'. Unlock at least one category to generate a plan.";
      }
      if (remaining > 0) {
        lines.push(`Still needed to reach target: ${formatMoney(remaining)}.`);
      } else {
        lines.push("This plan can hit your target.");
      }

      return lines.join("\n");
    }

    function generateSavingsPlan() {
      const text = buildLocalPlanFallback();
      setPlanReply(text);
      setPlanNotice(`Plan generated at ${new Date().toLocaleTimeString()}.`);
      setTimeout(() => {
        planReplyRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 0);
    }

    function applyForecastCoachToPlanner() {
      if (!forecast || forecast.monthlySaveNeeded <= 0) {
        setPlanNotice("No reduction needed for the current savings goal.");
        return;
      }
      setCategoryCutPercents((prev) => {
        const next = { ...prev };
        for (const target of forecast.categoryTargets) {
          if (lockedCategories[target.categoryId]) continue;
          const rounded = Math.max(0, Math.min(100, Math.round(target.cutPct)));
          next[target.categoryId] = Math.max(next[target.categoryId] ?? 0, rounded);
        }
        return next;
      });
      setPlanNotice("Applied savings-goal cuts to Savings Goal Planner.");
    }

    function buildShareSnapshot() {
      const sortedAllTransactions = expenses
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .map((e) => ({
          date: e.date,
          description: e.notes,
          amount: e.amount,
          amountAbs: Math.abs(e.amount),
          direction: e.amount < 0 ? "expense" : "income",
          categoryId: e.categoryId,
          categoryName: catById.get(e.categoryId)?.name ?? e.categoryId,
          source: e.source ?? "",
          recurring: e.isRecurring,
          recurrence: e.recurrenceFrequency,
        }));
      const observedMonths = Math.max(1, new Set(reportRows.map((row) => row.date.slice(0, 7))).size);
      const reportTotalSpend = reportRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
      const averageMonthlySpend = reportTotalSpend / observedMonths;
      const prompt = [
        "You are my budgeting advisor.",
        "Read this JSON and give a step-by-step savings plan.",
        "Use my category patterns and forecast data.",
        "Focus on realistic actions by category with monthly dollar targets.",
        "Tell me what to keep, what to cut first, and how to hit my savings goal.",
      ].join(" ");

      return {
        generatedAt: new Date().toISOString(),
        appTitle,
        accountName: activeAccount?.name || "My Account",
        filters: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          chartCategoryFilter,
          interactiveCategoryId,
          interactiveMonth,
          interactiveMerchant,
          plannerMonthFilter,
          merchantMonth: merchantMonthGate,
          forecastMonthsAhead,
          forecastSavingsGoal,
          plannerExecutionPct,
          riskBufferPct,
          forecastConfidencePct,
          manualVolatilityPct,
          excludeTransfersFromCharts,
          excludeCCPayFromCharts,
          excludeInvestingSavingsFromCharts,
        },
        totals,
        reportSummary: {
          transactionsInView: reportRows.length,
          observedMonths,
          totalSpend: reportTotalSpend,
          averageMonthlySpend,
          weekly,
          monthly,
          topCategories: reportSpendByCategory.slice(0, 15),
          topMerchants: merchantSpend,
          savingsPotential,
        },
        dataQualitySummary: dataQuality,
        behaviorSummary: {
          weekdayWeekendStats,
          merchantConcentration,
          varianceMonthKey,
          budgetVarianceRows,
        },
        plannerSummary: {
          target: plannerTotals.target,
          baseline: plannerTotals.baseline,
          projectedSave: plannerTotals.save,
          spendAfterCuts: plannerTotals.spendAfterCuts,
          goalGap: plannerTotals.gap,
          rows: plannerRows.map((row) => ({
            categoryId: row.categoryId,
            categoryName: row.name,
            baseline: row.baseline,
            cutPercent: row.effectiveCutPct,
            projectedSave: row.projectedSave,
            projectedSpend: row.projectedSpend,
            locked: row.locked,
          })),
        },
        forecastSummary: forecast
          ? {
              horizonMonths: forecastMonthsAhead,
              savingsGoal: forecast.goal,
              reachableGoal: forecast.reachableGoal,
              isGoalTooHigh: forecast.isGoalTooHigh,
              maxPossibleSaveTotal: forecast.maxPossibleSaveTotal,
              avgMonthlySpend: forecast.avgMonthlySpend,
              monthlySpendTarget: forecast.monthlySpendTarget,
              monthlySaveNeeded: forecast.monthlySaveNeeded,
              weeklySaveNeeded: forecast.weeklySaveNeeded,
              requiredCutPercent: forecast.requiredCutPercent,
              currentPlanMonthlySave: forecast.currentPlanMonthlySave,
              currentPlanTotal: forecast.currentPlanTotal,
              planGap: forecast.planGap,
              monthlySaveLow: forecast.monthlySaveLow,
              monthlySaveHigh: forecast.monthlySaveHigh,
              confidenceRangePct: forecast.confidenceRangePct,
              assumptions: forecast.assumptions,
              chartRows: forecast.chartRows,
              categoryTargets: forecast.categoryTargets,
            }
          : null,
        generatedSavingsPlan: planReply || null,
        chatgptPrompt: prompt,
        allTransactions: sortedAllTransactions,
      };
    }

    function shareStamp() {
      return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    }

    function buildChatGptBriefLines(snapshot: ReturnType<typeof buildShareSnapshot>) {
      return [
        `${snapshot.appTitle} - Share Brief`,
        `Generated: ${snapshot.generatedAt}`,
        `Account: ${snapshot.accountName}`,
        "",
        "Key totals:",
        `- Spending in report view: ${formatMoney(snapshot.reportSummary.totalSpend)}`,
        `- Avg monthly spend: ${formatMoney(snapshot.reportSummary.averageMonthlySpend)}`,
        `- Planner projected save: ${formatMoney(snapshot.plannerSummary.projectedSave)}`,
        `- Planner goal gap: ${snapshot.plannerSummary.target > 0 ? formatMoney(snapshot.plannerSummary.goalGap) : "No goal set"}`,
        `- Data quality score: ${snapshot.dataQualitySummary.score.toFixed(1)} / 100 (${snapshot.dataQualitySummary.grade})`,
        "",
        "Forecast:",
        snapshot.forecastSummary
          ? `- Horizon: ${snapshot.forecastSummary.horizonMonths} months`
          : "- Forecast unavailable",
        snapshot.forecastSummary
          ? `- Savings goal: ${formatMoney(snapshot.forecastSummary.savingsGoal)}`
          : "",
        snapshot.forecastSummary
          ? `- Needed per month: ${formatMoney(snapshot.forecastSummary.monthlySaveNeeded)}`
          : "",
        snapshot.forecastSummary
          ? `- Needed cut: ${Math.round(snapshot.forecastSummary.requiredCutPercent)}% of monthly spend`
          : "",
        snapshot.forecastSummary
          ? `- Confidence range (monthly save): ${formatMoney(snapshot.forecastSummary.monthlySaveLow)} to ${formatMoney(snapshot.forecastSummary.monthlySaveHigh)}`
          : "",
        "",
        "Top categories by spend:",
        ...snapshot.reportSummary.topCategories.slice(0, 6).map((row) => `- ${row.name}: ${formatMoney(row.value)}`),
        "",
        "Paste this into ChatGPT with your goals:",
        snapshot.chatgptPrompt,
      ].filter(Boolean);
    }

    function downloadReportSnapshotJSON() {
      const snapshot = buildShareSnapshot();
      const stamp = shareStamp();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8;" });
      triggerFileDownload(blob, `budget_bestie_report_snapshot_${stamp}.json`);
      setShareNotice("Downloaded report snapshot JSON.");
    }

    function downloadChatGptBrief() {
      const snapshot = buildShareSnapshot();
      const lines = buildChatGptBriefLines(snapshot);
      const stamp = shareStamp();
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
      triggerFileDownload(blob, `budget_bestie_chatgpt_brief_${stamp}.txt`);
      setShareNotice("Downloaded ChatGPT brief text file.");
    }

    async function copyReportSnapshotJson() {
      const snapshot = buildShareSnapshot();
      const ok = await copyTextToClipboard(JSON.stringify(snapshot, null, 2));
      setShareNotice(ok ? "Copied report snapshot JSON to clipboard." : "Could not copy JSON. Try download instead.");
    }

    async function copyForChatGpt() {
      const snapshot = buildShareSnapshot();
      const lines = buildChatGptBriefLines(snapshot);
      const payload = [
        lines.join("\n"),
        "",
        "JSON snapshot:",
        "```json",
        JSON.stringify(snapshot, null, 2),
        "```",
      ].join("\n");
      const ok = await copyTextToClipboard(payload);
      setShareNotice(ok ? "Copied ChatGPT brief + JSON to clipboard." : "Could not copy text. Try download instead.");
    }

    function downloadExecutiveReport() {
      const snapshot = buildShareSnapshot();
      const stamp = shareStamp();
      const topCategories = snapshot.reportSummary.topCategories.slice(0, 5);
      const overBudget = snapshot.behaviorSummary.budgetVarianceRows.filter((row) => row.variance > 0).slice(0, 5);
      const highConcentration = snapshot.behaviorSummary.merchantConcentration.top5SharePct;
      const weekendLift = snapshot.behaviorSummary.weekdayWeekendStats.weekendLiftPct;

      const lines = [
        `# ${snapshot.appTitle} Executive Report`,
        ``,
        `Generated: ${snapshot.generatedAt}`,
        `Account: ${snapshot.accountName}`,
        ``,
        `## 1) Executive Summary`,
        `- Spending (active filters): ${formatMoney(snapshot.reportSummary.totalSpend)}`,
        `- Average monthly spending: ${formatMoney(snapshot.reportSummary.averageMonthlySpend)}`,
        `- Projected planner savings: ${formatMoney(snapshot.plannerSummary.projectedSave)}`,
        `- Goal gap: ${snapshot.plannerSummary.target > 0 ? formatMoney(snapshot.plannerSummary.goalGap) : "No goal set"}`,
        `- Data quality score: ${snapshot.dataQualitySummary.score.toFixed(1)} / 100 (${snapshot.dataQualitySummary.grade})`,
        ``,
        `## 2) Key Patterns`,
        `- Weekend average spend per transaction: ${formatMoney(snapshot.behaviorSummary.weekdayWeekendStats.weekendAvg)}`,
        `- Weekday average spend per transaction: ${formatMoney(snapshot.behaviorSummary.weekdayWeekendStats.weekdayAvg)}`,
        `- Weekend lift vs weekday: ${Math.round(weekendLift)}%`,
        `- Merchant concentration (Top 5 share): ${Math.round(highConcentration)}%`,
        ``,
        `## 3) Top Spend Categories`,
        ...topCategories.map((row, idx) => `${idx + 1}. ${row.name}: ${formatMoney(row.value)}`),
        ``,
        `## 4) Budget Variance (${snapshot.behaviorSummary.varianceMonthKey})`,
        ...(overBudget.length
          ? overBudget.map((row, idx) => `${idx + 1}. ${row.categoryName}: over by ${formatMoney(row.variance)} (${Math.round(row.variancePct)}%)`)
          : [`- No over-budget categories in this month.`]),
        ``,
        `## 5) Forecast and Assumptions`,
        snapshot.forecastSummary
          ? `- Horizon: ${snapshot.forecastSummary.horizonMonths} months`
          : `- Forecast unavailable`,
        snapshot.forecastSummary
          ? `- Goal (buffered): ${formatMoney(snapshot.forecastSummary.savingsGoal)}`
          : ``,
        snapshot.forecastSummary
          ? `- Required monthly save: ${formatMoney(snapshot.forecastSummary.monthlySaveNeeded)}`
          : ``,
        snapshot.forecastSummary
          ? `- Confidence range (monthly): ${formatMoney(snapshot.forecastSummary.monthlySaveLow)} to ${formatMoney(snapshot.forecastSummary.monthlySaveHigh)}`
          : ``,
        snapshot.forecastSummary
          ? `- Assumptions: execution ${snapshot.forecastSummary.assumptions.plannerExecutionPct}%, risk buffer ${snapshot.forecastSummary.assumptions.riskBufferPct}%, confidence ${snapshot.forecastSummary.assumptions.forecastConfidencePct}%`
          : ``,
        ``,
        `## 6) Action Plan`,
        `1. Focus first on top categories with over-budget variance and high spend concentration.`,
        `2. Apply planner cuts to close monthly gap toward the selected savings target.`,
        `3. Re-run this report monthly and track movement in quality score and goal gap.`,
      ].filter(Boolean);

      triggerFileDownload(
        new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8;" }),
        `budget_bestie_executive_report_${stamp}.md`
      );
      setShareNotice("Downloaded executive report (Markdown).");
    }

    function downloadSharePack() {
      const stamp = shareStamp();
      exportToCSV(expenses, `budget_bestie_all_transactions_${stamp}`);
      exportToXLSX(expenses, `budget_bestie_all_transactions_${stamp}`);
      const snapshot = buildShareSnapshot();
      triggerFileDownload(
        new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8;" }),
        `budget_bestie_report_snapshot_${stamp}.json`
      );
      const summary = [
        `${snapshot.appTitle} - Share Brief`,
        `Generated: ${snapshot.generatedAt}`,
        `Report total spend: ${formatMoney(snapshot.reportSummary.totalSpend)}`,
        `Avg monthly spend: ${formatMoney(snapshot.reportSummary.averageMonthlySpend)}`,
        `Planner projected save: ${formatMoney(snapshot.plannerSummary.projectedSave)}`,
        `Goal gap: ${snapshot.plannerSummary.target > 0 ? formatMoney(snapshot.plannerSummary.goalGap) : "No goal set"}`,
        "",
        "Prompt for ChatGPT:",
        snapshot.chatgptPrompt,
      ].join("\n");
      triggerFileDownload(
        new Blob([summary], { type: "text/plain;charset=utf-8;" }),
        `budget_bestie_chatgpt_brief_${stamp}.txt`
      );
      const executiveSnapshot = buildShareSnapshot();
      const executiveContent = [
        `# ${executiveSnapshot.appTitle} Executive Report`,
        `Generated: ${executiveSnapshot.generatedAt}`,
        `Data quality score: ${executiveSnapshot.dataQualitySummary.score.toFixed(1)} / 100`,
      ].join("\n");
      triggerFileDownload(
        new Blob([executiveContent], { type: "text/markdown;charset=utf-8;" }),
        `budget_bestie_executive_report_${stamp}.md`
      );
      setShareNotice("Downloaded full share pack (CSV, XLSX, JSON, TXT, MD).");
    }

    return (
      <div className="bb-reports-page">
        <ReportsHeader
          categories={categories}
          chartCategoryFilter={chartCategoryFilter}
          excludeInvestingSavingsFromCharts={excludeInvestingSavingsFromCharts}
          s={s}
          setChartCategoryFilter={setChartCategoryFilter}
          setExcludeInvestingSavingsFromCharts={setExcludeInvestingSavingsFromCharts}
        />
        <InteractiveFiltersCard
          onOpenRows={openInteractiveRows}
          onReset={resetInteractiveFilters}
          s={s}
          selectedCategoryName={selectedCategoryName}
          selectedMerchantName={selectedMerchantName}
          selectedMonthName={selectedMonthName}
        />
        <DataQualityCard dataQuality={dataQuality} onCleanDuplicates={removeDuplicates} s={s} />
        <BehaviorPatternsCard
          budgetVarianceRows={budgetVarianceRows}
          merchantConcentration={merchantConcentration}
          monthLabel={monthLabel}
          s={s}
          softLayer={softLayer}
          varianceMonthKey={varianceMonthKey}
          weekdayWeekendStats={weekdayWeekendStats}
        />
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Spending by Category</div>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 8 }}>
              Click a slice to filter all charts. Click again to clear.
            </div>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 8 }}>
              Mode: {excludeInvestingSavingsFromCharts ? "without investing/saving" : "with investing/saving"}.
            </div>
            {reportSpendByCategory.length === 0 ? (
              <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No spending yet.</div>
            ) : (
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportSpendByCategory.slice(0, 10)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={110}
                      onClick={(entry) => {
                        if (!entry || typeof entry !== "object" || !("categoryId" in entry)) return;
                        const categoryId =
                          typeof (entry as { categoryId?: unknown }).categoryId === "string"
                            ? (entry as { categoryId: string }).categoryId
                            : "all";
                        if (categoryId !== "all") toggleInteractiveCategory(categoryId);
                      }}
                    >
                      {reportSpendByCategory.slice(0, 10).map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.color}
                          opacity={interactiveCategoryId === "all" || interactiveCategoryId === entry.categoryId ? 1 : 0.32}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => currencyTooltip(v)} />
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ fontSize: 12, fontWeight: 700 }}
                      formatter={(value) => String(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div
            style={{
              ...s.card,
              borderRadius: 24,
              background: performanceCardStyle.cardBackground,
              border: `1px solid ${performanceCardStyle.cardBorder}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 950, marginBottom: 4 }}>Performance Chart</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Track results and watch your progress rise.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PERFORMANCE_VIEW_TABS.map((tab) => {
                  const isActive = performanceView === tab.value;
                  return (
                    <button
                      key={tab.value}
                      style={
                        isActive
                          ? {
                              ...s.btnPrimary,
                              minWidth: 72,
                              justifyContent: "center",
                              borderRadius: 14,
                              padding: "8px 12px",
                              background: performanceCardStyle.tabActiveBg,
                              border: "1px solid rgba(255,255,255,0.16)",
                            }
                          : {
                              ...s.btnSecondary,
                              minWidth: 72,
                              justifyContent: "center",
                              borderRadius: 14,
                              padding: "8px 12px",
                              background: performanceCardStyle.tabInactiveBg,
                            }
                      }
                      type="button"
                      aria-label={`${tab.label} view`}
                      aria-pressed={isActive}
                      data-performance-view={tab.value}
                      onClick={() => setPerformanceView(tab.value)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
              {performanceCardStyle.legend.map((entry) => (
                <div key={entry.label} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 760 }}>
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 4,
                      background: entry.color,
                      border: `1px solid ${PALETTE.border}`,
                    }}
                  />
                  {entry.label}
                </div>
              ))}
            </div>

            {performanceRows.length === 0 ? (
              <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No data yet.</div>
            ) : (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    height: 330,
                    borderRadius: 18,
                    overflow: "hidden",
                    background: performanceCardStyle.plotBackground,
                    border: `1px solid ${performanceCardStyle.plotBorder}`,
                    padding: 8,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart key={performanceView} data={performanceRows} margin={{ top: 10, right: 12, left: 8, bottom: 6 }}>
                      <defs>
                        <pattern id="bbPerfStripe" width="9" height="9" patternUnits="userSpaceOnUse">
                          <rect width="9" height="9" fill={performanceCardStyle.stripeFill} />
                          <line x1="1" y1="0" x2="1" y2="9" stroke={performanceCardStyle.stripeLine} strokeWidth="1.1" />
                        </pattern>
                      </defs>
                      <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: PALETTE.muted, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => performanceTickLabel(value, performanceView)}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v) => currencyTooltip(v)}
                        contentStyle={{ background: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 12 }}
                      />
                      {performanceMidLabel ? <ReferenceLine x={performanceMidLabel} stroke={PALETTE.border} strokeDasharray="4 4" /> : null}
                      <Area type="monotone" dataKey="avg" stroke="transparent" fill="url(#bbPerfStripe)" />
                      <Line type="monotone" dataKey="value" stroke={performanceCardStyle.mainLine} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="avg" stroke={performanceCardStyle.avgLine} strokeWidth={2.5} dot={false} />
                      <Brush dataKey="label" height={18} stroke="#0b0b0b" travellerWidth={10} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 74,
                    right: 16,
                    width: 120,
                    borderRadius: 16,
                    padding: "10px 12px",
                    background: performanceCardStyle.badgeBackground,
                    border: "1px solid rgba(255,255,255,0.7)",
                    boxShadow: themeMode === "dark" ? "0 12px 30px rgba(8, 20, 42, 0.45)" : "0 10px 24px rgba(180, 125, 150, 0.2)",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ fontWeight: 980, fontSize: 28, lineHeight: 1, color: performanceCardStyle.badgeText }}>{performanceBadge}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: performanceCardStyle.badgeSub, marginTop: 4 }}>Recent movement</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Monthly Summary</div>
          <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 8 }}>
            Click a bar to filter all charts to that month. Click again to clear.
          </div>
          {monthlyChartRows.length === 0 ? (
            <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No data yet.</div>
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartRows}
                  onClick={(state) => {
                    const month = state?.activeLabel;
                    if (typeof month !== "string") return;
                    toggleInteractiveMonth(month);
                  }}
                >
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: PALETTE.muted, fontSize: 12 }} />
                  <YAxis tick={{ fill: PALETTE.muted, fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => currencyTooltip(v)}
                    contentStyle={{ background: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={42}>
                    {monthlyChartRows.map((row, idx) => (
                      <Cell
                        key={row.month}
                        fill={
                          row.selected
                            ? chartTheme.bar
                            : colorWithAlpha(chartTheme.pie[idx % chartTheme.pie.length], 0.78)
                        }
                      />
                    ))}
                  </Bar>
                  <Brush dataKey="month" height={20} stroke={chartTheme.trendSoft} travellerWidth={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Savings Forecast (Interactive)</div>
          <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 10 }}>
            Choose your timeline and savings goal. This section shows how much to save each month and where to cut.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                Horizon (months)
              </div>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Horizon: {forecastMonthsAhead} month(s)</div>
              <PremiumRange
                type="range"
                min={1}
                max={60}
                step={1}
                value={forecastMonthsAhead}
                onChange={(e) => setForecastHorizonMonths(Number(e.target.value))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", gap: 8, marginTop: 8 }}>
                <button style={s.btnSecondary} onClick={() => setForecastHorizonMonths(forecastMonthsAhead - 1)}>
                  -1
                </button>
                <input
                  style={s.input}
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={forecastMonthsAhead}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    setForecastHorizonMonths(next);
                  }}
                />
                <button style={s.btnSecondary} onClick={() => setForecastHorizonMonths(forecastMonthsAhead + 1)}>
                  +1
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {[3, 6, 9, 12, 24].map((preset) => (
                  <button
                    key={preset}
                    style={forecastMonthsAhead === preset ? s.btnPrimary : s.btnSecondary}
                    onClick={() => setForecastHorizonMonths(preset)}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                Savings goal
              </div>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>{formatMoney(forecastSavingsGoal)}</div>
              <PremiumRange
                type="range"
                min={0}
                max={Math.max(maxForecastGoal, forecastSavingsGoal, 1000)}
                step={50}
                value={forecastSavingsGoal}
                onChange={(e) => setForecastSavingsGoalValue(Number(e.target.value))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", gap: 8, marginTop: 8 }}>
                <button style={s.btnSecondary} onClick={() => setForecastSavingsGoalValue(forecastSavingsGoal - 100)}>
                  -100
                </button>
                <input
                  style={s.input}
                  type="number"
                  min={0}
                  step={50}
                  value={forecastSavingsGoal}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    setForecastSavingsGoalValue(next);
                  }}
                />
                <button style={s.btnSecondary} onClick={() => setForecastSavingsGoalValue(forecastSavingsGoal + 100)}>
                  +100
                </button>
              </div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginTop: 6 }}>
                Drag this slider to move your goal up/down.
              </div>
            </div>

            <div
              style={{
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                background: softLayer(0.72, 0.89),
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 900 }}>Forecast Assumptions</div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Planner execution (% of planned cuts actually achieved)
              </div>
              <PremiumRange
                type="range"
                min={50}
                max={100}
                step={1}
                value={plannerExecutionPct}
                onChange={(e) => setPlannerExecutionPct(Number(e.target.value))}
              />
              <div style={{ fontWeight: 800, fontSize: 12 }}>{plannerExecutionPct}%</div>

              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Risk buffer (extra target for unexpected expenses)
              </div>
              <PremiumRange
                type="range"
                min={0}
                max={35}
                step={1}
                value={riskBufferPct}
                onChange={(e) => setRiskBufferPct(Number(e.target.value))}
              />
              <div style={{ fontWeight: 800, fontSize: 12 }}>{riskBufferPct}%</div>

              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Confidence level</div>
              <PremiumRange
                type="range"
                min={60}
                max={99}
                step={1}
                value={forecastConfidencePct}
                onChange={(e) => setForecastConfidencePct(Number(e.target.value))}
              />
              <div style={{ fontWeight: 800, fontSize: 12 }}>{forecastConfidencePct}%</div>

              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Manual volatility floor</div>
              <PremiumRange
                type="range"
                min={5}
                max={40}
                step={1}
                value={manualVolatilityPct}
                onChange={(e) => setManualVolatilityPct(Number(e.target.value))}
              />
              <div style={{ fontWeight: 800, fontSize: 12 }}>{manualVolatilityPct}%</div>
            </div>
          </div>

          {!forecast ? (
            <div style={{ color: PALETTE.muted, fontWeight: 650 }}>Add spending data first to build a savings forecast.</div>
          ) : (
            <>
              {forecast.isGoalTooHigh ? (
                <div style={{ marginBottom: 10, color: PALETTE.bad, fontWeight: 800 }}>
                  Goal is higher than possible for this horizon. Maximum possible is {formatMoney(forecast.maxPossibleSaveTotal)}.
                </div>
              ) : null}

              <div style={{ marginBottom: 8, fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Goal pace, your plan, gap, and dotted confidence range.
                Assumptions: execution {forecast.assumptions.plannerExecutionPct}%, risk buffer {forecast.assumptions.riskBufferPct}%,
                confidence {forecast.assumptions.forecastConfidencePct}%.
              </div>

              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.chartRows}>
                    <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: PALETTE.muted, fontSize: 12 }} />
                    <YAxis tick={{ fill: PALETTE.muted, fontSize: 12 }} />
                    <Tooltip
                      formatter={(v, name) => [currencyTooltip(v), savingsForecastSeriesLabel(String(name ?? ""))]}
                      contentStyle={{ background: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="left"
                      wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingBottom: 10 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="goalCumulative"
                      name="Goal"
                      stroke={chartTheme.goal}
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="plannerCumulative"
                      name="Your Plan"
                      stroke={chartTheme.plan}
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="gapCumulative"
                      name="Behind By"
                      stroke={chartTheme.gap}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="lowCumulative"
                      name="Confidence Low"
                      stroke={colorWithAlpha(chartTheme.band, 0.72)}
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="highCumulative"
                      name="Confidence High"
                      stroke={colorWithAlpha(chartTheme.band, 0.72)}
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 8,
                }}
              >
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>
                    Total savings target ({forecastMonthsAhead} months)
                  </div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>{formatMoney(forecast.reachableGoal)}</div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Monthly savings target</div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>{formatMoney(forecast.monthlySaveNeeded)}</div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Monthly target range</div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>
                    {formatMoney(forecast.monthlySaveLow)} - {formatMoney(forecast.monthlySaveHigh)}
                  </div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Weekly savings target</div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>{formatMoney(forecast.weeklySaveNeeded)}</div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Required spending cut</div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>{Math.round(forecast.requiredCutPercent)}%</div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Target monthly spending cap</div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>{formatMoney(forecast.monthlySpendTarget)}</div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>
                    Extra savings needed (vs current plan)
                  </div>
                  <div style={{ fontWeight: 950, marginTop: 4, color: forecast.planGap > 0 ? PALETTE.bad : PALETTE.good }}>
                    {formatMoney(forecast.planGap)}
                  </div>
                </div>
                <div style={{ ...s.card, padding: 10 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Confidence range width</div>
                  <div style={{ fontWeight: 950, marginTop: 4 }}>{Math.round(forecast.confidenceRangePct)}%</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  border: `1px solid ${PALETTE.border}`,
                  borderRadius: 14,
                  padding: 12,
                  background: softLayer(0.72, 0.89),
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 950 }}>Simple Action Steps</div>
                {forecast.monthlySaveNeeded <= 0 ? (
                  <div style={{ color: PALETTE.muted, fontWeight: 700 }}>
                    You are already on track for this goal.
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 800 }}>
                      1. Save about {formatMoney(forecast.monthlySaveNeeded)}/month ({formatMoney(forecast.weeklySaveNeeded)}/week).
                    </div>
                    <div style={{ fontWeight: 800 }}>
                      2. Keep monthly spending around {formatMoney(forecast.monthlySpendTarget)} instead of{" "}
                      {formatMoney(forecast.avgMonthlySpend)}.
                    </div>
                    <div style={{ fontWeight: 800 }}>
                      3. Suggested category cuts:
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {forecast.categoryTargets.map((target) => (
                        <div
                          key={target.categoryId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            border: `1px solid ${PALETTE.border}`,
                            borderRadius: 12,
                            padding: "8px 10px",
                            background: softLayer(0.7, 0.88),
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{target.name}</div>
                          <div style={{ fontWeight: 800 }}>
                            Cut ~{Math.max(1, Math.round(target.cutPct))}% to save {formatMoney(target.monthlySave)}/mo
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <button style={s.btnPrimary} onClick={applyForecastCoachToPlanner}>
                        Apply these cuts to Savings Planner
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 950 }}>Merchant Drilldown</div>
            <select
              style={{ ...s.select, minWidth: 180, padding: "8px 10px" }}
              value={merchantMonthGate}
              onChange={(e) => setMerchantMonthFilter(e.target.value)}
              disabled={interactiveMonth !== "all"}
            >
              <option value="all">All months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          {interactiveMonth !== "all" ? (
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 8 }}>
              Month is locked to {monthLabel(interactiveMonth)} by chart filter.
            </div>
          ) : null}
          {merchantSpend.length === 0 ? (
            <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No merchant spending data in this filter.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 8 }}>
                Click a merchant bar to cross-filter charts. Click again to clear.
              </div>
              <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={merchantChartRows}
                    layout="vertical"
                    margin={{ left: 30 }}
                  >
                    <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: PALETTE.muted, fontSize: 12 }} />
                    <YAxis dataKey="merchant" type="category" width={220} tick={{ fill: PALETTE.muted, fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => currencyTooltip(v)}
                      contentStyle={{ background: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
                    />
                    <Bar
                      dataKey="value"
                      fill={chartTheme.bar}
                      onClick={(entry) => {
                        const merchant =
                          entry && typeof entry === "object" && "merchant" in entry
                            ? (entry as { merchant?: string }).merchant
                            : undefined;
                        if (!merchant) return;
                        toggleInteractiveMerchant(merchant);
                      }}
                    >
                      {merchantChartRows.map((row, idx) => (
                        <Cell
                          key={row.merchant}
                          fill={
                            row.selected
                              ? chartTheme.bar
                              : colorWithAlpha(chartTheme.pie[idx % chartTheme.pie.length], 0.78)
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <SavingsPotentialCard s={s} savingsPotential={savingsPotential} softLayer={softLayer} />
        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Savings Goal Planner (Interactive)</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Savings target
                </div>
                <input
                  style={s.input}
                  value={savingsTargetInput}
                  onChange={(e) => setSavingsTargetInput(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Planner month
                </div>
                <select
                  style={{ ...s.select, padding: "10px 12px" }}
                  value={plannerMonthFilter}
                  onChange={(e) => setPlannerMonthFilter(e.target.value)}
                >
                  <option value="all">All months</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btnSecondary} onClick={() => setAllCuts(5)}>Set all 5%</button>
                <button style={s.btnSecondary} onClick={() => setAllCuts(10)}>Set all 10%</button>
                <button style={s.btnSecondary} onClick={() => setAllCuts(15)}>Set all 15%</button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  I can cut (comma separated)
                </div>
                <input
                  style={s.input}
                  value={canCutText}
                  onChange={(e) => setCanCutText(e.target.value)}
                  placeholder="dining, shopping, subscriptions"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  I cannot cut (comma separated)
                </div>
                <input
                  style={s.input}
                  value={cannotCutText}
                  onChange={(e) => setCannotCutText(e.target.value)}
                  placeholder="rent, insurance, groceries"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={s.btnSecondary} onClick={applyConstraintsFromText}>
                Apply Can/Cannot Cut
              </button>
              <button style={s.btnPrimary} onClick={generateSavingsPlan}>
                Generate Plan
              </button>
            </div>
            {planNotice ? (
              <div style={{ color: PALETTE.good, fontWeight: 800, fontSize: 12 }}>
                {planNotice}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 8,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                padding: 10,
                background: softLayer(0.7, 0.88),
              }}
            >
              <div style={{ fontWeight: 850 }}>Current spend: {formatMoney(plannerTotals.baseline)}</div>
              <div style={{ fontWeight: 850 }}>Projected save: {formatMoney(plannerTotals.save)}</div>
              <div style={{ fontWeight: 850 }}>Spend after cuts: {formatMoney(plannerTotals.spendAfterCuts)}</div>
              <div style={{ fontWeight: 850 }}>
                Goal gap: {plannerTotals.target > 0 ? formatMoney(plannerTotals.gap) : "Set target"}
              </div>
            </div>

            {plannerRows.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {plannerRows.map((row) => (
                  <div
                    key={row.categoryId}
                    style={{
                      border: `1px solid ${PALETTE.border}`,
                      borderRadius: 14,
                      padding: 10,
                      background: softLayer(0.75, 0.9),
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{row.name}</div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(lockedCategories[row.categoryId])}
                          onChange={(e) =>
                            setLockedCategories((prev) => ({
                              ...prev,
                              [row.categoryId]: e.target.checked,
                            }))
                          }
                        />
                        cannot cut
                      </label>
                    </div>

                    <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                      Baseline {formatMoney(row.baseline)} • Save {formatMoney(row.projectedSave)} • After cut{" "}
                      {formatMoney(row.projectedSpend)}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: 10, alignItems: "center" }}>
                      <PremiumRange
                        type="range"
                        min={0}
                        max={60}
                        step={1}
                        value={Math.round(row.effectiveCutPct)}
                        disabled={Boolean(lockedCategories[row.categoryId])}
                        onChange={(e) =>
                          setCategoryCutPercents((prev) => ({
                            ...prev,
                            [row.categoryId]: Number(e.target.value),
                          }))
                        }
                      />
                      <input
                        style={s.input}
                        value={Math.round(row.effectiveCutPct)}
                        disabled={Boolean(lockedCategories[row.categoryId])}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setCategoryCutPercents((prev) => ({
                            ...prev,
                            [row.categoryId]: Math.max(0, Math.min(100, n)),
                          }));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: PALETTE.muted, fontWeight: 650 }}>Add data to run the savings planner.</div>
            )}

            {planReply ? (
              <div
                ref={planReplyRef}
                style={{
                  border: `1px solid ${PALETTE.border}`,
                  borderRadius: 14,
                  padding: 12,
                  background: softLayer(0.72, 0.89),
                  fontWeight: 700,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                }}
              >
                {planReply}
              </div>
            ) : null}
          </div>
        </div>

        <KpiDictionaryCard s={s} />

        <ShareDownloadCard
          copyForChatGpt={copyForChatGpt}
          copyReportSnapshotJson={copyReportSnapshotJson}
          downloadChatGptBrief={downloadChatGptBrief}
          downloadExecutiveReport={downloadExecutiveReport}
          downloadReportSnapshotJSON={downloadReportSnapshotJSON}
          downloadSharePack={downloadSharePack}
          s={s}
          shareNotice={shareNotice}
        />
      </div>
    );
  }
