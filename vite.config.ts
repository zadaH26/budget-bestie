import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, ".budget-bestie-state.json");
const EMPTY_STATE = { version: 2, currentUserId: null, accounts: {} };
const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

function parseJsonFromText(rawText: string): unknown | null {
  const text = (rawText || "").trim();
  if (!text) return null;

  const candidates: string[] = [text];
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

function coerceParsedTransactions(payload: unknown) {
  const list =
    payload &&
    typeof payload === "object" &&
    "transactions" in payload &&
    Array.isArray((payload as { transactions?: unknown }).transactions)
      ? ((payload as { transactions: unknown[] }).transactions as unknown[])
      : [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
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
    .filter((row): row is { date: string; description: string; amount: unknown; rawAmount: string; direction: string } =>
      Boolean(row)
    );
}

function sharedStatePlugin(): Plugin {
  return {
    name: "shared-state-api",
    configureServer(server) {
      server.middlewares.use("/api/parse-transactions", async (req, res) => {
        if (!req.url) return;
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("end", async () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(raw || "{}") as {
              model?: string;
              text?: string;
              sourceLabel?: string;
            };

            const text = typeof body.text === "string" ? body.text.trim() : "";
            if (!text) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Statement text is required." }));
              return;
            }

            const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "llama3.2:3b";
            const sourceLabel = typeof body.sourceLabel === "string" ? body.sourceLabel.trim() : "Pasted";

            const system =
              "You are a strict transaction extractor. Output only valid JSON with no markdown and no prose.";
            const prompt = [
              "Extract all transactions from this bank/app statement text.",
              `Source label: ${sourceLabel}`,
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

            const ollamaResp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                prompt,
                system,
                stream: false,
                options: { temperature: 0.1 },
              }),
            });

            if (!ollamaResp.ok) {
              const details = await ollamaResp.text();
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: "Ollama parse request failed.",
                  details: details || `Status ${ollamaResp.status}`,
                })
              );
              return;
            }

            const json = (await ollamaResp.json()) as { response?: string };
            const modelText = typeof json.response === "string" ? json.response : "";
            const parsed = parseJsonFromText(modelText);
            const transactions = coerceParsedTransactions(parsed);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ transactions }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: "Could not parse statement with Ollama.",
                details: error instanceof Error ? error.message : "Unknown error",
              })
            );
          }
        });
      });

      server.middlewares.use("/api/ai", async (req, res) => {
        if (!req.url) return;
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("end", async () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(raw || "{}") as { model?: string; prompt?: string; system?: string };
            const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
            if (!prompt) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Prompt is required." }));
              return;
            }

            const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "llama3.2:3b";
            const system = typeof body.system === "string" ? body.system : "";

            const ollamaResp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                prompt,
                system,
                stream: false,
                options: { temperature: 0.35 },
              }),
            });

            if (!ollamaResp.ok) {
              const text = await ollamaResp.text();
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: "Ollama request failed.",
                  details: text || `Status ${ollamaResp.status}`,
                })
              );
              return;
            }

            const json = (await ollamaResp.json()) as { response?: string };
            const responseText = typeof json.response === "string" ? json.response.trim() : "";
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ response: responseText }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: "Could not generate response from Ollama.",
                details: error instanceof Error ? error.message : "Unknown error",
              })
            );
          }
        });
      });

      server.middlewares.use("/api/state", async (req, res) => {
        if (!req.url) return;

        if (req.method === "GET") {
          try {
            const raw = await fs.readFile(STATE_FILE, "utf8");
            res.setHeader("Content-Type", "application/json");
            res.end(raw);
            return;
          } catch {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(EMPTY_STATE));
            return;
          }
        }

        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          req.on("end", async () => {
            try {
              const body = Buffer.concat(chunks).toString("utf8") || JSON.stringify(EMPTY_STATE);
              JSON.parse(body);
              await fs.writeFile(STATE_FILE, body, "utf8");
              res.statusCode = 204;
              res.end();
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Could not save state" }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), sharedStatePlugin()],
});
