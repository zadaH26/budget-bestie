/**
 * Budget Bestie AI Worker
 *
 * Routes:
 * - POST /ai
 * - POST /parse-transactions
 *
 * Required bindings:
 * - AI (Workers AI binding)
 *
 * Optional vars:
 * - AI_MODEL (default model used for chat-style budget assistant)
 * - PARSER_MODEL (default model used for statement parsing)
 */

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

function jsonResponse(body, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function parseJsonFromText(rawText) {
  const text = (rawText || "").trim();
  if (!text) return null;

  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) candidates.unshift(fenced[1].trim());

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.unshift(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function coerceParsedTransactions(payload) {
  const list = Array.isArray(payload?.transactions) ? payload.transactions : [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item;
      const date = typeof row.date === "string" ? row.date.trim() : "";
      const description =
        typeof row.description === "string"
          ? row.description.trim()
          : typeof row.notes === "string"
            ? row.notes.trim()
            : typeof row.merchant === "string"
              ? row.merchant.trim()
              : "";
      const direction =
        typeof row.direction === "string"
          ? row.direction.trim().toLowerCase()
          : typeof row.type === "string"
            ? row.type.trim().toLowerCase()
            : "unknown";
      const amount = row.amount;
      const rawAmount =
        typeof row.rawAmount === "string"
          ? row.rawAmount.trim()
          : typeof row.amount === "string"
            ? row.amount.trim()
            : "";

      if (!date || !description || (typeof amount !== "number" && typeof amount !== "string" && !rawAmount)) {
        return null;
      }

      return { date, description, amount, rawAmount, direction };
    })
    .filter(Boolean);
}

function buildAssistantPrompt(context, question) {
  return [
    "Financial data context:",
    context || "No context provided.",
    "",
    `User question: ${question}`,
    "Return a direct answer with concrete suggestions and numbers when possible.",
  ].join("\n");
}

function buildParserPrompt(text, sourceLabel) {
  return [
    "Extract all transactions from this bank/app statement text.",
    `Source label: ${sourceLabel || "Pasted"}`,
    "",
    "Return EXACTLY this JSON shape:",
    '{"transactions":[{"date":"YYYY-MM-DD","description":"string","amount":"string|number","rawAmount":"string","direction":"inflow|outflow|unknown"}]}',
    "",
    "Rules:",
    "- Keep one object per transaction line.",
    "- Ignore headers/noise like Date/Description/Download/Search/Filter/Posted Transactions/Foreign Currency.",
    "- Normalize date to YYYY-MM-DD.",
    "- For two-digit years, assume 20YY (for example 26 => 2026).",
    "- Preserve amount sign cues in rawAmount (for example +$10.00, -$10.00, (10.00), 10.00-).",
    "- If rawAmount has '-' or parentheses, set direction=inflow. If rawAmount has '+', set direction=outflow.",
    "- direction=inflow for credits/refunds/payments received, direction=outflow for debits/charges/spend.",
    "- If uncertain, set direction=unknown.",
    "",
    "Statement text:",
    text,
  ].join("\n");
}

async function runModel(env, model, messages) {
  const selected = model || env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const result = await env.AI.run(selected, { messages, temperature: 0.2 });
  const text =
    typeof result === "string"
      ? result
      : typeof result?.response === "string"
        ? result.response
        : typeof result?.result?.response === "string"
          ? result.result.response
          : "";
  return text.trim();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, origin);
    }

    if (!env.AI) {
      return jsonResponse({ error: "AI binding missing." }, 500, origin);
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, origin);
    }

    try {
      if (url.pathname === "/ai") {
        const question = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const system = typeof body.system === "string" ? body.system.trim() : "";
        const context = typeof body.context === "string" ? body.context.trim() : "";
        if (!question) return jsonResponse({ error: "Prompt is required." }, 400, origin);

        const prompt = buildAssistantPrompt(context, question);
        const response = await runModel(env, body.model, [
          {
            role: "system",
            content:
              system ||
              "You are Budget Bestie AI, a practical personal finance coach. Be specific, actionable, and concise.",
          },
          { role: "user", content: prompt },
        ]);
        return jsonResponse({ response }, 200, origin);
      }

      if (url.pathname === "/parse-transactions") {
        const text = typeof body.text === "string" ? body.text.trim() : "";
        const sourceLabel = typeof body.sourceLabel === "string" ? body.sourceLabel.trim() : "Pasted";
        if (!text) return jsonResponse({ error: "Statement text is required." }, 400, origin);

        const prompt = buildParserPrompt(text, sourceLabel);
        const response = await runModel(env, body.model || env.PARSER_MODEL, [
          {
            role: "system",
            content: "You are a strict transaction extractor. Output only valid JSON with no markdown and no prose.",
          },
          { role: "user", content: prompt },
        ]);

        const parsed = parseJsonFromText(response);
        const transactions = coerceParsedTransactions(parsed);
        return jsonResponse({ transactions }, 200, origin);
      }

      return jsonResponse({ error: "Not found." }, 404, origin);
    } catch (error) {
      return jsonResponse(
        {
          error: "AI request failed.",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
        origin
      );
    }
  },
};
