import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { AmountDirectionHint, Expense, RawRow } from "../types/domain";
import { parseDateFlexible, toISODate } from "./dateMoney";

export function isCreditCardPaymentText(descRaw: string): boolean {
  const d = (descRaw || "").toLowerCase();
  return /bill\s*pymt|bill\s*payment|credit\s*card\s*payment|cc\s*payment|amex\s*bill|visa\s*payment|mastercard\s*payment|(?:transfer|payment)\s+(?:to|for)\s+(?:my\s+)?(?:credit\s*card|visa|mastercard|amex)|(?:credit\s*card|visa|mastercard|amex)\s+(?:bill|payment|pymt)|pay\s+(?:my\s+)?(?:credit\s*card|visa|mastercard|amex)/.test(
    d
  );
}

export function isAlwaysExcludedStatementText(descRaw: string): boolean {
  const d = (descRaw || "").toLowerCase().replace(/\s+/g, " ").trim();
  return /payment received - thank you|payment - thank you \/ paiement - merci|to find & save/.test(d);
}

export function shouldExcludeImportedTransaction(descRaw: string): boolean {
  return isCreditCardPaymentText(descRaw) || isAlwaysExcludedStatementText(descRaw);
}

export function hasExplicitMinusAmountToken(tokenLike: unknown, parsedAmount?: number) {
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

export function shouldFlipInstallmentToInflow(params: {
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

export function isWsInvestmentsText(descRaw: string) {
  return /\bws\s*invest(?:ment|ments)\b/i.test(descRaw || "");
}

export function isInvestingText(descRaw: string) {
  const d = (descRaw || "").toLowerCase();
  return /\b(ws\s*invest(?:ment|ments)?|wealthsimple|invest(?:ing|ment|ments)?|tfsa|rrsp|fhsa|brokerage|portfolio|etf|mutual fund)\b/.test(
    d
  );
}

export function isSavingsText(descRaw: string) {
  const d = (descRaw || "").toLowerCase();
  return /\b(savings?\s+account|high[-\s]?interest\s+savings?|save\s+account|to\s+savings?|emergency\s+fund)\b/.test(
    d
  );
}

export function isInvestingOrSavingsTransaction(row: Pick<Expense, "categoryId" | "notes">) {
  if (row.categoryId === "cat_investing" || row.categoryId === "cat_savings") return true;
  return isInvestingText(row.notes) || isSavingsText(row.notes);
}

export function classifyCategory(descRaw: string): string {
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

export function transactionNameKey(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function sourceFamilyFromLabel(label: string): string {
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

export function sourceFamilyFromContent(text: string): string | null {
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

export function resolveSourceFamily(sourceLabel: string, contentHint?: string): string {
  const fromContent = contentHint ? sourceFamilyFromContent(contentHint) : null;
  if (fromContent) return fromContent;
  return sourceFamilyFromLabel(sourceLabel);
}

export function findMoneyTokens(text: string): string[] {
  return text.match(/[+\-−–—﹣＋]?\(?\$?\s*\d[\d,]*\.\d{2}\)?[+\-−–—﹣＋]?(?:\s*(?:cr|dr|credit|debit))?/gi) ?? [];
}

export function stripMoneyTokens(text: string): string {
  return text
    .replace(/[+\-−–—﹣＋]?\(?\$?\s*\d[\d,]*\.\d{2}\)?[+\-−–—﹣＋]?(?:\s*(?:cr|dr|credit|debit))?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectAmountDirectionHint(tokenRaw: string, sourceGroup?: string): AmountDirectionHint {
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

export function directionHintFromDescription(descRaw: string, sourceGroup?: string): AmountDirectionHint {
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

export function applyAmountSignRules(params: {
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
export function parsePasteBlock(text: string, sourceLabel: string): Array<Omit<Expense, "id" | "createdAt">> {
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
export function normHeader(h: string) {
  return (h || "")
    .toString()
    .replace(/\uFEFF/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pick(row: RawRow, keys: string[]) {
  const map = new Map<string, unknown>();
  for (const k of Object.keys(row)) map.set(normHeader(k), row[k]);
  for (const want of keys) {
    const v = map.get(normHeader(want));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

export function parseMoneyAny(v: unknown): number | null {
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

export function guessDateFromCell(v: unknown): string | null {
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

export function rowToExpense(
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

export async function parseCsvFile(file: File): Promise<RawRow[]> {
  const text = await file.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h: string) => (h || "").replace(/\uFEFF/g, "").trim(),
  }) as { data?: RawRow[] };
  return (parsed.data || []).filter(Boolean);
}

export function isLikelyHeaderRow(row: unknown[]): boolean {
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

export function parseXlsxSheet(ws: XLSX.WorkSheet): RawRow[] {
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

export async function parseXlsxFile(file: File): Promise<RawRow[]> {
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
