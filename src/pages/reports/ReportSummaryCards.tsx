import type React from "react";
import { Filter } from "lucide-react";
import type { Category } from "../../app/appCore";
import { PALETTE, colorWithAlpha, formatMoney } from "../../app/appCore";
import { PageTitle } from "../../app/uiComponents";

type Styles = Record<string, React.CSSProperties>;
type SoftLayer = (lightAlpha: number, darkAlpha?: number) => string;

type DataQualitySummary = {
  totalRows: number;
  duplicateCandidateCount: number;
  signAnomalyCount: number;
  missingFieldCount: number;
  invalidDateCount: number;
  uncategorizedCount: number;
  score: number;
  grade: string;
};

type WeekdayWeekendStats = {
  weekendAvg: number;
  weekdayAvg: number;
  weekendLiftPct: number;
};

type MerchantConcentration = {
  top1SharePct: number;
  top5SharePct: number;
  hhi: number;
};

type BudgetVarianceRow = {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  actual: number;
  variance: number;
  variancePct: number;
};

type SavingsPotential = {
  top: Array<{ categoryId: string; name: string; value: number }>;
  potential: number;
};

export function ReportsHeader({
  categories,
  chartCategoryFilter,
  excludeInvestingSavingsFromCharts,
  s,
  setChartCategoryFilter,
  setExcludeInvestingSavingsFromCharts,
}: {
  categories: Category[];
  chartCategoryFilter: string;
  excludeInvestingSavingsFromCharts: boolean;
  s: Styles;
  setChartCategoryFilter: (categoryId: string) => void;
  setExcludeInvestingSavingsFromCharts: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <PageTitle
      title="Reports"
      subtitle="Pie + trends + weekly/monthly summaries."
      right={
        <div
          className="bb-reports-header-controls"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}
        >
          <button
            style={excludeInvestingSavingsFromCharts ? s.btnPrimary : s.btnSecondary}
            onClick={() => setExcludeInvestingSavingsFromCharts((prev) => !prev)}
            type="button"
          >
            {excludeInvestingSavingsFromCharts ? "Without investing/saving" : "With investing/saving"}
          </button>
          <Filter size={15} />
          <select
            style={{ ...s.select, minWidth: 180, padding: "8px 10px" }}
            value={chartCategoryFilter}
            onChange={(e) => setChartCategoryFilter(e.target.value)}
          >
            <option value="all">All chart categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon ?? "✨"} {category.name}
              </option>
            ))}
          </select>
        </div>
      }
    />
  );
}

export function InteractiveFiltersCard({
  onOpenRows,
  onReset,
  s,
  selectedCategoryName,
  selectedMerchantName,
  selectedMonthName,
}: {
  onOpenRows: () => void;
  onReset: () => void;
  s: Styles;
  selectedCategoryName: string;
  selectedMerchantName: string;
  selectedMonthName: string;
}) {
  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 950 }}>Interactive Cross-Filter</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={s.btnSecondary} onClick={onReset}>
            Reset chart filters
          </button>
          <button style={s.btnPrimary} onClick={onOpenRows}>
            Open filtered transactions
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ ...s.btnSecondary, cursor: "default" }}>Category: {selectedCategoryName}</span>
        <span style={{ ...s.btnSecondary, cursor: "default" }}>Month: {selectedMonthName}</span>
        <span style={{ ...s.btnSecondary, cursor: "default", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>
          Merchant: {selectedMerchantName}
        </span>
      </div>
      <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginTop: 8 }}>
        Click chart elements to filter all visuals, like a Power BI cross-filter.
      </div>
    </div>
  );
}

export function DataQualityCard({
  dataQuality,
  onCleanDuplicates,
  s,
}: {
  dataQuality: DataQualitySummary;
  onCleanDuplicates: () => void;
  s: Styles;
}) {
  const metricCards = [
    { label: "Rows scanned", value: dataQuality.totalRows },
    {
      label: "Duplicate candidates",
      value: dataQuality.duplicateCandidateCount,
      color: dataQuality.duplicateCandidateCount > 0 ? PALETTE.bad : PALETTE.good,
    },
    {
      label: "Sign anomalies",
      value: dataQuality.signAnomalyCount,
      color: dataQuality.signAnomalyCount > 0 ? PALETTE.bad : PALETTE.good,
    },
    { label: "Missing fields", value: dataQuality.missingFieldCount },
    { label: "Invalid dates", value: dataQuality.invalidDateCount },
    { label: "Unknown categories", value: dataQuality.uncategorizedCount },
  ];

  return (
    <div style={{ ...s.card, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 950 }}>Data Quality Monitor</div>
          <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Analyst checks on current filter window.</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontWeight: 980, fontSize: 24 }}>{dataQuality.score.toFixed(1)}</div>
          <div style={{ fontWeight: 900, color: PALETTE.muted }}>/ 100 ({dataQuality.grade})</div>
        </div>
      </div>
      <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: colorWithAlpha(PALETTE.accent, 0.14), overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, dataQuality.score))}%`,
            height: "100%",
            background: dataQuality.score >= 82 ? PALETTE.good : dataQuality.score >= 70 ? PALETTE.warn : PALETTE.bad,
          }}
        />
      </div>
      <div style={{ ...s.grid3, marginTop: 10 }}>
        {metricCards.map((metric) => (
          <div key={metric.label} style={{ ...s.card, padding: 10 }}>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>{metric.label}</div>
            <div style={{ fontWeight: 950, marginTop: 4, color: metric.color }}>{metric.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button style={s.btnSecondary} onClick={onCleanDuplicates}>
          Clean duplicates now
        </button>
      </div>
    </div>
  );
}

export function BehaviorPatternsCard({
  budgetVarianceRows,
  merchantConcentration,
  monthLabel,
  s,
  softLayer,
  varianceMonthKey,
  weekdayWeekendStats,
}: {
  budgetVarianceRows: BudgetVarianceRow[];
  merchantConcentration: MerchantConcentration;
  monthLabel: (monthKey: string) => string;
  s: Styles;
  softLayer: SoftLayer;
  varianceMonthKey: string;
  weekdayWeekendStats: WeekdayWeekendStats;
}) {
  const metrics = [
    { label: "Weekend avg spend/txn", value: formatMoney(weekdayWeekendStats.weekendAvg) },
    { label: "Weekday avg spend/txn", value: formatMoney(weekdayWeekendStats.weekdayAvg) },
    {
      label: "Weekend lift",
      value: `${Math.round(weekdayWeekendStats.weekendLiftPct)}%`,
      color: weekdayWeekendStats.weekendLiftPct > 0 ? PALETTE.warn : PALETTE.good,
    },
    { label: "Top 1 merchant share", value: `${Math.round(merchantConcentration.top1SharePct)}%` },
    { label: "Top 5 merchant share", value: `${Math.round(merchantConcentration.top5SharePct)}%` },
    { label: "Merchant concentration (HHI)", value: Math.round(merchantConcentration.hhi) },
  ];

  return (
    <div style={{ ...s.card, marginTop: 16 }}>
      <div style={{ fontWeight: 950, marginBottom: 8 }}>Behavior Patterns & Variance</div>
      <div style={s.grid3}>
        {metrics.map((metric) => (
          <div key={metric.label} style={{ ...s.card, padding: 10 }}>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>{metric.label}</div>
            <div style={{ fontWeight: 950, marginTop: 4, color: metric.color }}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontWeight: 900 }}>Monthly budget variance ({monthLabel(varianceMonthKey)})</div>
      {budgetVarianceRows.length === 0 ? (
        <div style={{ marginTop: 8, color: PALETTE.muted, fontWeight: 650 }}>
          No monthly budgets set. Add monthly budgets to unlock variance analysis.
        </div>
      ) : (
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {budgetVarianceRows.slice(0, 8).map((row) => (
            <div
              key={row.categoryId}
              className="bb-report-variance-row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1fr) 120px 120px 120px 110px",
                gap: 8,
                padding: "8px 10px",
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 12,
                background: softLayer(0.72, 0.89),
                alignItems: "center",
                fontSize: 12.5,
                fontWeight: 800,
              }}
            >
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.categoryName}</div>
              <div>Budget {formatMoney(row.budgetAmount)}</div>
              <div>Actual {formatMoney(row.actual)}</div>
              <div style={{ color: row.variance > 0 ? PALETTE.bad : PALETTE.good }}>Var {formatMoney(row.variance)}</div>
              <div style={{ color: row.variance > 0 ? PALETTE.bad : PALETTE.good }}>{Math.round(row.variancePct)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SavingsPotentialCard({
  s,
  savingsPotential,
  softLayer,
}: {
  s: Styles;
  savingsPotential: SavingsPotential;
  softLayer: SoftLayer;
}) {
  return (
    <div style={{ ...s.card, marginTop: 16 }}>
      <div style={{ fontWeight: 950, marginBottom: 6 }}>Savings Potential</div>
      {savingsPotential.top.length === 0 ? (
        <div style={{ color: PALETTE.muted, fontWeight: 650 }}>Add expenses to see suggestions.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 850, color: PALETTE.muted }}>
            If you reduce the top categories by ~10%, you could save:
          </div>
          <div style={{ fontWeight: 980, fontSize: 20 }}>{formatMoney(savingsPotential.potential)}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {savingsPotential.top.map((category) => (
              <div
                key={category.categoryId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: 18,
                  border: `1px solid ${PALETTE.border}`,
                  background: softLayer(0.75, 0.9),
                }}
              >
                <div style={{ fontWeight: 900 }}>{category.name}</div>
                <div style={{ fontWeight: 900 }}>Save ~ {formatMoney(category.value * 0.1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function KpiDictionaryCard({ s }: { s: Styles }) {
  return (
    <div style={{ ...s.card, marginTop: 16 }}>
      <div style={{ fontWeight: 950, marginBottom: 8 }}>KPI Quick Dictionary</div>
      <div style={{ display: "grid", gap: 8, fontSize: 12.5 }}>
        <div><strong>Total Spending:</strong> Sum of all expense transactions in the active filters.</div>
        <div><strong>Total Income:</strong> Positive transactions tagged as Income (payroll/deposits).</div>
        <div><strong>Credits & Refunds:</strong> Positive transactions not tagged as Income.</div>
        <div><strong>Net:</strong> Income + Credits - Spending.</div>
        <div><strong>Goal Gap:</strong> Remaining amount needed to hit your savings target.</div>
        <div><strong>Quality Score:</strong> Composite score from duplicate, sign, and missing-data checks.</div>
      </div>
    </div>
  );
}

export function ShareDownloadCard({
  copyForChatGpt,
  copyReportSnapshotJson,
  downloadChatGptBrief,
  downloadExecutiveReport,
  downloadReportSnapshotJSON,
  downloadSharePack,
  s,
  shareNotice,
}: {
  copyForChatGpt: () => Promise<void>;
  copyReportSnapshotJson: () => Promise<void>;
  downloadChatGptBrief: () => void;
  downloadExecutiveReport: () => void;
  downloadReportSnapshotJSON: () => void;
  downloadSharePack: () => void;
  s: Styles;
  shareNotice: string;
}) {
  return (
    <div style={{ ...s.card, marginTop: 16 }}>
      <div style={{ fontWeight: 950, marginBottom: 8 }}>Share & Download</div>
      <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 10 }}>
        Download your transactions and report snapshot so you can share or upload to ChatGPT for guidance.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={s.btnPrimary} onClick={downloadSharePack}>
          Download full share pack
        </button>
        <button style={s.btnPrimary} onClick={() => void copyForChatGpt()}>
          Copy for ChatGPT
        </button>
        <button style={s.btnSecondary} onClick={downloadExecutiveReport}>
          Download executive report
        </button>
        <button style={s.btnSecondary} onClick={() => void copyReportSnapshotJson()}>
          Copy report JSON
        </button>
        <button style={s.btnSecondary} onClick={downloadReportSnapshotJSON}>
          Download report JSON
        </button>
        <button style={s.btnSecondary} onClick={downloadChatGptBrief}>
          Download ChatGPT brief
        </button>
      </div>
      {shareNotice ? (
        <div style={{ color: PALETTE.good, fontWeight: 800, fontSize: 12, marginTop: 8 }}>{shareNotice}</div>
      ) : null}
    </div>
  );
}
