/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Check, PlusCircle, Trash2 } from "lucide-react";
import { DEFAULT_CATEGORIES,  sanitizeBrandText, sanitizeCategoryIcon, sanitizeHexColor, uid } from "../app/appCore";
import type { Category } from "../app/appCore";
import { useBudgetBestie } from "../app/BudgetBestieContext";
import { PageTitle } from "../app/uiComponents";

export function CategoriesPage() {
  const {
    categories,
    s,
    setCategories,
    setExpenses,
    setLearnedCategoryRules,
  } = useBudgetBestie();

    const [draft, setDraft] = useState<Record<string, Category>>(() => {
      const m: Record<string, Category> = {};
      categories.forEach((c) => (m[c.id] = { ...c }));
      return m;
    });

    useEffect(() => {
      const m: Record<string, Category> = {};
      categories.forEach((c) => (m[c.id] = { ...c }));
      setDraft(m);
    }, [categories]);

    function save() {
      const cleaned = Object.values(draft).map((item) => {
        const name = sanitizeBrandText(item.name, "New Category", 32);
        const icon = sanitizeCategoryIcon(item.icon, item.id, name) ?? "✨";
        const fallbackColor = DEFAULT_CATEGORIES.find((c) => c.id === item.id)?.color ?? "#cbd5e1";
        const color = sanitizeHexColor(item.color, fallbackColor);
        return { id: item.id, name, icon, color };
      });
      setCategories(cleaned);
    }

    function addCategory() {
      const id = uid("cat");
      setDraft((p) => ({
        ...p,
        [id]: { id, name: "New Category", icon: "✨", color: "#cbd5e1" },
      }));
    }

    function removeCategory(id: string) {
      if (!confirm("Delete this category? Transactions will move to Other.")) return;
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setExpenses((prev) => prev.map((e) => (e.categoryId === id ? { ...e, categoryId: "cat_other" } : e)));
      setLearnedCategoryRules((prev) => {
        const next: Record<string, string> = {};
        for (const [key, categoryId] of Object.entries(prev)) {
          if (categoryId !== id) next[key] = categoryId;
        }
        return next;
      });
    }

    return (
      <div>
        <PageTitle title="Categories" subtitle="Edit names, icons, colors. Transactions update instantly." />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button style={s.btnSecondary} onClick={addCategory}>
            <PlusCircle size={16} /> Add category
          </button>
          <button style={s.btnPrimary} onClick={save}>
            <Check size={16} /> Save
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {Object.values(draft).map((c) => (
            <div key={c.id} style={s.card}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "center" }}>
                <input style={s.input} value={c.name} onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...p[c.id], name: e.target.value } }))} />
                <input style={s.input} value={c.icon ?? ""} onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...p[c.id], icon: e.target.value } }))} placeholder="Icon" />
                <input style={s.input} value={c.color} onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...p[c.id], color: e.target.value } }))} placeholder="#hex" />
                <button style={s.iconBtn} onClick={() => removeCategory(c.id)} title="Delete category">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
