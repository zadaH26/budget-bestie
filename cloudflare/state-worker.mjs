function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(body, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function emptyState() {
  return { version: 2, currentUserId: null, accounts: {} };
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeAccountId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function sanitizeAccountForStorage(account, fallbackId) {
  if (!isObject(account)) return null;
  const id = normalizeAccountId(account.id || fallbackId);
  if (!id) return null;
  return {
    ...account,
    id,
    name: typeof account.name === "string" && account.name.trim() ? account.name.trim() : id,
    password: "",
    updatedAt: Date.now(),
  };
}

function publicAccount(record, password) {
  return {
    ...record.account,
    password,
  };
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashPassword(password, salt) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(digest);
}

function normalizeStateShape(raw) {
  if (!isObject(raw)) return emptyState();
  const state = raw;
  const version = Number.isFinite(Number(state.version)) ? Number(state.version) : 2;
  const currentUserId = typeof state.currentUserId === "string" ? state.currentUserId : null;
  const accounts = isObject(state.accounts) ? state.accounts : {};
  return { version, currentUserId, accounts };
}

export class StateStore {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  limitForToday() {
    const configured = Number(this.env?.FREE_DAILY_REQUEST_LIMIT);
    if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
    return 90000;
  }

  async enforceDailyLimit() {
    const now = new Date();
    const dayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
      now.getUTCDate()
    ).padStart(2, "0")}`;
    const key = `usage:${dayKey}`;
    const usage = (await this.state.storage.get(key)) || { count: 0 };
    const nextCount = Number(usage.count || 0) + 1;
    const limit = this.limitForToday();
    await this.state.storage.put(key, { count: nextCount });
    return { allowed: nextCount <= limit, count: nextCount, limit };
  }

  async readJson(request) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  async getAccountRecord(accountId) {
    return (await this.state.storage.get(`account:${accountId}`)) || null;
  }

  async verifyAccount(accountId, password) {
    const record = await this.getAccountRecord(accountId);
    if (!record || !record.salt || !record.passwordHash || !record.account) return { ok: false, record: null };
    const candidateHash = await hashPassword(password, record.salt);
    return { ok: candidateHash === record.passwordHash, record };
  }

  async createAccount(request, origin) {
    const body = await this.readJson(request);
    if (!isObject(body)) return jsonResponse({ error: "Invalid JSON body." }, 400, origin);

    const password = typeof body.password === "string" ? body.password : "";
    const account = sanitizeAccountForStorage(body.account, body.username);
    if (!account) return jsonResponse({ error: "Invalid account." }, 400, origin);
    if (!password.trim()) return jsonResponse({ error: "Password is required." }, 400, origin);

    const existing = await this.getAccountRecord(account.id);
    if (existing) return jsonResponse({ error: "Account already exists." }, 409, origin);

    const encoded = JSON.stringify(account);
    if (encoded.length > 2_000_000) {
      return jsonResponse({ error: "Payload too large." }, 413, origin);
    }

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const record = { account, salt, passwordHash, updatedAt: Date.now() };
    await this.state.storage.put(`account:${account.id}`, record);
    return jsonResponse({ account: publicAccount(record, password), savedAt: record.updatedAt }, 200, origin);
  }

  async loginAccount(request, origin) {
    const body = await this.readJson(request);
    if (!isObject(body)) return jsonResponse({ error: "Invalid JSON body." }, 400, origin);

    const accountId = normalizeAccountId(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    if (!accountId) return jsonResponse({ error: "Username is required." }, 400, origin);
    if (!password.trim()) return jsonResponse({ error: "Password is required." }, 400, origin);

    const verified = await this.verifyAccount(accountId, password);
    if (!verified.record) return jsonResponse({ error: "Account not found." }, 404, origin);
    if (!verified.ok) return jsonResponse({ error: "Incorrect password." }, 401, origin);

    return jsonResponse({ account: publicAccount(verified.record, password) }, 200, origin);
  }

  async saveAccount(request, origin) {
    const body = await this.readJson(request);
    if (!isObject(body)) return jsonResponse({ error: "Invalid JSON body." }, 400, origin);

    const accountId = normalizeAccountId(body.username || body.account?.id);
    const password = typeof body.password === "string" ? body.password : "";
    if (!accountId) return jsonResponse({ error: "Username is required." }, 400, origin);
    if (!password.trim()) return jsonResponse({ error: "Password is required." }, 400, origin);

    const verified = await this.verifyAccount(accountId, password);
    if (!verified.record) return jsonResponse({ error: "Account not found." }, 404, origin);
    if (!verified.ok) return jsonResponse({ error: "Incorrect password." }, 401, origin);

    const account = sanitizeAccountForStorage(body.account, accountId);
    if (!account || account.id !== accountId) return jsonResponse({ error: "Invalid account." }, 400, origin);

    const encoded = JSON.stringify(account);
    if (encoded.length > 2_000_000) {
      return jsonResponse({ error: "Payload too large." }, 413, origin);
    }

    const record = { ...verified.record, account, updatedAt: Date.now() };
    await this.state.storage.put(`account:${accountId}`, record);
    return jsonResponse({ ok: true, savedAt: record.updatedAt }, 200, origin);
  }

  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, mode: "account-sync" }, 200, origin);
    }

    const quota = await this.enforceDailyLimit();
    if (!quota.allowed) {
      return jsonResponse(
        {
          error: "Free sync limit reached for today. Sync is paused until tomorrow.",
          count: quota.count,
          limit: quota.limit,
        },
        429,
        origin
      );
    }

    if (url.pathname === "/state") {
      if (request.method === "GET") return jsonResponse(emptyState(), 200, origin);
      if (request.method === "POST") {
        const payload = await this.readJson(request);
        const normalized = normalizeStateShape(payload);
        const currentUserId = normalizeAccountId(normalized.currentUserId);
        const account = currentUserId ? sanitizeAccountForStorage(normalized.accounts?.[currentUserId], currentUserId) : null;
        if (account && typeof normalized.accounts?.[currentUserId]?.password === "string") {
          const existing = await this.getAccountRecord(currentUserId);
          if (!existing) {
            const password = normalized.accounts[currentUserId].password;
            const salt = randomSalt();
            const passwordHash = await hashPassword(password, salt);
            await this.state.storage.put(`account:${currentUserId}`, {
              account,
              salt,
              passwordHash,
              updatedAt: Date.now(),
            });
          }
        }
        return jsonResponse({ ok: true, mode: "account-sync" }, 200, origin);
      }
      return jsonResponse({ error: "Method not allowed." }, 405, origin);
    }

    if (url.pathname === "/account/create" && request.method === "POST") {
      return this.createAccount(request, origin);
    }

    if (url.pathname === "/account/login" && request.method === "POST") {
      return this.loginAccount(request, origin);
    }

    if (url.pathname === "/account/save" && request.method === "POST") {
      return this.saveAccount(request, origin);
    }

    return jsonResponse({ error: "Not found." }, 404, origin);
  }
}

export default {
  async fetch(request, env) {
    const id = env.STATE_STORE.idFromName("global");
    const stub = env.STATE_STORE.get(id);
    return stub.fetch(request);
  },
};
