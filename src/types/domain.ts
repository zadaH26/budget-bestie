export type Period = "weekly" | "monthly" | "yearly";
export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Category = { id: string; name: string; icon?: string; color: string };
export type Budget = { id: string; categoryId: string; amount: number; period: Period };

export type Expense = {
  id: string;
  amount: number; // negative = expense, positive = income
  categoryId: string;
  date: string; // YYYY-MM-DD
  notes: string;
  source?: string;
  sourceGroup?: string;
  isRecurring: boolean;
  recurrenceFrequency: Recurrence;
  createdAt: number;
};

export type Alert = { id: string; type: "warn" | "info"; text: string };
export type RawRow = Record<string, unknown>;
export type AmountDirectionHint = "inflow" | "outflow" | "unknown";
export type AppFontId =
  | "original"
  | "modern"
  | "clean"
  | "sans"
  | "serif"
  | "georgia"
  | "rounded"
  | "mono";
export type HeadingFontId = "serif" | "modern" | "classic";
export type ThemePreset = {
  id: string;
  label: string;
  note: string;
  mode: "light" | "dark";
  accent: string;
  bg: string;
  panel: string;
  panel2: string;
  card: string;
};
export type ThemeChartStyle = {
  pie: string[];
  trend: string;
  trendSoft: string;
  bar: string;
  goal: string;
  plan: string;
  gap: string;
  band: string;
};
export type AccountData = {
  categories: Category[];
  budgets: Budget[];
  expenses: Expense[];
  importedFileFingerprints: string[];
  customThemes: ThemePreset[];
  themeMode: "light" | "dark";
  brandIcon: string;
  appTitle: string;
  appSubtitle: string;
  primaryActionLabel: string;
  appFont: AppFontId;
  headingFont: HeadingFontId;
  colorAccent: string;
  colorBg: string;
  colorPanel: string;
  colorPanel2: string;
  colorCard: string;
  uiRadius: number;
  uiShadow: number;
  uiGlass: number;
  uiMotionMs: number;
  dateFrom: string;
  dateTo: string;
  excludeTransfersFromCharts: boolean;
  excludeCCPayFromCharts: boolean;
  excludeInvestingSavingsFromCharts: boolean;
  chartCategoryFilter: string;
  learnedCategoryRules: Record<string, string>;
  savingsTrackerGoal: number;
  savingsTrackerSaved: number;
};
export type StoredAccount = {
  id: string;
  name: string;
  password: string;
  createdAt: number;
  updatedAt: number;
  data: AccountData;
};
export type PersistedAppState = {
  version: number;
  currentUserId: string | null;
  accounts: Record<string, StoredAccount>;
};
