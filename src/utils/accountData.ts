import type { AccountData, AppFontId, Budget, Category, Expense, HeadingFontId, Recurrence, StoredAccount, ThemePreset } from "../types/domain";
import { DARK_PALETTE, DEFAULT_UI_GLASS, DEFAULT_UI_MOTION_MS, DEFAULT_UI_RADIUS, DEFAULT_UI_SHADOW, HEADING_FONT_OPTIONS, LIGHT_PALETTE } from "./theme";
import { parseDateFlexible, uid } from "./dateMoney";
import { shouldExcludeImportedTransaction } from "./transactionParsing";

export const DEFAULT_CATEGORIES: Category[] = [
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

export const APP_FONT_OPTIONS: Array<{ id: AppFontId; label: string; stack: string }> = [
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

export const DEFAULT_APP_FONT: AppFontId = "clean";

export function sanitizeAppFont(value: unknown, fallback: AppFontId = DEFAULT_APP_FONT): AppFontId {
  if (typeof value !== "string") return fallback;
  const matched = APP_FONT_OPTIONS.find((font) => font.id === value);
  return matched ? matched.id : fallback;
}

export function appFontStack(fontId: AppFontId): string {
  return APP_FONT_OPTIONS.find((font) => font.id === fontId)?.stack ?? APP_FONT_OPTIONS[0].stack;
}

export function sanitizeHeadingFont(value: unknown, fallback: HeadingFontId = "serif"): HeadingFontId {
  if (typeof value !== "string") return fallback;
  const matched = HEADING_FONT_OPTIONS.find((font) => font.id === value);
  return matched ? matched.id : fallback;
}

export function headingFontStack(fontId: HeadingFontId): string {
  return HEADING_FONT_OPTIONS.find((font) => font.id === fontId)?.stack ?? HEADING_FONT_OPTIONS[0].stack;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeAccountId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "");
}

export function usernameToCloudEmails(usernameInput: string) {
  const normalized = normalizeAccountId(usernameInput);
  if (!normalized) return [];
  // Keep backward compatibility with older cloud accounts while preferring a
  // widely accepted domain for new sign-ups.
  const candidates = [
    `${normalized}@gmail.com`,
    `${normalized}@budgetbestie.app`,
  ];
  return [...new Set(candidates)];
}

export function defaultAccountData(): AccountData {
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
    savingsTrackerGoal: 0,
    savingsTrackerSaved: 0,
  };
}

export function sanitizeCategories(raw: unknown): Category[] {
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

export function sanitizeBudgets(raw: unknown): Budget[] {
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

export function sanitizeExpenses(raw: unknown): Expense[] {
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

export function sanitizeLearnedRules(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const cleanedRules: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v && v !== "cat_ccpay") cleanedRules[k] = v;
  }
  return cleanedRules;
}

export function sanitizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const s = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

export function sanitizeBrandText(value: unknown, fallback: string, maxLen: number) {
  if (typeof value !== "string") return fallback;
  const next = repairMojibakeText(value).trim().replace(/\s+/g, " ");
  if (!next) return fallback;
  return next.slice(0, maxLen);
}

export function isLikelyMojibakeText(value: string): boolean {
  // Common UTF-8 -> latin1 corruption markers (e.g. "ðŸ’¸", "Ã¢â‚¬").
  return /[\uFFFD]|Ã|Â|ð|Ÿ|™|œ|ž|ï|¸|¢|¤|½/.test(value);
}

export function repairMojibakeText(value: string): string {
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

export function defaultCategoryIconFor(categoryId: string, categoryName: string): string | undefined {
  const byId = DEFAULT_CATEGORIES.find((c) => c.id === categoryId)?.icon;
  if (byId) return byId;
  const normalizedName = categoryName.trim().toLowerCase();
  return DEFAULT_CATEGORIES.find((c) => c.name.trim().toLowerCase() === normalizedName)?.icon;
}

export function sanitizeCategoryIcon(rawIcon: unknown, categoryId: string, categoryName: string): string | undefined {
  const fallback = defaultCategoryIconFor(categoryId, categoryName);
  if (typeof rawIcon !== "string") return fallback;
  const icon = repairMojibakeText(rawIcon).trim();
  if (!icon) return fallback;
  if (isLikelyMojibakeText(icon)) return fallback;
  if (icon.length > 12) return fallback;
  return icon;
}

export function sanitizeThemePresets(raw: unknown): ThemePreset[] {
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

export function sanitizeAccountData(raw: unknown): AccountData {
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
    savingsTrackerGoal: clampNumber(raw.savingsTrackerGoal, 0, 1_000_000_000, 0),
    savingsTrackerSaved: clampNumber(raw.savingsTrackerSaved, 0, 1_000_000_000, 0),
  };
}

export function expenseCountForAccount(account: StoredAccount | undefined): number {
  const rows = account?.data?.expenses;
  return Array.isArray(rows) ? rows.length : 0;
}

export function resolvePreferredCurrentAccount(
  requestedId: string | null,
  accounts: Record<string, StoredAccount>
): string | null {
  const ids = Object.keys(accounts);
  if (!ids.length) return null;
  if (!requestedId || !accounts[requestedId]) return ids[0];

  const requestedCount = expenseCountForAccount(accounts[requestedId]);
  const requestedAccount = accounts[requestedId];
  const fullerAccountId = ids
    .filter((id) => id !== requestedId)
    .sort((a, b) => expenseCountForAccount(accounts[b]) - expenseCountForAccount(accounts[a]))[0];

  if (
    requestedId === "my_account" &&
    requestedAccount.name === "My Account" &&
    !requestedAccount.password &&
    fullerAccountId &&
    expenseCountForAccount(accounts[fullerAccountId]) >= requestedCount + 20
  ) {
    return fullerAccountId;
  }

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
