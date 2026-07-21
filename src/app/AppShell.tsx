import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, BrushIcon, Check, LayoutDashboard, Moon, PlusCircle, Receipt, Search, Settings2, Sun, Tags, Trash2, UserRound, Wallet } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getCloudUser, isSupabaseConfigured, loadCloudStateJson, saveCloudStateJson, signInCloud, signOutCloud, signUpCloud, supabase, verifyCloudConnection } from "../supabase";
import type { CloudUser } from "../supabase";
import { ACCOUNT_ENDPOINT_SYNC_ENABLED, DARK_PALETTE, DEFAULT_UI_GLASS, DEFAULT_UI_MOTION_MS, DEFAULT_UI_RADIUS, DEFAULT_UI_SHADOW, LIGHT_PALETTE, PALETTE, STATE_ENDPOINT_SYNC_ENABLED, THEME_PRESETS, UI_THEME, appFontStack, chartStyleForTheme, clampNumber, cloudErrorSummary, colorWithAlpha, createAccountInSyncApi, defaultAccountData, directionHintFromDescription, ensureStateHasDefaultAccount, formatMoney, guessDisplayNameFromEmail, headingFontStack, isCloudQuotaLimitError, isInvestingOrSavingsTransaction, isPersistedStateEmpty, isPersistedStateMoreComplete, loadAccountFromSyncApi, loadLocalHistoryStates, loadLocalSessionUserId, loadPersistedAppStateFromApi, loadPersistedAppStateFromLocalStorage, makeStyles, mergePersistedStateCandidates, normalizeAccountId, parsePersistedAppState, persistedStateExpenseCount, resolveActiveThemePresetId, resolvePreferredCurrentAccount, sanitizeAccountData, sanitizeHexColor, saveAccountToSyncApi, saveLocalSessionUserId, savePersistedAppStateToApi, savePersistedAppStateToLocalStorage, setPalette, setUiTheme, shouldExcludeImportedTransaction, sourceFamilyFromLabel, transactionNameKey, triggerFileDownload, uid, usernameToCloudEmails } from "./appCore";
import type { Alert, AppFontId, Budget, Category, Expense, HeadingFontId, PersistedAppState, StoredAccount, ThemePreset } from "./appCore";
import { BudgetBestieProvider } from "./BudgetBestieContext";
import { RailItem, TopTabItem } from "./uiComponents";
import { AddExpensePage } from "../pages/AddExpensePage";
import { BudgetsPage } from "../pages/BudgetsPage";
import { CategoriesPage } from "../pages/CategoriesPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ExpensesPage } from "../pages/ExpensesPage";
import { PersonalizePage } from "../pages/PersonalizePage";
import { ReportsPage } from "../pages/ReportsPage";
import "./AppShell.css";

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isCloudConnectionError(error: unknown): boolean {
  const msg = cloudErrorSummary(error).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("networkerror") ||
    msg.includes("load failed")
  );
}

export function AppShell() {
  const nav = useNavigate();
  const cloudEnabled = isSupabaseConfigured;

  const [accounts, setAccounts] = useState<Record<string, StoredAccount>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [isAccountReady, setIsAccountReady] = useState(false);

  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [isCloudReady, setIsCloudReady] = useState(!cloudEnabled);
  const [cloudAuthMode, setCloudAuthMode] = useState<"signin" | "create">("signin");
  const [cloudUsername, setCloudUsername] = useState("");
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
  const [savingsTrackerGoal, setSavingsTrackerGoal] = useState(0);
  const [savingsTrackerSaved, setSavingsTrackerSaved] = useState(0);

  const [deleteFrom, setDeleteFrom] = useState<string>("");
  const [deleteTo, setDeleteTo] = useState<string>("");
  const [restorePayloadText, setRestorePayloadText] = useState("");
  const cloudRuntimeEnabled = cloudEnabled && !isCloudSyncPaused;
  const accountSyncEnabled = ACCOUNT_ENDPOINT_SYNC_ENABLED;
  const crossBrowserSyncEnabled = cloudRuntimeEnabled || accountSyncEnabled || STATE_ENDPOINT_SYNC_ENABLED;
  const showPrivateRestore = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("restore") === "local";

  const activeAccount = currentUserId ? accounts[currentUserId] ?? null : null;
  const basePalette = themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  setPalette({
    ...basePalette,
    accent: sanitizeHexColor(colorAccent, basePalette.accent),
    bg: sanitizeHexColor(colorBg, basePalette.bg),
    panel: sanitizeHexColor(colorPanel, basePalette.panel),
    panel2: sanitizeHexColor(colorPanel2, basePalette.panel2),
    card: sanitizeHexColor(colorCard, basePalette.card),
  });
  const allThemePresets = useMemo(() => [...customThemes, ...THEME_PRESETS], [customThemes]);
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
  setUiTheme({
    radius: clampNumber(uiRadius, 8, 28, DEFAULT_UI_RADIUS),
    shadow: clampNumber(uiShadow, 0, 24, DEFAULT_UI_SHADOW),
    glass: clampNumber(uiGlass, 70, 100, DEFAULT_UI_GLASS),
    motionMs: clampNumber(uiMotionMs, 80, 420, DEFAULT_UI_MOTION_MS),
    headingFontStack: headingFontStack(headingFont),
    isDark: themeMode === "dark",
  });
  const s = makeStyles();
  const fontFamily = appFontStack(appFont);
  const pageStyle = {
    ...s.page,
    fontFamily,
    "--bb-motion-ms": `${UI_THEME.motionMs}ms`,
    "--bb-heading-font": UI_THEME.headingFontStack,
    "--bb-radius": `${UI_THEME.radius}px`,
    "--bb-text": PALETTE.text,
    "--bb-muted": PALETTE.muted,
    "--bb-accent": PALETTE.accent,
    "--bb-bg": PALETTE.bg,
    "--bb-panel": PALETTE.panel,
    "--bb-panel2": PALETTE.panel2,
    "--bb-card": PALETTE.card,
    "--bb-border": PALETTE.border,
    "--bb-good": PALETTE.good,
    "--bb-warn": PALETTE.warn,
    "--bb-bad": PALETTE.bad,
    "--bb-ambient-sheen": colorWithAlpha("#ffffff", themeMode === "dark" ? 0.02 : 0.32),
    "--bb-ambient-accent": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.16 : 0.18),
    "--bb-dot-color": colorWithAlpha(PALETTE.text, themeMode === "dark" ? 0.16 : 0.08),
    "--bb-dot-opacity": themeMode === "dark" ? 0.13 : 0.09,
    "--bb-sidebar-sheen": colorWithAlpha("#ffffff", themeMode === "dark" ? 0.08 : 0.58),
    "--bb-sidebar-top-glow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.18 : 0.2),
    "--bb-sidebar-bottom-glow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.12 : 0.14),
    "--bb-sidebar-rail-strong": colorWithAlpha(PALETTE.accent, 0.34),
    "--bb-sidebar-rail-soft": colorWithAlpha(PALETTE.accent, 0.18),
    "--bb-sidebar-rail-shadow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.18 : 0.14),
    "--bb-nav-hover-accent": colorWithAlpha(PALETTE.accent, 0.14),
    "--bb-nav-hover-card": colorWithAlpha(PALETTE.card, themeMode === "dark" ? 0.72 : 0.9),
    "--bb-nav-hover-border": colorWithAlpha(PALETTE.accent, 0.28),
    "--bb-nav-hover-shadow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.16 : 0.14),
    "--bb-card-sheen": colorWithAlpha("#ffffff", themeMode === "dark" ? 0.06 : 0.54),
    "--bb-kicker-color": colorWithAlpha(PALETTE.text, themeMode === "dark" ? 0.62 : 0.52),
    "--bb-focus-border": colorWithAlpha(PALETTE.accent, 0.45),
    "--bb-focus-shadow": colorWithAlpha(PALETTE.accent, 0.12),
    "--bb-range-border": colorWithAlpha(PALETTE.border, themeMode === "dark" ? 0.9 : 0.78),
    "--bb-range-fill-strong": colorWithAlpha(PALETTE.accent, 0.92),
    "--bb-range-fill-soft": colorWithAlpha(PALETTE.accent, 0.62),
    "--bb-range-empty-start": colorWithAlpha(PALETTE.card, themeMode === "dark" ? 0.34 : 0.72),
    "--bb-range-empty-end": colorWithAlpha(PALETTE.panel2, themeMode === "dark" ? 0.64 : 0.82),
    "--bb-range-sheen": colorWithAlpha("#ffffff", themeMode === "dark" ? 0.12 : 0.72),
    "--bb-range-inner-light": colorWithAlpha("#ffffff", themeMode === "dark" ? 0.1 : 0.72),
    "--bb-range-inner-shadow": colorWithAlpha(PALETTE.text, themeMode === "dark" ? 0.18 : 0.06),
    "--bb-range-outer-shadow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.14 : 0.1),
    "--bb-range-thumb-border": colorWithAlpha("#ffffff", themeMode === "dark" ? 0.3 : 0.92),
    "--bb-range-thumb-deep": colorWithAlpha(PALETTE.text, themeMode === "dark" ? 0.42 : 0.2),
    "--bb-range-thumb-shadow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.32 : 0.24),
    "--bb-range-thumb-base-shadow": colorWithAlpha(PALETTE.text, themeMode === "dark" ? 0.32 : 0.14),
    "--bb-range-focus-ring": colorWithAlpha(PALETTE.accent, 0.16),
    "--bb-range-thumb-hover-shadow": colorWithAlpha(PALETTE.accent, themeMode === "dark" ? 0.38 : 0.28),
    "--bb-range-thumb-base-hover-shadow": colorWithAlpha(PALETTE.text, themeMode === "dark" ? 0.34 : 0.16),
    "--bb-scrollbar-thumb": colorWithAlpha(PALETTE.text, 0.18),
    "--bb-mobile-card-bg": colorWithAlpha(PALETTE.card, themeMode === "dark" ? 0.92 : 0.84),
    "--bb-mobile-card-shadow": themeMode === "dark"
      ? "0 12px 24px rgba(0,0,0,0.28)"
      : "0 10px 22px rgba(41, 31, 47, 0.09)",
    "--bb-mobile-progress-track": colorWithAlpha(PALETTE.accent, 0.16),
    "--bb-mobile-progress-fill-strong": colorWithAlpha(PALETTE.accent, 0.95),
    "--bb-mobile-progress-fill-soft": colorWithAlpha(PALETTE.accent, 0.72),
    "--bb-mobile-icon-bg": colorWithAlpha(PALETTE.accent, 0.17),
    "--bb-mobile-goal-accent": colorWithAlpha(PALETTE.accent, 0.2),
    "--bb-mobile-goal-card": colorWithAlpha(PALETTE.card, 0.94),
    "--bb-mobile-overview-strong": colorWithAlpha(PALETTE.accent, 0.66),
    "--bb-mobile-overview-soft": colorWithAlpha(PALETTE.accent, 0.46),
    "--bb-mobile-tabs-bg": colorWithAlpha(PALETTE.panel2, 0.96),
    "--bb-mobile-tab-active-bg": colorWithAlpha(PALETTE.accent, 0.18),
    "--bb-mobile-tab-active-border": colorWithAlpha(PALETTE.accent, 0.44),
  } as React.CSSProperties;
  const softLayer = (lightAlpha: number, darkAlpha = 0.9) =>
    themeMode === "dark" ? colorWithAlpha(PALETTE.card, darkAlpha) : `rgba(255,255,255,${lightAlpha})`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const rawAccountName =
    (cloudRuntimeEnabled ? cloudUser?.email?.split("@")[0] : activeAccount?.name?.split(" ")[0]) || "there";
  const accountDisplayName = rawAccountName
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const accountGreetingName =
    accountDisplayName === "there" ? "there" : (accountDisplayName.split(" ")[0] || accountDisplayName).slice(0, 20);

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

  const pauseCloudSyncFromConnectionError = useCallback((error: unknown, context: string) => {
    console.warn(context, error);
    setIsCloudSyncPaused(true);
    setCloudPauseReason("");
    setCloudError("");
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
        await verifyCloudConnection();
        const user = await getCloudUser();
        if (cancelled) return;
        setCloudUser(user);
        if (user?.email) setCloudUsername(user.email.split("@")[0] || "");
      } catch (error) {
        if (isCloudQuotaLimitError(error)) {
          if (cancelled) return;
          pauseCloudSyncFromQuota(error, "Cloud auth/session check paused due to quota.");
          return;
        }
        if (isCloudConnectionError(error)) {
          if (cancelled) return;
          pauseCloudSyncFromConnectionError(error, "Cloud auth/session check paused because Supabase is unreachable.");
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
  }, [cloudRuntimeEnabled, pauseCloudSyncFromConnectionError, pauseCloudSyncFromQuota]);

  // Load storage (cloud if configured, otherwise local/api).
  useEffect(() => {
    if (!isRestoreBootstrapReady) return;
    if (cloudEnabled && isCloudSyncPaused) {
      const browserSessionUserId = loadLocalSessionUserId();
      const localState = mergePersistedStateCandidates(
        [
          { state: loadPersistedAppStateFromLocalStorage(), priority: 30 },
          ...loadLocalHistoryStates().map((state, index) => ({ state, priority: 20 - index })),
        ],
        browserSessionUserId
      );
      const browserSessionResolved =
        browserSessionUserId && localState.accounts[browserSessionUserId]
          ? resolvePreferredCurrentAccount(browserSessionUserId, localState.accounts)
          : null;
      if (browserSessionUserId && !browserSessionResolved) {
        saveLocalSessionUserId(null);
      }
      const stateCurrentUserId =
        localState.currentUserId && localState.accounts[localState.currentUserId] ? localState.currentUserId : null;
      const resolvedCurrentUserId = browserSessionResolved ?? stateCurrentUserId;
      setAccounts(localState.accounts);
      setCurrentUserId(resolvedCurrentUserId);
      if (resolvedCurrentUserId) {
        saveLocalSessionUserId(resolvedCurrentUserId);
      }
      setIsStorageReady(true);
      return;
    }
    if (cloudRuntimeEnabled && !isCloudReady) return;
    let cancelled = false;

    async function loadStorage() {
      setIsStorageReady(false);
      const browserSessionUserId = loadLocalSessionUserId();
      const localState = mergePersistedStateCandidates(
        [
          { state: loadPersistedAppStateFromLocalStorage(), priority: 30 },
          ...loadLocalHistoryStates().map((state, index) => ({ state, priority: 20 - index })),
        ],
        browserSessionUserId
      );

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

        const cloudCount = persistedStateExpenseCount(cloudState);
        const localCount = persistedStateExpenseCount(localState);
        const hasCloud = Boolean(cloudState && !isPersistedStateEmpty(cloudState));
        const hasLocal = Boolean(!isPersistedStateEmpty(localState));
        const shouldPreferLocal = hasLocal && (!hasCloud || localCount > cloudCount);

        const chosen =
          hasCloud && !shouldPreferLocal
            ? cloudState!
            : hasLocal
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

        if (!cloudState || isPersistedStateEmpty(cloudState) || shouldPreferLocal) {
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
      const chosenState = mergePersistedStateCandidates(
        [
          { state: localState, priority: 30 },
          { state: serverState, priority: 20 },
        ],
        browserSessionUserId
      );

      if (
        !isPersistedStateEmpty(chosenState) &&
        (!serverState || isPersistedStateEmpty(serverState) || isPersistedStateMoreComplete(chosenState, serverState))
      ) {
        try {
          await savePersistedAppStateToApi(chosenState);
        } catch (error) {
          console.warn("Could not migrate local app state to server storage", error);
        }
      }

      if (cancelled) return;
      setAccounts(chosenState.accounts);
      const browserSessionResolved =
        browserSessionUserId && chosenState.accounts[browserSessionUserId]
          ? resolvePreferredCurrentAccount(browserSessionUserId, chosenState.accounts)
          : null;
      if (browserSessionUserId && !browserSessionResolved) {
        saveLocalSessionUserId(null);
      }
      const stateCurrentUserId =
        chosenState.currentUserId && chosenState.accounts[chosenState.currentUserId] ? chosenState.currentUserId : null;
      const resolvedCurrentUserId = browserSessionResolved ?? stateCurrentUserId;
      setCurrentUserId(resolvedCurrentUserId);
      if (resolvedCurrentUserId) {
        saveLocalSessionUserId(resolvedCurrentUserId);
      }
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
    setSavingsTrackerGoal(data.savingsTrackerGoal);
    setSavingsTrackerSaved(data.savingsTrackerSaved);
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
            savingsTrackerGoal,
            savingsTrackerSaved,
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
    savingsTrackerGoal,
    savingsTrackerSaved,
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

      if (accountSyncEnabled && currentUserId && accounts[currentUserId]) {
        void saveAccountToSyncApi(accounts[currentUserId]).catch((error) => {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          if (message.includes("account not found")) {
            void createAccountInSyncApi(accounts[currentUserId], accounts[currentUserId].password).catch((createError) => {
              console.warn("Could not create account in sync storage", createError);
            });
            return;
          }
          console.warn("Could not save account to sync storage", error);
        });
        return;
      }

      if (accountSyncEnabled) return;

      void savePersistedAppStateToApi(state).catch((error) => {
        console.warn("Could not save app state to server storage", error);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [isStorageReady, currentUserId, accounts, cloudRuntimeEnabled, cloudUser?.id, pauseCloudSyncFromQuota]);

  async function createAccount() {
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
    if (!authPassword.trim()) {
      setAuthError("Enter a password.");
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

    let accountToSave = next;
    if (accountSyncEnabled) {
      try {
        const syncedAccount = await createAccountInSyncApi(next, authPassword);
        if (syncedAccount) accountToSave = syncedAccount;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("already exists")) {
          setAuthError("That username already exists. Sign in instead.");
          return;
        }
        setAuthError("Could not create synced account. Please try again.");
        return;
      }
    }

    const nextAccounts = { ...accounts, [id]: accountToSave };
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

  function restoreLocalBackupText() {
    setAuthError("");
    setAuthInfo("");
    try {
      const importedState = parsePersistedAppState(restorePayloadText);
      if (isPersistedStateEmpty(importedState)) {
        setAuthError("That restore payload does not contain Budget Bestie accounts.");
        return;
      }

      const currentState = { version: 2, currentUserId, accounts } satisfies PersistedAppState;
      const restoredState = mergePersistedStateCandidates(
        [
          { state: importedState, priority: 40 },
          { state: currentState, priority: 10 },
        ],
        importedState.currentUserId
      );
      const restoredUserId = restoredState.currentUserId;
      if (!restoredUserId || !restoredState.accounts[restoredUserId]) {
        setAuthError("Restore completed, but no active account could be selected.");
        return;
      }

      savePersistedAppStateToLocalStorage(restoredState);
      saveLocalSessionUserId(restoredUserId);
      setAccounts(restoredState.accounts);
      setIsAccountReady(false);
      setCurrentUserId(restoredUserId);
      setRestorePayloadText("");
      setAuthUsername(restoredState.accounts[restoredUserId].name || restoredUserId);
      setAuthPassword("");
      setAuthInfo(`Restored ${restoredState.accounts[restoredUserId].name || restoredUserId}.`);
    } catch (error) {
      console.warn("Could not restore private local backup", error);
      setAuthError("Could not restore that payload.");
    }
  }

  async function signIn() {
    const id = normalizeAccountId(authUsername);
    const account = accounts[id];
    const enteredPassword = authPassword;
    const trimmedPassword = authPassword.trim();
    setAuthError("");
    setAuthInfo("");
    if (!id) {
      setAuthError("Enter a valid username.");
      return;
    }
    if (!trimmedPassword) {
      setAuthError("Enter a password.");
      return;
    }

    if (!account && accountSyncEnabled) {
      try {
        const syncedAccount = await loadAccountFromSyncApi(id, authPassword);
        if (!syncedAccount) {
          setAuthError("Account not found.");
          return;
        }
        const nextAccounts = { ...accounts, [syncedAccount.id]: syncedAccount };
        const nextState = { version: 2, currentUserId: syncedAccount.id, accounts: nextAccounts } satisfies PersistedAppState;
        savePersistedAppStateToLocalStorage(nextState);
        setAccounts(nextAccounts);
        setIsAccountReady(false);
        saveLocalSessionUserId(syncedAccount.id);
        setCurrentUserId(syncedAccount.id);
        setAuthPassword("");
        setAuthInfo("Signed in.");
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("not found")) {
          setAuthError("Account not found.");
        } else if (message.includes("incorrect password")) {
          setAuthError("Incorrect password.");
        } else {
          setAuthError("Could not reach account sync. Please try again.");
        }
        return;
      }
    }

    if (!account) {
      setAuthError(
        crossBrowserSyncEnabled
          ? "Account not found."
          : "Account not found here. Create a free workspace or try the demo."
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
      if (accountSyncEnabled) {
        try {
          const syncedAccount = await loadAccountFromSyncApi(id, authPassword);
          if (syncedAccount) {
            const nextAccounts = { ...accounts, [syncedAccount.id]: syncedAccount };
            const nextState = { version: 2, currentUserId: syncedAccount.id, accounts: nextAccounts } satisfies PersistedAppState;
            savePersistedAppStateToLocalStorage(nextState);
            setAccounts(nextAccounts);
            setIsAccountReady(false);
            saveLocalSessionUserId(syncedAccount.id);
            setCurrentUserId(syncedAccount.id);
            setAuthPassword("");
            setAuthInfo("Signed in.");
            return;
          }
        } catch {
          // Fall through to the local password error.
        }
      }
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
    const username = normalizeAccountId(cloudUsername);
    if (!username) {
      setCloudError("Enter a valid username.");
      return;
    }
    const emailCandidates = usernameToCloudEmails(username);
    if (!emailCandidates.length) {
      setCloudError("Enter a valid username.");
      return;
    }
    if (!cloudPassword.trim()) {
      setCloudError("Enter a password.");
      return;
    }

    setIsCloudAuthBusy(true);
    setCloudError("");
    try {
      if (cloudAuthMode === "create") {
        let lastError: unknown = null;
        let didAuth = false;
        for (const email of emailCandidates) {
          try {
            await signUpCloud(email, cloudPassword);
            await signInCloud(email, cloudPassword);
            didAuth = true;
            break;
          } catch (error) {
            lastError = error;
            const msg = cloudErrorSummary(error).toLowerCase();
            if (msg.includes("user already registered")) {
              try {
                await signInCloud(email, cloudPassword);
                didAuth = true;
                break;
              } catch (signInError) {
                lastError = signInError;
                continue;
              }
            }
            if (msg.includes("email address") && msg.includes("invalid")) continue;
            if (msg.includes("invalid email")) continue;
            throw error;
          }
        }
        if (!didAuth) {
          if (lastError) throw lastError;
          throw new Error("Could not create account.");
        }
      } else {
        let lastError: unknown = null;
        let didAuth = false;
        for (const email of emailCandidates) {
          try {
            await signInCloud(email, cloudPassword);
            didAuth = true;
            break;
          } catch (error) {
            lastError = error;
            continue;
          }
        }
        if (!didAuth) {
          if (lastError) throw lastError;
          throw new Error("Could not sign in.");
        }
      }
      setCloudPassword("");
    } catch (error) {
      if (isCloudQuotaLimitError(error)) {
        pauseCloudSyncFromQuota(error, "Cloud auth paused due to quota.");
        return;
      }
      const msg = cloudErrorSummary(error).toLowerCase();
      if (msg.includes("user already registered")) {
        setCloudError("Incorrect password.");
      } else if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
        setCloudError("Cloud auth setting is blocking sign-in: Email confirmation is enabled in Supabase. Disable it once, then sign in again.");
      } else if (msg.includes("invalid login credentials")) {
        setCloudError("Incorrect password.");
      } else if (msg.includes("email address") && msg.includes("invalid")) {
        setCloudError("Account setup failed. Please try a different username.");
      } else if (
        msg.includes("failed to fetch") ||
        msg.includes("fetch failed") ||
        msg.includes("networkerror") ||
        msg.includes("load failed")
      ) {
        pauseCloudSyncFromConnectionError(error, "Cloud auth paused because Supabase is unreachable.");
      } else if (msg.includes("email rate limit exceeded") || msg.includes("too many requests") || msg.includes("rate limit")) {
        setCloudError("Incorrect password.");
      } else {
        setCloudError(error instanceof Error ? error.message : "Could not authenticate.");
      }
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
    if (authMode === "create") void createAccount();
    else void signIn();
  }

  function openExpensesWithFilters(filters: {
    categoryId?: string;
    search?: string;
    from?: string;
    to?: string;
    focusSearch?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters.categoryId && filters.categoryId !== "all") params.set("category", filters.categoryId);
    if (filters.search) params.set("q", filters.search);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.focusSearch) params.set("focusSearch", "1");
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
    setSavingsTrackerGoal(defaults.savingsTrackerGoal);
    setSavingsTrackerSaved(defaults.savingsTrackerSaved);
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
  const appContextValue = {
    activeAccount,
    activeThemePresetId,
    advisorAlerts,
    allThemePresets,
    appFont,
    appTitle,
    areLikelyDuplicateNames,
    brandIcon,
    budgets,
    catById,
    categories,
    chartCategoryFilter,
    chartTheme,
    colorAccent,
    colorBg,
    colorCard,
    colorPanel,
    colorPanel2,
    dateFrom,
    dateTo,
    dedupeAndAdd,
    dedupePreviewRows,
    excludeCCPayFromCharts,
    excludeInvestingSavingsFromCharts,
    excludeTransfersFromCharts,
    expenseOnly,
    expenses,
    exportToCSV,
    exportToXLSX,
    filteredExpenses,
    getWeekNumber,
    headingFont,
    importedFileFingerprints,
    nav,
    openExpensesWithFilters,
    removeDuplicates,
    resolveCategoryByLearnedRule,
    s,
    savingsTrackerGoal,
    savingsTrackerSaved,
    setAppFont,
    setAppTitle,
    setBrandIcon,
    setBudgets,
    setCategories,
    setChartCategoryFilter,
    setColorAccent,
    setColorBg,
    setColorCard,
    setColorPanel,
    setColorPanel2,
    setCustomThemes,
    setDateFrom,
    setDateTo,
    setExcludeCCPayFromCharts,
    setExcludeInvestingSavingsFromCharts,
    setExcludeTransfersFromCharts,
    setExpenses,
    setHeadingFont,
    setImportedFileFingerprints,
    setLearnedCategoryRules,
    setSavingsTrackerGoal,
    setSavingsTrackerSaved,
    setThemeMode,
    setUiGlass,
    setUiMotionMs,
    setUiRadius,
    setUiShadow,
    softLayer,
    spendByCategory,
    themeMode,
    totals,
    uiGlass,
    uiMotionMs,
    uiRadius,
    uiShadow,
  };


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

  if (cloudRuntimeEnabled && !cloudUser) {
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
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>Username</div>
              <input
                style={s.input}
                type="text"
                autoComplete="username"
                placeholder="Enter username"
                value={cloudUsername}
                onChange={(e) => setCloudUsername(e.target.value)}
                disabled={isCloudSyncPaused}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 800, marginBottom: 6 }}>Password</div>
              <input
                style={s.input}
                type="password"
                autoComplete={cloudAuthMode === "create" ? "new-password" : "current-password"}
                placeholder="Enter your password"
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                disabled={isCloudSyncPaused}
              />
            </div>

            <button style={s.btnPrimary} type="submit" disabled={isCloudAuthBusy || isCloudSyncPaused}>
              {isCloudAuthBusy ? "Please wait..." : cloudAuthMode === "create" ? "Create Account" : "Sign In"}
            </button>
          </form>

          {cloudError ? <div style={{ marginTop: 10, color: PALETTE.warn, fontSize: 12, fontWeight: 700 }}>{cloudError}</div> : null}
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
              A polished personal-finance workspace for budgets, transactions, reports, and savings planning.
            </div>
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
                placeholder="Enter password"
                value={authPassword}
                onChange={(e) => {
                  setAuthError("");
                  setAuthInfo("");
                  setAuthPassword(e.target.value);
                }}
              />
            </div>

            <button style={s.btnPrimary} type="submit">
              {authMode === "create" ? "Create Free Workspace" : "Sign In"}
            </button>
          </form>

          {authError ? <div style={{ marginTop: 10, color: PALETTE.warn, fontSize: 12, fontWeight: 700 }}>{authError}</div> : null}
          {!authError && authInfo ? (
            <div style={{ marginTop: 10, color: PALETTE.good, fontSize: 12, fontWeight: 700 }}>{authInfo}</div>
          ) : null}

          {showPrivateRestore ? (
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: `1px solid ${PALETTE.border}`,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 950 }}>Private local restore</div>
              <textarea
                style={{ ...s.input, minHeight: 120, resize: "vertical" }}
                placeholder="Paste Budget Bestie private restore JSON"
                value={restorePayloadText}
                onChange={(event) => {
                  setAuthError("");
                  setAuthInfo("");
                  setRestorePayloadText(event.target.value);
                }}
              />
              <button style={s.btnSecondary} type="button" onClick={restoreLocalBackupText}>
                Restore Private Account
              </button>
            </div>
          ) : null}

        </div>
      </div>
    );
  }

  return (
    <BudgetBestieProvider value={appContextValue}>
      <div
        className={`bb-page-smooth ${themeMode === "dark" ? "bb-theme-dark" : "bb-theme-light"} min-h-screen w-full antialiased`}
        style={pageStyle}
      >
      <div className="bb-shell mx-auto grid w-full" style={s.shell}>
        <aside className="bb-sidebar min-w-0" style={s.sidebar}>
          <div className="bb-sidebar-inner" style={s.sidebarInner}>
            <div style={s.brand}>
              <div style={s.brandIcon}>{brandIcon || "💜"}</div>
              <div style={{ minWidth: 0 }}>
                <div className="bb-brand-title" style={s.brandTitle}>
                  {appTitle || "Budget Bestie"}
                </div>
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
              <div style={{ fontWeight: 900, marginTop: 4, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cloudRuntimeEnabled
                  ? cloudUser?.email?.split("@")[0] || activeAccount?.name
                  : activeAccount?.name}
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
          </div>
        </aside>

        <main className="bb-main min-w-0" style={s.main}>
          <div className="bb-top-bar sticky top-3 z-30" style={s.topBar}>
            <div
              className="bb-top-title bb-page-title"
              title={accountDisplayName}
              style={{ fontSize: 32, fontWeight: 930, paddingLeft: 8, overflowWrap: "anywhere", lineHeight: 1.15 }}
            >
              <div className="bb-top-kicker">Private finance studio</div>
              <div>Good {greeting}, {accountGreetingName}</div>
            </div>

            <div className="bb-top-tabs" style={s.topTabs}>
              <TopTabItem to="/" label="Dashboard" />
              <TopTabItem to="/expenses" label="Expenses" />
              <TopTabItem to="/budgets" label="Budgets" />
              <TopTabItem to="/reports" label="Reports" />
            </div>

            <div className="bb-top-actions" style={s.topActions}>
              <button
                style={s.iconPill}
                title="Search transactions"
                onClick={() => openExpensesWithFilters({ search: "", focusSearch: true })}
              >
                <Search size={18} />
              </button>
              <button
                style={s.iconPill}
                title="Insights"
                onClick={() => nav("/assistant")}
              >
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/add" element={<AddExpensePage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/personalize" element={<PersonalizePage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/assistant" element={<ReportsPage />} />
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
    </BudgetBestieProvider>
  );
}
