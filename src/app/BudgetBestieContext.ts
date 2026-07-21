import { createContext, createElement, useContext, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type {
  Alert,
  AppFontId,
  Budget,
  Category,
  Expense,
  HeadingFontId,
  ThemeChartStyle,
  ThemePreset,
  StoredAccount,
} from "./appCore";

type TransactionDraft = Omit<Expense, "id" | "createdAt">;
type ImportResult = {
  nextExpenses: Expense[];
  added: number;
  skippedAsDuplicate: number;
  correctedBySign: number;
};
type SpendingCategoryRow = {
  categoryId: string;
  name: string;
  value: number;
  color: string;
};
type Totals = {
  spent: number;
  income: number;
  credits: number;
  net: number;
};

export type BudgetBestieRuntimeContext = {
  activeAccount: StoredAccount | null;
  activeThemePresetId: string | null;
  advisorAlerts: Alert[];
  allThemePresets: ThemePreset[];
  appFont: AppFontId;
  appTitle: string;
  areLikelyDuplicateNames: (a: string, b: string) => boolean;
  brandIcon: string;
  budgets: Budget[];
  catById: Map<string, Category>;
  categories: Category[];
  chartCategoryFilter: string;
  chartTheme: ThemeChartStyle;
  colorAccent: string;
  colorBg: string;
  colorCard: string;
  colorPanel: string;
  colorPanel2: string;
  dateFrom: string;
  dateTo: string;
  dedupeAndAdd: (incoming: TransactionDraft[]) => ImportResult;
  dedupePreviewRows: (rows: TransactionDraft[]) => TransactionDraft[];
  excludeCCPayFromCharts: boolean;
  excludeInvestingSavingsFromCharts: boolean;
  excludeTransfersFromCharts: boolean;
  expenseOnly: Expense[];
  expenses: Expense[];
  exportToCSV: (rows: Expense[], filenameBase: string) => void;
  exportToXLSX: (rows: Expense[], filenameBase: string) => void;
  filteredExpenses: Expense[];
  getWeekNumber: (d: Date) => number;
  headingFont: HeadingFontId;
  importedFileFingerprints: string[];
  nav: NavigateFunction;
  openExpensesWithFilters: (filters: {
    categoryId?: string;
    search?: string;
    from?: string;
    to?: string;
    focusSearch?: boolean;
  }) => void;
  removeDuplicates: () => void;
  resolveCategoryByLearnedRule: (notes: string, fallbackCategoryId: string) => string;
  s: Record<string, CSSProperties>;
  savingsTrackerGoal: number;
  savingsTrackerSaved: number;
  setAppFont: Dispatch<SetStateAction<AppFontId>>;
  setAppTitle: Dispatch<SetStateAction<string>>;
  setBrandIcon: Dispatch<SetStateAction<string>>;
  setBudgets: Dispatch<SetStateAction<Budget[]>>;
  setCategories: Dispatch<SetStateAction<Category[]>>;
  setChartCategoryFilter: Dispatch<SetStateAction<string>>;
  setColorAccent: Dispatch<SetStateAction<string>>;
  setColorBg: Dispatch<SetStateAction<string>>;
  setColorCard: Dispatch<SetStateAction<string>>;
  setColorPanel: Dispatch<SetStateAction<string>>;
  setColorPanel2: Dispatch<SetStateAction<string>>;
  setCustomThemes: Dispatch<SetStateAction<ThemePreset[]>>;
  setDateFrom: Dispatch<SetStateAction<string>>;
  setDateTo: Dispatch<SetStateAction<string>>;
  setExcludeCCPayFromCharts: Dispatch<SetStateAction<boolean>>;
  setExcludeInvestingSavingsFromCharts: Dispatch<SetStateAction<boolean>>;
  setExcludeTransfersFromCharts: Dispatch<SetStateAction<boolean>>;
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  setHeadingFont: Dispatch<SetStateAction<HeadingFontId>>;
  setImportedFileFingerprints: Dispatch<SetStateAction<string[]>>;
  setLearnedCategoryRules: Dispatch<SetStateAction<Record<string, string>>>;
  setSavingsTrackerGoal: Dispatch<SetStateAction<number>>;
  setSavingsTrackerSaved: Dispatch<SetStateAction<number>>;
  setThemeMode: Dispatch<SetStateAction<"light" | "dark">>;
  setUiGlass: Dispatch<SetStateAction<number>>;
  setUiMotionMs: Dispatch<SetStateAction<number>>;
  setUiRadius: Dispatch<SetStateAction<number>>;
  setUiShadow: Dispatch<SetStateAction<number>>;
  softLayer: (lightAlpha: number, darkAlpha?: number) => string;
  spendByCategory: SpendingCategoryRow[];
  themeMode: "light" | "dark";
  totals: Totals;
  uiGlass: number;
  uiMotionMs: number;
  uiRadius: number;
  uiShadow: number;
};

const BudgetBestieContext = createContext<BudgetBestieRuntimeContext | null>(null);

export function BudgetBestieProvider({ value, children }: { value: BudgetBestieRuntimeContext; children: ReactNode }) {
  return createElement(BudgetBestieContext.Provider, { value }, children);
}

export function useBudgetBestie() {
  const value = useContext(BudgetBestieContext);
  if (!value) throw new Error("BudgetBestie context is missing.");
  return value;
}
