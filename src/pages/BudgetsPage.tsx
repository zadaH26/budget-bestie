import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { PALETTE,  colorWithAlpha, formatMoney, toISODate, uid } from "../app/appCore";
import type { Period } from "../app/appCore";
import { useBudgetBestie } from "../app/BudgetBestieContext";
import { PageTitle } from "../app/uiComponents";

export function BudgetsPage() {
  const {
    budgets,
    catById,
    categories,
    filteredExpenses,
    getWeekNumber,
    s,
    setBudgets,
    softLayer,
  } = useBudgetBestie();

    const [catId, setCatId] = useState("cat_dining");
    const [amount, setAmount] = useState("300");
    const [period, setPeriod] = useState<Period>("monthly");
    const [budgetNotice, setBudgetNotice] = useState("");
    const [monthlyBudgetView, setMonthlyBudgetView] = useState("latest");

    const currentMonthKey = toISODate(new Date()).slice(0, 7);
    const monthKeysWithExpenses = useMemo(() => {
      return [...new Set(filteredExpenses.filter((e) => e.amount < 0).map((e) => e.date.slice(0, 7)))].sort((a, b) =>
        b.localeCompare(a)
      );
    }, [filteredExpenses]);
    const latestMonthKey = monthKeysWithExpenses[0] ?? currentMonthKey;
    const selectedMonthlyViewKey = monthlyBudgetView === "latest" ? latestMonthKey : monthlyBudgetView;

    function monthLabelLocal(monthKey: string) {
      const m = monthKey.match(/^(\d{4})-(\d{2})$/);
      if (!m) return monthKey;
      const year = Number(m[1]);
      const month = Number(m[2]);
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
    }

    const budgetProgress = useMemo(() => {
      const now = new Date();
      const nowYear = now.getFullYear();
      const nowWeek = getWeekNumber(now);

      return budgets.map((b) => {
        let spent = 0;
        for (const e of filteredExpenses) {
          if (e.amount >= 0 || e.categoryId !== b.categoryId) continue;
          const d = new Date(e.date + "T00:00:00");
          if (Number.isNaN(d.getTime())) continue;

          let inCurrentWindow = false;
          if (b.period === "monthly") inCurrentWindow = e.date.slice(0, 7) === selectedMonthlyViewKey;
          else if (b.period === "yearly") inCurrentWindow = d.getFullYear() === nowYear;
          else inCurrentWindow = d.getFullYear() === nowYear && getWeekNumber(d) === nowWeek;

          if (inCurrentWindow) spent += Math.abs(e.amount);
        }

        const remaining = Math.max(0, b.amount - spent);
        const over = Math.max(0, spent - b.amount);
        const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
        const status: "ok" | "near" | "over" = over > 0 ? "over" : pct >= 90 ? "near" : "ok";
        return { budget: b, spent, remaining, over, pct, status };
      });
    }, [budgets, filteredExpenses, getWeekNumber, selectedMonthlyViewKey]);

    function setBudget() {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return alert("Enter a valid budget amount");
      let updated = false;
      setBudgets((prev) => {
        const existing = prev.find((b) => b.categoryId === catId && b.period === period);
        if (existing) {
          updated = true;
          return prev.map((b) => (b.id === existing.id ? { ...b, amount: n } : b));
        }
        return [{ id: uid("bud"), categoryId: catId, amount: n, period }, ...prev];
      });
      const catName = catById.get(catId)?.name ?? "Category";
      setBudgetNotice(`${updated ? "Updated" : "Added"} ${catName} (${period}) budget: ${formatMoney(n)}.`);
      setAmount("");
    }

    return (
      <div>
        <PageTitle title="Budgets" subtitle="Set caps. Dashboard + Reports update automatically." />
        <div style={s.card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <select style={s.select} value={catId} onChange={(e) => setCatId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ?? "✨"} {c.name}
                </option>
              ))}
            </select>
            <input style={s.input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="300" />
            <select style={s.select} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
            <button style={s.btnPrimary} onClick={setBudget}>
              Set Budget
            </button>
          </div>
          {budgetNotice ? (
            <div style={{ marginTop: 10, color: PALETTE.good, fontWeight: 800, fontSize: 12 }}>
              {budgetNotice}
            </div>
          ) : null}
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Monthly budget view</div>
            <select
              style={{ ...s.select, maxWidth: 320 }}
              value={monthlyBudgetView}
              onChange={(e) => setMonthlyBudgetView(e.target.value)}
            >
              <option value="latest">Latest month with data ({monthLabelLocal(latestMonthKey)})</option>
              <option value={currentMonthKey}>Current month ({monthLabelLocal(currentMonthKey)})</option>
              {monthKeysWithExpenses
                .filter((month) => month !== currentMonthKey)
                .map((month) => (
                  <option key={month} value={month}>
                    {monthLabelLocal(month)}
                  </option>
                ))}
            </select>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
              Monthly budgets below are currently calculated using {monthLabelLocal(selectedMonthlyViewKey)}.
            </div>
          </div>
          <div style={{ marginTop: 8, color: PALETTE.muted, fontWeight: 700, fontSize: 12 }}>
            You will see progress below right away. Monthly budgets also drive Dashboard alerts.
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Your Budgets</div>
          {budgetProgress.length === 0 ? (
            <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No budgets yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {budgetProgress.map((row) => (
                <div
                  key={row.budget.id}
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    border: `1px solid ${PALETTE.border}`,
                    background: softLayer(0.75, 0.9),
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>
                      {catById.get(row.budget.categoryId)?.name ?? "Category"} • {row.budget.period}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 950 }}>{formatMoney(row.budget.amount)}</div>
                      <button
                        style={s.iconBtn}
                        onClick={() => {
                          setBudgets((p) => p.filter((x) => x.id !== row.budget.id));
                          setBudgetNotice("Budget deleted.");
                        }}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>
                    Spent: {formatMoney(row.spent)} • Remaining: {formatMoney(row.remaining)} • Over: {formatMoney(row.over)}
                  </div>
                  {row.spent === 0 ? (
                    <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                      No expenses found for this category in the selected budget window.
                    </div>
                  ) : null}
                  <div style={{ height: 10, borderRadius: 999, background: colorWithAlpha(PALETTE.accent, 0.15), overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${row.pct}%`,
                        height: "100%",
                        background: row.status === "over" ? PALETTE.bad : row.status === "near" ? "#f59e0b" : PALETTE.good,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: row.status === "over" ? PALETTE.bad : row.status === "near" ? "#b45309" : PALETTE.good,
                    }}
                  >
                    {row.status === "over"
                      ? "Over budget"
                      : row.status === "near"
                        ? "Near budget limit"
                        : "Within budget"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
