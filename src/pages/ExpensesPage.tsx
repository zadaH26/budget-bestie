/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, Download, Filter, Repeat, Trash2, X } from "lucide-react";
import { PALETTE,  formatMoney, parseDateFlexible, transactionNameKey } from "../app/appCore";
import type { Expense } from "../app/appCore";
import { useBudgetBestie } from "../app/BudgetBestieContext";
import { PageTitle } from "../app/uiComponents";

export function ExpensesPage() {
  const {
    catById,
    categories,
    dateFrom,
    dateTo,
    expenses,
    exportToCSV,
    exportToXLSX,
    filteredExpenses,
    s,
    setDateFrom,
    setDateTo,
    setExpenses,
    setLearnedCategoryRules,
    softLayer,
  } = useBudgetBestie();

    const location = useLocation();
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<{ notes: string; date: string; amount: string }>({
      notes: "",
      date: "",
      amount: "",
    });

    const rows = useMemo(() => {
      let r = filteredExpenses.slice();

      if (categoryFilter !== "all") r = r.filter((x) => x.categoryId === categoryFilter);
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        r = r.filter((x) => x.notes.toLowerCase().includes(q) || (x.source ?? "").toLowerCase().includes(q));
      }

      return r.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    }, [filteredExpenses, categoryFilter, search]);

    const catTotals = useMemo(() => {
      const spent = rows.filter((e) => e.amount < 0).reduce((s2, e) => s2 + Math.abs(e.amount), 0);
      const income = rows
        .filter((e) => e.amount > 0 && e.categoryId === "cat_income")
        .reduce((s2, e) => s2 + e.amount, 0);
      const credits = rows
        .filter((e) => e.amount > 0 && e.categoryId !== "cat_income")
        .reduce((s2, e) => s2 + e.amount, 0);
      return { spent, income, credits, net: income + credits - spent };
    }, [rows]);
    const hasAnyExpenses = expenses.length > 0;
    const dateFilterActive = Boolean(dateFrom || dateTo);
    const categoryFilterActive = categoryFilter !== "all";
    const searchFilterActive = Boolean(search.trim());
    const hasAnyFilterActive = dateFilterActive || categoryFilterActive || searchFilterActive;

    const categoryBreakdown = useMemo(() => {
      const m = new Map<string, { count: number; spent: number; income: number; net: number }>();
      for (const e of rows) {
        const cur = m.get(e.categoryId) ?? { count: 0, spent: 0, income: 0, net: 0 };
        cur.count += 1;
        if (e.amount < 0) cur.spent += Math.abs(e.amount);
        if (e.amount > 0) cur.income += e.amount;
        cur.net = cur.income - cur.spent;
        m.set(e.categoryId, cur);
      }
      return [...m.entries()]
        .map(([id, totals]) => ({ id, name: catById.get(id)?.name ?? id, ...totals }))
        .sort((a, b) => b.spent - a.spent);
    }, [rows, catById]);

    useEffect(() => {
      const params = new URLSearchParams(location.search);
      const queryCategory = params.get("category");
      const querySearch = params.get("q");
      const queryFrom = params.get("from");
      const queryTo = params.get("to");
      const queryFocusSearch = params.get("focusSearch");

      if (queryCategory) setCategoryFilter(queryCategory);
      if (querySearch !== null) setSearch(querySearch);
      if (queryFrom !== null) setDateFrom(queryFrom);
      if (queryTo !== null) setDateTo(queryTo);
      if (queryFocusSearch === "1") {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }
    }, [location.search]);

    function startEditing(expense: Expense) {
      setEditingId(expense.id);
      setEditDraft({
        notes: expense.notes,
        date: expense.date,
        amount: String(Math.abs(expense.amount)),
      });
    }

    function cancelEditing() {
      setEditingId(null);
      setEditDraft({ notes: "", date: "", amount: "" });
    }

    function saveEditing(expense: Expense) {
      const normalizedDate = parseDateFlexible(editDraft.date);
      const amountText = editDraft.amount.trim().replace(/,/g, "");
      const parsedAmount = Number(amountText);
      if (!normalizedDate) {
        alert("Enter a valid date.");
        return;
      }
      if (!editDraft.notes.trim()) {
        alert("Enter a transaction name.");
        return;
      }
      if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
        alert("Enter a valid amount.");
        return;
      }

      const hasExplicitSign = /^[+-]/.test(amountText);
      const nextAmount = hasExplicitSign
        ? parsedAmount
        : expense.amount < 0
          ? -Math.abs(parsedAmount)
          : Math.abs(parsedAmount);

      setExpenses((prev) =>
        prev.map((item) =>
          item.id === expense.id
            ? {
                ...item,
                notes: editDraft.notes.trim().slice(0, 180),
                date: normalizedDate,
                amount: nextAmount,
              }
            : item
        )
      );
      setLearnedCategoryRules((prev) => ({
        ...prev,
        [transactionNameKey(editDraft.notes)]: expense.categoryId,
      }));
      cancelEditing();
    }

    return (
      <div className="bb-expenses-page">
        <PageTitle
          title="Expenses"
          subtitle="Filter by category. Edit category per transaction. Export to Excel."
          right={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={s.btnSecondary} onClick={() => exportToCSV(rows, "budget_bestie_transactions")}>
                <Download size={16} /> CSV
              </button>
              <button style={s.btnPrimary} onClick={() => exportToXLSX(rows, "budget_bestie_transactions")}>
                <Download size={16} /> Excel
              </button>
            </div>
          }
        />

        <div style={s.card}>
          <div className="bb-expenses-controls" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div className="bb-expenses-controls-left" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                <Filter size={16} /> Category
              </div>
              <select style={{ ...s.select, width: 230, maxWidth: "100%" }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? "✨"} {c.name}
                  </option>
                ))}
              </select>

              <input
                ref={searchInputRef}
                id="bb-expenses-search"
                style={{ ...s.input, width: 260, maxWidth: "100%" }}
                placeholder="Search description/source…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="bb-expenses-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ fontWeight: 900 }}>
                Transactions: <span style={{ fontWeight: 980 }}>{rows.length}</span>
              </div>
              <div style={{ fontWeight: 900 }}>
                Spending: <span style={{ fontWeight: 980 }}>{formatMoney(catTotals.spent)}</span>
              </div>
              <div style={{ fontWeight: 900 }}>
                Income: <span style={{ fontWeight: 980 }}>{formatMoney(catTotals.income)}</span>
              </div>
              <div style={{ fontWeight: 900 }}>
                Credits: <span style={{ fontWeight: 980 }}>{formatMoney(catTotals.credits)}</span>
              </div>
              <div style={{ fontWeight: 900 }}>
                Net: <span style={{ fontWeight: 980 }}>{formatMoney(catTotals.net)}</span>
              </div>
            </div>
          </div>
        </div>

        {rows.length === 0 && hasAnyExpenses && hasAnyFilterActive ? (
          <div
            style={{
              ...s.card,
              marginTop: 12,
              borderLeft: `6px solid ${PALETTE.warn}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 820 }}>
              Filters are hiding transactions
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginTop: 3 }}>
                Clear date/category/search filters to show your full transaction list.
              </div>
            </div>
            <button
              style={s.btnPrimary}
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setCategoryFilter("all");
                setSearch("");
              }}
            >
              Show all transactions
            </button>
          </div>
        ) : null}

        {categoryBreakdown.length > 0 ? (
          <div style={{ ...s.card, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              {categoryFilter === "all" ? "Category totals in current list" : "Selected category totals"}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {categoryBreakdown.map((c) => (
                <div
                  key={c.id}
                  className="bb-expense-breakdown-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(140px, 1fr) 100px 130px 130px 130px",
                    gap: 10,
                    alignItems: "center",
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: 14,
                    padding: "8px 10px",
                    background: softLayer(0.72, 0.89),
                    fontSize: 12.5,
                    fontWeight: 800,
                  }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div>{c.count} txns</div>
                  <div>Spend {formatMoney(c.spent)}</div>
                  <div>Inflow {formatMoney(c.income)}</div>
                  <div>Net {formatMoney(c.net)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {rows.length === 0 ? (
            <div style={s.card}>No transactions match your filters.</div>
          ) : (
            rows.map((e) => {
              const cat = catById.get(e.categoryId);
              const isExpense = e.amount < 0;
              const isEditing = editingId === e.id;

              return (
                <div key={e.id} className="bb-tx-card" style={s.txCard}>
                  <div className="bb-tx-left" style={s.txLeft}>
                    <div style={{ ...s.txIcon, background: (cat?.color ?? "#94a3b8") + "33" }}>
                      <span style={{ fontSize: 18 }}>{cat?.icon ?? "✨"}</span>
                    </div>

                    <div style={{ minWidth: 0, width: "100%" }}>
                      {isEditing ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <input
                            style={s.input}
                            value={editDraft.notes}
                            onChange={(ev) => setEditDraft((prev) => ({ ...prev, notes: ev.target.value }))}
                            placeholder="Transaction name"
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                            <input
                              style={s.input}
                              type="date"
                              value={editDraft.date}
                              onChange={(ev) => setEditDraft((prev) => ({ ...prev, date: ev.target.value }))}
                            />
                            <input
                              style={s.input}
                              value={editDraft.amount}
                              onChange={(ev) => setEditDraft((prev) => ({ ...prev, amount: ev.target.value }))}
                              placeholder="Amount"
                            />
                          </div>
                          <div className="bb-tx-meta" style={s.txMeta}>
                            <select
                              style={{ ...s.select, maxWidth: 240, padding: "6px 10px" }}
                              value={e.categoryId}
                              onChange={(ev) => {
                                const newCat = ev.target.value;
                                const key = transactionNameKey(e.notes);
                                if (key) {
                                  setLearnedCategoryRules((prev) => {
                                    const next = { ...prev };
                                    if (newCat === "cat_ccpay") delete next[key];
                                    else next[key] = newCat;
                                    return next;
                                  });
                                }

                                setExpenses((p) =>
                                  p.map((x) => {
                                    if (x.id === e.id) return { ...x, categoryId: newCat };
                                    if (key && transactionNameKey(x.notes) === key) return { ...x, categoryId: newCat };
                                    return x;
                                  })
                                );
                              }}
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon ?? "✨"} {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={s.txTitle}>{e.notes}</div>
                          <div className="bb-tx-meta" style={s.txMeta}>
                            <span>{e.date}</span>
                            <span>•</span>

                            <select
                              style={{ ...s.select, maxWidth: 240, padding: "6px 10px" }}
                              value={e.categoryId}
                              onChange={(ev) => {
                                const newCat = ev.target.value;
                                const key = transactionNameKey(e.notes);
                                if (key) {
                                  setLearnedCategoryRules((prev) => {
                                    const next = { ...prev };
                                    if (newCat === "cat_ccpay") delete next[key];
                                    else next[key] = newCat;
                                    return next;
                                  });
                                }

                                setExpenses((p) =>
                                  p.map((x) => {
                                    if (x.id === e.id) return { ...x, categoryId: newCat };
                                    if (key && transactionNameKey(x.notes) === key) return { ...x, categoryId: newCat };
                                    return x;
                                  })
                                );
                              }}
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon ?? "✨"} {c.name}
                                </option>
                              ))}
                            </select>

                            {e.source ? (
                              <>
                                <span>•</span>
                                <span>{e.source}</span>
                              </>
                            ) : null}

                            {e.isRecurring ? (
                              <>
                                <span>•</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <Repeat size={14} /> {e.recurrenceFrequency}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bb-tx-right" style={s.txRight}>
                    <div style={{ fontWeight: 980, color: isExpense ? PALETTE.text : PALETTE.good }}>
                      {isExpense ? "-" : "+"}
                      {formatMoney(Math.abs(e.amount))}
                    </div>
                    {isEditing ? (
                      <>
                        <button style={s.iconBtn} onClick={() => saveEditing(e)} title="Save">
                          <Check size={16} />
                        </button>
                        <button style={s.iconBtn} onClick={cancelEditing} title="Cancel">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button style={s.btnSecondary} onClick={() => startEditing(e)}>
                        Edit
                      </button>
                    )}
                    <button
                      style={s.iconBtn}
                      onClick={() => {
                        if (!confirm("Delete this transaction?")) return;
                        setExpenses((p) => p.filter((x) => x.id !== e.id));
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
