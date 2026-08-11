import https from "node:https";
import { db, bannedWordsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Plain https GET returning the body. Used instead of fetch(): undici ignores
 * the process dns result order and stalls for seconds on PurgoMalum's
 * unroutable IPv6 address, blowing the filter's fail-open timeout.
 */
function httpsGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

/**
 * Two-layer profanity filter (mirrors the blueprint):
 * 1. Custom Banned_Word list in the database.
 * 2. PurgoMalum public API (best-effort, 2.5s timeout, fail-open).
 * Returns the offending source ("banned-word" | "purgomalum") or null if clean.
 */
export async function checkProfanity(text: string): Promise<string | null> {
  const lower = text.toLowerCase();
  const words = await db.select().from(bannedWordsTable);
  for (const w of words) {
    const term = w.word.trim().toLowerCase();
    if (term && lower.includes(term)) return "banned-word";
  }

  try {
    const body = await httpsGet(
      `https://www.purgomalum.com/service/containsprofanity?text=${encodeURIComponent(
        text.slice(0, 2000),
      )}`,
      4000,
    );
    if (body.trim() === "true") return "purgomalum";
  } catch (err) {
    logger.warn({ err }, "PurgoMalum unreachable; using banned-word list only");
  }
  return null;
}
