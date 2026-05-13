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

  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (url.pathname !== "/state") {
      return jsonResponse({ error: "Not found." }, 404, origin);
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

    if (request.method === "GET") {
      const saved = await this.state.storage.get("app_state_v2");
      return jsonResponse(normalizeStateShape(saved), 200, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, origin);
    }

    let payload = null;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, origin);
    }

    const normalized = normalizeStateShape(payload);
    const encoded = JSON.stringify(normalized);
    if (encoded.length > 2_000_000) {
      return jsonResponse({ error: "Payload too large." }, 413, origin);
    }

    await this.state.storage.put("app_state_v2", normalized);
    return jsonResponse({ ok: true, savedAt: Date.now() }, 200, origin);
  }
}

export default {
  async fetch(request, env) {
    const id = env.STATE_STORE.idFromName("global");
    const stub = env.STATE_STORE.get(id);
    return stub.fetch(request);
  },
};
