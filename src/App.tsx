import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  getCloudUser,
  isSupabaseConfigured,
  loadCloudStateJson,
  saveCloudStateJson,
  signInCloud,
  signOutCloud,
  signUpCloud,
  supabase,
  type CloudUser,
} from "./supabase";
import { computeConfidenceRange, computeQualityScore } from "./portfolioMath";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ComposedChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Brush,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Tags,
  Wallet,
  BarChart3,
  AlertTriangle,
  Repeat,
  Trash2,
  Check,
  X,
  Download,
  Filter,
  Brush as BrushIcon,
  Search,
  Bell,
  Settings2,
  Sun,
  Moon,
  UserRound,
} from "lucide-react";

/** ---------- Types ---------- */
type Period = "weekly" | "monthly" | "yearly";
type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

type Category = { id: string; name: string; icon?: string; color: string };
type Budget = { id: string; categoryId: string; amount: number; period: Period };

type Expense = {
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

type Alert = { id: string; type: "warn" | "info"; text: string };
type RawRow = Record<string, unknown>;
type AmountDirectionHint = "inflow" | "outflow" | "unknown";
type AppFontId =
  | "original"
  | "modern"
  | "clean"
  | "sans"
  | "serif"
  | "georgia"
  | "rounded"
  | "mono";
type HeadingFontId = "serif" | "modern" | "classic";
type ThemePreset = {
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
type ThemeChartStyle = {
  pie: string[];
  trend: string;
  trendSoft: string;
  bar: string;
  goal: string;
  plan: string;
  gap: string;
  band: string;
};
type AccountData = {
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
};
type StoredAccount = {
  id: string;
  name: string;
  password: string;
  createdAt: number;
  updatedAt: number;
  data: AccountData;
};
type PersistedAppState = {
  version: number;
  currentUserId: string | null;
  accounts: Record<string, StoredAccount>;
};

/** ---------- Theme ---------- */
const LIGHT_PALETTE = {
  bg: "#ede9f5",
  panel: "#ddd6ea",
  panel2: "#f7f4fc",
  card: "#ffffff",
  border: "rgba(35, 20, 54, 0.14)",
  text: "#1f132f",
  muted: "rgba(31, 19, 47, 0.62)",
  accent: "#b787e6",
  good: "#1fa27a",
  warn: "#c58735",
  bad: "#c94a72",
};

const DARK_PALETTE = {
  bg: "#090a16",
  panel: "#12142a",
  panel2: "#0f1226",
  card: "#1a1e3a",
  border: "rgba(238, 235, 255, 0.16)",
  text: "#f0efff",
  muted: "rgba(240, 239, 255, 0.72)",
  accent: "#8b7bff",
  good: "#2ccf9d",
  warn: "#f0bb69",
  bad: "#ff7aa7",
};

let PALETTE = LIGHT_PALETTE;

const HEADING_FONT_OPTIONS: Array<{ id: HeadingFontId; label: string; stack: string }> = [
  {
    id: "serif",
    label: "Serif Editorial",
    stack: "Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif",
  },
  {
    id: "modern",
    label: "Modern Sans",
    stack: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "classic",
    label: "Classic Serif",
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
];

const DEFAULT_UI_RADIUS = 14;
const DEFAULT_UI_SHADOW = 10;
const DEFAULT_UI_GLASS = 92;
const DEFAULT_UI_MOTION_MS = 220;
const COLOR_SWATCHES = [
  "#f6edf9",
  "#ecdff5",
  "#decdf1",
  "#cfb8eb",
  "#be9fe3",
  "#ab88da",
  "#d8b8eb",
  "#e6c1dd",
  "#f0c6d8",
  "#f4d2df",
  "#e7d0f5",
  "#d4d8f8",
  "#c4def8",
  "#b8e7f1",
  "#bde6df",
  "#d0e8d1",
  "#f2e2c6",
  "#f0ceb8",
  "#ffffff",
  "#f6f6fb",
  "#ececf6",
  "#d8d8e8",
  "#26253f",
  "#11142d",
];

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "lavender_bloom",
    label: "Lavender Bloom",
    note: "",
    mode: "light",
    accent: "#b787e6",
    bg: "#ede9f5",
    panel: "#ddd6ea",
    panel2: "#f7f4fc",
    card: "#ffffff",
  },
  {
    id: "violet_night",
    label: "Violet Night",
    note: "",
    mode: "dark",
    accent: "#8b7bff",
    bg: "#090a16",
    panel: "#12142a",
    panel2: "#0f1226",
    card: "#1a1e3a",
  },
  {
    id: "rose_mist",
    label: "Rose Mist",
    note: "",
    mode: "light",
    accent: "#d892c0",
    bg: "#cbc7d2",
    panel: "#d8d3df",
    panel2: "#eeebf4",
    card: "#ffffff",
  },
  {
    id: "frost_lilac",
    label: "Frost Lilac",
    note: "",
    mode: "light",
    accent: "#b29be8",
    bg: "#c9c6d4",
    panel: "#d6d2e1",
    panel2: "#efecf7",
    card: "#ffffff",
  },
  {
    id: "enterprise_blue",
    label: "Enterprise Blue",
    note: "",
    mode: "light",
    accent: "#3d86f0",
    bg: "#e8f1ff",
    panel: "#d9e7fb",
    panel2: "#f4f8ff",
    card: "#ffffff",
  },
  {
    id: "neon_pay",
    label: "Neon Pay",
    note: "",
    mode: "dark",
    accent: "#785dff",
    bg: "#080a1a",
    panel: "#121530",
    panel2: "#0e122d",
    card: "#1a1f45",
  },
];

function resolveActiveThemePresetId(
  mode: "light" | "dark",
  accent: string,
  bg: string,
  panel: string,
  panel2: string,
  card: string,
  presets: ThemePreset[] = THEME_PRESETS
): string | null {
  return (
    presets.find(
      (preset) =>
        preset.mode === mode &&
        preset.accent.toLowerCase() === accent.toLowerCase() &&
        preset.bg.toLowerCase() === bg.toLowerCase() &&
        preset.panel.toLowerCase() === panel.toLowerCase() &&
        preset.panel2.toLowerCase() === panel2.toLowerCase() &&
        preset.card.toLowerCase() === card.toLowerCase()
    )?.id ?? null
  );
}

function chartStyleForTheme(presetId: string | null, isDark: boolean, accent: string): ThemeChartStyle {
  const fallbackAccent = sanitizeHexColor(accent, isDark ? "#8b7bff" : "#b787e6");

  switch (presetId) {
    case "lavender_bloom":
      return {
        pie: ["#c8afe9", "#e6bdd8", "#d5c6f2", "#f0d8e8", "#b9d0f5", "#cfd6ef"],
        trend: "#9f7add",
        trendSoft: "#d5a5cb",
        bar: "#b88fe4",
        goal: "#8f70d2",
        plan: "#ca9acc",
        gap: "#c95679",
        band: "#c6b4e8",
      };
    case "rose_mist":
      return {
        pie: [
          "#d98db8",
          "#bda6e4",
          "#ebb2d1",
          "#c9b4ea",
          "#f0c5db",
          "#b79fdd",
          "#f4bfd0",
          "#ccb2ef",
          "#e8a7c8",
          "#b69ee8",
        ],
        trend: "#c786bb",
        trendSoft: "#b39fe6",
        bar: "#d58fbe",
        goal: "#be7eb6",
        plan: "#a992de",
        gap: "#c44f76",
        band: "#d9b6d9",
      };
    case "frost_lilac":
      return {
        pie: [
          "#b19ae1",
          "#cfafe6",
          "#c5b3eb",
          "#e6bcda",
          "#adc0f0",
          "#d8c1ea",
          "#c2a9e9",
          "#e0b9e1",
          "#b5c2f5",
          "#d4b5ec",
        ],
        trend: "#a68add",
        trendSoft: "#d0a8d6",
        bar: "#b79ce7",
        goal: "#9a82d7",
        plan: "#c4a0d4",
        gap: "#bf5077",
        band: "#c7b8eb",
      };
    case "enterprise_blue":
      return {
        pie: ["#64a9ff", "#8bc0ff", "#6dd2d6", "#9ed0ff", "#7a9ef5", "#7bc7f1"],
        trend: "#4f95f2",
        trendSoft: "#78b0f8",
        bar: "#4b90f0",
        goal: "#4f95f2",
        plan: "#33b5c6",
        gap: "#d7576f",
        band: "#8dbcf7",
      };
    case "violet_night":
      return {
        pie: ["#8e7bff", "#ca86ff", "#6bb7ff", "#a191ff", "#e69cff", "#60d3ca"],
        trend: "#9b89ff",
        trendSoft: "#c58dff",
        bar: "#8f7cff",
        goal: "#9f8aff",
        plan: "#52d2b0",
        gap: "#ff7aa7",
        band: "#b5a8ff",
      };
    case "neon_pay":
      return {
        pie: ["#8069ff", "#b782ff", "#5d9dff", "#9f7eff", "#f08acf", "#4ec9cd"],
        trend: "#8573ff",
        trendSoft: "#b58aff",
        bar: "#7c68ff",
        goal: "#9182ff",
        plan: "#54d0b2",
        gap: "#ff7aa7",
        band: "#a89cfb",
      };
    default:
      return {
        pie: [
          fallbackAccent,
          isDark ? "#9f8bff" : "#d59cc9",
          isDark ? "#57b8ff" : "#b6c2f2",
          isDark ? "#57d0ba" : "#e6b7d5",
          isDark ? "#f0aa72" : "#f2c5dc",
          isDark ? "#7db9ff" : "#cfb3ec",
        ],
        trend: fallbackAccent,
        trendSoft: isDark ? "#b692ff" : "#d1a3ce",
        bar: fallbackAccent,
        goal: fallbackAccent,
        plan: isDark ? "#58d2b3" : "#be9cd8",
        gap: isDark ? "#ff7ea8" : "#c84f77",
        band: isDark ? "#ab9fff" : "#cab7e8",
      };
  }
}

let UI_THEME = {
  radius: DEFAULT_UI_RADIUS,
  shadow: DEFAULT_UI_SHADOW,
  glass: DEFAULT_UI_GLASS,
  motionMs: DEFAULT_UI_MOTION_MS,
  headingFontStack: HEADING_FONT_OPTIONS[0].stack,
  isDark: false,
};

const LS_KEY = "budget_bestie_no_ai_v7";
const LS_HISTORY_KEY = `${LS_KEY}_history_v1`;
const MAX_LOCAL_HISTORY = 12;
const STATE_ENDPOINT = (import.meta.env.VITE_STATE_ENDPOINT || "").trim();
const STATE_ENDPOINT_SYNC_ENABLED = Boolean(STATE_ENDPOINT);
const LS_SESSION_USER_KEY = `${LS_KEY}_session_user_v1`;

/** ---------- Defaults ---------- */
const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat_dining", name: "Dining", icon: "🍽️", color: "#f472b6" },
  { id: "cat_groceries", name: "Groceries", icon: "🛒", color: "#60a5fa" },
  { id: "cat_transport", name: "Transportation", icon: "🚗", color: "#34d399" },
  { id: "cat_shopping", name: "Shopping", icon: "🛍️", color: "#fb7185" },
  { id: "cat_bills", name: "Bills", icon: "🧾", color: "#fbbf24" },
  { id: "cat_subs", name: "Subscriptions", icon: "🔁", color: "#22c55e" },
  { id: "cat_investing", name: "Investing", icon: "📈", color: "#8b5cf6" },
  { id: "cat_savings", name: "Savings", icon: "💾", color: "#14b8a6" },
  { id: "cat_ccpay", name: "Pay Credit Card", icon: "💳", color: "#a78bfa" },
  { id: "cat_income", name: "Income", icon: "💸", color: "#16a34a" },
  { id: "cat_transfers", name: "Transfers", icon: "🔄", color: "#c084fc" },
  { id: "cat_other", name: "Other", icon: "✨", color: "#94a3b8" },
];

const APP_FONT_OPTIONS: Array<{ id: AppFontId; label: string; stack: string }> = [
  {
    id: "original",
    label: "Original (Default)",
    stack: "Avenir Next, Avenir, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "modern",
    label: "Modern (System)",
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "clean",
    label: "Clean",
    stack: "Avenir, 'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "sans",
    label: "Sans Classic",
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    id: "serif",
    label: "Classic Serif",
    stack: "Iowan Old Style, Palatino, 'Times New Roman', Times, serif",
  },
  {
    id: "georgia",
    label: "Georgia Serif",
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    id: "rounded",
    label: "Rounded",
    stack: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif",
  },
  {
    id: "mono",
    label: "Monospace",
    stack: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
];

const DEFAULT_APP_FONT: AppFontId = "clean";

function sanitizeAppFont(value: unknown, fallback: AppFontId = DEFAULT_APP_FONT): AppFontId {
  if (typeof value !== "string") return fallback;
  const matched = APP_FONT_OPTIONS.find((font) => font.id === value);
  return matched ? matched.id : fallback;
}

function appFontStack(fontId: AppFontId): string {
  return APP_FONT_OPTIONS.find((font) => font.id === fontId)?.stack ?? APP_FONT_OPTIONS[0].stack;
}

function sanitizeHeadingFont(value: unknown, fallback: HeadingFontId = "serif"): HeadingFontId {
  if (typeof value !== "string") return fallback;
  const matched = HEADING_FONT_OPTIONS.find((font) => font.id === value);
  return matched ? matched.id : fallback;
}

function headingFontStack(fontId: HeadingFontId): string {
  return HEADING_FONT_OPTIONS.find((font) => font.id === fontId)?.stack ?? HEADING_FONT_OPTIONS[0].stack;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeAccountId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "");
}

function defaultAccountData(): AccountData {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    budgets: [],
    expenses: [],
    importedFileFingerprints: [],
    customThemes: [],
    themeMode: "light",
    brandIcon: "💜",
    appTitle: "Budget Bestie",
    appSubtitle: "Pastel finance tool (paste + files)",
    primaryActionLabel: "Primary action",
    appFont: DEFAULT_APP_FONT,
    headingFont: "serif",
    colorAccent: LIGHT_PALETTE.accent,
    colorBg: LIGHT_PALETTE.bg,
    colorPanel: LIGHT_PALETTE.panel,
    colorPanel2: LIGHT_PALETTE.panel2,
    colorCard: LIGHT_PALETTE.card,
    uiRadius: DEFAULT_UI_RADIUS,
    uiShadow: DEFAULT_UI_SHADOW,
    uiGlass: DEFAULT_UI_GLASS,
    uiMotionMs: DEFAULT_UI_MOTION_MS,
    dateFrom: "",
    dateTo: "",
    excludeTransfersFromCharts: true,
    excludeCCPayFromCharts: true,
    excludeInvestingSavingsFromCharts: true,
    chartCategoryFilter: "all",
    learnedCategoryRules: {},
  };
}

function sanitizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return defaultAccountData().categories;
  const categories: Category[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? repairMojibakeText(item.name).trim() : "";
    const icon = sanitizeCategoryIcon(item.icon, id, name);
    const color = typeof item.color === "string" ? item.color : "#94a3b8";
    if (!id || !name) continue;
    categories.push({ id, name, icon, color });
  }

  if (!categories.length) return defaultAccountData().categories;
  const requiredCategoryIds = ["cat_investing", "cat_savings", "cat_other"];
  for (const requiredId of requiredCategoryIds) {
    if (categories.some((c) => c.id === requiredId)) continue;
    const fallback = DEFAULT_CATEGORIES.find((c) => c.id === requiredId);
    if (fallback) categories.push({ ...fallback });
  }
  return categories;
}

function sanitizeBudgets(raw: unknown): Budget[] {
  if (!Array.isArray(raw)) return [];
  const budgets: Budget[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : uid("bud");
    const categoryId = typeof item.categoryId === "string" ? item.categoryId : "cat_other";
    const amount = Number(item.amount);
    const period = item.period;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (period !== "weekly" && period !== "monthly" && period !== "yearly") continue;
    budgets.push({ id, categoryId, amount, period });
  }
  return budgets;
}

function sanitizeExpenses(raw: unknown): Expense[] {
  if (!Array.isArray(raw)) return [];
  const expenses: Expense[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const amount = Number(item.amount);
    const notes = typeof item.notes === "string" ? repairMojibakeText(item.notes).trim() : "";
    const dateRaw = typeof item.date === "string" ? item.date : "";
    const date = parseDateFlexible(dateRaw);
    if (!Number.isFinite(amount) || !notes || !date) continue;

    const recurrence = item.recurrenceFrequency;
    const recurrenceFrequency: Recurrence =
      recurrence === "none" || recurrence === "daily" || recurrence === "weekly" || recurrence === "monthly" || recurrence === "yearly"
        ? recurrence
        : "none";

    const expense: Expense = {
      id: typeof item.id === "string" ? item.id : uid("exp"),
      amount,
      categoryId: typeof item.categoryId === "string" ? item.categoryId : "cat_other",
      date,
      notes,
      source: typeof item.source === "string" ? repairMojibakeText(item.source) : undefined,
      sourceGroup: typeof item.sourceGroup === "string" ? repairMojibakeText(item.sourceGroup) : undefined,
      isRecurring: Boolean(item.isRecurring),
      recurrenceFrequency,
      createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
    };

    if (expense.categoryId === "cat_ccpay" || shouldExcludeImportedTransaction(expense.notes)) continue;
    expenses.push(expense);
  }
  return expenses;
}

function sanitizeLearnedRules(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const cleanedRules: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v && v !== "cat_ccpay") cleanedRules[k] = v;
  }
  return cleanedRules;
}

function sanitizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const s = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

function sanitizeBrandText(value: unknown, fallback: string, maxLen: number) {
  if (typeof value !== "string") return fallback;
  const next = repairMojibakeText(value).trim().replace(/\s+/g, " ");
  if (!next) return fallback;
  return next.slice(0, maxLen);
}

function isLikelyMojibakeText(value: string): boolean {
  // Common UTF-8 -> latin1 corruption markers (e.g. "ðŸ’¸", "Ã¢â‚¬").
  return /[\uFFFD]|Ã|Â|ð|Ÿ|™|œ|ž/.test(value);
}

function repairMojibakeText(value: string): string {
  if (!value || !isLikelyMojibakeText(value)) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      bytes[i] = value.charCodeAt(i) & 0xff;
    }
    const decoded = new TextDecoder("utf-8").decode(bytes);
    if (!decoded) return value;
    // Keep decoded only when it looks cleaner than corrupted source.
    if (isLikelyMojibakeText(decoded) && decoded.length >= value.length) return value;
    return decoded;
  } catch {
    return value;
  }
}

function defaultCategoryIconFor(categoryId: string, categoryName: string): string | undefined {
  const byId = DEFAULT_CATEGORIES.find((c) => c.id === categoryId)?.icon;
  if (byId) return byId;
  const normalizedName = categoryName.trim().toLowerCase();
  return DEFAULT_CATEGORIES.find((c) => c.name.trim().toLowerCase() === normalizedName)?.icon;
}

function sanitizeCategoryIcon(rawIcon: unknown, categoryId: string, categoryName: string): string | undefined {
  const fallback = defaultCategoryIconFor(categoryId, categoryName);
  if (typeof rawIcon !== "string") return fallback;
  const icon = repairMojibakeText(rawIcon).trim();
  if (!icon) return fallback;
  if (isLikelyMojibakeText(icon)) return fallback;
  return icon;
}

function sanitizeThemePresets(raw: unknown): ThemePreset[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ThemePreset[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!isRecord(item)) continue;
    const label = sanitizeBrandText(item.label, "", 36);
    if (!label) continue;
    const mode: "light" | "dark" = item.mode === "dark" ? "dark" : "light";
    const basePalette = mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
    const rawId = typeof item.id === "string" ? normalizeAccountId(item.id) : "";
    const baseId = rawId || `custom_${normalizeAccountId(label) || `theme_${i + 1}`}`;
    const prefixedBaseId = baseId.startsWith("custom_") ? baseId : `custom_${baseId}`;
    let finalId = prefixedBaseId;
    let suffix = 2;
    while (seen.has(finalId)) {
      finalId = `${prefixedBaseId}_${suffix}`;
      suffix += 1;
    }
    seen.add(finalId);
    cleaned.push({
      id: finalId,
      label,
      note: "",
      mode,
      accent: sanitizeHexColor(item.accent, basePalette.accent),
      bg: sanitizeHexColor(item.bg, basePalette.bg),
      panel: sanitizeHexColor(item.panel, basePalette.panel),
      panel2: sanitizeHexColor(item.panel2, basePalette.panel2),
      card: sanitizeHexColor(item.card, basePalette.card),
    });
  }
  return cleaned.slice(0, 24);
}

function sanitizeAccountData(raw: unknown): AccountData {
  const fallback = defaultAccountData();
  if (!isRecord(raw)) return fallback;
  const themeMode = raw.themeMode === "dark" ? "dark" : "light";
  const basePalette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  return {
    categories: sanitizeCategories(raw.categories),
    budgets: sanitizeBudgets(raw.budgets),
    expenses: sanitizeExpenses(raw.expenses),
    importedFileFingerprints: Array.isArray(raw.importedFileFingerprints)
      ? raw.importedFileFingerprints.filter((value): value is string => typeof value === "string")
      : [],
    customThemes: sanitizeThemePresets(raw.customThemes),
    themeMode,
    brandIcon: sanitizeBrandText(raw.brandIcon, fallback.brandIcon, 120),
    appTitle: sanitizeBrandText(raw.appTitle, fallback.appTitle, 48),
    appSubtitle: sanitizeBrandText(raw.appSubtitle, fallback.appSubtitle, 90),
    primaryActionLabel: sanitizeBrandText(raw.primaryActionLabel, fallback.primaryActionLabel, 40),
    appFont: sanitizeAppFont(raw.appFont, fallback.appFont),
    headingFont: sanitizeHeadingFont(raw.headingFont, fallback.headingFont),
    colorAccent: sanitizeHexColor(raw.colorAccent, basePalette.accent),
    colorBg: sanitizeHexColor(raw.colorBg, basePalette.bg),
    colorPanel: sanitizeHexColor(raw.colorPanel, basePalette.panel),
    colorPanel2: sanitizeHexColor(raw.colorPanel2, basePalette.panel2),
    colorCard: sanitizeHexColor(raw.colorCard, basePalette.card),
    uiRadius: clampNumber(raw.uiRadius, 8, 28, fallback.uiRadius),
    uiShadow: clampNumber(raw.uiShadow, 0, 24, fallback.uiShadow),
    uiGlass: clampNumber(raw.uiGlass, 70, 100, fallback.uiGlass),
    uiMotionMs: clampNumber(raw.uiMotionMs, 80, 420, fallback.uiMotionMs),
    dateFrom: typeof raw.dateFrom === "string" ? raw.dateFrom : "",
    dateTo: typeof raw.dateTo === "string" ? raw.dateTo : "",
    excludeTransfersFromCharts:
      typeof raw.excludeTransfersFromCharts === "boolean" ? raw.excludeTransfersFromCharts : true,
    excludeCCPayFromCharts:
      typeof raw.excludeCCPayFromCharts === "boolean" ? raw.excludeCCPayFromCharts : true,
    excludeInvestingSavingsFromCharts:
      typeof raw.excludeInvestingSavingsFromCharts === "boolean" ? raw.excludeInvestingSavingsFromCharts : true,
    chartCategoryFilter: typeof raw.chartCategoryFilter === "string" ? raw.chartCategoryFilter : "all",
    learnedCategoryRules: sanitizeLearnedRules(raw.learnedCategoryRules),
  };
}

function expenseCountForAccount(account: StoredAccount | undefined): number {
  const rows = account?.data?.expenses;
  return Array.isArray(rows) ? rows.length : 0;
}

function resolvePreferredCurrentAccount(
  requestedId: string | null,
  accounts: Record<string, StoredAccount>
): string | null {
  const ids = Object.keys(accounts);
  if (!ids.length) return null;
  if (!requestedId || !accounts[requestedId]) return ids[0];

  const requestedCount = expenseCountForAccount(accounts[requestedId]);

  // If account ids look like accidental splits (e.g. "zada26"), prefer the base id ("zada")
  // when the base clearly has the fuller dataset.
  const splitMatch = requestedId.match(/^(.*?)(\d+)$/);
  if (splitMatch) {
    const baseId = normalizeAccountId(splitMatch[1] || "");
    if (baseId && baseId !== requestedId && accounts[baseId]) {
      const baseCount = expenseCountForAccount(accounts[baseId]);
      if (baseCount >= requestedCount + 20) return baseId;
    }
  }

  return requestedId;
}

function parsePersistedAppState(raw: unknown): PersistedAppState {
  try {
    if (!raw) {
      return { version: 2, currentUserId: null, accounts: {} };
    }
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isRecord(parsed)) {
      return { version: 2, currentUserId: null, accounts: {} };
    }

    if (isRecord(parsed.accounts)) {
      const accounts: Record<string, StoredAccount> = {};
      for (const [key, value] of Object.entries(parsed.accounts)) {
        if (!isRecord(value)) continue;
        const normalizedId = normalizeAccountId(typeof value.id === "string" ? value.id : key);
        if (!normalizedId) continue;
        const now = Date.now();
        accounts[normalizedId] = {
          id: normalizedId,
          name:
            typeof value.name === "string" && repairMojibakeText(value.name).trim()
              ? repairMojibakeText(value.name).trim()
              : normalizedId,
          password: typeof value.password === "string" ? value.password : "",
          createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : now,
          updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : now,
          data: sanitizeAccountData(value.data),
        };
      }

      const requestedId =
        typeof parsed.currentUserId === "string" ? normalizeAccountId(parsed.currentUserId) : null;
      const firstAccountId = Object.keys(accounts)[0] ?? null;
      const resolvedCurrent = resolvePreferredCurrentAccount(
        requestedId && accounts[requestedId] ? requestedId : firstAccountId,
        accounts
      );

      return {
        version: 2,
        currentUserId: resolvedCurrent,
        accounts,
      };
    }

    const hasLegacyFields = [
      "categories",
      "budgets",
      "expenses",
      "dateFrom",
      "dateTo",
      "excludeTransfersFromCharts",
      "excludeCCPayFromCharts",
      "excludeInvestingSavingsFromCharts",
      "chartCategoryFilter",
      "learnedCategoryRules",
    ].some((key) => key in parsed);

    if (hasLegacyFields) {
      const id = "my_account";
      const now = Date.now();
      return {
        version: 2,
        currentUserId: id,
        accounts: {
          [id]: {
            id,
            name: "My Account",
            password: "",
            createdAt: now,
            updatedAt: now,
            data: sanitizeAccountData(parsed),
          },
        },
      };
    }
  } catch (error) {
    console.warn("Could not parse saved app state", error);
  }

  return { version: 2, currentUserId: null, accounts: {} };
}

function loadPersistedAppStateFromLocalStorage(): PersistedAppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return parsePersistedAppState(raw);
  } catch (error) {
    console.warn("Could not load local app state", error);
    return { version: 2, currentUserId: null, accounts: {} };
  }
}

type LocalHistoryEntry = { savedAt: number; snapshot: string };

function loadLocalHistoryEntries(): LocalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const entries: LocalHistoryEntry[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      const savedAt = Number(item.savedAt);
      const snapshot = typeof item.snapshot === "string" ? item.snapshot : "";
      if (!Number.isFinite(savedAt) || !snapshot) continue;
      entries.push({ savedAt, snapshot });
    }
    return entries.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_LOCAL_HISTORY);
  } catch {
    return [];
  }
}

function saveLocalHistoryEntries(entries: LocalHistoryEntry[]) {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL_HISTORY)));
}

function saveSnapshotToLocalHistory(state: PersistedAppState) {
  try {
    const snapshot = JSON.stringify(state);
    const existing = loadLocalHistoryEntries();
    if (existing[0]?.snapshot === snapshot) return;
    const next: LocalHistoryEntry[] = [{ savedAt: Date.now(), snapshot }, ...existing].slice(0, MAX_LOCAL_HISTORY);
    saveLocalHistoryEntries(next);
  } catch (error) {
    console.warn("Could not write local autosave history", error);
  }
}

function savePersistedAppStateToLocalStorage(state: PersistedAppState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  saveSnapshotToLocalHistory(state);
}

function loadLocalSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_USER_KEY);
    if (!raw) return null;
    const normalized = normalizeAccountId(raw);
    return normalized || null;
  } catch {
    return null;
  }
}

function saveLocalSessionUserId(userId: string | null) {
  try {
    if (!userId) {
      localStorage.removeItem(LS_SESSION_USER_KEY);
      return;
    }
    localStorage.setItem(LS_SESSION_USER_KEY, normalizeAccountId(userId));
  } catch {
    // ignore storage write failures
  }
}

async function loadPersistedAppStateFromApi(): Promise<PersistedAppState | null> {
  if (!STATE_ENDPOINT) return null;
  try {
    const response = await fetch(STATE_ENDPOINT);
    if (!response.ok) return null;
    const json = (await response.json()) as unknown;
    return parsePersistedAppState(json);
  } catch (error) {
    console.warn("Could not load server app state", error);
    return null;
  }
}

async function savePersistedAppStateToApi(state: PersistedAppState) {
  if (!STATE_ENDPOINT) return;
  const response = await fetch(STATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`Server save failed with ${response.status}`);
  }
}

function isPersistedStateEmpty(state: PersistedAppState) {
  return !state.currentUserId && Object.keys(state.accounts).length === 0;
}

function ensureStateHasDefaultAccount(state: PersistedAppState, displayName?: string | null): PersistedAppState {
  if (!isPersistedStateEmpty(state)) {
    if (state.currentUserId && state.accounts[state.currentUserId]) return state;
    const firstId = Object.keys(state.accounts)[0] ?? null;
    return { ...state, currentUserId: firstId };
  }

  const seed = (displayName || "my_account").trim();
  const normalized = normalizeAccountId(seed) || "my_account";
  const now = Date.now();
  const next: StoredAccount = {
    id: normalized,
    name: displayName?.trim() || "My Account",
    password: "",
    createdAt: now,
    updatedAt: now,
    data: defaultAccountData(),
  };

  return {
    version: 2,
    currentUserId: normalized,
    accounts: { [normalized]: next },
  };
}

function guessDisplayNameFromEmail(email?: string | null): string {
  if (!email) return "My Account";
  const local = email.split("@")[0] || "my_account";
  const words = local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || "My Account";
}

function cloudErrorSummary(error: unknown): string {
  if (error instanceof Error) return error.message || "Unknown cloud error.";
  if (isRecord(error)) {
    const parts = [error.message, error.details, error.hint, error.code, error.status]
      .map((value) => (value == null ? "" : String(value).trim()))
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }
  if (typeof error === "string") return error;
  return "";
}

function isCloudQuotaLimitError(error: unknown): boolean {
  const text = cloudErrorSummary(error).toLowerCase();
  if (!text) return false;
  if (/\b(402|429)\b/.test(text)) return true;

  return [
    "quota",
    "rate limit",
    "too many requests",
    "resource exhausted",
    "usage limit",
    "limit reached",
    "billing",
    "over quota",
    "exceeded",
    "insufficient",
    "monthly active users",
    "egress",
    "database size",
    "project has exceeded",
  ].some((needle) => text.includes(needle));
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function formatMoney(n: number, currency = "CAD") {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-10000px";
    textarea.style.left = "-10000px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

function currencyTooltip(value: number | string | readonly (number | string)[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  return formatMoney(Number(normalized));
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthBounds(monthKey: string): { from: string; to: string } | null {
  const m = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const from = `${m[1]}-${m[2]}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = (hex || "").replace("#", "").trim();
  const parsed =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(parsed)) return `rgba(139, 92, 246, ${alpha})`;
  const r = Number.parseInt(parsed.slice(0, 2), 16);
  const g = Number.parseInt(parsed.slice(2, 4), 16);
  const b = Number.parseInt(parsed.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function parseDateFlexible(s: string): string | null {
  const t = (s || "").toString().trim();
  if (!t) return null;

  const normalize = (year: number, month: number, day: number) => {
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return toISODate(d);
  };

  // Numeric slash/dash dates.
  // Locale default is day-first for ambiguous values (e.g. 04/03/26 -> 2026-03-04).
  const mMDY = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  if (mMDY) {
    const a = Number(mMDY[1]);
    const b = Number(mMDY[2]);
    const yy = mMDY[3];
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else if (a <= 12 && b <= 12) {
      // Ambiguous date: default to DD/MM.
      day = a;
      month = b;
    }
    const iso = normalize(year, month, day);
    if (iso) return iso;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const mYMD = t.match(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/);
  if (mYMD) {
    const year = Number(mYMD[1]);
    const month = Number(mYMD[2]);
    const day = Number(mYMD[3]);
    const iso = normalize(year, month, day);
    if (iso) return iso;
  }

  // Compact YYYYMMDD
  const compact = t.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (compact) {
    const year = Number(compact[1]);
    const month = Number(compact[2]);
    const day = Number(compact[3]);
    const iso = normalize(year, month, day);
    if (iso) return iso;
  }

  // Month-name formats
  const m1 = t.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})\b/i);
  if (m1) {
    const mon = m1[1].slice(0, 3).toLowerCase();
    const day = Number(m1[2]);
    const yy = m1[3];
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const monthIdx =
      ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(mon);
    if (monthIdx >= 0) {
      const iso = normalize(year, monthIdx + 1, day);
      if (iso) return iso;
    }
  }

  const m2 = t.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?,?\s+(\d{2}|\d{4})\b/i);
  if (m2) {
    const day = Number(m2[1]);
    const mon = m2[2].slice(0, 3).toLowerCase();
    const yy = m2[3];
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const monthIdx =
      ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(mon);
    if (monthIdx >= 0) {
      const iso = normalize(year, monthIdx + 1, day);
      if (iso) return iso;
    }
  }

  // ISO date substring
  const m3 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m3) {
    const iso = normalize(Number(m3[1]), Number(m3[2]), Number(m3[3]));
    if (iso) return iso;
  }

  return null;
}

/** ---------- Smart (non-AI) Categorizer ---------- */
function isCreditCardPaymentText(descRaw: string): boolean {
  const d = (descRaw || "").toLowerCase();
  return /bill\s*pymt|bill\s*payment|credit\s*card\s*payment|cc\s*payment|amex\s*bill|visa\s*payment|mastercard\s*payment|(?:transfer|payment)\s+(?:to|for)\s+(?:my\s+)?(?:credit\s*card|visa|mastercard|amex)|(?:credit\s*card|visa|mastercard|amex)\s+(?:bill|payment|pymt)|pay\s+(?:my\s+)?(?:credit\s*card|visa|mastercard|amex)/.test(
    d
  );
}

function isAlwaysExcludedStatementText(descRaw: string): boolean {
  const d = (descRaw || "").toLowerCase().replace(/\s+/g, " ").trim();
  return /payment received - thank you|payment - thank you \/ paiement - merci|to find & save/.test(d);
}

function shouldExcludeImportedTransaction(descRaw: string): boolean {
  return isCreditCardPaymentText(descRaw) || isAlwaysExcludedStatementText(descRaw);
}

function hasExplicitMinusAmountToken(tokenLike: unknown, parsedAmount?: number) {
  if (typeof tokenLike === "number" && Number.isFinite(tokenLike)) return tokenLike < 0;
  if (typeof tokenLike === "string") {
    const token = tokenLike
      .replace(/[−–—﹣]/g, "-")
      .replace(/[＋]/g, "+")
      .toLowerCase();
    if (token.includes("(") && token.includes(")")) return true;
    if (token.includes("-")) return true;
    return false;
  }
  if (typeof parsedAmount === "number" && Number.isFinite(parsedAmount)) return parsedAmount < 0;
  return false;
}

function shouldFlipInstallmentToInflow(params: {
  notes: string;
  source?: string;
  sourceGroup?: string;
  tokenLike?: unknown;
  parsedAmount?: number;
}) {
  const notes = (params.notes || "").toLowerCase();
  const isInstallment =
    /\binstall(?:e)?ment\s*plan\b|\bmembership\s*fee\s*install(?:e)?ment\b|\bmonthly\s*install(?:e)?ment\s*fee\b/.test(
      notes
    );
  if (!isInstallment) return false;

  const sourceGroup = params.sourceGroup || sourceFamilyFromLabel(params.source || "");
  const isAmexLike = sourceGroup === "amex" || /\brbc\s+install(?:e)?ment\s*plan\b/.test(notes);
  if (!isAmexLike) return false;

  return hasExplicitMinusAmountToken(params.tokenLike, params.parsedAmount);
}

function isWsInvestmentsText(descRaw: string) {
  return /\bws\s*invest(?:ment|ments)\b/i.test(descRaw || "");
}

function isInvestingText(descRaw: string) {
  const d = (descRaw || "").toLowerCase();
  return /\b(ws\s*invest(?:ment|ments)?|wealthsimple|invest(?:ing|ment|ments)?|tfsa|rrsp|fhsa|brokerage|portfolio|etf|mutual fund)\b/.test(
    d
  );
}

function isSavingsText(descRaw: string) {
  const d = (descRaw || "").toLowerCase();
  return /\b(savings?\s+account|high[-\s]?interest\s+savings?|save\s+account|to\s+savings?|emergency\s+fund)\b/.test(
    d
  );
}

function isInvestingOrSavingsTransaction(row: Pick<Expense, "categoryId" | "notes">) {
  if (row.categoryId === "cat_investing" || row.categoryId === "cat_savings") return true;
  return isInvestingText(row.notes) || isSavingsText(row.notes);
}

function classifyCategory(descRaw: string): string {
  const d = (descRaw || "").toLowerCase();

  if (isWsInvestmentsText(d) || isInvestingText(d)) return "cat_investing";
  if (isSavingsText(d)) return "cat_savings";

  // Pay credit card
  if (isCreditCardPaymentText(d)) {
    return "cat_ccpay";
  }

  // Income
  if (/payroll|salary|deposit\b|atm deposit|pay\s?cheque|paycheck/.test(d)) return "cat_income";
  if (/cash back|cashback|reward/.test(d)) return "cat_income";

  // Transfers
  if (/e-?transfer|etransfer|online banking transfer|transfer|interac|to find\s*&\s*save/.test(d))
    return "cat_transfers";

  // Subscriptions
  if (/spotify|netflix|youtube|google one|icloud|chatgpt|openai|prime|amazon prime|snow ai|subscription/.test(d))
    return "cat_subs";

  // Groceries
  if (/longo|walmart|costco|no frills|metro|superstore|grocery|freshco|food basics/.test(d))
    return "cat_groceries";

  // Dining
  if (/starbucks|tim hortons|cafe|coffee|restaurant|pizza|shawarma|bubble tea|sweet lavender/.test(d))
    return "cat_dining";

  // Transportation
  if (/petro|pioneer|esso|shell|gas|parking|uber|lyft|ttc|go transit/.test(d))
    return "cat_transport";

  // Shopping
  if (/sephora|h&m|hm\.com|amazon|bath and body works|chapters|indigo/.test(d))
    return "cat_shopping";

  // Bills
  if (/insurance|rent|hydro|electric|rogers|bell|telus|internet|phone|\bbill\b/.test(d))
    return "cat_bills";

  return "cat_other";
}

function transactionNameKey(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function sourceFamilyFromLabel(label: string): string {
  const s = (label || "").toLowerCase().trim();
  if (!s) return "unknown";

  if (/american\s*express|\bamex\b/.test(s)) return "amex";
  if (/\brbc\b|royal\s*bank/.test(s)) return "rbc";
  if (/\btd\b|toronto\s*dominion/.test(s)) return "td";
  if (/\bcibc\b/.test(s)) return "cibc";
  if (/scotia|scotiabank/.test(s)) return "scotiabank";
  if (/bmo|bank\s*of\s*montreal/.test(s)) return "bmo";

  const noExt = s.replace(/\.(csv|xlsx|xls)$/i, "");
  const cleaned = noExt
    .replace(/\b(statement|transactions?|transaction|export|download|account|activity|report|period|from|to)\b/g, " ")
    .replace(/\b\d{4}[-_/]?\d{1,2}(?:[-_/]?\d{1,2})?\b/g, " ")
    .replace(/\b\d{6,8}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const base = cleaned.split(" ").slice(0, 2).join(" ").trim();
  return base || "unknown";
}

function sourceFamilyFromContent(text: string): string | null {
  const t = (text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/\bamerican express\b|\bamex\b/.test(t)) return "amex";
  if (/\bpayment received - thank you\b/.test(t)) return "amex";
  if (/\bmembership fee installment\b|\bmonthly installment fee\b/.test(t)) return "amex";
  if (
    /\bavailable credit\b|\bmembership rewards\b|\bplan it\b|\bminimum amount due\b|\bchange my credit limit\b|\bshow more transactions\b|\buse points for eligible purchases\b/.test(
      t
    )
  ) {
    return "amex";
  }
  const shortDateMatches = t.match(
    /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{2}\b/g
  );
  if ((shortDateMatches?.length || 0) >= 3) return "amex";
  if (/\bdate\s+description\s+amount\b/.test(t) && !/\bdebit\b|\bcredit\b|\bwithdrawals?\b|\bdeposits?\b/.test(t)) {
    return "amex";
  }
  return null;
}

function resolveSourceFamily(sourceLabel: string, contentHint?: string): string {
  const fromContent = contentHint ? sourceFamilyFromContent(contentHint) : null;
  if (fromContent) return fromContent;
  return sourceFamilyFromLabel(sourceLabel);
}

function findMoneyTokens(text: string): string[] {
  return text.match(/[+\-−–—﹣＋]?\(?\$?\s*\d[\d,]*\.\d{2}\)?[+\-−–—﹣＋]?(?:\s*(?:cr|dr|credit|debit))?/gi) ?? [];
}

function stripMoneyTokens(text: string): string {
  return text
    .replace(/[+\-−–—﹣＋]?\(?\$?\s*\d[\d,]*\.\d{2}\)?[+\-−–—﹣＋]?(?:\s*(?:cr|dr|credit|debit))?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectAmountDirectionHint(tokenRaw: string, sourceGroup?: string): AmountDirectionHint {
  const token = (tokenRaw || "")
    .replace(/[−–—﹣]/g, "-")
    .replace(/[＋]/g, "+")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!token) return "unknown";
  const isAmex = sourceGroup === "amex";
  if (token.includes("credit") || /(^|[^a-z])cr($|[^a-z])/.test(token)) return "inflow";
  if (token.includes("debit") || /(^|[^a-z])dr($|[^a-z])/.test(token)) return "outflow";
  if (token.includes("(") && token.includes(")")) return isAmex ? "inflow" : "outflow";
  if (token.includes("-")) return isAmex ? "inflow" : "outflow";
  if (token.includes("+")) return isAmex ? "outflow" : "inflow";
  return "unknown";
}

function directionHintFromDescription(descRaw: string, sourceGroup?: string): AmountDirectionHint {
  const d = (descRaw || "").toLowerCase();
  if (!d) return "unknown";

  const isAmex = sourceGroup === "amex";

  // Outgoing transfer/payment cues should always be outflow.
  if (
    /\be-?transfer\s*sent\b|\betransfer\s*sent\b|\binterac\b.*\bsent\b|\btransfer\s*sent\b|\bsent\s+to\b|\bpayment\s*sent\b/.test(
      d
    )
  ) {
    return "outflow";
  }

  // Incoming transfer/payment cues should always be inflow.
  if (
    /\be-?transfer\s*received\b|\betransfer\s*received\b|\binterac\b.*\breceived\b|\bpayment\s*received\b|\bdeposit\b|\brefund\b|\breimburse(?:ment)?\b|\bpayroll\b|\bsalary\b/.test(
      d
    )
  ) {
    return "inflow";
  }

  // AMEX installment markers should follow amount-token sign convention instead of hard-coded direction.
  if (isAmex && /\binstall(?:e)?ment\s*plan\b|\bmembership\s*fee\s*install(?:e)?ment\b|\bmonthly\s*install(?:e)?ment\s*fee\b/.test(d)) {
    return "unknown";
  }

  return "unknown";
}

function applyAmountSignRules(params: {
  amount: number;
  categoryId: string;
  explicitDirection?: AmountDirectionHint;
  hasDepositCue?: boolean;
  hasOutflowCue?: boolean;
  preserveParsedSign?: boolean;
}): number {
  const {
    amount,
    categoryId,
    explicitDirection = "unknown",
    hasDepositCue = false,
    hasOutflowCue = false,
    preserveParsedSign = false,
  } = params;

  const abs = Math.abs(amount);
  if (!Number.isFinite(abs) || abs === 0) return 0;
  if (preserveParsedSign) return amount < 0 ? -abs : abs;
  if (explicitDirection === "inflow") return abs;
  if (explicitDirection === "outflow") return -abs;

  if (hasDepositCue && !hasOutflowCue) return abs;
  if (hasOutflowCue && !hasDepositCue) return -abs;

  const isIncomeOrTransfer = categoryId === "cat_income" || categoryId === "cat_transfers";
  return isIncomeOrTransfer ? abs : -abs;
}

/**
 * Multi-format paste parser:
 * - RBC: Date Description Withdrawals Deposits Balance
 * - AMEX/CC: Date Description Amount
 * Works even if pasted as one long line.
 */
function parsePasteBlock(text: string, sourceLabel: string): Array<Omit<Expense, "id" | "createdAt">> {
  const normalizedInput = (text || "").replace(/[−–—﹣]/g, "-").replace(/[＋]/g, "+");
  const sourceGroup = resolveSourceFamily(sourceLabel, normalizedInput);
  const isStatementNoiseLine = (line: string) =>
    /^(posted transactions|download|search by keyword|search|filter|foreign currency)$/i.test((line || "").trim());

  // Structured statement parser (line-based), e.g. RBC table paste.
  const parseStructuredStatement = () => {
    const lines = normalizedInput
      .replace(/\u00A0/g, " ")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const rows: Array<{ date: string; parts: string[] }> = [];
    let current: { date: string; parts: string[] } | null = null;

    for (const line of lines) {
      if (/^date\b/i.test(line) || /^description\b/i.test(line)) continue;
      if (isStatementNoiseLine(line)) continue;

      const iso = parseDateFlexible(line);
      if (iso) {
        if (current) rows.push(current);
        current = { date: iso, parts: [] };
        continue;
      }

      if (current) current.parts.push(line);
    }
    if (current) rows.push(current);

    const out: Array<Omit<Expense, "id" | "createdAt">> = [];

    for (const row of rows) {
      let amount: number | null = null;
      let pickedAmountToken = "";
      const descParts: string[] = [];
      let hasDepositCue = false;
      let hasOutflowCue = false;

      for (const line of row.parts) {
        const lineLower = line.toLowerCase();
        if (isStatementNoiseLine(line)) continue;
        if (
          /\batm\s*deposit\b|\bpayroll\b|\bsalary\b|\bdeposit\b|\brefund\b|\breimburse(?:ment)?\b|\binterest\b|\bcash\s*back\b|\bcashback\b|\breward\b/.test(
            lineLower
          )
        ) {
          hasDepositCue = true;
        }
        if (
          /\be-?transfer\s*sent\b|\bpayment\b|\bpymt\b|\bbill\b|\bto\s+find\s*&\s*save\b|\btransfer\s*-\s*\d+\b|\bfee\b|\bcharge\b/.test(
            lineLower
          )
        ) {
          hasOutflowCue = true;
        }

        const tokens = findMoneyTokens(line);
        for (const token of tokens) {
          const n = parseMoneyAny(token);
          if (n !== null && n !== 0 && amount === null) {
            amount = n;
            pickedAmountToken = token;
            break;
          }
        }

        const cleaned = stripMoneyTokens(line);

        if (/^(withdrawals?|deposits?|balance)$/i.test(cleaned)) continue;
        if (isStatementNoiseLine(cleaned)) continue;
        // Ignore common short reference codes like B3FUWM / FAR2RP.
        if (!cleaned || /^[A-Z0-9]{5,10}$/i.test(cleaned)) continue;
        descParts.push(cleaned);
      }

      if (amount === null) continue;

      const desc = descParts.join(" ").replace(/\s+/g, " ").trim();
      if (!desc) continue;
      const preserveParsedSign = isWsInvestmentsText(desc);

      const categoryId = classifyCategory(desc);
      if (categoryId === "cat_ccpay" || shouldExcludeImportedTransaction(desc)) continue;
      const descriptionDirection = directionHintFromDescription(desc, sourceGroup);
      const explicitDirection =
        descriptionDirection !== "unknown"
          ? descriptionDirection
          : detectAmountDirectionHint(pickedAmountToken, sourceGroup);
      const signedAmount = applyAmountSignRules({
        amount,
        categoryId,
        explicitDirection,
        hasDepositCue,
        hasOutflowCue,
        preserveParsedSign,
      });
      const normalizedAmount =
        shouldFlipInstallmentToInflow({
          notes: desc,
          source: sourceLabel,
          sourceGroup,
          tokenLike: pickedAmountToken,
          parsedAmount: amount,
        }) && signedAmount < 0
          ? Math.abs(signedAmount)
          : signedAmount;

      out.push({
        amount: normalizedAmount,
        categoryId,
        date: row.date,
        notes: desc.slice(0, 180),
        source: sourceLabel || "Pasted",
        sourceGroup,
        isRecurring: false,
        recurrenceFrequency: "none",
      });
    }

    return out;
  };

  const structured = parseStructuredStatement();
  if (structured.length >= 1) return structured;

  const raw = normalizedInput.trim();
  if (!raw) return [];

  const normalized = raw
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const dateTokenRE =
    /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{2,4})\b/gi;

  const dates = [...normalized.matchAll(dateTokenRE)].map((m) => ({ idx: m.index ?? 0, val: m[0] }));
  if (dates.length === 0) return [];

  const chunks: { dateStr: string; chunk: string }[] = [];
  for (let i = 0; i < dates.length; i++) {
    const start = dates[i].idx;
    const end = i + 1 < dates.length ? dates[i + 1].idx : normalized.length;
    chunks.push({ dateStr: dates[i].val, chunk: normalized.slice(start, end).trim() });
  }

  const out: Array<Omit<Expense, "id" | "createdAt">> = [];
  for (const c of chunks) {
    const iso = parseDateFlexible(c.dateStr);
    if (!iso) continue;

    let rest = c.chunk.replace(c.dateStr, "").trim();

    rest = rest
      .replace(/\bDate\b/gi, " ")
      .replace(/\bDescription\b/gi, " ")
      .replace(/\bWithdrawals?\b/gi, " ")
      .replace(/\bDeposits?\b/gi, " ")
      .replace(/\bBalance\b/gi, " ")
      .replace(/\bPosted Transactions\b/gi, " ")
      .replace(/\bDownload\b/gi, " ")
      .replace(/\bSearch by keyword\b/gi, " ")
      .replace(/\bSearch\b/gi, " ")
      .replace(/\bFilter\b/gi, " ")
      .replace(/\bForeign Currency\b/gi, " ")
      .replace(/Display:\s*14\s*days|Display:\s*30\s*days|Display:\s*Last\s*Month/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const monies = findMoneyTokens(rest);
    if (monies.length === 0) continue;

    const amountToken = monies.find((m) => parseMoneyAny(m) !== null);
    if (!amountToken) continue;
    const amount = parseMoneyAny(amountToken);
    if (amount === null) continue;

    const desc = stripMoneyTokens(rest);
    if (!desc) continue;

    const categoryId = classifyCategory(desc);
    if (categoryId === "cat_ccpay" || shouldExcludeImportedTransaction(desc)) continue;

    const descriptionDirection = directionHintFromDescription(desc, sourceGroup);
    const explicitDirection =
      descriptionDirection !== "unknown" ? descriptionDirection : detectAmountDirectionHint(amountToken, sourceGroup);
    const signedAmount = applyAmountSignRules({
      amount,
      categoryId,
      explicitDirection,
    });
    const normalizedAmount =
      shouldFlipInstallmentToInflow({
        notes: desc,
        source: sourceLabel,
        sourceGroup,
        tokenLike: amountToken,
        parsedAmount: amount,
      }) && signedAmount < 0
        ? Math.abs(signedAmount)
        : signedAmount;

    out.push({
      amount: normalizedAmount,
      categoryId,
      date: iso,
      notes: desc.slice(0, 180),
      source: sourceLabel || "Pasted",
      sourceGroup,
      isRecurring: false,
      recurrenceFrequency: "none",
    });
  }

  return out;
}

/** ---------- File Import Helpers (CSV/XLSX/XLS) ---------- */
function normHeader(h: string) {
  return (h || "")
    .toString()
    .replace(/\uFEFF/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(row: RawRow, keys: string[]) {
  const map = new Map<string, unknown>();
  for (const k of Object.keys(row)) map.set(normHeader(k), row[k]);
  for (const want of keys) {
    const v = map.get(normHeader(want));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function parseMoneyAny(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v)
    .replace(/[−–—﹣]/g, "-")
    .replace(/[＋]/g, "+")
    .trim();
  if (!s) return null;
  const negParen = /^\(.*\)$/.test(s);
  const trailingMinus = /-$/.test(s);
  const leadingPlus = /^\+/.test(s);
  const debit = /\bdr\b|\bdebit\b/i.test(s);
  const credit = /\bcr\b|\bcredit\b/i.test(s);
  const cleaned = s
    .replace(/[()]/g, "")
    .replace(/[$,]/g, "")
    .replace(/\b(cr|credit|dr|debit|cad|usd|eur|gbp)\b/gi, "")
    .replace(/\s+/g, "")
    .trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (credit) return Math.abs(n);
  if (negParen || trailingMinus || debit) return -Math.abs(n);
  if (leadingPlus) return Math.abs(n);
  return n;
}

function guessDateFromCell(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toISODate(v);

  // Excel date serial
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) return toISODate(new Date(d.y, d.m - 1, d.d));
  }

  const s = String(v).trim();
  return parseDateFlexible(s);
}

function rowToExpense(
  row: RawRow,
  sourceLabel: string,
  sourceGroupOverride?: string
): Omit<Expense, "id" | "createdAt"> | null {
  const sourceGroup = sourceGroupOverride || sourceFamilyFromLabel(sourceLabel);
  const dateVal = pick(row, [
    "transaction date",
    "date",
    "posted date",
    "posting date",
    "trans date",
    "activity date",
  ]);

  const desc1 = pick(row, [
    "description 1",
    "description1",
    "description",
    "merchant",
    "merchant name",
    "name",
    "details",
    "memo",
    "reference",
    "payee",
  ]);

  const desc2 = pick(row, [
    "description 2",
    "description2",
    "extended details",
    "city",
    "location",
    "transaction details",
  ]);

  const amountVal = pick(row, [
    "amount",
    "amt",
    "amount $",
    "amount cad",
    "cad amount",
    "cad$",
    "cad",
    "usd$",
    "usd",
    "transaction amount",
    "debit amount",
    "credit amount",
  ]);

  const withdrawalsVal = pick(row, ["withdrawals", "withdrawal", "debit", "debits", "charges", "purchase amount"]);
  const depositsVal = pick(row, ["deposits", "deposit", "credit", "credits", "payments", "refund amount"]);

  const descParts = [desc1, desc2].filter(Boolean).map(String);
  const amountAsMoney = amountVal !== undefined ? parseMoneyAny(amountVal) : null;
  // Some statement exports misalign description/amount columns; keep non-money "amount" as description text.
  if (
    amountVal !== undefined &&
    amountAsMoney === null &&
    typeof amountVal === "string" &&
    String(amountVal).trim()
  ) {
    descParts.push(String(amountVal));
  }
  const desc = descParts.join(" ").replace(/\s+/g, " ").trim();
  const descNoMoney = stripMoneyTokens(desc);

  const iso = guessDateFromCell(dateVal);
  if (!iso || !descNoMoney) return null;

  let amount: number | null = null;

  if (amountVal !== undefined) {
    amount = amountAsMoney;
  } else {
    const w = withdrawalsVal !== undefined ? parseMoneyAny(withdrawalsVal) : null;
    const d = depositsVal !== undefined ? parseMoneyAny(depositsVal) : null;

    if (w !== null && w !== 0) amount = -Math.abs(w);
    else if (d !== null && d !== 0) amount = Math.abs(d);
  }

  // Fallback for swapped columns (e.g. amount appears in description column).
  if (amount === null) {
    const d1 = desc1 !== undefined ? parseMoneyAny(desc1) : null;
    const d2 = desc2 !== undefined ? parseMoneyAny(desc2) : null;
    if (d1 !== null && d1 !== 0) amount = d1;
    else if (d2 !== null && d2 !== 0) amount = d2;
  }

  if (amount === null || amount === 0) return null;

  const categoryId = classifyCategory(descNoMoney);
  if (categoryId === "cat_ccpay" || shouldExcludeImportedTransaction(descNoMoney)) return null;
  const preserveParsedSign = isWsInvestmentsText(descNoMoney);

  const descriptionDirection = directionHintFromDescription(descNoMoney, sourceGroup);
  let signedAmount = amount;
  let explicitDirection: AmountDirectionHint = descriptionDirection;
  const isSingleAmountStatement = amountVal !== undefined && withdrawalsVal === undefined && depositsVal === undefined;
  if (explicitDirection === "unknown" && isSingleAmountStatement) {
    explicitDirection = detectAmountDirectionHint(String(amountVal), sourceGroup);
  } else if (explicitDirection === "unknown" && (withdrawalsVal !== undefined || depositsVal !== undefined)) {
    const outflowHint =
      withdrawalsVal !== undefined && parseMoneyAny(withdrawalsVal) !== null ? ("outflow" as const) : "unknown";
    const inflowHint = depositsVal !== undefined && parseMoneyAny(depositsVal) !== null ? ("inflow" as const) : "unknown";
    explicitDirection = outflowHint !== "unknown" ? outflowHint : inflowHint;
  }
  signedAmount = applyAmountSignRules({
    amount: signedAmount,
    categoryId,
    explicitDirection,
    preserveParsedSign,
  });
  const installmentTokenLike = isSingleAmountStatement ? amountVal : withdrawalsVal ?? depositsVal;
  if (
    shouldFlipInstallmentToInflow({
      notes: descNoMoney,
      source: sourceLabel,
      sourceGroup,
      tokenLike: installmentTokenLike,
      parsedAmount: amount,
    }) &&
    signedAmount < 0
  ) {
    signedAmount = Math.abs(signedAmount);
  }

  return {
    amount: signedAmount,
    categoryId,
    date: iso,
    notes: descNoMoney.slice(0, 180),
    source: sourceLabel,
    sourceGroup,
    isRecurring: false,
    recurrenceFrequency: "none",
  };
}

async function parseCsvFile(file: File): Promise<RawRow[]> {
  const text = await file.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h: string) => (h || "").replace(/\uFEFF/g, "").trim(),
  }) as { data?: RawRow[] };
  return (parsed.data || []).filter(Boolean);
}

function isLikelyHeaderRow(row: unknown[]): boolean {
  const cells = row.map((c) => normHeader(String(c ?? ""))).filter(Boolean);
  if (cells.length < 2) return false;
  const hasDate = cells.some((c) =>
    ["date", "transaction date", "posted date", "posting date", "trans date", "activity date"].some(
      (k) => c === k || c.includes(k)
    )
  );
  const hasDescription = cells.some(
    (c) =>
      c.includes("description") ||
      c.includes("merchant") ||
      c.includes("name") ||
      c.includes("memo") ||
      c.includes("details") ||
      c.includes("narrative")
  );
  const hasAmount = cells.some((c) =>
    ["amount", "withdrawal", "withdrawals", "debit", "deposit", "deposits", "credit", "cad$", "charges", "payments"].some((k) =>
      c.includes(k)
    )
  );
  return hasDate && (hasDescription || hasAmount);
}

function parseXlsxSheet(ws: XLSX.WorkSheet): RawRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  const headerRowIdx = matrix.findIndex((row) => isLikelyHeaderRow(Array.isArray(row) ? row : []));

  if (headerRowIdx >= 0) {
    const headerRow = Array.isArray(matrix[headerRowIdx]) ? matrix[headerRowIdx] : [];
    const headers = headerRow.map((cell, idx) => String(cell ?? "").trim() || `column_${idx + 1}`);

    const rows: RawRow[] = [];
    for (const row of matrix.slice(headerRowIdx + 1)) {
      if (!Array.isArray(row)) continue;
      const obj: RawRow = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? "";
      });
      const hasValue = Object.values(obj).some((v) => String(v ?? "").trim() !== "");
      if (hasValue) rows.push(obj);
    }
    return rows;
  }

  return XLSX.utils
    .sheet_to_json<RawRow>(ws, { defval: "", raw: true })
    .filter((row) => Object.values(row).some((v) => String(v ?? "").trim() !== ""));
}

async function parseXlsxFile(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const allRows: RawRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    allRows.push(...parseXlsxSheet(ws));
  }

  return allRows;
}

/** ---------- UI Styles ---------- */
function makeStyles(): Record<string, React.CSSProperties> {
  const isDark = UI_THEME.isDark;
  const cardRadius = Math.max(10, Math.min(24, UI_THEME.radius + 1));
  const controlRadius = Math.max(8, Math.min(20, UI_THEME.radius - 1));
  const navRadius = Math.max(10, Math.min(22, UI_THEME.radius));
  const cardSurface = isDark ? colorWithAlpha(PALETTE.card, 0.96) : colorWithAlpha("#ffffff", UI_THEME.glass / 100);
  const pageBackground = isDark
    ? `radial-gradient(circle at 14% 14%, ${colorWithAlpha(PALETTE.accent, 0.2)} 0%, transparent 35%), radial-gradient(circle at 88% 90%, ${colorWithAlpha(PALETTE.accent, 0.14)} 0%, transparent 33%), linear-gradient(180deg, ${colorWithAlpha(PALETTE.bg, 0.98)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.98)} 100%)`
    : `radial-gradient(circle at 15% 9%, ${colorWithAlpha(PALETTE.accent, 0.2)} 0%, transparent 30%), radial-gradient(circle at 86% 86%, ${colorWithAlpha(PALETTE.accent, 0.14)} 0%, transparent 28%), linear-gradient(180deg, ${colorWithAlpha(PALETTE.bg, 0.98)} 0%, ${colorWithAlpha(PALETTE.panel, 0.96)} 58%, ${colorWithAlpha(PALETTE.panel2, 0.98)} 100%)`;
  const brandSurface = isDark
    ? `linear-gradient(180deg, ${colorWithAlpha(PALETTE.card, 0.92)} 0%, ${colorWithAlpha(PALETTE.panel, 0.9)} 100%)`
    : "rgba(255,255,255,0.86)";
  const cardBackground = isDark
    ? `linear-gradient(180deg, ${colorWithAlpha(PALETTE.card, 0.96)} 0%, ${colorWithAlpha(PALETTE.panel, 0.92)} 100%)`
    : `linear-gradient(180deg, ${cardSurface} 0%, ${colorWithAlpha(PALETTE.card, 0.985)} 62%, ${colorWithAlpha(PALETTE.panel2, 0.82)} 100%)`;
  const cardShadow = isDark
    ? `0 ${6 + UI_THEME.shadow}px ${18 + UI_THEME.shadow}px rgba(0, 0, 0, ${(0.24 + UI_THEME.shadow * 0.005).toFixed(3)})`
    : `0 ${6 + UI_THEME.shadow}px ${18 + UI_THEME.shadow}px rgba(16, 24, 30, ${(0.045 + UI_THEME.shadow * 0.0045).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,0.72)`;
  const controlBg = isDark ? colorWithAlpha(PALETTE.card, 0.84) : "rgba(255,255,255,0.92)";
  const controlInset = isDark ? "none" : "inset 0 1px 0 rgba(255,255,255,0.75)";
  const secondaryBtnBg = isDark
    ? `linear-gradient(180deg, ${colorWithAlpha(PALETTE.card, 0.88)} 0%, ${colorWithAlpha(PALETTE.panel, 0.9)} 100%)`
    : `linear-gradient(180deg, ${colorWithAlpha("#ffffff", 0.95)} 0%, ${colorWithAlpha(PALETTE.panel2, 0.9)} 100%)`;
  const iconBtnBg = isDark ? colorWithAlpha(PALETTE.card, 0.86) : "rgba(255,255,255,0.9)";
  const txCardBg = isDark ? colorWithAlpha(PALETTE.card, 0.9) : "rgba(255,255,255,0.88)";
  const primaryBtnShadow = isDark
    ? `0 4px 12px ${colorWithAlpha(PALETTE.accent, 0.2)}`
    : `0 11px 22px ${colorWithAlpha(PALETTE.accent, 0.28)}`;

  return {
    page: {
      minHeight: "100vh",
      width: "100%",
      background: pageBackground,
      color: PALETTE.text,
      overflowX: "hidden",
    },
    shell: {
      display: "grid",
      gridTemplateColumns: "clamp(250px, 20vw, 300px) minmax(0, 1fr)",
      gap: 18,
      padding: 18,
      width: "100%",
      maxWidth: 1710,
      margin: "20px auto",
      alignItems: "start",
      boxSizing: "border-box",
      minHeight: "calc(100vh - 40px)",
      background: isDark
        ? colorWithAlpha(PALETTE.panel2, 0.9)
        : `linear-gradient(180deg, ${colorWithAlpha(PALETTE.panel2, 0.96)} 0%, ${colorWithAlpha(PALETTE.panel, 0.92)} 100%)`,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 36,
      boxShadow: isDark ? "0 20px 48px rgba(0,0,0,0.35)" : `0 28px 48px ${colorWithAlpha(PALETTE.accent, 0.18)}`,
    },
    sidebar: {
      background: isDark ? colorWithAlpha(PALETTE.card, 0.5) : colorWithAlpha("#ffffff", 0.52),
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 26,
      padding: 14,
      position: "sticky",
      top: 20,
      height: "calc(100vh - 76px)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      overflow: "auto",
      boxSizing: "border-box",
      backdropFilter: "blur(14px)",
      boxShadow: isDark ? "0 10px 22px rgba(0,0,0,0.3)" : "0 10px 24px rgba(54, 43, 52, 0.08)",
      minWidth: 0,
      alignItems: "stretch",
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      background: brandSurface,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 18,
      marginBottom: 6,
    },
    brandIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      display: "grid",
      placeItems: "center",
      background: `linear-gradient(145deg, ${colorWithAlpha(PALETTE.accent, 0.3)} 0%, ${colorWithAlpha(PALETTE.accent, 0.16)} 100%)`,
      fontSize: 20,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6)",
    },
    brandTitle: { fontWeight: 940, fontSize: 17, letterSpacing: 0.1, fontFamily: UI_THEME.headingFontStack },
    brandSub: { fontSize: 12, color: PALETTE.muted, fontWeight: 640 },

    main: {
      background: "transparent",
      border: "none",
      borderRadius: 26,
      padding: 0,
      minHeight: "calc(100vh - 76px)",
      overflow: "visible",
      boxSizing: "border-box",
      boxShadow: "none",
      backdropFilter: "none",
    },

    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "11px 13px",
      borderRadius: navRadius,
      textDecoration: "none",
      color: PALETTE.text,
      fontWeight: 760,
      fontSize: 14.2,
      transition: "all 220ms ease",
    },
    railNav: {
      width: "100%",
      display: "grid",
      gap: 8,
      justifyItems: "stretch",
    },
    railBtn: {
      width: "100%",
      minHeight: 50,
      borderRadius: 14,
      border: `1px solid ${PALETTE.border}`,
      background: isDark ? colorWithAlpha(PALETTE.card, 0.82) : colorWithAlpha("#ffffff", 0.88),
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 12px",
      color: PALETTE.text,
      textDecoration: "none",
      boxShadow: isDark ? "0 6px 16px rgba(0,0,0,0.28)" : "0 6px 14px rgba(51, 38, 47, 0.08)",
      transition: "all 220ms ease",
      fontWeight: 820,
      fontSize: 14,
    },
    topBar: {
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      alignItems: "center",
      gap: 14,
      marginBottom: 12,
      background: isDark ? colorWithAlpha(PALETTE.panel2, 0.84) : colorWithAlpha("#f5f4fa", 0.88),
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 24,
      padding: 12,
      boxShadow: isDark ? "0 8px 18px rgba(0,0,0,0.25)" : "0 8px 20px rgba(61, 47, 58, 0.08)",
    },
    topTabs: {
      display: "flex",
      gap: 8,
      justifyContent: "center",
      flexWrap: "wrap",
    },
    topTab: {
      padding: "12px 22px",
      borderRadius: 16,
      textDecoration: "none",
      border: `1px solid ${PALETTE.border}`,
      background: isDark ? colorWithAlpha(PALETTE.card, 0.82) : colorWithAlpha("#ffffff", 0.88),
      color: PALETTE.text,
      fontWeight: 820,
      fontSize: 14,
    },
    topActions: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    iconPill: {
      width: 46,
      height: 46,
      borderRadius: 14,
      border: `1px solid ${PALETTE.border}`,
      background: isDark ? colorWithAlpha(PALETTE.card, 0.82) : colorWithAlpha("#ffffff", 0.9),
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      color: PALETTE.text,
    },
    avatarPill: {
      width: 46,
      height: 46,
      borderRadius: 14,
      border: `1px solid ${PALETTE.border}`,
      background: `linear-gradient(145deg, ${colorWithAlpha(PALETTE.accent, 0.3)} 0%, ${colorWithAlpha(PALETTE.accent, 0.14)} 100%)`,
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
      color: PALETTE.text,
    },

    pageHeader: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" },
    h1: { fontSize: 23, fontWeight: 940, letterSpacing: 0.2, fontFamily: UI_THEME.headingFontStack },
    sub: { fontSize: 13, color: PALETTE.muted, fontWeight: 650, marginTop: 4 },

    grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 },
    grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 },

    card: {
      background: cardBackground,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: cardRadius,
      padding: 14,
      boxShadow: cardShadow,
    },

    input: {
      width: "100%",
      padding: "11px 13px",
      borderRadius: controlRadius,
      border: `1px solid ${PALETTE.border}`,
      background: controlBg,
      fontWeight: 700,
      color: PALETTE.text,
      outline: "none",
      boxSizing: "border-box",
      boxShadow: controlInset,
    },
    select: {
      width: "100%",
      padding: "11px 13px",
      borderRadius: controlRadius,
      border: `1px solid ${PALETTE.border}`,
      background: controlBg,
      fontWeight: 700,
      color: PALETTE.text,
      outline: "none",
      boxSizing: "border-box",
      boxShadow: controlInset,
    },
    textarea: {
      width: "100%",
      minHeight: 140,
      padding: "11px 13px",
      borderRadius: controlRadius,
      border: `1px solid ${PALETTE.border}`,
      background: controlBg,
      fontWeight: 650,
      color: PALETTE.text,
      outline: "none",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: 12.5,
      boxSizing: "border-box",
      boxShadow: controlInset,
    },
    btnPrimary: {
      padding: "10px 13px",
      borderRadius: controlRadius,
      border: `1px solid ${colorWithAlpha(PALETTE.accent, 0.7)}`,
      background: `linear-gradient(160deg, ${PALETTE.accent} 0%, ${colorWithAlpha(PALETTE.accent, 0.86)} 100%)`,
      cursor: "pointer",
      fontWeight: 880,
      color: "#fffaf7",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      whiteSpace: "nowrap",
      boxSizing: "border-box",
      boxShadow: primaryBtnShadow,
      transition: "all 220ms ease",
    },
    btnSecondary: {
      padding: "10px 13px",
      borderRadius: controlRadius,
      border: `1px solid ${PALETTE.border}`,
      background: secondaryBtnBg,
      cursor: "pointer",
      fontWeight: 840,
      color: PALETTE.text,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      whiteSpace: "nowrap",
      boxSizing: "border-box",
      boxShadow: "0 5px 14px rgba(16, 24, 30, 0.08)",
      transition: "all 220ms ease",
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: Math.max(10, controlRadius - 2),
      border: `1px solid ${PALETTE.border}`,
      background: iconBtnBg,
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      transition: "all 220ms ease",
    },
    deleteLabel: {
      fontWeight: 830,
      fontSize: 11.5,
      color: PALETTE.muted,
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    deleteInput: {
      width: "100%",
      minHeight: 46,
      display: "block",
      fontSize: 15,
      fontWeight: 760,
      boxSizing: "border-box",
    },
    deleteBtn: {
      width: "100%",
      minHeight: 46,
      justifyContent: "center",
      fontSize: 14,
      fontWeight: 860,
      boxSizing: "border-box",
    },
    deleteDangerBtn: {
      width: "100%",
      minHeight: 46,
      justifyContent: "center",
      fontSize: 14,
      fontWeight: 900,
      boxSizing: "border-box",
    },
    txCard: {
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
      padding: 12,
      borderRadius: cardRadius,
      border: `1px solid ${PALETTE.border}`,
      background: txCardBg,
      boxShadow: `0 ${4 + UI_THEME.shadow}px ${14 + UI_THEME.shadow}px rgba(14, 22, 30, ${(0.038 + UI_THEME.shadow * 0.0038).toFixed(3)})`,
    },
    txLeft: { display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 },
    txIcon: { width: 44, height: 44, borderRadius: controlRadius, display: "grid", placeItems: "center" },
    txTitle: {
      fontWeight: 880,
      fontSize: 14,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      width: "100%",
    },
    txMeta: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      fontSize: 12,
      color: PALETTE.muted,
      fontWeight: 700,
      marginTop: 4,
      alignItems: "center",
    },
    txRight: { display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" },
  };
}

/** ---------- Small UI Components ---------- */
function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const s = makeStyles();
  return (
    <div style={s.pageHeader}>
      <div>
        <div className="bb-page-title" style={s.h1}>
          {title}
        </div>
        {subtitle ? <div style={s.sub}>{subtitle}</div> : null}
      </div>
      <div>{right}</div>
    </div>
  );
}

function RailItem({
  to,
  icon,
  title,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  const s = makeStyles();
  const activeStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${colorWithAlpha("#111111", 0.95)} 0%, ${colorWithAlpha("#050505", 0.95)} 100%)`,
    color: "#f6f6f6",
    border: `1px solid ${colorWithAlpha(PALETTE.accent, 0.35)}`,
    boxShadow: `0 8px 18px ${colorWithAlpha(PALETTE.accent, 0.24)}`,
  };
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={title}
      onClick={onClick}
      style={({ isActive }) => (isActive ? { ...s.railBtn, ...activeStyle } : s.railBtn)}
    >
      {icon}
      <span>{title}</span>
    </NavLink>
  );
}

function TopTabItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  const s = makeStyles();
  const activeStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${colorWithAlpha("#111111", 0.96)} 0%, ${colorWithAlpha("#050505", 0.96)} 100%)`,
    color: "#f6f6f6",
    border: `1px solid ${colorWithAlpha(PALETTE.accent, 0.35)}`,
    boxShadow: `0 8px 18px ${colorWithAlpha(PALETTE.accent, 0.22)}`,
  };
  return (
    <NavLink
      to={to}
      end={to === "/"}
      style={({ isActive }) => (isActive ? { ...s.topTab, ...activeStyle } : s.topTab)}
    >
      {label}
    </NavLink>
  );
}

/** ---------- App Shell ---------- */
function AppShell() {
  const nav = useNavigate();
  const cloudEnabled = isSupabaseConfigured;

  const [accounts, setAccounts] = useState<Record<string, StoredAccount>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [isAccountReady, setIsAccountReady] = useState(false);

  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [isCloudReady, setIsCloudReady] = useState(!cloudEnabled);
  const [cloudAuthMode, setCloudAuthMode] = useState<"signin" | "create">("signin");
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [isCloudAuthBusy, setIsCloudAuthBusy] = useState(false);
  const [isCloudSyncPaused, setIsCloudSyncPaused] = useState(false);
  const [cloudPauseReason, setCloudPauseReason] = useState("");
  const [isRestoreBootstrapReady] = useState(true);

  const [authMode, setAuthMode] = useState<"signin" | "create">("signin");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");

  const [categories, setCategories] = useState<Category[]>(defaultAccountData().categories);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [importedFileFingerprints, setImportedFileFingerprints] = useState<string[]>([]);
  const [customThemes, setCustomThemes] = useState<ThemePreset[]>(defaultAccountData().customThemes);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [brandIcon, setBrandIcon] = useState(defaultAccountData().brandIcon);
  const [appTitle, setAppTitle] = useState(defaultAccountData().appTitle);
  const [appSubtitle, setAppSubtitle] = useState(defaultAccountData().appSubtitle);
  const [primaryActionLabel, setPrimaryActionLabel] = useState(defaultAccountData().primaryActionLabel);
  const [appFont, setAppFont] = useState<AppFontId>(defaultAccountData().appFont);
  const [headingFont, setHeadingFont] = useState<HeadingFontId>(defaultAccountData().headingFont);
  const [colorAccent, setColorAccent] = useState(defaultAccountData().colorAccent);
  const [colorBg, setColorBg] = useState(defaultAccountData().colorBg);
  const [colorPanel, setColorPanel] = useState(defaultAccountData().colorPanel);
  const [colorPanel2, setColorPanel2] = useState(defaultAccountData().colorPanel2);
  const [colorCard, setColorCard] = useState(defaultAccountData().colorCard);
  const [uiRadius, setUiRadius] = useState(defaultAccountData().uiRadius);
  const [uiShadow, setUiShadow] = useState(defaultAccountData().uiShadow);
  const [uiGlass, setUiGlass] = useState(defaultAccountData().uiGlass);
  const [uiMotionMs, setUiMotionMs] = useState(defaultAccountData().uiMotionMs);

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [excludeTransfersFromCharts, setExcludeTransfersFromCharts] = useState(true);
  const [excludeCCPayFromCharts, setExcludeCCPayFromCharts] = useState(true);
  const [excludeInvestingSavingsFromCharts, setExcludeInvestingSavingsFromCharts] = useState(true);
  const [chartCategoryFilter, setChartCategoryFilter] = useState<string>("all");
  const [learnedCategoryRules, setLearnedCategoryRules] = useState<Record<string, string>>({});

  const [deleteFrom, setDeleteFrom] = useState<string>("");
  const [deleteTo, setDeleteTo] = useState<string>("");
  const cloudRuntimeEnabled = cloudEnabled && !isCloudSyncPaused;
  const crossBrowserSyncEnabled = cloudRuntimeEnabled || STATE_ENDPOINT_SYNC_ENABLED;

  const activeAccount = currentUserId ? accounts[currentUserId] ?? null : null;
  const basePalette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  PALETTE = {
    ...basePalette,
    accent: sanitizeHexColor(colorAccent, basePalette.accent),
    bg: sanitizeHexColor(colorBg, basePalette.bg),
    panel: sanitizeHexColor(colorPanel, basePalette.panel),
    panel2: sanitizeHexColor(colorPanel2, basePalette.panel2),
    card: sanitizeHexColor(colorCard, basePalette.card),
  };
  const allThemePresets = useMemo(() => [...THEME_PRESETS, ...customThemes], [customThemes]);
  const activeThemePresetId = resolveActiveThemePresetId(
    themeMode,
    PALETTE.accent,
    PALETTE.bg,
    PALETTE.panel,
    PALETTE.panel2,
    PALETTE.card,
    allThemePresets
  );
  const chartTheme = chartStyleForTheme(activeThemePresetId, themeMode === "dark", PALETTE.accent);
  UI_THEME = {
    radius: clampNumber(uiRadius, 8, 28, DEFAULT_UI_RADIUS),
    shadow: clampNumber(uiShadow, 0, 24, DEFAULT_UI_SHADOW),
    glass: clampNumber(uiGlass, 70, 100, DEFAULT_UI_GLASS),
    motionMs: clampNumber(uiMotionMs, 80, 420, DEFAULT_UI_MOTION_MS),
    headingFontStack: headingFontStack(headingFont),
    isDark: themeMode === "dark",
  };
  const s = makeStyles();
  const fontFamily = appFontStack(appFont);
  const pageStyle = {
    ...s.page,
    fontFamily,
    "--bb-motion-ms": `${UI_THEME.motionMs}ms`,
    "--bb-heading-font": UI_THEME.headingFontStack,
    "--bb-radius": `${UI_THEME.radius}px`,
  } as React.CSSProperties;
  const softLayer = (lightAlpha: number, darkAlpha = 0.9) =>
    themeMode === "dark" ? colorWithAlpha(PALETTE.card, darkAlpha) : `rgba(255,255,255,${lightAlpha})`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const accountFirstName =
    (cloudRuntimeEnabled ? cloudUser?.email?.split("@")[0] : activeAccount?.name?.split(" ")[0]) || "there";

  const pauseCloudSyncFromQuota = useCallback((error: unknown, context: string) => {
    const detail = cloudErrorSummary(error);
    const baseMessage =
      "Cloud free plan limit reached. Cloud sync is paused to keep this app on free tier.";
    const reason = detail ? `${baseMessage} (${detail})` : baseMessage;
    console.warn(context, error);
    setIsCloudSyncPaused(true);
    setCloudPauseReason((prev) => prev || reason);
    setCloudError(baseMessage);
    setIsCloudReady(true);
  }, []);

  // Resolve cloud auth session when Supabase is configured.
  useEffect(() => {
    if (!cloudRuntimeEnabled) {
      setIsCloudReady(true);
      return;
    }
    if (!supabase) {
      setIsCloudReady(true);
      return;
    }

    let cancelled = false;

    async function refreshCloudUser() {
      try {
        const user = await getCloudUser();
        if (cancelled) return;
        setCloudUser(user);
        if (user?.email) setCloudEmail(user.email);
      } catch (error) {
        if (isCloudQuotaLimitError(error)) {
          if (cancelled) return;
          pauseCloudSyncFromQuota(error, "Cloud auth/session check paused due to quota.");
          return;
        }
        if (!cancelled) {
          setCloudError(cloudErrorSummary(error) || "Could not connect cloud account.");
        }
      } finally {
        if (!cancelled) setIsCloudReady(true);
      }
    }

    void refreshCloudUser();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshCloudUser();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [cloudRuntimeEnabled, pauseCloudSyncFromQuota]);

  // Load storage (cloud if configured, otherwise local/api).
  useEffect(() => {
    if (!isRestoreBootstrapReady) return;
    if (cloudEnabled && isCloudSyncPaused) {
      setAccounts({});
      setCurrentUserId(null);
      setIsStorageReady(true);
      return;
    }
    if (cloudRuntimeEnabled && !isCloudReady) return;
    let cancelled = false;

    async function loadStorage() {
      setIsStorageReady(false);
      const localState = loadPersistedAppStateFromLocalStorage();

      if (cloudRuntimeEnabled) {
        if (!cloudUser) {
          if (cancelled) return;
          setAccounts({});
          setCurrentUserId(null);
          setIsStorageReady(true);
          return;
        }

        let cloudState: PersistedAppState | null = null;
        try {
          const cloudRaw = await loadCloudStateJson(cloudUser.id);
          cloudState = cloudRaw ? parsePersistedAppState(cloudRaw) : null;
        } catch (error) {
          if (isCloudQuotaLimitError(error)) {
            if (cancelled) return;
            pauseCloudSyncFromQuota(error, "Cloud load paused due to quota.");
          } else {
            console.warn("Could not load cloud app state", error);
          }
        }

        const chosen =
          cloudState && !isPersistedStateEmpty(cloudState)
            ? cloudState
            : !isPersistedStateEmpty(localState)
              ? localState
              : ensureStateHasDefaultAccount(
                  { version: 2, currentUserId: null, accounts: {} },
                  guessDisplayNameFromEmail(cloudUser.email)
                );

        const hydrated = ensureStateHasDefaultAccount(chosen, guessDisplayNameFromEmail(cloudUser.email));
        if (cancelled) return;
        setAccounts(hydrated.accounts);
        setCurrentUserId(hydrated.currentUserId);
        setIsStorageReady(true);

        if (!cloudState || isPersistedStateEmpty(cloudState)) {
          void saveCloudStateJson(cloudUser.id, hydrated).catch((error) => {
            if (isCloudQuotaLimitError(error)) {
              pauseCloudSyncFromQuota(error, "Cloud initialization save paused due to quota.");
              return;
            }
            console.warn("Could not initialize cloud app state", error);
          });
        }
        return;
      }

      const serverState = await loadPersistedAppStateFromApi();
      const chosenState =
        serverState && !isPersistedStateEmpty(serverState)
          ? serverState
          : !isPersistedStateEmpty(localState)
            ? localState
            : serverState ?? localState;

      if (!serverState || (isPersistedStateEmpty(serverState) && !isPersistedStateEmpty(localState))) {
        try {
          await savePersistedAppStateToApi(localState);
        } catch (error) {
          console.warn("Could not migrate local app state to server storage", error);
        }
      }

      if (cancelled) return;
      setAccounts(chosenState.accounts);
      const browserSessionUserId = loadLocalSessionUserId();
      const browserSessionResolved =
        browserSessionUserId && chosenState.accounts[browserSessionUserId] ? browserSessionUserId : null;
      if (browserSessionUserId && !browserSessionResolved) {
        saveLocalSessionUserId(null);
      }
      setCurrentUserId(browserSessionResolved);
      setIsStorageReady(true);
    }

    void loadStorage();
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, isCloudSyncPaused, cloudRuntimeEnabled, isRestoreBootstrapReady, isCloudReady, cloudUser?.id, pauseCloudSyncFromQuota]);

  // Load selected account data into working state.
  useEffect(() => {
    if (!isStorageReady) return;
    if (!activeAccount) {
      setIsAccountReady(false);
      return;
    }

    setIsAccountReady(false);
    const data = sanitizeAccountData(activeAccount.data);
    setCategories(data.categories);
    setBudgets(data.budgets);
    setExpenses(data.expenses);
    setImportedFileFingerprints(data.importedFileFingerprints);
    setCustomThemes(data.customThemes);
    setThemeMode(data.themeMode);
    setBrandIcon(data.brandIcon);
    setAppTitle(data.appTitle);
    setAppSubtitle(data.appSubtitle);
    setPrimaryActionLabel(data.primaryActionLabel);
    setAppFont(data.appFont);
    setHeadingFont(data.headingFont);
    setColorAccent(data.colorAccent);
    setColorBg(data.colorBg);
    setColorPanel(data.colorPanel);
    setColorPanel2(data.colorPanel2);
    setColorCard(data.colorCard);
    setUiRadius(data.uiRadius);
    setUiShadow(data.uiShadow);
    setUiGlass(data.uiGlass);
    setUiMotionMs(data.uiMotionMs);
    setDateFrom(data.dateFrom);
    setDateTo(data.dateTo);
    setExcludeTransfersFromCharts(data.excludeTransfersFromCharts);
    setExcludeCCPayFromCharts(data.excludeCCPayFromCharts);
    setExcludeInvestingSavingsFromCharts(data.excludeInvestingSavingsFromCharts);
    setChartCategoryFilter(data.chartCategoryFilter);
    setLearnedCategoryRules(data.learnedCategoryRules);
    setDeleteFrom("");
    setDeleteTo("");
    setIsAccountReady(true);
  }, [activeAccount?.id, isStorageReady]);

  // Keep active account data synced after hydration.
  useEffect(() => {
    if (!isStorageReady || !isAccountReady || !currentUserId) return;
    setAccounts((prev) => {
      const current = prev[currentUserId];
      if (!current) return prev;
      return {
        ...prev,
        [currentUserId]: {
          ...current,
          updatedAt: Date.now(),
          data: {
            categories,
            budgets,
            expenses,
            importedFileFingerprints,
            customThemes,
            themeMode,
            brandIcon,
            appTitle,
            appSubtitle,
            primaryActionLabel,
            appFont,
            headingFont,
            colorAccent,
            colorBg,
            colorPanel,
            colorPanel2,
            colorCard,
            uiRadius,
            uiShadow,
            uiGlass,
            uiMotionMs,
            dateFrom,
            dateTo,
            excludeTransfersFromCharts,
            excludeCCPayFromCharts,
            excludeInvestingSavingsFromCharts,
            chartCategoryFilter,
            learnedCategoryRules,
          },
        },
      };
    });
  }, [
    isStorageReady,
    isAccountReady,
    currentUserId,
    categories,
    budgets,
    expenses,
    importedFileFingerprints,
    customThemes,
    themeMode,
    brandIcon,
    appTitle,
    appSubtitle,
    primaryActionLabel,
    appFont,
    headingFont,
    colorAccent,
    colorBg,
    colorPanel,
    colorPanel2,
    colorCard,
    uiRadius,
    uiShadow,
    uiGlass,
    uiMotionMs,
    dateFrom,
    dateTo,
    excludeTransfersFromCharts,
    excludeCCPayFromCharts,
    excludeInvestingSavingsFromCharts,
    chartCategoryFilter,
    learnedCategoryRules,
  ]);

  // Persist account container.
  useEffect(() => {
    if (!isStorageReady) return;
    const state = {
      version: 2,
      currentUserId,
      accounts,
    } satisfies PersistedAppState;

    savePersistedAppStateToLocalStorage(state);

    const timer = setTimeout(() => {
      if (cloudRuntimeEnabled && cloudUser) {
        void saveCloudStateJson(cloudUser.id, state).catch((error) => {
          if (isCloudQuotaLimitError(error)) {
            pauseCloudSyncFromQuota(error, "Cloud save paused due to quota.");
            return;
          }
          console.warn("Could not save app state to cloud storage", error);
        });
        return;
      }

      void savePersistedAppStateToApi(state).catch((error) => {
        console.warn("Could not save app state to server storage", error);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [isStorageReady, currentUserId, accounts, cloudRuntimeEnabled, cloudUser?.id, pauseCloudSyncFromQuota]);

  function createAccount() {
    const displayName = authUsername.trim();
    const id = normalizeAccountId(displayName);
    setAuthError("");
    setAuthInfo("");
    if (!id) {
      setAuthError("Enter a valid username (letters and numbers).");
      return;
    }
    if (accounts[id]) {
      setAuthError("That username already exists. Sign in instead.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    const now = Date.now();
    const next: StoredAccount = {
      id,
      name: displayName || id,
      password: authPassword,
      createdAt: now,
      updatedAt: now,
      data: defaultAccountData(),
    };

    const nextAccounts = { ...accounts, [id]: next };
    const nextState = { version: 2, currentUserId: id, accounts: nextAccounts } satisfies PersistedAppState;
    savePersistedAppStateToLocalStorage(nextState);
    saveLocalSessionUserId(id);
    setAccounts(nextAccounts);
    setIsAccountReady(false);
    setCurrentUserId(id);
    setAuthMode("signin");
    setAuthUsername("");
    setAuthPassword("");
    setAuthInfo("Account created and saved.");
  }

  function signIn() {
    const id = normalizeAccountId(authUsername);
    const account = accounts[id];
    const enteredPassword = authPassword;
    const trimmedPassword = authPassword.trim();
    setAuthError("");
    setAuthInfo("");
    if (!account) {
      setAuthError(
        crossBrowserSyncEnabled
          ? "Account not found."
          : "Account not found on this browser. Browser-local mode does not sync accounts across browsers/devices."
      );
      return;
    }
    const savedPassword = String(account.password || "");
    const normalizedSaved = savedPassword.trim().toLowerCase();
    const normalizedEntered = trimmedPassword.toLowerCase();
    const passwordMatches =
      savedPassword === enteredPassword ||
      savedPassword === trimmedPassword ||
      normalizedSaved === normalizedEntered;
    if (!passwordMatches) {
      setAuthError("Incorrect password.");
      return;
    }

    setIsAccountReady(false);
    saveLocalSessionUserId(id);
    setCurrentUserId(id);
    setAuthPassword("");
    setAuthInfo("Signed in.");
  }

  function signOut() {
    setIsAccountReady(false);
    saveLocalSessionUserId(null);
    setCurrentUserId(null);
    setAuthPassword("");
    setAuthError("");
    setAuthInfo("");
    setDeleteFrom("");
    setDeleteTo("");
  }

  async function submitCloudAuth() {
    if (isCloudSyncPaused) {
      setCloudError(cloudPauseReason || "Cloud sync is paused due to free-tier limits.");
      return;
    }
    const email = cloudEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setCloudError("Enter a valid email.");
      return;
    }
    if (cloudPassword.length < 6) {
      setCloudError("Password must be at least 6 characters.");
      return;
    }

    setIsCloudAuthBusy(true);
    setCloudError("");
    try {
      if (cloudAuthMode === "create") await signUpCloud(email, cloudPassword);
      else await signInCloud(email, cloudPassword);
      setCloudPassword("");
    } catch (error) {
      if (isCloudQuotaLimitError(error)) {
        pauseCloudSyncFromQuota(error, "Cloud auth paused due to quota.");
        return;
      }
      setCloudError(error instanceof Error ? error.message : "Could not authenticate.");
    } finally {
      setIsCloudAuthBusy(false);
    }
  }

  async function signOutEverything() {
    signOut();
    if (!cloudEnabled) return;
    try {
      await signOutCloud();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  function setLocalAuthMode(mode: "signin" | "create") {
    setAuthMode(mode);
    setAuthError("");
    setAuthInfo("");
  }

  function submitLocalAuth() {
    if (authMode === "create") createAccount();
    else signIn();
  }

  function openExpensesWithFilters(filters: {
    categoryId?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();
    if (filters.categoryId && filters.categoryId !== "all") params.set("category", filters.categoryId);
    if (filters.search) params.set("q", filters.search);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    nav(`/expenses${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  function resolveCategoryByLearnedRule(notes: string, fallbackCategoryId: string) {
    const key = transactionNameKey(notes);
    const learned = key ? learnedCategoryRules[key] : undefined;
    if (learned && catById.has(learned)) return learned;
    return fallbackCategoryId;
  }

  function inDeleteRange(iso: string) {
    if (deleteFrom && iso < deleteFrom) return false;
    if (deleteTo && iso > deleteTo) return false;
    return true;
  }

  function normalizeIdentityText(value?: string) {
    const raw = (value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[−–—﹣]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw) return "";
    return raw
      .replace(/[^a-z0-9,\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function txDayAmountKey(e: { date: string; amount: number }) {
    return [e.date, Number(Math.abs(e.amount)).toFixed(2)].join("|");
  }

  function areLikelyDuplicateNames(a: string, b: string) {
    const normA = normalizeIdentityText(a);
    const normB = normalizeIdentityText(b);
    if (!normA || !normB) return false;
    if (normA === normB) return true;
    if (normA.includes(normB) || normB.includes(normA)) return true;

    const tokensA = normA.split(/[\s,]+/).filter(Boolean);
    const tokensB = normB.split(/[\s,]+/).filter(Boolean);
    const short = tokensA.length <= tokensB.length ? tokensA : tokensB;
    const long = tokensA.length <= tokensB.length ? tokensB : tokensA;
    if (short.length < 2) return false;
    const longSet = new Set(long);
    let overlap = 0;
    for (const token of short) {
      if (longSet.has(token)) overlap += 1;
    }
    return overlap / short.length >= 0.8;
  }

  function shouldPreferIncomingDuplicate(
    existing: { categoryId: string; notes: string; sourceGroup?: string; source?: string },
    incoming: { categoryId: string; notes: string; sourceGroup?: string; source?: string }
  ) {
    if (existing.categoryId === "cat_other" && incoming.categoryId !== "cat_other") return true;
    if (!existing.sourceGroup && !existing.source && (incoming.sourceGroup || incoming.source)) return true;
    if (incoming.notes.trim().length > existing.notes.trim().length + 6) return true;
    return false;
  }

  // Duplicate identity must be stable across file names/source labels.
  function txIdentityKey(e: { date: string; amount: number; notes: string }) {
    return [e.date, Number(e.amount).toFixed(2), normalizeIdentityText(e.notes)].join("|");
  }

  // Mirror identity ignores sign so we can repair + / - duplicates for direction-known rows.
  function txMirrorIdentityKey(e: { date: string; amount: number; notes: string }) {
    return [e.date, Number(Math.abs(e.amount)).toFixed(2), normalizeIdentityText(e.notes)].join("|");
  }

  function shouldPreferIncomingOverExistingMirror(
    existing: { amount: number; notes: string; sourceGroup?: string; source?: string },
    incoming: { amount: number; notes: string; sourceGroup?: string; source?: string }
  ) {
    const existingSource = existing.sourceGroup || sourceFamilyFromLabel(existing.source || "");
    const incomingSource = incoming.sourceGroup || sourceFamilyFromLabel(incoming.source || "");
    if (existingSource === "amex" || incomingSource === "amex") {
      // For AMEX imports, opposite-sign mirror rows should be replaced by latest parsed value.
      return incoming.amount !== existing.amount;
    }

    const direction = directionHintFromDescription(incoming.notes || existing.notes);
    if (direction === "outflow") return incoming.amount < 0 && existing.amount > 0;
    if (direction === "inflow") return incoming.amount > 0 && existing.amount < 0;
    return false;
  }

  function addUniqueTransactions(prev: Expense[], incoming: Array<Omit<Expense, "id" | "createdAt">>) {
    const incomingWithRules = incoming
      .map((inc) => ({
        ...inc,
        categoryId: resolveCategoryByLearnedRule(inc.notes, inc.categoryId),
      }))
      .filter((inc) => inc.categoryId !== "cat_ccpay" && !shouldExcludeImportedTransaction(inc.notes));

    const existingById = new Map(prev.map((e) => [e.id, e] as const));
    const identityToId = new Map<string, string>();
    const mirrorToId = new Map<string, string>();
    const dayAmountToIds = new Map<string, string[]>();
    for (const e of prev) {
      identityToId.set(txIdentityKey(e), e.id);
      const mirrorKey = txMirrorIdentityKey(e);
      if (!mirrorToId.has(mirrorKey)) mirrorToId.set(mirrorKey, e.id);
      const dayAmountKey = txDayAmountKey(e);
      const bucket = dayAmountToIds.get(dayAmountKey);
      if (bucket) bucket.push(e.id);
      else dayAmountToIds.set(dayAmountKey, [e.id]);
    }

    const add: Expense[] = [];
    let skippedAsDuplicate = 0;
    let correctedBySign = 0;

    for (const inc of incomingWithRules) {
      const identity = txIdentityKey(inc);
      if (identityToId.has(identity)) {
        skippedAsDuplicate += 1;
        continue;
      }

      const dayAmountKey = txDayAmountKey(inc);
      const dayBucket = dayAmountToIds.get(dayAmountKey) ?? [];
      let matchedSimilarId: string | null = null;
      for (const existingId of dayBucket) {
        const existing = existingById.get(existingId);
        if (!existing) continue;
        if (areLikelyDuplicateNames(existing.notes, inc.notes)) {
          matchedSimilarId = existingId;
          break;
        }
      }
      if (matchedSimilarId) {
        const existing = existingById.get(matchedSimilarId);
        if (existing && shouldPreferIncomingDuplicate(existing, inc)) {
          const oldIdentity = txIdentityKey(existing);
          const updated: Expense = {
            ...existing,
            ...inc,
            id: existing.id,
            createdAt: existing.createdAt,
          };
          existingById.set(existing.id, updated);
          identityToId.delete(oldIdentity);
          identityToId.set(txIdentityKey(updated), updated.id);
        }
        skippedAsDuplicate += 1;
        continue;
      }

      const mirrorKey = txMirrorIdentityKey(inc);
      const existingMirrorId = mirrorToId.get(mirrorKey);
      if (existingMirrorId) {
        const existingMirror = existingById.get(existingMirrorId);
        if (existingMirror) {
          if (shouldPreferIncomingOverExistingMirror(existingMirror, inc)) {
            const oldIdentity = txIdentityKey(existingMirror);
            const updated: Expense = {
              ...existingMirror,
              ...inc,
              id: existingMirror.id,
              createdAt: existingMirror.createdAt,
            };
            existingById.set(existingMirror.id, updated);
            identityToId.delete(oldIdentity);
            identityToId.set(txIdentityKey(updated), updated.id);
            correctedBySign += 1;
            continue;
          }

          // If direction is known (sent/received etc), block mirror +/-, it is a duplicate sign conflict.
          if (directionHintFromDescription(inc.notes || existingMirror.notes) !== "unknown") {
            skippedAsDuplicate += 1;
            continue;
          }
        }
      }

      const created = { ...inc, id: uid("exp"), createdAt: Date.now() };
      add.push(created);
      existingById.set(created.id, created);
      identityToId.set(identity, created.id);
      if (!mirrorToId.has(mirrorKey)) mirrorToId.set(mirrorKey, created.id);
      const bucket = dayAmountToIds.get(dayAmountKey);
      if (bucket) bucket.push(created.id);
      else dayAmountToIds.set(dayAmountKey, [created.id]);
    }

    const normalizedPrev = prev.map((e) => existingById.get(e.id) ?? e);

    return {
      nextExpenses: [...add, ...normalizedPrev],
      added: add.length,
      skippedAsDuplicate,
      correctedBySign,
    };
  }

  function dedupeAndAdd(incoming: Array<Omit<Expense, "id" | "createdAt">>) {
    let result = { nextExpenses: expenses, added: 0, skippedAsDuplicate: 0, correctedBySign: 0 };
    setExpenses((prev) => {
      result = addUniqueTransactions(prev, incoming);
      return result.nextExpenses;
    });
    return result;
  }

  function dedupePreviewRows(rows: Array<Omit<Expense, "id" | "createdAt">>) {
    const seen = new Set<string>();
    const directedMirrorIndex = new Map<string, number>();
    const dayAmountIndex = new Map<string, number[]>();
    const unique: Array<Omit<Expense, "id" | "createdAt">> = [];
    for (const r of rows) {
      const identity = txIdentityKey(r);
      if (seen.has(identity)) continue;

      const dayAmountKey = txDayAmountKey(r);
      const dayBucket = dayAmountIndex.get(dayAmountKey) ?? [];
      let matchedIdx: number | null = null;
      for (const idx of dayBucket) {
        const existing = unique[idx];
        if (existing && areLikelyDuplicateNames(existing.notes, r.notes)) {
          matchedIdx = idx;
          break;
        }
      }
      if (matchedIdx !== null) {
        const existing = unique[matchedIdx];
        if (shouldPreferIncomingDuplicate(existing, r)) {
          seen.delete(txIdentityKey(existing));
          unique[matchedIdx] = r;
          seen.add(identity);
        }
        continue;
      }

      const direction = directionHintFromDescription(r.notes);
      const mirrorKey = txMirrorIdentityKey(r);
      if (direction !== "unknown" && directedMirrorIndex.has(mirrorKey)) {
        const idx = directedMirrorIndex.get(mirrorKey)!;
        const existing = unique[idx];
        if (shouldPreferIncomingOverExistingMirror(existing, r)) {
          seen.delete(txIdentityKey(existing));
          unique[idx] = r;
          seen.add(identity);
        }
        continue;
      }

      seen.add(identity);
      unique.push(r);
      if (direction !== "unknown" && !directedMirrorIndex.has(mirrorKey)) {
        directedMirrorIndex.set(mirrorKey, unique.length - 1);
      }
      const idx = unique.length - 1;
      const bucket = dayAmountIndex.get(dayAmountKey);
      if (bucket) bucket.push(idx);
      else dayAmountIndex.set(dayAmountKey, [idx]);
    }
    return unique;
  }

  function removeDuplicates() {
    const seen = new Set<string>();
    const directedMirrorIndex = new Map<string, number>();
    const dayAmountIndex = new Map<string, number[]>();
    const cleaned: Expense[] = [];
    let removed = 0;
    let repairedSign = 0;

    for (const original of expenses) {
      const direction = directionHintFromDescription(original.notes);
      const e =
        direction === "outflow" && original.amount > 0
          ? { ...original, amount: -Math.abs(original.amount) }
          : direction === "inflow" && original.amount < 0
            ? { ...original, amount: Math.abs(original.amount) }
            : original;

      if (e !== original) repairedSign += 1;

      const identity = txIdentityKey(e);
      if (seen.has(identity)) {
        removed += 1;
        continue;
      }

      const dayAmountKey = txDayAmountKey(e);
      const dayBucket = dayAmountIndex.get(dayAmountKey) ?? [];
      let matchedIdx: number | null = null;
      for (const idx of dayBucket) {
        const existing = cleaned[idx];
        if (existing && areLikelyDuplicateNames(existing.notes, e.notes)) {
          matchedIdx = idx;
          break;
        }
      }
      if (matchedIdx !== null) {
        const existing = cleaned[matchedIdx];
        if (shouldPreferIncomingDuplicate(existing, e)) {
          seen.delete(txIdentityKey(existing));
          cleaned[matchedIdx] = e;
          seen.add(identity);
        }
        removed += 1;
        continue;
      }

      const mirrorKey = txMirrorIdentityKey(e);
      if (direction !== "unknown" && directedMirrorIndex.has(mirrorKey)) {
        const idx = directedMirrorIndex.get(mirrorKey)!;
        const existing = cleaned[idx];
        if (shouldPreferIncomingOverExistingMirror(existing, e)) {
          seen.delete(txIdentityKey(existing));
          cleaned[idx] = e;
          seen.add(identity);
        } else {
          removed += 1;
        }
        continue;
      }

      seen.add(identity);
      cleaned.push(e);
      if (direction !== "unknown" && !directedMirrorIndex.has(mirrorKey)) {
        directedMirrorIndex.set(mirrorKey, cleaned.length - 1);
      }
      const idx = cleaned.length - 1;
      const bucket = dayAmountIndex.get(dayAmountKey);
      if (bucket) bucket.push(idx);
      else dayAmountIndex.set(dayAmountKey, [idx]);
    }

    if (!removed) {
      if (repairedSign > 0) {
        setExpenses(cleaned);
        alert(`Repaired sign on ${repairedSign} transfer transaction${repairedSign === 1 ? "" : "s"}.`);
      } else {
        alert("No duplicates found.");
      }
      return;
    }

    setExpenses(cleaned);
    alert(
      `Removed ${removed} duplicate transaction${removed === 1 ? "" : "s"}${
        repairedSign > 0 ? ` and repaired sign on ${repairedSign} transfer transaction${repairedSign === 1 ? "" : "s"}` : ""
      }.`
    );
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [expenses, dateFrom, dateTo]);

  const filteredForCharts = useMemo(() => {
    return filteredExpenses.filter((e) => {
      if (excludeTransfersFromCharts && e.categoryId === "cat_transfers") return false;
      if (excludeCCPayFromCharts && e.categoryId === "cat_ccpay") return false;
      if (excludeInvestingSavingsFromCharts && isInvestingOrSavingsTransaction(e)) return false;
      if (chartCategoryFilter !== "all" && e.categoryId !== chartCategoryFilter) return false;
      return true;
    });
  }, [
    filteredExpenses,
    excludeTransfersFromCharts,
    excludeCCPayFromCharts,
    excludeInvestingSavingsFromCharts,
    chartCategoryFilter,
  ]);

  const expenseOnly = useMemo(() => filteredForCharts.filter((e) => e.amount < 0), [filteredForCharts]);
  const trueIncomeOnly = useMemo(
    () => filteredForCharts.filter((e) => e.amount > 0 && e.categoryId === "cat_income"),
    [filteredForCharts]
  );
  const creditOnly = useMemo(
    () => filteredForCharts.filter((e) => e.amount > 0 && e.categoryId !== "cat_income"),
    [filteredForCharts]
  );

  const totals = useMemo(() => {
    const spent = expenseOnly.reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const income = trueIncomeOnly.reduce((sum, e) => sum + e.amount, 0);
    const credits = creditOnly.reduce((sum, e) => sum + e.amount, 0);
    return { spent, income, credits, net: income + credits - spent };
  }, [expenseOnly, trueIncomeOnly, creditOnly]);

  const spendByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenseOnly) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + Math.abs(e.amount));
    return [...m.entries()]
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
  }, [expenseOnly, catById, chartTheme.pie]);

  /** ---------- Advisor ---------- */
  const advisorAlerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    const now = new Date();
    const mth = now.getMonth();
    const yr = now.getFullYear();

    const monthExpenses = expenseOnly.filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d.getMonth() === mth && d.getFullYear() === yr;
    });

    const byCatMonth = new Map<string, number>();
    for (const e of monthExpenses) byCatMonth.set(e.categoryId, (byCatMonth.get(e.categoryId) ?? 0) + Math.abs(e.amount));

    for (const b of budgets.filter((b) => b.period === "monthly")) {
      const spent = byCatMonth.get(b.categoryId) ?? 0;
      if (b.amount > 0) {
        const pct = spent / b.amount;
        if (pct >= 0.9 && pct < 1) {
          alerts.push({
            id: uid("al"),
            type: "warn",
            text: `Close to exceeding your ${catById.get(b.categoryId)?.name ?? "category"} budget (${Math.round(pct * 100)}%).`,
          });
        }
        if (pct >= 1) {
          alerts.push({
            id: uid("al"),
            type: "warn",
            text: `You exceeded your ${catById.get(b.categoryId)?.name ?? "category"} budget.`,
          });
        }
      }
    }

    const DAY = 86400000;
    const startThis = new Date(Date.now() - 7 * DAY);
    const startPrev = new Date(Date.now() - 14 * DAY);

    const thisWeek = expenseOnly.filter((e) => new Date(e.date + "T00:00:00") >= startThis);
    const prevWeek = expenseOnly.filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d >= startPrev && d < startThis;
    });

    const sumByCat = (rows: Expense[]) => {
      const m = new Map<string, number>();
      for (const e of rows) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + Math.abs(e.amount));
      return m;
    };

    const a = sumByCat(thisWeek);
    const b = sumByCat(prevWeek);

    for (const [catId, cur] of a.entries()) {
      const prev = b.get(catId) ?? 0;
      if (prev >= 40 && cur > prev * 1.25) {
        const pct = Math.round(((cur - prev) / prev) * 100);
        alerts.push({
          id: uid("al"),
          type: "info",
          text: `${catById.get(catId)?.name ?? "Category"} spending increased ${pct}% this week.`,
        });
      }
    }

    const top = spendByCategory[0];
    if (top && top.value >= 50) {
      alerts.unshift({ id: uid("al"), type: "info", text: `Top category: ${top.name} (${formatMoney(top.value)})` });
    }

    return alerts.slice(0, 6);
  }, [expenseOnly, budgets, catById, spendByCategory]);

  /** ---------- Exports ---------- */
  function exportToCSV(rows: Expense[], filenameBase: string) {
    const exportRows = rows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      .map((e) => ({
        Date: e.date,
        Description: e.notes,
        Amount: e.amount,
        AmountAbs: Math.abs(e.amount),
        Type: e.amount < 0 ? "Expense" : "Income",
        Category: catById.get(e.categoryId)?.name ?? e.categoryId,
        Source: e.source ?? "",
        Recurring: e.isRecurring ? "yes" : "no",
        Frequency: e.recurrenceFrequency,
      }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    triggerFileDownload(blob, `${filenameBase}.csv`);
  }

  function exportToXLSX(rows: Expense[], filenameBase: string) {
    const exportRows = rows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      .map((e) => ({
        Date: e.date,
        Description: e.notes,
        Amount: e.amount,
        AmountAbs: Math.abs(e.amount),
        Type: e.amount < 0 ? "Expense" : "Income",
        Category: catById.get(e.categoryId)?.name ?? e.categoryId,
        Source: e.source ?? "",
        Recurring: e.isRecurring,
        Frequency: e.recurrenceFrequency,
      }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerFileDownload(blob, `${filenameBase}.xlsx`);
  }

  /** ---------- Pages ---------- */
  function Dashboard() {
    const metricCards = [
      { label: "Total Spending", value: formatMoney(totals.spent) },
      { label: "Total Income (pay/deposits)", value: formatMoney(totals.income) },
      { label: "Credits & Refunds", value: formatMoney(totals.credits) },
      { label: "Net", value: formatMoney(totals.net) },
    ];

    return (
      <div>
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

  function Expenses() {
    const location = useLocation();
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
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

      if (queryCategory) setCategoryFilter(queryCategory);
      if (querySearch !== null) setSearch(querySearch);
      if (queryFrom !== null) setDateFrom(queryFrom);
      if (queryTo !== null) setDateTo(queryTo);
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
      <div>
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                <Filter size={16} /> Category
              </div>
              <select style={{ ...s.select, width: 230 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? "✨"} {c.name}
                  </option>
                ))}
              </select>

              <input
                style={{ ...s.input, width: 260 }}
                placeholder="Search description/source…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
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

        {categoryBreakdown.length > 0 ? (
          <div style={{ ...s.card, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              {categoryFilter === "all" ? "Category totals in current list" : "Selected category totals"}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {categoryBreakdown.map((c) => (
                <div
                  key={c.id}
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
                <div key={e.id} style={s.txCard}>
                  <div style={s.txLeft}>
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
                          <div style={s.txMeta}>
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
                          <div style={s.txMeta}>
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

                  <div style={s.txRight}>
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

  function AddExpense() {
    const [amount, setAmount] = useState("");
    const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "cat_other");
    const [date, setDate] = useState(toISODate(new Date()));
    const [notes, setNotes] = useState("");
    const [source, setSource] = useState("Manual");
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<Recurrence>("none");

    const [preview, setPreview] = useState<Array<Omit<Expense, "id" | "createdAt">>>([]);
    const [previewMsg, setPreviewMsg] = useState("");
    const [pasteBlocks, setPasteBlocks] = useState<Array<{ id: string; label: string; text: string }>>([
      { id: uid("pb"), label: "RBC", text: "" },
    ]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isPreviewingPaste, setIsPreviewingPaste] = useState(false);

    function fileFingerprint(file: File) {
      return `${file.name}|${file.size}|${file.lastModified}`;
    }

    function splitFilesByImportHistory(files: File[]) {
      const seen = new Set(importedFileFingerprints);
      const fresh: File[] = [];
      const alreadyImported: File[] = [];

      for (const file of files) {
        if (seen.has(fileFingerprint(file))) alreadyImported.push(file);
        else fresh.push(file);
      }

      return { fresh, alreadyImported };
    }

    function mergeSelectedFiles(nextFiles: File[]) {
      setSelectedFiles((prev) => {
        const map = new Map<string, File>();
        for (const f of prev) map.set(fileFingerprint(f), f);
        for (const f of nextFiles) map.set(fileFingerprint(f), f);
        return [...map.values()];
      });
    }

    function addPasteBox() {
      setPasteBlocks((p) => [...p, { id: uid("pb"), label: `Paste ${p.length + 1}`, text: "" }]);
    }

    async function parsePasteBlocksSmart(blocks: Array<{ id: string; label: string; text: string }>) {
      const all: Array<Omit<Expense, "id" | "createdAt">> = [];

      for (const b of blocks) {
        if (!b.text.trim()) continue;

        const localRows = parsePasteBlock(b.text, b.label).map((row) => ({
          ...row,
          categoryId: resolveCategoryByLearnedRule(row.notes, row.categoryId),
        }));
        all.push(...dedupePreviewRows(localRows));
      }

      const unique = dedupePreviewRows(all);
      const removed = all.length - unique.length;
      return { unique, removed };
    }

    async function previewPaste() {
      setIsPreviewingPaste(true);
      try {
        const { unique, removed } = await parsePasteBlocksSmart(pasteBlocks);
        setPreview(unique);
        setPreviewMsg(
          unique.length
            ? `Parsed ${unique.length} transactions from paste${
                removed > 0 ? ` (${removed} duplicates skipped)` : ""
              }.`
            : "Couldn’t parse paste yet. Upload CSV/XLSX or check statement format."
        );
      } finally {
        setIsPreviewingPaste(false);
      }
    }

    async function parseFilesIntoPreview(files: File[]) {
      const all: Array<Omit<Expense, "id" | "createdAt">> = [];
      let failed = 0;

      for (const f of files) {
        const name = f.name;
        let sourceGroup = sourceFamilyFromLabel(name);
        let rows: RawRow[] = [];
        try {
          if (name.toLowerCase().endsWith(".csv")) rows = await parseCsvFile(f);
          else rows = await parseXlsxFile(f);

          if (sourceGroup === "unknown" || sourceGroup === "rbc") {
            const contentHint = rows
              .slice(0, 120)
              .map((row) => Object.values(row).map((v) => String(v ?? "")).join(" "))
              .join(" ");
            sourceGroup = resolveSourceFamily(name, contentHint);
          }

          for (const r of rows) {
            const exp = rowToExpense(r, name, sourceGroup);
            if (exp) {
              const resolvedCategoryId = resolveCategoryByLearnedRule(exp.notes, exp.categoryId);
              if (resolvedCategoryId === "cat_ccpay" || shouldExcludeImportedTransaction(exp.notes)) continue;
              all.push({
                ...exp,
                categoryId: resolvedCategoryId,
                sourceGroup,
              });
            }
          }
        } catch (err) {
          failed += 1;
          console.error(err);
        }
      }

      const unique = dedupePreviewRows(all);
      const removed = all.length - unique.length;
      return { unique, removed, failed };
    }

    function syncAndAddFromFiles(incoming: Array<Omit<Expense, "id" | "createdAt">>) {
      // Never delete old rows automatically. Add/update only.
      const result = dedupeAndAdd(incoming);
      return {
        added: result.added,
        deleted: 0,
        skippedAsDuplicate: result.skippedAsDuplicate,
        correctedBySign: result.correctedBySign,
      };
    }

    async function addSelectedFilesNow() {
      if (!selectedFiles.length) {
        alert("Choose one or more files first.");
        return;
      }

      setIsImporting(true);
      try {
        const { fresh, alreadyImported } = splitFilesByImportHistory(selectedFiles);
        if (!fresh.length) {
          setPreview([]);
          setPreviewMsg(
            `Skipped ${alreadyImported.length} file${alreadyImported.length === 1 ? "" : "s"} because those exact files were already imported.`
          );
          setSelectedFiles([]);
          return;
        }

        const { unique, removed, failed } = await parseFilesIntoPreview(fresh);
        if (unique.length) {
          const synced = syncAndAddFromFiles(unique);
          setImportedFileFingerprints((prev) => [
            ...prev,
            ...fresh.map((file) => fileFingerprint(file)).filter((fingerprint) => !prev.includes(fingerprint)),
          ]);
          setPreview([]);
          setPreviewMsg(
            `Imported ${synced.added} transaction${synced.added === 1 ? "" : "s"} from ${fresh.length} file${
              fresh.length === 1 ? "" : "s"
            }.${
              removed > 0 || synced.skippedAsDuplicate > 0 || alreadyImported.length > 0
                ? ` Skipped ${removed + synced.skippedAsDuplicate + alreadyImported.length} duplicate item${
                    removed + synced.skippedAsDuplicate + alreadyImported.length === 1 ? "" : "s"
                  }.`
                : ""
            }${synced.correctedBySign > 0 ? ` Repaired sign on ${synced.correctedBySign} transfer transaction${synced.correctedBySign === 1 ? "" : "s"}.` : ""}`
          );
        } else {
          setPreviewMsg(
            failed > 0
              ? "Could not parse selected file(s). Try CSV export from your bank and re-upload."
              : alreadyImported.length
                ? "No new transactions found. Matching files were already imported."
                : "No transactions found in selected files (header mismatch)."
          );
        }
        setSelectedFiles([]);
      } finally {
        setIsImporting(false);
      }
    }

    async function importNow() {
      setIsImporting(true);
      try {
        let rowsToImport = preview;
        let importedFromSelectedFiles = false;
        let freshFiles: File[] = [];
        let alreadyImportedFiles: File[] = [];

        // If preview is empty, try parsing the selected files on Import click too.
        if (!rowsToImport.length && selectedFiles.length) {
          const split = splitFilesByImportHistory(selectedFiles);
          freshFiles = split.fresh;
          alreadyImportedFiles = split.alreadyImported;
          if (!freshFiles.length) {
            setPreview([]);
            setPreviewMsg(
              `Skipped ${alreadyImportedFiles.length} file${alreadyImportedFiles.length === 1 ? "" : "s"} because those exact files were already imported.`
            );
            setSelectedFiles([]);
            return;
          }

          const { unique, removed } = await parseFilesIntoPreview(freshFiles);
          rowsToImport = unique;
          importedFromSelectedFiles = true;
          setPreview(unique);
          setPreviewMsg(
            unique.length
              ? `Parsed ${unique.length} transactions from selected file${
                  freshFiles.length === 1 ? "" : "s"
                }${
                  removed > 0 ? ` (${removed} duplicates skipped)` : ""
                }.`
              : "No transactions found in selected files."
          );
        }

        // If still empty, try paste blocks directly.
        if (!rowsToImport.length) {
          const { unique: uniquePasted } = await parsePasteBlocksSmart(pasteBlocks);
          if (uniquePasted.length) {
            rowsToImport = uniquePasted;
            setPreview(uniquePasted);
            setPreviewMsg(`Parsed ${uniquePasted.length} transactions from paste.`);
          }
        }

        if (!rowsToImport.length) {
          alert("Nothing to import yet. Upload files or paste transactions first.");
          return;
        }

        if (importedFromSelectedFiles) {
          const synced = syncAndAddFromFiles(rowsToImport);
          setImportedFileFingerprints((prev) => [
            ...prev,
            ...freshFiles.map((file) => fileFingerprint(file)).filter((fingerprint) => !prev.includes(fingerprint)),
          ]);
          setPreview([]);
          setPreviewMsg(
            `Imported ${synced.added} transaction${synced.added === 1 ? "" : "s"}.${
              synced.skippedAsDuplicate > 0 || alreadyImportedFiles.length > 0
                ? ` Skipped ${synced.skippedAsDuplicate + alreadyImportedFiles.length} duplicate item${
                    synced.skippedAsDuplicate + alreadyImportedFiles.length === 1 ? "" : "s"
                  }.`
                : ""
            }${synced.correctedBySign > 0 ? ` Repaired sign on ${synced.correctedBySign} transfer transaction${synced.correctedBySign === 1 ? "" : "s"}.` : ""}`
          );
        } else {
          const added = dedupeAndAdd(rowsToImport);
          setPreview([]);
          setPreviewMsg(
            added.skippedAsDuplicate > 0
              ? `Imported ${added.added} transaction${added.added === 1 ? "" : "s"}. Skipped ${added.skippedAsDuplicate} duplicate${
                  added.skippedAsDuplicate === 1 ? "" : "s"
                }.${added.correctedBySign > 0 ? ` Repaired sign on ${added.correctedBySign} transfer transaction${added.correctedBySign === 1 ? "" : "s"}.` : ""}`
              : `Imported ${added.added} transaction${added.added === 1 ? "" : "s"}.${
                  added.correctedBySign > 0
                    ? ` Repaired sign on ${added.correctedBySign} transfer transaction${added.correctedBySign === 1 ? "" : "s"}.`
                    : ""
                }`
          );
        }
        setSelectedFiles([]);
      } finally {
        setIsImporting(false);
      }
    }

    function addManual() {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) return alert("Enter a valid amount");
      const result = dedupeAndAdd([
        {
          amount: -Math.abs(n),
          categoryId,
          date,
          notes: notes.trim() || "Manual entry",
          source: source.trim() || "Manual",
          isRecurring,
          recurrenceFrequency: isRecurring ? recurrenceFrequency : "none",
        },
      ]);
      if (result.added === 0) {
        alert("That transaction already exists, so it was not added again.");
        return;
      }
      setAmount("");
      setNotes("");
      setIsRecurring(false);
      setRecurrenceFrequency("none");
    }

    return (
      <div>
        <PageTitle title="Add Expense" subtitle="Upload files OR paste. Preview shows what will be imported." />

        <div style={s.grid2}>
          {/* Manual */}
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Manual Entry</div>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={s.input} placeholder="Amount (e.g. 12.34)" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select style={s.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? "✨"} {c.name}
                  </option>
                ))}
              </select>
              <input style={s.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input style={s.input} placeholder="Notes (Starbucks, rent…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <input style={s.input} placeholder="Source (RBC, AMEX…)" value={source} onChange={(e) => setSource(e.target.value)} />

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                Recurring expense (subscriptions)
              </label>

              <select
                style={s.select}
                value={recurrenceFrequency}
                onChange={(e) => setRecurrenceFrequency(e.target.value as Recurrence)}
                disabled={!isRecurring}
              >
                <option value="none">none</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>

              <button style={s.btnPrimary} onClick={addManual}>
                <PlusCircle size={16} /> Add
              </button>
            </div>
          </div>

          {/* Import */}
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Import Transactions</div>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 650, marginBottom: 10 }}>
              Upload RBC + AMEX CSV/XLSX files. You can upload multiple files at once.
            </div>

            {/* FILE UPLOAD */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Upload CSV / Excel</div>
              <input
                type="file"
                multiple
                accept=".csv,.xlsx,.xls"
                style={s.input}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  mergeSelectedFiles(files);
                  setPreviewMsg(
                    `Selected ${files.length} new file${files.length === 1 ? "" : "s"}. Click "Add Selected Files" to import.`
                  );
                  // Allow selecting the same file again.
                  e.target.value = "";
                }}
              />
              {selectedFiles.length ? (
                <div style={{ marginTop: 8, fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                  Selected: {selectedFiles.map((f) => f.name).join(", ")}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button style={s.btnPrimary} onClick={addSelectedFilesNow} disabled={!selectedFiles.length || isImporting}>
                  {isImporting ? "Adding..." : "Add Selected Files"}
                </button>
                <button
                  style={s.btnSecondary}
                  onClick={() => setSelectedFiles([])}
                  disabled={!selectedFiles.length || isImporting}
                >
                  Clear Selected
                </button>
              </div>
            </div>

            {/* PASTE */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 900 }}>Paste (optional)</div>
              <button style={s.btnSecondary} onClick={addPasteBox}>
                + Add box
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                padding: 10,
                marginBottom: 10,
                background: softLayer(0.62, 0.85),
              }}
            >
              <div style={{ fontWeight: 850 }}>Local parser is enabled.</div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Amount sign rules: `-$x` or `(x)` treated as inflow/credit; `+$x` treated as outflow/expense.
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {pasteBlocks.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: 18,
                    padding: 12,
                    background: softLayer(0.65, 0.86),
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <input
                      style={{ ...s.input, maxWidth: 220 }}
                      value={b.label}
                      onChange={(e) =>
                        setPasteBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    {pasteBlocks.length > 1 ? (
                      <button style={s.iconBtn} onClick={() => setPasteBlocks((p) => p.filter((x) => x.id !== b.id))} title="Remove">
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>

                  <textarea
                    style={{ ...s.textarea, marginTop: 10 }}
                    value={b.text}
                    onChange={(e) =>
                      setPasteBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))
                    }
                    placeholder="Paste transactions here (RBC/AMEX)…"
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                style={s.btnSecondary}
                onClick={() => void previewPaste()}
                disabled={isImporting || isPreviewingPaste}
              >
                {isPreviewingPaste ? "Parsing..." : "Preview Paste"}
              </button>
              <button style={s.btnPrimary} onClick={importNow} disabled={isImporting || isPreviewingPaste}>
                {isImporting ? "Importing..." : "Import Transactions"}
              </button>
              {previewMsg ? (
                <div style={{ color: PALETTE.muted, fontWeight: 700, fontSize: 12, alignSelf: "center" }}>
                  {previewMsg}
                </div>
              ) : null}
            </div>

            {preview.length ? (
              <div style={{ marginTop: 12, maxHeight: 260, overflow: "auto", display: "grid", gap: 8 }}>
                {preview.slice(0, 80).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: `1px solid ${PALETTE.border}`,
                      background: softLayer(0.78, 0.9),
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.date}</div>
                    <div style={{ color: PALETTE.muted }}>{r.source}</div>
                    <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.notes}
                    </div>
                    <div style={{ fontWeight: 900 }}>{formatMoney(r.amount)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function Categories() {
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
      setCategories(Object.values(draft));
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

  function Budgets() {
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
    }, [budgets, filteredExpenses, selectedMonthlyViewKey]);

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

  function Personalize() {
    const basePalette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
    const iconPresets = ["💜", "💎", "💰", "🏦", "🧠", "📊", "✨", "🚀", "🌸", "🎯", "🦋", "🔥"];
    const [draftBrandIcon, setDraftBrandIcon] = useState(brandIcon);
    const [draftAppTitle, setDraftAppTitle] = useState(appTitle);
    const [draftAppSubtitle, setDraftAppSubtitle] = useState(appSubtitle);
    const [draftPrimaryActionLabel, setDraftPrimaryActionLabel] = useState(primaryActionLabel);
    const [draftAppFont, setDraftAppFont] = useState<AppFontId>(appFont);
    const [draftHeadingFont, setDraftHeadingFont] = useState<HeadingFontId>(headingFont);
    const [draftUiRadius, setDraftUiRadius] = useState(uiRadius);
    const [draftUiShadow, setDraftUiShadow] = useState(uiShadow);
    const [draftUiGlass, setDraftUiGlass] = useState(uiGlass);
    const [draftUiMotionMs, setDraftUiMotionMs] = useState(uiMotionMs);
    const [customThemeName, setCustomThemeName] = useState("");
    const [customThemeNotice, setCustomThemeNotice] = useState("");

    useEffect(() => {
      setDraftBrandIcon(brandIcon);
      setDraftAppTitle(appTitle);
      setDraftAppSubtitle(appSubtitle);
      setDraftPrimaryActionLabel(primaryActionLabel);
      setDraftAppFont(appFont);
      setDraftHeadingFont(headingFont);
      setDraftUiRadius(uiRadius);
      setDraftUiShadow(uiShadow);
      setDraftUiGlass(uiGlass);
      setDraftUiMotionMs(uiMotionMs);
    }, [brandIcon, appTitle, appSubtitle, primaryActionLabel, appFont, headingFont, uiRadius, uiShadow, uiGlass, uiMotionMs]);

    const brandDirty =
      draftBrandIcon !== brandIcon ||
      draftAppTitle !== appTitle ||
      draftAppSubtitle !== appSubtitle ||
      draftPrimaryActionLabel !== primaryActionLabel ||
      draftAppFont !== appFont ||
      draftHeadingFont !== headingFont ||
      draftUiRadius !== uiRadius ||
      draftUiShadow !== uiShadow ||
      draftUiGlass !== uiGlass ||
      draftUiMotionMs !== uiMotionMs;

    function resetColorsToThemeDefaults() {
      setColorAccent(basePalette.accent);
      setColorBg(basePalette.bg);
      setColorPanel(basePalette.panel);
      setColorPanel2(basePalette.panel2);
      setColorCard(basePalette.card);
    }

    function applyThemeMode(nextMode: "light" | "dark") {
      const nextBase = nextMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
      setThemeMode(nextMode);
      setColorAccent(nextBase.accent);
      setColorBg(nextBase.bg);
      setColorPanel(nextBase.panel);
      setColorPanel2(nextBase.panel2);
      setColorCard(nextBase.card);
    }

    function applyThemePreset(preset: ThemePreset) {
      setThemeMode(preset.mode);
      setColorAccent(preset.accent);
      setColorBg(preset.bg);
      setColorPanel(preset.panel);
      setColorPanel2(preset.panel2);
      setColorCard(preset.card);
    }

    function saveCurrentThemeAsCustom() {
      const name = customThemeName.trim().replace(/\s+/g, " ").slice(0, 36);
      if (!name) {
        setCustomThemeNotice("Type a theme name first.");
        return;
      }
      const nextMode: "light" | "dark" = themeMode === "dark" ? "dark" : "light";
      const nextBase = nextMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
      const normalized = normalizeAccountId(name) || `theme_${Date.now().toString(36)}`;
      const desiredId = `custom_${normalized}`;

      setCustomThemes((prev) => {
        const existing = prev.find((theme) => theme.id === desiredId || theme.label.toLowerCase() === name.toLowerCase());
        const nextPreset: ThemePreset = {
          id: existing?.id ?? desiredId,
          label: name,
          note: "",
          mode: nextMode,
          accent: sanitizeHexColor(colorAccent, nextBase.accent),
          bg: sanitizeHexColor(colorBg, nextBase.bg),
          panel: sanitizeHexColor(colorPanel, nextBase.panel),
          panel2: sanitizeHexColor(colorPanel2, nextBase.panel2),
          card: sanitizeHexColor(colorCard, nextBase.card),
        };
        if (existing) return prev.map((theme) => (theme.id === existing.id ? nextPreset : theme));
        return [...prev, nextPreset].slice(-24);
      });

      setCustomThemeName("");
      setCustomThemeNotice(`Saved "${name}"`);
    }

    function saveBrandingDraft() {
      setBrandIcon(draftBrandIcon);
      setAppTitle(draftAppTitle.slice(0, 48));
      setAppSubtitle(draftAppSubtitle.slice(0, 90));
      setPrimaryActionLabel(draftPrimaryActionLabel.slice(0, 40));
      setAppFont(sanitizeAppFont(draftAppFont));
      setHeadingFont(sanitizeHeadingFont(draftHeadingFont));
      setUiRadius(clampNumber(draftUiRadius, 8, 28, DEFAULT_UI_RADIUS));
      setUiShadow(clampNumber(draftUiShadow, 0, 24, DEFAULT_UI_SHADOW));
      setUiGlass(clampNumber(draftUiGlass, 70, 100, DEFAULT_UI_GLASS));
      setUiMotionMs(clampNumber(draftUiMotionMs, 80, 420, DEFAULT_UI_MOTION_MS));
    }

    return (
      <div>
        <PageTitle
          title="Personalize"
          subtitle="Make this account your own: app name, fonts, colors, corners, shadows, and motion are saved per account."
        />

        <div style={s.grid2}>
          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Brand</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Brand icon
                </div>
                <input
                  style={s.input}
                  value={draftBrandIcon}
                  onChange={(e) => setDraftBrandIcon(e.target.value)}
                  placeholder="💜"
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {iconPresets.map((icon) => (
                    <button
                      key={icon}
                      style={draftBrandIcon === icon ? s.btnPrimary : s.btnSecondary}
                      onClick={() => setDraftBrandIcon(icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginTop: 6 }}>
                  Pick a preset or type/paste any emoji(s) you want.
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  App name
                </div>
                <input
                  style={s.input}
                  value={draftAppTitle}
                  onChange={(e) => setDraftAppTitle(e.target.value.slice(0, 48))}
                  placeholder="My Budget Hub"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Subtitle
                </div>
                <input
                  style={s.input}
                  value={draftAppSubtitle}
                  onChange={(e) => setDraftAppSubtitle(e.target.value.slice(0, 90))}
                  placeholder="Family finances and goals"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Primary action text
                </div>
                <input
                  style={s.input}
                  value={draftPrimaryActionLabel}
                  onChange={(e) => setDraftPrimaryActionLabel(e.target.value.slice(0, 40))}
                  placeholder="Primary action"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  App font
                </div>
                <select
                  style={s.select}
                  value={draftAppFont}
                  onChange={(e) => setDraftAppFont(sanitizeAppFont(e.target.value))}
                >
                  {APP_FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>
                  Heading font
                </div>
                <select
                  style={s.select}
                  value={draftHeadingFont}
                  onChange={(e) => setDraftHeadingFont(sanitizeHeadingFont(e.target.value))}
                >
                  {HEADING_FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Layout controls (full custom)</div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Corner radius: {draftUiRadius}px</div>
                  <input
                    type="range"
                    min={8}
                    max={28}
                    step={1}
                    value={draftUiRadius}
                    onChange={(e) => setDraftUiRadius(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Shadow depth: {draftUiShadow}</div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={draftUiShadow}
                    onChange={(e) => setDraftUiShadow(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Glass effect: {draftUiGlass}%</div>
                  <input
                    type="range"
                    min={70}
                    max={100}
                    step={1}
                    value={draftUiGlass}
                    onChange={(e) => setDraftUiGlass(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                    Motion speed: {draftUiMotionMs}ms
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={420}
                    step={10}
                    value={draftUiMotionMs}
                    onChange={(e) => setDraftUiMotionMs(Number(e.target.value))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btnPrimary} onClick={saveBrandingDraft} disabled={!brandDirty}>
                  Save Branding
                </button>
                <button
                  style={s.btnSecondary}
                  onClick={() => {
                    setDraftBrandIcon(brandIcon);
                    setDraftAppTitle(appTitle);
                    setDraftAppSubtitle(appSubtitle);
                    setDraftPrimaryActionLabel(primaryActionLabel);
                    setDraftAppFont(appFont);
                    setDraftHeadingFont(headingFont);
                    setDraftUiRadius(uiRadius);
                    setDraftUiShadow(uiShadow);
                    setDraftUiGlass(uiGlass);
                    setDraftUiMotionMs(uiMotionMs);
                  }}
                  disabled={!brandDirty}
                >
                  Cancel
                </button>
              </div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Brand edits apply when you click Save Branding.
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Colors</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Theme mode</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    style={themeMode === "light" ? s.btnPrimary : s.btnSecondary}
                    onClick={() => applyThemeMode("light")}
                  >
                    Light
                  </button>
                  <button
                    style={themeMode === "dark" ? s.btnPrimary : s.btnSecondary}
                    onClick={() => applyThemeMode("dark")}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Themes</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {allThemePresets.map((preset) => {
                    const selected = activeThemePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        style={{
                          ...(selected ? s.btnPrimary : s.btnSecondary),
                          width: "100%",
                          justifyContent: "space-between",
                          textAlign: "left",
                        }}
                        onClick={() => applyThemePreset(preset)}
                      >
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Save current colors as theme</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    style={s.input}
                    value={customThemeName}
                    onChange={(e) => {
                      setCustomThemeName(e.target.value.slice(0, 36));
                      if (customThemeNotice) setCustomThemeNotice("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveCurrentThemeAsCustom();
                      }
                    }}
                    placeholder="Theme name (ex: Soft Pink)"
                  />
                  <button style={s.btnPrimary} onClick={saveCurrentThemeAsCustom}>
                    Save As Theme
                  </button>
                </div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                  Your saved themes are account-specific and stay after refresh.
                </div>
                {customThemeNotice ? (
                  <div style={{ fontSize: 12, color: PALETTE.good, fontWeight: 800 }}>{customThemeNotice}</div>
                ) : null}
              </div>

              {[
                { label: "Accent", value: colorAccent, set: setColorAccent },
                { label: "Background", value: colorBg, set: setColorBg },
                { label: "Sidebar panel", value: colorPanel, set: setColorPanel },
                { label: "Main panel", value: colorPanel2, set: setColorPanel2 },
                { label: "Card", value: colorCard, set: setColorCard },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "grid", gap: 8 }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "120px 56px 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: PALETTE.muted }}>{item.label}</div>
                    <input
                      type="color"
                      value={item.value}
                      onInput={(e) => item.set((e.target as HTMLInputElement).value)}
                      onChange={(e) => item.set(e.target.value)}
                      style={{ width: 52, height: 36, border: "none", background: "transparent", padding: 0 }}
                    />
                    <input
                      style={s.input}
                      value={item.value}
                      onChange={(e) => item.set(e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      overflowX: "auto",
                      padding: "2px 1px 4px",
                      scrollbarWidth: "thin",
                    }}
                  >
                    {COLOR_SWATCHES.map((swatch) => {
                      const selected = item.value.toLowerCase() === swatch.toLowerCase();
                      return (
                        <button
                          key={`${item.label}-${swatch}`}
                          onClick={() => item.set(swatch)}
                          title={swatch}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            border: selected ? `2px solid ${PALETTE.text}` : `1px solid ${PALETTE.border}`,
                            background: swatch,
                            flex: "0 0 auto",
                            cursor: "pointer",
                            boxShadow: selected ? `0 0 0 2px ${colorWithAlpha(PALETTE.accent, 0.24)}` : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Scroll the color dots sideways for smoother color picking.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btnSecondary} onClick={resetColorsToThemeDefaults}>
                  Reset Colors To Theme
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Preview</div>
          <div
            style={{
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 18,
              padding: 14,
              background: PALETTE.panel,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: colorWithAlpha(PALETTE.accent, 0.2),
                }}
              >
                {draftBrandIcon || "💜"}
              </div>
              <div>
                <div className="bb-section-title" style={{ fontWeight: 950 }}>
                  {draftAppTitle || "Budget Bestie"}
                </div>
                <div style={{ color: PALETTE.muted, fontSize: 12, fontWeight: 700 }}>
                  {draftAppSubtitle || "Pastel finance tool (paste + files)"}
                </div>
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                background: PALETTE.card,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontWeight: 800 }}>{draftPrimaryActionLabel || "Primary action"}</span>
              <span
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: colorWithAlpha(PALETTE.accent, 0.18),
                  fontWeight: 900,
                }}
              >
                {PALETTE.accent}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Reports() {
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
      return sliced.map((row, idx) => {
        const start = Math.max(0, idx - 2);
        const sample = sliced.slice(start, idx + 1);
        const avg = sample.reduce((sum, item) => sum + item.value, 0) / Math.max(1, sample.length);
        return { ...row, avg };
      });
    }, [reportRows]);
    const performanceDeltaPct = useMemo(() => {
      if (weekly.length < 2) return 0;
      const latest = weekly[weekly.length - 1]?.value ?? 0;
      const prior = weekly[weekly.length - 2]?.value ?? 0;
      if (prior <= 0) return 0;
      return Math.round(((latest - prior) / prior) * 100);
    }, [weekly]);
    const performanceBadge = `${performanceDeltaPct >= 0 ? "+" : ""}${performanceDeltaPct}%`;
    const performanceMidWeek = weekly[Math.floor(weekly.length / 2)]?.week ?? null;

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
    }, [reportRows, catById, chartTheme.pie]);

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
    }, [filteredExpenses, catById]);

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
      <div>
        <PageTitle
          title="Reports"
          subtitle="Pie + trends + weekly/monthly summaries."
          right={
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? "✨"} {c.name}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 950 }}>Interactive Cross-Filter</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={s.btnSecondary} onClick={resetInteractiveFilters}>
                Reset chart filters
              </button>
              <button style={s.btnPrimary} onClick={openInteractiveRows}>
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

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950 }}>Data Quality Monitor</div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                Analyst checks on current filter window.
              </div>
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
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Rows scanned</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{dataQuality.totalRows}</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Duplicate candidates</div>
              <div style={{ fontWeight: 950, marginTop: 4, color: dataQuality.duplicateCandidateCount > 0 ? PALETTE.bad : PALETTE.good }}>
                {dataQuality.duplicateCandidateCount}
              </div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Sign anomalies</div>
              <div style={{ fontWeight: 950, marginTop: 4, color: dataQuality.signAnomalyCount > 0 ? PALETTE.bad : PALETTE.good }}>
                {dataQuality.signAnomalyCount}
              </div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Missing fields</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{dataQuality.missingFieldCount}</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Invalid dates</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{dataQuality.invalidDateCount}</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Unknown categories</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{dataQuality.uncategorizedCount}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button style={s.btnSecondary} onClick={removeDuplicates}>
              Clean duplicates now
            </button>
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Behavior Patterns & Variance</div>
          <div style={s.grid3}>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Weekend avg spend/txn</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{formatMoney(weekdayWeekendStats.weekendAvg)}</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Weekday avg spend/txn</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{formatMoney(weekdayWeekendStats.weekdayAvg)}</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Weekend lift</div>
              <div style={{ fontWeight: 950, marginTop: 4, color: weekdayWeekendStats.weekendLiftPct > 0 ? PALETTE.warn : PALETTE.good }}>
                {Math.round(weekdayWeekendStats.weekendLiftPct)}%
              </div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Top 1 merchant share</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{Math.round(merchantConcentration.top1SharePct)}%</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Top 5 merchant share</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{Math.round(merchantConcentration.top5SharePct)}%</div>
            </div>
            <div style={{ ...s.card, padding: 10 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Merchant concentration (HHI)</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{Math.round(merchantConcentration.hhi)}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontWeight: 900 }}>
            Monthly budget variance ({monthLabel(varianceMonthKey)})
          </div>
          {budgetVarianceRows.length === 0 ? (
            <div style={{ marginTop: 8, color: PALETTE.muted, fontWeight: 650 }}>
              No monthly budgets set. Add monthly budgets to unlock variance analysis.
            </div>
          ) : (
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {budgetVarianceRows.slice(0, 8).map((row) => (
                <div
                  key={row.categoryId}
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
                  <div style={{ color: row.variance > 0 ? PALETTE.bad : PALETTE.good }}>
                    Var {formatMoney(row.variance)}
                  </div>
                  <div style={{ color: row.variance > 0 ? PALETTE.bad : PALETTE.good }}>
                    {Math.round(row.variancePct)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
              background:
                themeMode === "dark"
                  ? `linear-gradient(180deg, ${colorWithAlpha(PALETTE.card, 0.92)} 0%, ${colorWithAlpha(PALETTE.panel, 0.88)} 100%)`
                  : `linear-gradient(180deg, rgba(249,248,252,0.95) 0%, rgba(244,241,250,0.95) 100%)`,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 950, marginBottom: 4 }}>Performance Chart</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Track results and watch your progress rise.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Week", "Month", "Year"].map((tab, idx) => (
                  <button
                    key={tab}
                    style={
                      idx === 1
                        ? {
                            ...s.btnPrimary,
                            minWidth: 72,
                            justifyContent: "center",
                            borderRadius: 14,
                            padding: "8px 12px",
                            background: "linear-gradient(180deg, #131313 0%, #060606 100%)",
                            border: "1px solid rgba(255,255,255,0.16)",
                          }
                        : {
                            ...s.btnSecondary,
                            minWidth: 72,
                            justifyContent: "center",
                            borderRadius: 14,
                            padding: "8px 12px",
                            background: themeMode === "dark" ? colorWithAlpha(PALETTE.card, 0.82) : "rgba(255,255,255,0.86)",
                          }
                    }
                    type="button"
                    aria-label={`${tab} view`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
              {[
                { label: "Theory", color: "#bfc4ff" },
                { label: "Practice", color: "#f0b6c8" },
                { label: "Lexicon", color: "#e5b8d8" },
              ].map((entry) => (
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

            {weekly.length === 0 ? (
              <div style={{ color: PALETTE.muted, fontWeight: 650 }}>No data yet.</div>
            ) : (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    height: 330,
                    borderRadius: 18,
                    overflow: "hidden",
                    background: themeMode === "dark" ? colorWithAlpha(PALETTE.panel2, 0.44) : "rgba(255,255,255,0.6)",
                    border: `1px solid ${PALETTE.border}`,
                    padding: 8,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weekly} margin={{ top: 10, right: 12, left: 8, bottom: 6 }}>
                      <defs>
                        <pattern id="bbPerfStripe" width="9" height="9" patternUnits="userSpaceOnUse">
                          <rect width="9" height="9" fill={colorWithAlpha("#eff1ff", themeMode === "dark" ? 0.08 : 0.35)} />
                          <line x1="1" y1="0" x2="1" y2="9" stroke={colorWithAlpha("#b4bcff", themeMode === "dark" ? 0.45 : 0.8)} strokeWidth="1.1" />
                        </pattern>
                      </defs>
                      <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="week"
                        tick={{ fill: PALETTE.muted, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => {
                          const raw = String(value ?? "");
                          const parts = raw.split("-W");
                          return parts.length === 2 ? `W${parts[1]}` : raw;
                        }}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v) => currencyTooltip(v)}
                        contentStyle={{ background: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 12 }}
                      />
                      {performanceMidWeek ? <ReferenceLine x={performanceMidWeek} stroke={PALETTE.border} strokeDasharray="4 4" /> : null}
                      <Area type="monotone" dataKey="avg" stroke="transparent" fill="url(#bbPerfStripe)" />
                      <Line type="monotone" dataKey="value" stroke="#efb4c8" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="avg" stroke="#b8bcff" strokeWidth={2.5} dot={false} />
                      <Brush dataKey="week" height={18} stroke="#0b0b0b" travellerWidth={10} />
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
                    background: "linear-gradient(180deg, rgba(247,203,223,0.95) 0%, rgba(243,195,219,0.88) 100%)",
                    border: "1px solid rgba(255,255,255,0.7)",
                    boxShadow: "0 10px 24px rgba(180, 125, 150, 0.2)",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ fontWeight: 980, fontSize: 28, lineHeight: 1 }}>{performanceBadge}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(31, 19, 47, 0.75)", marginTop: 4 }}>Recent movement</div>
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
              <input
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
              <input
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
              <input
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
              <input
                type="range"
                min={0}
                max={35}
                step={1}
                value={riskBufferPct}
                onChange={(e) => setRiskBufferPct(Number(e.target.value))}
              />
              <div style={{ fontWeight: 800, fontSize: 12 }}>{riskBufferPct}%</div>

              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Confidence level</div>
              <input
                type="range"
                min={60}
                max={99}
                step={1}
                value={forecastConfidencePct}
                onChange={(e) => setForecastConfidencePct(Number(e.target.value))}
              />
              <div style={{ fontWeight: 800, fontSize: 12 }}>{forecastConfidencePct}%</div>

              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Manual volatility floor</div>
              <input
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
                {savingsPotential.top.map((c) => (
                  <div key={c.categoryId} style={{ display: "flex", justifyContent: "space-between", padding: 12, borderRadius: 18, border: `1px solid ${PALETTE.border}`, background: softLayer(0.75, 0.9) }}>
                    <div style={{ fontWeight: 900 }}>{c.name}</div>
                    <div style={{ fontWeight: 900 }}>Save ~ {formatMoney(c.value * 0.1)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
                      <input
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
            <div style={{ color: PALETTE.good, fontWeight: 800, fontSize: 12, marginTop: 8 }}>
              {shareNotice}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /** ---------- Danger / Data Tools in Sidebar ---------- */
  function deleteRange() {
    if (!deleteFrom && !deleteTo) return alert("Set From or To date first.");
    if (!confirm("Delete transactions in this date range?")) return;
    setExpenses((prev) => prev.filter((e) => !inDeleteRange(e.date)));
  }

  function resetAll() {
    if (!confirm("Reset all data? This cannot be undone.")) return;
    const defaults = defaultAccountData();
    setExpenses([]);
    setBudgets([]);
    setCategories(defaults.categories);
    setImportedFileFingerprints([]);
    setCustomThemes(defaults.customThemes);
    setBrandIcon(defaults.brandIcon);
    setAppTitle(defaults.appTitle);
    setAppSubtitle(defaults.appSubtitle);
    setPrimaryActionLabel(defaults.primaryActionLabel);
    setAppFont(defaults.appFont);
    setHeadingFont(defaults.headingFont);
    const basePalette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
    setColorAccent(basePalette.accent);
    setColorBg(basePalette.bg);
    setColorPanel(basePalette.panel);
    setColorPanel2(basePalette.panel2);
    setColorCard(basePalette.card);
    setUiRadius(defaults.uiRadius);
    setUiShadow(defaults.uiShadow);
    setUiGlass(defaults.uiGlass);
    setUiMotionMs(defaults.uiMotionMs);
    setDateFrom("");
    setDateTo("");
    setDeleteFrom("");
    setDeleteTo("");
    setExcludeTransfersFromCharts(defaults.excludeTransfersFromCharts);
    setExcludeCCPayFromCharts(defaults.excludeCCPayFromCharts);
    setExcludeInvestingSavingsFromCharts(defaults.excludeInvestingSavingsFromCharts);
    setLearnedCategoryRules({});
  }

  function setQuickThemeMode(nextMode: "light" | "dark") {
    const nextBase = nextMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
    setThemeMode(nextMode);
    setColorAccent(nextBase.accent);
    setColorBg(nextBase.bg);
    setColorPanel(nextBase.panel);
    setColorPanel2(nextBase.panel2);
    setColorCard(nextBase.card);
  }

  if (!isRestoreBootstrapReady) {
    return (
      <div style={pageStyle}>
        <div style={{ ...s.card, maxWidth: 520, margin: "80px auto", textAlign: "center", fontWeight: 900 }}>
          Preparing your saved data...
        </div>
      </div>
    );
  }

  if (cloudRuntimeEnabled && !isCloudReady) {
    return (
      <div style={pageStyle}>
        <div style={{ ...s.card, maxWidth: 480, margin: "80px auto", textAlign: "center", fontWeight: 900 }}>
          Connecting cloud account...
        </div>
      </div>
    );
  }

  if (!isStorageReady) {
    return (
      <div style={pageStyle}>
        <div style={{ ...s.card, maxWidth: 480, margin: "80px auto", textAlign: "center", fontWeight: 900 }}>
          Loading saved data...
        </div>
      </div>
    );
  }

  if (cloudEnabled && !cloudUser) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            ...s.card,
            maxWidth: 560,
            margin: "64px auto",
            padding: 28,
            boxShadow: "0 24px 46px rgba(26, 17, 13, 0.14)",
          }}
        >
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${PALETTE.border}` }}>
            <div className="bb-page-title" style={{ fontSize: 32, fontWeight: 980, marginBottom: 4 }}>
              {appTitle || "Budget Bestie"}
            </div>
            <div style={{ color: PALETTE.muted, fontWeight: 700 }}>
              Secure cloud account. Your data syncs across phone and computer.
            </div>
            {isCloudSyncPaused ? (
              <div style={{ marginTop: 8, color: PALETTE.warn, fontWeight: 800, fontSize: 12 }}>
                {cloudPauseReason || "Cloud sync is paused because free-tier limits were reached."}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              style={cloudAuthMode === "signin" ? s.btnPrimary : s.btnSecondary}
              onClick={() => {
                setCloudError("");
                setCloudAuthMode("signin");
              }}
              disabled={isCloudAuthBusy || isCloudSyncPaused}
            >
              Sign In
            </button>
            <button
              style={cloudAuthMode === "create" ? s.btnPrimary : s.btnSecondary}
              onClick={() => {
                setCloudError("");
                setCloudAuthMode("create");
              }}
              disabled={isCloudAuthBusy || isCloudSyncPaused}
            >
              Create Account
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitCloudAuth();
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>Email</div>
              <input
                style={s.input}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={cloudEmail}
                onChange={(e) => setCloudEmail(e.target.value)}
                disabled={isCloudSyncPaused}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>Password</div>
              <input
                style={s.input}
                type="password"
                autoComplete={cloudAuthMode === "create" ? "new-password" : "current-password"}
                placeholder={cloudAuthMode === "create" ? "At least 6 characters" : "Enter your password"}
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                disabled={isCloudSyncPaused}
              />
            </div>

            <button style={s.btnPrimary} type="submit" disabled={isCloudAuthBusy || isCloudSyncPaused}>
              {isCloudAuthBusy ? "Please wait..." : cloudAuthMode === "create" ? "Create Cloud Account" : "Sign In"}
            </button>
          </form>

          {cloudError ? <div style={{ marginTop: 10, color: PALETTE.warn, fontSize: 12, fontWeight: 700 }}>{cloudError}</div> : null}

          <div style={{ marginTop: 12, color: PALETTE.muted, fontSize: 12, fontWeight: 700 }}>
            Cloud mode enabled via `VITE_ENABLE_CLOUD_SYNC=true` + Supabase keys.
          </div>
        </div>
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            ...s.card,
            maxWidth: 560,
            margin: "64px auto",
            padding: 28,
            boxShadow: "0 24px 46px rgba(26, 17, 13, 0.14)",
          }}
        >
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${PALETTE.border}` }}>
            <div className="bb-page-title" style={{ fontSize: 32, fontWeight: 980, marginBottom: 4 }}>
              {appTitle || "Budget Bestie"}
            </div>
            <div style={{ color: PALETTE.muted, fontWeight: 700 }}>
              Create an account or sign in. Each account has separate transactions, budgets, and categories.
            </div>
            {!crossBrowserSyncEnabled ? (
              <div style={{ marginTop: 8, color: PALETTE.muted, fontWeight: 700, fontSize: 12 }}>
                Browser-local mode: accounts here do not sync to other browsers/devices.
              </div>
            ) : (
              <div style={{ marginTop: 8, color: PALETTE.muted, fontWeight: 700, fontSize: 12 }}>
                Cross-browser sync mode: sign in with the same username and password on any device.
              </div>
            )}
            {isCloudSyncPaused ? (
              <div style={{ marginTop: 10, color: PALETTE.warn, fontSize: 12, fontWeight: 800 }}>
                {cloudPauseReason || "Cloud free plan limit reached. Cloud sync is paused right now."}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              style={authMode === "signin" ? s.btnPrimary : s.btnSecondary}
              onClick={() => setLocalAuthMode("signin")}
            >
              Sign In
            </button>
            <button
              style={authMode === "create" ? s.btnPrimary : s.btnSecondary}
              onClick={() => setLocalAuthMode("create")}
            >
              Create Account
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLocalAuth();
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>Username</div>
              <input
                style={s.input}
                autoComplete="username"
                placeholder="Enter username"
                value={authUsername}
                onChange={(e) => {
                  setAuthError("");
                  setAuthInfo("");
                  setAuthUsername(e.target.value);
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>Password</div>
              <input
                style={s.input}
                type="password"
                autoComplete={authMode === "create" ? "new-password" : "current-password"}
                placeholder={authMode === "create" ? "At least 6 characters" : "Enter password"}
                value={authPassword}
                onChange={(e) => {
                  setAuthError("");
                  setAuthInfo("");
                  setAuthPassword(e.target.value);
                }}
              />
            </div>

            <button style={s.btnPrimary} type="submit">
              {authMode === "create" ? "Create Account" : "Sign In"}
            </button>
          </form>

          {authError ? <div style={{ marginTop: 10, color: PALETTE.warn, fontSize: 12, fontWeight: 700 }}>{authError}</div> : null}
          {!authError && authInfo ? (
            <div style={{ marginTop: 10, color: PALETTE.good, fontSize: 12, fontWeight: 700 }}>{authInfo}</div>
          ) : null}

          <div style={{ marginTop: 12, color: PALETTE.muted, fontSize: 12, fontWeight: 700 }}>
            Data is saved automatically and stays until manually deleted.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bb-page-smooth" style={pageStyle}>
      {/* Responsive CSS */}
      <style>{`
        .bb-shell,
        .bb-sidebar,
        .bb-main,
        .bb-account-card,
        .bb-delete-card,
        .bb-nav-link {
          box-sizing: border-box;
        }

        .bb-page-smooth * {
          transition: background-color var(--bb-motion-ms, 220ms) ease, border-color var(--bb-motion-ms, 220ms) ease, box-shadow var(--bb-motion-ms, 220ms) ease, color var(--bb-motion-ms, 220ms) ease;
        }

        .bb-nav-link:hover {
          background: ${colorWithAlpha(PALETTE.accent, 0.1)} !important;
          border: 1px solid ${colorWithAlpha(PALETTE.accent, 0.2)} !important;
        }

        .bb-delete-card .bb-delete-grid > * {
          width: 100%;
          min-width: 0;
        }

        .bb-delete-card .bb-delete-grid button {
          justify-content: center;
        }

        .bb-delete-card input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0.62;
          cursor: pointer;
        }

        .bb-brand-title,
        .bb-page-title,
        .bb-section-title {
          font-family: var(--bb-heading-font) !important;
          letter-spacing: 0.01em;
        }

        button:hover {
          transform: translateY(-1px);
        }

        button:active {
          transform: translateY(0);
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: ${colorWithAlpha(PALETTE.accent, 0.45)} !important;
          box-shadow: 0 0 0 3px ${colorWithAlpha(PALETTE.accent, 0.12)} !important;
        }

        .bb-sidebar::-webkit-scrollbar {
          width: 10px;
        }
        .bb-sidebar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: ${colorWithAlpha(PALETTE.text, 0.18)};
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .bb-mobile-tabs {
          display: none;
        }

        @media (max-width: 1250px){
          .bb-shell {
            max-width: 100%;
            margin: 10px;
            padding: 12px;
            border-radius: 26px;
          }
          .bb-main .bb-page-title {
            font-size: 26px !important;
          }
        }

        @media (max-width: 1020px){
          .bb-shell {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            margin: 10px !important;
            padding: 12px !important;
            border-radius: 24px !important;
          }
          .bb-sidebar {
            position: relative !important;
            top: 0 !important;
            height: auto !important;
            width: 100% !important;
            border-radius: 20px !important;
            padding: 12px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
          }
          .bb-main {
            min-height: auto !important;
          }
          .bb-top-actions,
          .bb-top-title {
            width: 100% !important;
          }
        }

        @media (max-width: 900px){
          .bb-shell {
            margin: 0 !important;
            min-height: 100vh !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
          }
          .bb-sidebar {
            display: none !important;
          }
          .bb-main {
            padding-bottom: 82px !important;
          }
          .bb-top-bar {
            display: grid !important;
            grid-template-columns: 1fr auto !important;
            gap: 8px !important;
            padding: 10px !important;
            border-radius: 18px !important;
          }
          .bb-top-tabs {
            display: none !important;
          }
          .bb-top-title {
            font-size: clamp(26px, 8vw, 34px) !important;
            line-height: 1.04 !important;
            padding-left: 0 !important;
          }
          .bb-top-actions {
            gap: 6px !important;
            align-self: start !important;
          }
          .bb-top-actions > button:nth-of-type(3) {
            display: none !important;
          }
          .bb-top-actions > .bb-avatar {
            display: none !important;
          }
          .bb-global-date-card {
            padding: 10px !important;
          }
          .bb-global-date-controls {
            display: grid !important;
            grid-template-columns: 1fr !important;
            width: 100% !important;
          }
          .bb-global-date-controls input,
          .bb-global-date-controls button {
            width: 100% !important;
            min-width: 0 !important;
          }
          .bb-mobile-tabs {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 6px;
            position: fixed;
            left: 8px;
            right: 8px;
            bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
            z-index: 40;
            border: 1px solid ${PALETTE.border};
            background: ${colorWithAlpha(PALETTE.panel2, 0.96)};
            border-radius: 16px;
            padding: 6px;
            box-shadow: 0 14px 32px rgba(25, 17, 14, 0.18);
            backdrop-filter: blur(10px);
          }
          .bb-mobile-tab {
            border: 1px solid transparent;
            text-decoration: none;
            color: ${PALETTE.text};
            border-radius: 12px;
            display: grid;
            justify-items: center;
            gap: 2px;
            padding: 8px 4px;
            font-size: 10.5px;
            font-weight: 780;
          }
          .bb-mobile-tab.active {
            background: ${colorWithAlpha(PALETTE.accent, 0.18)};
            border-color: ${colorWithAlpha(PALETTE.accent, 0.44)};
          }
          .bb-mobile-tab svg {
            width: 17px;
            height: 17px;
          }
        }
      `}</style>

      <div className="bb-shell" style={s.shell}>
        <aside className="bb-sidebar" style={s.sidebar}>
          <div style={s.brand}>
            <div style={s.brandIcon}>{brandIcon || "💜"}</div>
            <div style={{ minWidth: 0 }}>
              <div className="bb-brand-title" style={s.brandTitle}>
                {appTitle || "Budget Bestie"}
              </div>
              <div style={s.brandSub}>{appSubtitle || "Pastel finance tool (paste + files)"}</div>
            </div>
          </div>

          <div style={s.railNav}>
            <RailItem to="/" title="Dashboard" icon={<LayoutDashboard size={20} />} />
            <RailItem to="/expenses" title="Expenses" icon={<Receipt size={20} />} />
            <RailItem to="/add" title="Add Expense" icon={<PlusCircle size={20} />} />
            <RailItem to="/categories" title="Categories" icon={<Tags size={20} />} />
            <RailItem to="/budgets" title="Budgets" icon={<Wallet size={20} />} />
            <RailItem to="/reports" title="Reports" icon={<BarChart3 size={20} />} />
            <RailItem to="/personalize" title="Personalize" icon={<BrushIcon size={20} />} />
          </div>

          <div className="bb-account-card" style={{ ...s.card, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800 }}>Signed in as</div>
            <div style={{ fontWeight: 900, marginTop: 4, marginBottom: 8 }}>
              {cloudRuntimeEnabled ? cloudUser?.email || activeAccount?.name : activeAccount?.name}
            </div>
            <button style={s.btnSecondary} onClick={() => void signOutEverything()}>
              {cloudRuntimeEnabled ? "Sign out" : "Switch account"}
            </button>
          </div>

          <div style={{ marginTop: "auto" }} />

          <div className="bb-delete-card" style={s.card}>
            <div className="bb-section-title" style={{ fontWeight: 950, marginBottom: 10 }}>
              Delete data
            </div>
            <div className="bb-delete-grid" style={{ display: "grid", gap: 10 }}>
              <div style={s.deleteLabel}>From</div>
              <input
                style={{ ...s.input, ...s.deleteInput }}
                type="date"
                value={deleteFrom}
                onChange={(e) => setDeleteFrom(e.target.value)}
              />
              <div style={s.deleteLabel}>To</div>
              <input
                style={{ ...s.input, ...s.deleteInput }}
                type="date"
                value={deleteTo}
                onChange={(e) => setDeleteTo(e.target.value)}
              />
              <button style={{ ...s.btnSecondary, ...s.deleteBtn }} onClick={deleteRange}>
                <Trash2 size={16} /> Delete transactions in range
              </button>
              <button style={{ ...s.btnSecondary, ...s.deleteBtn }} onClick={removeDuplicates}>
                <Check size={16} /> Clean duplicates
              </button>
              <button style={{ ...s.btnPrimary, ...s.deleteDangerBtn }} onClick={resetAll}>
                Reset all data
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={{ ...s.iconPill, flex: 1 }} title="Light mode" onClick={() => setQuickThemeMode("light")}>
              <Sun size={18} />
            </button>
            <button style={{ ...s.iconPill, flex: 1 }} title="Dark mode" onClick={() => setQuickThemeMode("dark")}>
              <Moon size={18} />
            </button>
            <button style={{ ...s.iconPill, flex: 1 }} title="Personalize" onClick={() => nav("/personalize")}>
              <Settings2 size={18} />
            </button>
          </div>
        </aside>

        <main className="bb-main" style={s.main}>
          <div className="bb-top-bar" style={s.topBar}>
            <div className="bb-top-title bb-page-title" style={{ fontSize: 32, fontWeight: 930, paddingLeft: 8 }}>
              Good {greeting}, {accountFirstName}
            </div>

            <div className="bb-top-tabs" style={s.topTabs}>
              <TopTabItem to="/" label="Dashboard" />
              <TopTabItem to="/expenses" label="Expenses" />
              <TopTabItem to="/budgets" label="Budgets" />
              <TopTabItem to="/reports" label="Reports" />
            </div>

            <div className="bb-top-actions" style={s.topActions}>
              <button style={s.iconPill} title="Search">
                <Search size={18} />
              </button>
              <button style={s.iconPill} title="Notifications">
                <Bell size={18} />
              </button>
              <button style={s.iconPill} title="Personalize" onClick={() => nav("/personalize")}>
                <Settings2 size={18} />
              </button>
              <div className="bb-avatar" style={s.avatarPill} title={activeAccount?.name}>
                <UserRound size={18} />
              </div>
            </div>
          </div>

          {isCloudSyncPaused ? (
            <div
              style={{
                ...s.card,
                marginBottom: 12,
                borderLeft: `6px solid ${PALETTE.warn}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <AlertTriangle size={18} style={{ marginTop: 2, color: PALETTE.warn }} />
              <div>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>Cloud sync paused</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                  {cloudPauseReason || "Cloud free plan limit reached. App continues in local save mode."}
                </div>
              </div>
            </div>
          ) : null}

          <div className="bb-global-date-card" style={{ ...s.card, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 950 }}>Global Date Filter</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>
                  Applies to Dashboard, Expenses, Budgets, and Reports.
                </div>
              </div>
              <div className="bb-global-date-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <input
                  style={{ ...s.input, width: 170 }}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <input
                  style={{ ...s.input, width: 170 }}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                <button
                  style={s.btnSecondary}
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/add" element={<AddExpense />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/personalize" element={<Personalize />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/assistant" element={<Reports />} />
          </Routes>
        </main>

        <nav className="bb-mobile-tabs" aria-label="Mobile navigation">
          {[
            { to: "/", label: "Home", icon: <LayoutDashboard /> },
            { to: "/expenses", label: "Expenses", icon: <Receipt /> },
            { to: "/add", label: "Add", icon: <PlusCircle /> },
            { to: "/reports", label: "Reports", icon: <BarChart3 /> },
            { to: "/budgets", label: "Budgets", icon: <Wallet /> },
            { to: "/categories", label: "Categories", icon: <Tags /> },
            { to: "/personalize", label: "Style", icon: <BrushIcon /> },
            { to: "/assistant", label: "Insights", icon: <AlertTriangle /> },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `bb-mobile-tab${isActive ? " active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Week number helper */
function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
