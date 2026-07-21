import { useEffect, useState } from "react";
import { AlertTriangle, Filter, PiggyBank } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PALETTE,  colorWithAlpha, currencyTooltip, formatMoney, isInvestingOrSavingsTransaction } from "../app/appCore";
import { useBudgetBestie } from "../app/BudgetBestieContext";
import { PageTitle } from "../app/uiComponents";

export function DashboardPage() {
  const {
    advisorAlerts,
    budgets,
    catById,
    categories,
    chartCategoryFilter,
    chartTheme,
    excludeCCPayFromCharts,
    excludeInvestingSavingsFromCharts,
    excludeTransfersFromCharts,
    filteredExpenses,
    nav,
    openExpensesWithFilters,
    s,
    savingsTrackerGoal,
    savingsTrackerSaved,
    setChartCategoryFilter,
    setExcludeCCPayFromCharts,
    setExcludeInvestingSavingsFromCharts,
    setExcludeTransfersFromCharts,
    setSavingsTrackerGoal,
    setSavingsTrackerSaved,
    softLayer,
    spendByCategory,
    themeMode,
    totals,
  } = useBudgetBestie();

    const totalBudgetLimit = budgets
      .filter((b) => b.period === "monthly")
      .reduce((sum, b) => sum + Math.max(0, b.amount), 0);
    const budgetUsagePct = totalBudgetLimit > 0 ? Math.min(100, (totals.spent / totalBudgetLimit) * 100) : 0;
    const savedAmount = filteredExpenses
      .filter((e) => e.amount < 0 && isInvestingOrSavingsTransaction(e))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const trackerGoal = Math.max(0, savingsTrackerGoal);
    const trackerSaved = Math.max(0, savingsTrackerSaved);
    const savingsProgressPct = trackerGoal > 0 ? Math.min(100, (trackerSaved / trackerGoal) * 100) : 0;
    const trackerLeft = Math.max(0, trackerGoal - trackerSaved);
    const savingsGoalName = "Savings Goal";
    const recentActivity = filteredExpenses
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, 3);
    const [goalInput, setGoalInput] = useState(() => String(Math.round(trackerGoal)));
    const [addInput, setAddInput] = useState("");
    const [savingsHint, setSavingsHint] = useState("");

    useEffect(() => {
      setGoalInput(String(Math.round(Math.max(0, trackerGoal))));
    }, [trackerGoal]);

    function parseSavingsTrackerInput(raw: string) {
      const normalized = raw.replace(/[^0-9.]/g, "");
      const n = Number(normalized);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, n);
    }

    function saveSavingsGoal() {
      const nextGoal = parseSavingsTrackerInput(goalInput);
      setSavingsTrackerGoal(nextGoal);
      setSavingsHint(`Goal saved: ${formatMoney(nextGoal)}`);
    }

    function addToSavingsTracker() {
      const add = parseSavingsTrackerInput(addInput);
      if (add <= 0) {
        setSavingsHint("Enter an amount first, then tap Add amount.");
        return;
      }
      setSavingsTrackerSaved((prev) => Math.max(0, prev + add));
      setAddInput("");
      setSavingsHint(`Added ${formatMoney(add)} to saved amount.`);
    }

    function useFromSavingsTracker() {
      const used = parseSavingsTrackerInput(addInput);
      if (used <= 0) {
        setSavingsHint("Enter an amount first, then tap Subtract amount.");
        return;
      }
      setSavingsTrackerSaved((prev) => Math.max(0, prev - used));
      setAddInput("");
      setSavingsHint(`Subtracted ${formatMoney(used)} from saved amount.`);
    }

    function resetSavingsTracker() {
      setSavingsTrackerSaved(0);
      setAddInput("");
      setSavingsHint("Saved amount reset to $0.00.");
    }

    const metricCards = [
      { label: "Total Spending", value: formatMoney(totals.spent) },
      { label: "Total Income (pay/deposits)", value: formatMoney(totals.income) },
      { label: "Credits & Refunds", value: formatMoney(totals.credits) },
      { label: "Net", value: formatMoney(totals.net) },
    ];

    return (
      <div className="bb-dashboard-page">
        <PageTitle
          title="Dashboard"
          subtitle="Totals + advisor + charts (filtered)."
          right={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 12, color: PALETTE.muted }}>
                <input
                  type="checkbox"
                  checked={excludeTransfersFromCharts}
                  onChange={(e) => setExcludeTransfersFromCharts(e.target.checked)}
                />
                Exclude transfers
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 12, color: PALETTE.muted }}>
                <input
                  type="checkbox"
                  checked={excludeCCPayFromCharts}
                  onChange={(e) => setExcludeCCPayFromCharts(e.target.checked)}
                />
                Exclude CC payments
              </label>
              <button
                style={excludeInvestingSavingsFromCharts ? s.btnPrimary : s.btnSecondary}
                onClick={() => setExcludeInvestingSavingsFromCharts((prev) => !prev)}
                type="button"
              >
                {excludeInvestingSavingsFromCharts ? "Without investing/saving" : "With investing/saving"}
              </button>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Filter size={15} />
                <select
                  style={{ ...s.select, minWidth: 180, padding: "8px 10px" }}
                  value={chartCategoryFilter}
                  onChange={(e) => setChartCategoryFilter(e.target.value)}
                >
                  <option value="all">All chart categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ?? "✨"} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
        />

        <div className="bb-mobile-overview-card" style={{ ...s.card, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 850, letterSpacing: 0.35, color: colorWithAlpha(PALETTE.text, 0.76) }}>
            TOTAL BALANCE
          </div>
          <div style={{ fontSize: 40, fontWeight: 980, marginTop: 4 }}>{formatMoney(totals.net)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <div style={{ ...s.card, padding: 10, background: colorWithAlpha(PALETTE.good, 0.12) }}>
              <div style={{ fontSize: 12, fontWeight: 820, color: PALETTE.muted }}>Income</div>
              <div style={{ marginTop: 4, fontSize: 23, fontWeight: 960, color: PALETTE.good }}>{formatMoney(totals.income)}</div>
            </div>
            <div style={{ ...s.card, padding: 10, background: colorWithAlpha(PALETTE.bad, 0.09) }}>
              <div style={{ fontSize: 12, fontWeight: 820, color: PALETTE.muted }}>Expenses</div>
              <div style={{ marginTop: 4, fontSize: 23, fontWeight: 960 }}>{formatMoney(totals.spent)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: 850 }}>
              <span>Saved / Invested</span>
              <span>{formatMoney(savedAmount)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: colorWithAlpha(PALETTE.accent, 0.18), overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, budgetUsagePct))}%`,
                  background: PALETTE.accent,
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: PALETTE.muted, fontWeight: 780 }}>
              <span>Budget used {Math.round(budgetUsagePct)}%</span>
              <span>Budget limit {totalBudgetLimit > 0 ? formatMoney(totalBudgetLimit) : "Not set"}</span>
            </div>
          </div>
        </div>

        <div className="bb-mobile-smooth-stack">
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 930, fontSize: 16 }}>Recent Activity</div>
              <button style={{ ...s.btnSecondary, padding: "7px 11px", fontSize: 12 }} onClick={() => nav("/expenses")}>
                See all
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {recentActivity.length === 0 ? (
                <div className="bb-mobile-soft-card" style={{ color: PALETTE.muted, fontWeight: 700 }}>
                  Add transactions to see recent activity.
                </div>
              ) : (
                recentActivity.map((tx) => {
                  const category = catById.get(tx.categoryId);
                  return (
                    <div key={tx.id} className="bb-mobile-activity-row">
                      <div className="bb-mobile-activity-icon">{category?.icon ?? "✨"}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.notes}</div>
                        <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                          {category?.name ?? "Other"} • {tx.date}
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, color: tx.amount > 0 ? PALETTE.good : PALETTE.text }}>
                        {tx.amount > 0 ? "+" : "-"}
                        {formatMoney(Math.abs(tx.amount))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bb-mobile-savings-grid">
            <div className="bb-mobile-soft-card bb-mobile-goal-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div className="bb-mobile-goal-icon">
                  <PiggyBank size={18} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: PALETTE.muted }}>SAVINGS TRACKER</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: PALETTE.muted }}>{savingsGoalName}</div>
              <div style={{ marginTop: 4, fontSize: 31, fontWeight: 980 }}>{formatMoney(trackerSaved)}</div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Saved of {formatMoney(trackerGoal)}
              </div>
              <div className="bb-mobile-progress-track" style={{ marginTop: 8 }}>
                <div className="bb-mobile-progress-fill" style={{ width: `${Math.max(0, Math.min(100, savingsProgressPct))}%` }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 850 }}>
                {formatMoney(trackerLeft)} left
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, color: PALETTE.muted, fontWeight: 800 }}>
                  Set your target, type an amount, then add or subtract.
                </div>
                <div className="bb-savings-inputs">
                  <input
                    style={{ ...s.input, fontSize: 12, padding: "8px 10px" }}
                    type="text"
                    inputMode="decimal"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="Goal target"
                  />
                  <input
                    style={{ ...s.input, fontSize: 12, padding: "8px 10px" }}
                    type="text"
                    inputMode="decimal"
                    value={addInput}
                    onChange={(e) => setAddInput(e.target.value)}
                    placeholder="Amount (+/-)"
                  />
                </div>
                <div className="bb-savings-buttons">
                  <button style={{ ...s.btnSecondary, justifyContent: "center", padding: "9px 10px", fontSize: 12 }} onClick={saveSavingsGoal}>
                    Set Goal Target
                  </button>
                  <button style={{ ...s.btnPrimary, justifyContent: "center", padding: "9px 10px", fontSize: 12 }} onClick={addToSavingsTracker}>
                    Add Amount
                  </button>
                  <button
                    style={{ ...s.btnSecondary, justifyContent: "center", padding: "9px 10px", fontSize: 12 }}
                    onClick={useFromSavingsTracker}
                  >
                    Subtract Amount
                  </button>
                  <button
                    style={{ ...s.btnSecondary, justifyContent: "center", padding: "9px 10px", fontSize: 12 }}
                    onClick={resetSavingsTracker}
                  >
                    Reset Saved
                  </button>
                </div>
                {savingsHint ? <div style={{ fontSize: 11, color: PALETTE.muted, fontWeight: 800 }}>{savingsHint}</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...s.grid3, marginTop: 4 }}>
          {metricCards.map((card, idx) => (
            <div
              key={card.label}
              style={{
                ...s.card,
                background: `linear-gradient(160deg, ${colorWithAlpha(chartTheme.pie[idx % chartTheme.pie.length], 0.22)} 0%, ${colorWithAlpha(PALETTE.card, themeMode === "dark" ? 0.96 : 0.95)} 72%)`,
                borderColor: colorWithAlpha(chartTheme.pie[idx % chartTheme.pie.length], 0.4),
              }}
            >
              <div style={{ fontWeight: 900, color: PALETTE.muted }}>{card.label}</div>
              <div style={{ fontWeight: 980, fontSize: 22, marginTop: 10 }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950 }}>Adaptive Spending Advisor</div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 650, marginTop: 4 }}>
                Budget usage + weekly spikes (based on filtered range).
              </div>
            </div>
            <AlertTriangle size={18} />
          </div>

          {advisorAlerts.length === 0 ? (
            <div style={{ marginTop: 12, color: PALETTE.muted, fontWeight: 650 }}>
              No alerts yet. Add transactions and budgets.
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {advisorAlerts.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    border: `1px solid ${PALETTE.border}`,
                    background: softLayer(0.75, 0.9),
                    borderLeft: a.type === "warn" ? `6px solid ${PALETTE.warn}` : `6px solid ${PALETTE.accent}`,
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {a.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...s.grid2, marginTop: 16 }}>
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Spending by Category (Pie)</div>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 8 }}>
              Click a slice to open matching transactions.
            </div>
            {spendByCategory.length === 0 ? (
              <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No spending in this date range yet.</div>
            ) : (
              <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spendByCategory.slice(0, 10)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={110}
                      onClick={(entry) => {
                        if (!entry || typeof entry !== "object" || !("categoryId" in entry)) return;
                        const categoryId =
                          typeof (entry as { categoryId?: unknown }).categoryId === "string"
                            ? (entry as { categoryId: string }).categoryId
                            : "all";
                        openExpensesWithFilters({ categoryId });
                      }}
                    >
                      {spendByCategory.slice(0, 10).map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
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

          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Top Categories</div>
            {spendByCategory.length === 0 ? (
              <div style={{ color: PALETTE.muted, fontWeight: 650 }}>Nothing yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {spendByCategory.slice(0, 6).map((c) => (
                  <div
                    key={c.categoryId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: 12,
                      borderRadius: 18,
                      border: `1px solid ${colorWithAlpha(c.color, 0.42)}`,
                      borderLeft: `6px solid ${c.color}`,
                      background: `linear-gradient(150deg, ${colorWithAlpha(c.color, 0.17)} 0%, ${softLayer(0.8, 0.9)} 72%)`,
                      cursor: "pointer",
                    }}
                    onClick={() => openExpensesWithFilters({ categoryId: c.categoryId })}
                    title="Go to Expenses to filter"
                  >
                    <div style={{ fontWeight: 900 }}>{c.name}</div>
                    <div style={{ fontWeight: 950 }}>{formatMoney(c.value)}</div>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 650 }}>
                  Tip: filter by category on the Expenses page to see details + totals.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
