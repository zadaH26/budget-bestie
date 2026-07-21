export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function formatMoney(n: number, currency = "CAD") {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
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

export function currencyTooltip(value: number | string | readonly (number | string)[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  return formatMoney(Number(normalized));
}

export function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function monthBounds(monthKey: string): { from: string; to: string } | null {
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

export function colorWithAlpha(hex: string, alpha: number) {
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

export function parseDateFlexible(s: string): string | null {
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
