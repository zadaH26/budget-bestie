import type { PersistedAppState, StoredAccount } from "../types/domain";
import { defaultAccountData, isRecord, normalizeAccountId, repairMojibakeText, resolvePreferredCurrentAccount, sanitizeAccountData } from "./accountData";

export const LS_KEY = "budget_bestie_no_ai_v7";
export const LS_HISTORY_KEY = `${LS_KEY}_history_v1`;
export const MAX_LOCAL_HISTORY = 12;
const DEFAULT_LOCAL_STATE_ENDPOINT = import.meta.env.DEV ? "/api/state" : "";
export const STATE_ENDPOINT = (import.meta.env.VITE_STATE_ENDPOINT || DEFAULT_LOCAL_STATE_ENDPOINT).trim();
export const STATE_ENDPOINT_SYNC_ENABLED = Boolean(STATE_ENDPOINT);
export const ACCOUNT_SYNC_ENDPOINT = (
  import.meta.env.VITE_ACCOUNT_SYNC_ENDPOINT ||
  (STATE_ENDPOINT ? STATE_ENDPOINT.replace(/\/state\/?$/, "/account") : "")
).trim();
export const ACCOUNT_ENDPOINT_SYNC_ENABLED = Boolean(ACCOUNT_SYNC_ENDPOINT);
export const LS_SESSION_USER_KEY = `${LS_KEY}_session_user_v1`;

export type LocalHistoryEntry = { savedAt: number; snapshot: string };

export function parsePersistedAppState(raw: unknown): PersistedAppState {
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

export function loadPersistedAppStateFromLocalStorage(): PersistedAppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return parsePersistedAppState(raw);
  } catch (error) {
    console.warn("Could not load local app state", error);
    return { version: 2, currentUserId: null, accounts: {} };
  }
}

export function loadLocalHistoryEntries(): LocalHistoryEntry[] {
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

export function loadLocalHistoryStates(): PersistedAppState[] {
  return loadLocalHistoryEntries()
    .map((entry) => parsePersistedAppState(entry.snapshot))
    .filter((state) => !isPersistedStateEmpty(state));
}

export function saveLocalHistoryEntries(entries: LocalHistoryEntry[]) {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL_HISTORY)));
}

export function saveSnapshotToLocalHistory(state: PersistedAppState) {
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

export function savePersistedAppStateToLocalStorage(state: PersistedAppState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  saveSnapshotToLocalHistory(state);
}

export function loadLocalSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_USER_KEY);
    if (!raw) return null;
    const normalized = normalizeAccountId(raw);
    return normalized || null;
  } catch {
    return null;
  }
}

export function saveLocalSessionUserId(userId: string | null) {
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

export async function loadPersistedAppStateFromApi(): Promise<PersistedAppState | null> {
  if (ACCOUNT_ENDPOINT_SYNC_ENABLED) return null;
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

export async function savePersistedAppStateToApi(state: PersistedAppState) {
  if (ACCOUNT_ENDPOINT_SYNC_ENABLED) return;
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

function accountEndpoint(path: "create" | "login" | "save") {
  return `${ACCOUNT_SYNC_ENDPOINT.replace(/\/+$/, "")}/${path}`;
}

async function parseAccountApiResponse(response: Response): Promise<unknown> {
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // ignore invalid response body
  }
  if (!response.ok) {
    const message =
      isRecord(json) && typeof json.error === "string" && json.error.trim()
        ? json.error.trim()
        : `Account sync failed with ${response.status}`;
    throw new Error(message);
  }
  return json;
}

function parseSyncedAccount(raw: unknown, password: string): StoredAccount | null {
  if (!isRecord(raw) || !isRecord(raw.account)) return null;
  const candidateAccount = raw.account;
  const id = normalizeAccountId(typeof candidateAccount.id === "string" ? candidateAccount.id : "");
  if (!id) return null;
  const parsed = parsePersistedAppState({
    version: 2,
    currentUserId: id,
    accounts: {
      [id]: {
        ...candidateAccount,
        password,
      },
    },
  });
  return parsed.accounts[id] ?? null;
}

export async function createAccountInSyncApi(account: StoredAccount, password: string): Promise<StoredAccount | null> {
  if (!ACCOUNT_SYNC_ENDPOINT) return null;
  const response = await fetch(accountEndpoint("create"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: account.id, password, account }),
  });
  const json = await parseAccountApiResponse(response);
  return parseSyncedAccount(json, password);
}

export async function loadAccountFromSyncApi(username: string, password: string): Promise<StoredAccount | null> {
  if (!ACCOUNT_SYNC_ENDPOINT) return null;
  const response = await fetch(accountEndpoint("login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = await parseAccountApiResponse(response);
  return parseSyncedAccount(json, password);
}

export async function saveAccountToSyncApi(account: StoredAccount): Promise<void> {
  if (!ACCOUNT_SYNC_ENDPOINT || !account.password) return;
  const response = await fetch(accountEndpoint("save"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: account.id, password: account.password, account }),
  });
  await parseAccountApiResponse(response);
}

export function isPersistedStateEmpty(state: PersistedAppState) {
  return !state.currentUserId && Object.keys(state.accounts).length === 0;
}

export function persistedStateExpenseCount(state: PersistedAppState | null): number {
  if (!state) return 0;
  try {
    return Object.values(state.accounts || {}).reduce((sum, account) => {
      const count = Array.isArray(account?.data?.expenses) ? account.data.expenses.length : 0;
      return sum + count;
    }, 0);
  } catch {
    return 0;
  }
}

function accountExpenseCount(account: StoredAccount | undefined): number {
  return Array.isArray(account?.data?.expenses) ? account.data.expenses.length : 0;
}

function accountUpdatedAt(account: StoredAccount | undefined): number {
  const updatedAt = Number(account?.updatedAt);
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

function accountDataFootprint(account: StoredAccount | undefined): number {
  if (!account) return 0;
  const data = account.data;
  return (
    accountExpenseCount(account) +
    (Array.isArray(data.budgets) ? data.budgets.length : 0) +
    (Array.isArray(data.categories) ? data.categories.length : 0) +
    (Array.isArray(data.customThemes) ? data.customThemes.length : 0)
  );
}

function compareAccounts(candidate: StoredAccount, existing: StoredAccount): number {
  const candidateExpenses = accountExpenseCount(candidate);
  const existingExpenses = accountExpenseCount(existing);
  if (candidateExpenses !== existingExpenses) return candidateExpenses - existingExpenses;

  const candidateFootprint = accountDataFootprint(candidate);
  const existingFootprint = accountDataFootprint(existing);
  if (candidateFootprint !== existingFootprint) return candidateFootprint - existingFootprint;

  return accountUpdatedAt(candidate) - accountUpdatedAt(existing);
}

export function persistedStateUpdatedAt(state: PersistedAppState | null): number {
  if (!state) return 0;
  return Object.values(state.accounts || {}).reduce((latest, account) => Math.max(latest, accountUpdatedAt(account)), 0);
}

export function isPersistedStateMoreComplete(
  candidate: PersistedAppState | null,
  baseline: PersistedAppState | null
): boolean {
  const candidateCount = persistedStateExpenseCount(candidate);
  const baselineCount = persistedStateExpenseCount(baseline);
  if (candidateCount !== baselineCount) return candidateCount > baselineCount;
  return persistedStateUpdatedAt(candidate) > persistedStateUpdatedAt(baseline);
}

export type PersistedStateCandidate = {
  state: PersistedAppState | null | undefined;
  priority?: number;
};

export function mergePersistedStateCandidates(
  candidates: PersistedStateCandidate[],
  preferredUserId?: string | null
): PersistedAppState {
  const usableCandidates = candidates
    .map((candidate, index) => ({ ...candidate, index }))
    .filter((candidate) => candidate.state && !isPersistedStateEmpty(candidate.state));

  if (!usableCandidates.length) {
    return { version: 2, currentUserId: null, accounts: {} };
  }

  const accounts: Record<string, StoredAccount> = {};
  for (const candidate of usableCandidates) {
    for (const [key, account] of Object.entries(candidate.state!.accounts || {})) {
      const normalizedId = normalizeAccountId(account.id || key);
      if (!normalizedId) continue;
      const normalizedAccount = { ...account, id: normalizedId };
      if (!accounts[normalizedId] || compareAccounts(normalizedAccount, accounts[normalizedId]) > 0) {
        accounts[normalizedId] = normalizedAccount;
      }
    }
  }

  const normalizedPreferred = preferredUserId ? normalizeAccountId(preferredUserId) : null;
  const bestCandidate = [...usableCandidates].sort((a, b) => {
    const countDiff = persistedStateExpenseCount(b.state!) - persistedStateExpenseCount(a.state!);
    if (countDiff !== 0) return countDiff;
    const updatedDiff = persistedStateUpdatedAt(b.state!) - persistedStateUpdatedAt(a.state!);
    if (updatedDiff !== 0) return updatedDiff;
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return a.index - b.index;
  })[0];
  const bestCandidateUserId =
    bestCandidate?.state?.currentUserId && accounts[bestCandidate.state.currentUserId]
      ? bestCandidate.state.currentUserId
      : null;
  const fullestAccountId = Object.entries(accounts).sort(([, a], [, b]) => compareAccounts(b, a))[0]?.[0] ?? null;
  const requestedId =
    normalizedPreferred && accounts[normalizedPreferred] ? normalizedPreferred : bestCandidateUserId ?? fullestAccountId;

  return {
    version: 2,
    currentUserId: resolvePreferredCurrentAccount(requestedId, accounts),
    accounts,
  };
}

export function ensureStateHasDefaultAccount(state: PersistedAppState, displayName?: string | null): PersistedAppState {
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

export function guessDisplayNameFromEmail(email?: string | null): string {
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

export function cloudErrorSummary(error: unknown): string {
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

export function isCloudQuotaLimitError(error: unknown): boolean {
  const text = cloudErrorSummary(error).toLowerCase();
  if (!text) return false;
  if (/\b402\b/.test(text)) return true;
  if (text.includes("email rate limit exceeded")) return false;
  if (text.includes("rate limit")) return false;
  if (text.includes("too many requests")) return false;
  if (/\b429\b/.test(text)) return false;

  return [
    "quota",
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
