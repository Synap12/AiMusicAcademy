import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  usersTable,
  tracksTable,
  playHistoryTable,
  withdrawalRequestsTable,
  coverArtsTable,
  coverArtGenerationsTable,
} from "@workspace/db";
import { and, eq, desc, gte, sql, count, countDistinct, inArray } from "drizzle-orm";
import { requireArtist } from "../middlewares/auth";
import { PLAY_RATE, coverArtGenerationsFor } from "../lib/plans";
import { generateCoverArt, isOpenAiConfigured } from "../lib/coverart";

const router: IRouter = Router();

router.get("/artist/dashboard", requireArtist, async (req, res, next) => {
  try {
    const artistId = req.user!.id;
    const tracks = await db
      .select()
      .from(tracksTable)
      .where(eq(tracksTable.artistId, artistId));
    const trackIds = tracks.map((t) => t.id);
    const recentPlays = trackIds.length
      ? await db
          .select({
            play: playHistoryTable,
            trackName: tracksTable.trackName,
            coverArt: tracksTable.coverArt,
            listenerName: usersTable.artistName,
          })
          .from(playHistoryTable)
          .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
          .innerJoin(usersTable, eq(playHistoryTable.listenerId, usersTable.id))
          .where(inArray(playHistoryTable.trackId, trackIds))
          .orderBy(desc(playHistoryTable.playedAt))
          .limit(15)
      : [];
    const withdrawals = await db
      .select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.artistId, artistId))
      .orderBy(desc(withdrawalRequestsTable.requestedAt))
      .limit(20);
    res.json({
      stats: {
        totalTracks: tracks.length,
        totalPlays: tracks.reduce((s, t) => s + t.playCount, 0),
        streamBalance: req.user!.streamBalance,
        totalEarnings: req.user!.totalEarnings,
      },
      recentActivity: recentPlays.map((r) => ({
        trackName: r.trackName,
        coverArt: r.coverArt,
        listenerName: r.listenerName,
        playedAt: r.play.playedAt,
      })),
      withdrawals,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/artist/analytics", requireArtist, async (req, res, next) => {
  try {
    const artistId = req.user!.id;
    const range = String(req.query.range ?? "30");
    const days = range === "all" ? null : Number(range) || 30;
    const since = days ? new Date(Date.now() - days * 86400_000) : null;
    const prevSince = days ? new Date(Date.now() - days * 2 * 86400_000) : null;

    const playConditions = [eq(tracksTable.artistId, artistId)];
    if (since) playConditions.push(gte(playHistoryTable.playedAt, since));

    const [[totals], topTracks, daily, allTimeListeners] = await Promise.all([
      db
        .select({
          plays: count(),
          listeners: countDistinct(playHistoryTable.listenerId),
          seconds: sql<string>`coalesce(sum(${tracksTable.durationSeconds}), 0)`,
        })
        .from(playHistoryTable)
        .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
        .where(and(...playConditions)),
      db
        .select({
          trackId: tracksTable.id,
          trackName: tracksTable.trackName,
          coverArt: tracksTable.coverArt,
          genre: tracksTable.genre,
          plays: count(),
        })
        .from(playHistoryTable)
        .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
        .where(and(...playConditions))
        .groupBy(tracksTable.id, tracksTable.trackName, tracksTable.coverArt, tracksTable.genre)
        .orderBy(desc(count()))
        .limit(5),
      db
        .select({
          day: sql<string>`to_char(${playHistoryTable.playedAt}, 'YYYY-MM-DD')`,
          plays: count(),
        })
        .from(playHistoryTable)
        .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
        .where(and(...playConditions))
        .groupBy(sql`to_char(${playHistoryTable.playedAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${playHistoryTable.playedAt}, 'YYYY-MM-DD')`),
      // Listeners who had played this artist before the selected window (returning).
      prevSince
        ? db
            .select({ listenerId: playHistoryTable.listenerId })
            .from(playHistoryTable)
            .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
            .where(
              and(
                eq(tracksTable.artistId, artistId),
                sql`${playHistoryTable.playedAt} < ${since}`,
              ),
            )
            .groupBy(playHistoryTable.listenerId)
        : Promise.resolve([] as { listenerId: number }[]),
    ]);

    const currentListeners = await db
      .select({ listenerId: playHistoryTable.listenerId })
      .from(playHistoryTable)
      .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
      .where(and(...playConditions))
      .groupBy(playHistoryTable.listenerId);
    const previous = new Set(allTimeListeners.map((l) => l.listenerId));
    const returning = currentListeners.filter((l) => previous.has(l.listenerId)).length;
    const plays = totals?.plays ?? 0;
    const listeners = totals?.listeners ?? 0;

    res.json({
      range,
      stats: {
        plays,
        listeners,
        revenue: plays * PLAY_RATE,
        avgListenSeconds: plays > 0 ? Number(totals?.seconds ?? 0) / plays : 0,
      },
      topTracks,
      dailyPlays: daily,
      revenueBreakdown: {
        streaming: plays * PLAY_RATE,
        merch: 0, // merch is fulfilled externally; revenue goes direct to the artist
        tips: 0,
      },
      audience: {
        newListeners: Math.max(0, listeners - returning),
        returningListeners: returning,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/artist/withdrawals", requireArtist, async (req, res, next) => {
  try {
    const schema = z.object({ amount: z.coerce.number().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid amount" });
      return;
    }
    const amount = Math.round(parsed.data.amount * 100) / 100;
    if (amount > req.user!.streamBalance + 1e-9) {
      res.status(400).json({
        error: `You can withdraw up to $${req.user!.streamBalance.toFixed(2)}`,
      });
      return;
    }
    const [pending] = await db
      .select({ n: count() })
      .from(withdrawalRequestsTable)
      .where(
        and(
          eq(withdrawalRequestsTable.artistId, req.user!.id),
          eq(withdrawalRequestsTable.status, "pending"),
        ),
      );
    if ((pending?.n ?? 0) > 0) {
      res.status(400).json({ error: "You already have a pending withdrawal request" });
      return;
    }
    const [request] = await db
      .insert(withdrawalRequestsTable)
      .values({ artistId: req.user!.id, amount })
      .returning();
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

// ---- AI cover art ----

/** Start of the current calendar month (UTC) — quotas reset on the 1st. */
function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Generations used this month. Counted from the permanent generation log
 *  (not the gallery), so deleting a cover never refunds quota. */
async function generationsUsed(artistId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(coverArtGenerationsTable)
    .where(
      and(
        eq(coverArtGenerationsTable.artistId, artistId),
        gte(coverArtGenerationsTable.createdAt, startOfMonth()),
      ),
    );
  return row?.n ?? 0;
}

router.get("/artist/cover-art", requireArtist, async (req, res, next) => {
  try {
    const [gallery, used] = await Promise.all([
      db
        .select()
        .from(coverArtsTable)
        .where(eq(coverArtsTable.artistId, req.user!.id))
        .orderBy(desc(coverArtsTable.createdAt)),
      generationsUsed(req.user!.id),
    ]);
    res.json({
      gallery,
      openaiConfigured: isOpenAiConfigured(),
      usage: {
        used,
        // null = unlimited (admins have no plan and no quota).
        limit: req.user!.isAdmin
          ? null
          : coverArtGenerationsFor(req.user!.subscriptionPlan),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/artist/cover-art", requireArtist, async (req, res, next) => {
  try {
    const schema = z.object({
      prompt: z.string().min(3).max(1000),
      style: z.string().max(60).optional().default(""),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Describe the cover you want (3+ characters)" });
      return;
    }
    if (!req.user!.isAdmin) {
      const limit = coverArtGenerationsFor(req.user!.subscriptionPlan);
      const used = await generationsUsed(req.user!.id);
      if (used >= limit) {
        res.status(403).json({
          error: `You've used all ${limit} AI cover generations for this month. Your quota resets on the 1st.`,
        });
        return;
      }
    }
    const { url, generator } = await generateCoverArt(
      parsed.data.prompt,
      parsed.data.style,
    );
    await db
      .insert(coverArtGenerationsTable)
      .values({ artistId: req.user!.id });
    const [art] = await db
      .insert(coverArtsTable)
      .values({
        artistId: req.user!.id,
        image: url,
        prompt: parsed.data.prompt,
        style: parsed.data.style,
      })
      .returning();
    res.status(201).json({ art, generator });
  } catch (err) {
    next(err);
  }
});

router.delete("/artist/cover-art/:id", requireArtist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db
      .delete(coverArtsTable)
      .where(
        and(eq(coverArtsTable.id, id), eq(coverArtsTable.artistId, req.user!.id)),
      )
      .returning({ id: coverArtsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Cover not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/artist/cover-art/:id/assign",
  requireArtist,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({ trackId: z.coerce.number().int() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Pick a track" });
        return;
      }
      const [art] = await db
        .select()
        .from(coverArtsTable)
        .where(
          and(eq(coverArtsTable.id, id), eq(coverArtsTable.artistId, req.user!.id)),
        )
        .limit(1);
      if (!art) {
        res.status(404).json({ error: "Cover not found" });
        return;
      }
      const [track] = await db
        .update(tracksTable)
        .set({ coverArt: art.image })
        .where(
          and(
            eq(tracksTable.id, parsed.data.trackId),
            eq(tracksTable.artistId, req.user!.id),
          ),
        )
        .returning();
      if (!track) {
        res.status(404).json({ error: "Track not found" });
        return;
      }
      res.json({ track });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
