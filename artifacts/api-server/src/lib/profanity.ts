import { db, bannedWordsTable } from "@workspace/db";
import { logger } from "./logger";

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://www.purgomalum.com/service/containsprofanity?text=${encodeURIComponent(
        text.slice(0, 2000),
      )}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (res.ok) {
      const body = (await res.text()).trim();
      if (body === "true") return "purgomalum";
    }
  } catch (err) {
    logger.warn({ err }, "PurgoMalum unreachable; using banned-word list only");
  }
  return null;
}
