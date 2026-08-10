import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  usersTable,
  tracksTable,
  playHistoryTable,
  likedTracksTable,
  followingsTable,
} from "@workspace/db";
import { and, eq, desc, asc, sql, inArray, count, sum } from "drizzle-orm";
import { requireOnboarded, requireArtist } from "../middlewares/auth";
import { miniUser } from "../lib/auth";
import { audioUpload, uploadUrl } from "../lib/uploads";
import { PLAY_RATE } from "../lib/plans";

const router: IRouter = Router();

async function likedTrackIds(userId: number, trackIds: number[]) {
  if (trackIds.length === 0) return new Set<number>();
  const rows = await db
    .select({ trackId: likedTracksTable.trackId })
    .from(likedTracksTable)
    .where(
      and(
        eq(likedTracksTable.listenerId, userId),
        inArray(likedTracksTable.trackId, trackIds),
      ),
    );
  return new Set(rows.map((r) => r.trackId));
}

/** Browse published tracks with search / genre filter / sort. */
router.get("/tracks", requireOnboarded, async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const genre = String(req.query.genre ?? "").trim();
    const sort = String(req.query.sort ?? "newest");

    const conditions = [eq(tracksTable.isPublished, true)];
    if (genre && genre !== "All") conditions.push(eq(tracksTable.genre, genre));
    if (search) {
      conditions.push(
        sql`(lower(${tracksTable.trackName}) like ${"%" + search + "%"} or lower(${tracksTable.genre}) like ${"%" + search + "%"} or lower(${usersTable.artistName}) like ${"%" + search + "%"})`,
      );
    }
    const orderBy =
      sort === "popular"
        ? desc(tracksTable.playCount)
        : sort === "oldest"
          ? asc(tracksTable.releaseDate)
          : desc(tracksTable.releaseDate);

    const rows = await db
      .select({ track: tracksTable, artist: usersTable })
      .from(tracksTable)
      .innerJoin(usersTable, eq(tracksTable.artistId, usersTable.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(200);

    const liked = await likedTrackIds(
      req.user!.id,
      rows.map((r) => r.track.id),
    );
    res.json({
      tracks: rows.map((r) => ({
        ...r.track,
        artist: miniUser(r.artist),
        likedByMe: liked.has(r.track.id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/genres", requireOnboarded, async (_req, res, next) => {
  try {
    const rows = await db
      .selectDistinct({ genre: tracksTable.genre })
      .from(tracksTable)
      .where(eq(tracksTable.isPublished, true));
    res.json({ genres: rows.map((r) => r.genre).sort() });
  } catch (err) {
    next(err);
  }
});

/** Artist's own tracks (drafts included). */
router.get("/tracks/mine", requireArtist, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(tracksTable)
      .where(eq(tracksTable.artistId, req.user!.id))
      .orderBy(desc(tracksTable.createdAt));
    res.json({
      tracks: rows.map((t) => ({ ...t, artist: miniUser(req.user!) })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/tracks",
  requireArtist,
  audioUpload.fields([
    { name: "audio", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const audio = files?.audio?.[0];
      if (!audio) {
        res.status(400).json({ error: "An audio file is required" });
        return;
      }
      const schema = z.object({
        trackName: z.string().min(1).max(120),
        genre: z.string().min(1).max(40),
        releaseDate: z.string().optional(),
        // Multipart form fields arrive as strings, where "false" must mean false.
        isPublished: z
          .preprocess((v) => v === true || v === "true" || v === "1", z.boolean())
          .optional(),
        durationSeconds: z.coerce.number().positive().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
        return;
      }
      const cover = files?.cover?.[0];
      const [track] = await db
        .insert(tracksTable)
        .values({
          trackName: parsed.data.trackName,
          genre: parsed.data.genre,
          artistId: req.user!.id,
          audioFile: uploadUrl("audio", audio.filename),
          coverArt: cover ? uploadUrl("images", cover.filename) : null,
          releaseDate: parsed.data.releaseDate
            ? new Date(parsed.data.releaseDate)
            : new Date(),
          isPublished: parsed.data.isPublished ?? false,
          durationSeconds: parsed.data.durationSeconds,
        })
        .returning();
      res.status(201).json({ track: { ...track, artist: miniUser(req.user!) } });
    } catch (err) {
      next(err);
    }
  },
);

const editSchema = z.object({
  trackName: z.string().min(1).max(120).optional(),
  genre: z.string().min(1).max(40).optional(),
  releaseDate: z.string().optional(),
  isPublished: z.boolean().optional(),
  coverArt: z.string().max(1000).optional(),
});

router.patch("/tracks/:id", requireArtist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }
    const { releaseDate, ...rest } = parsed.data;
    const [track] = await db
      .update(tracksTable)
      .set({
        ...rest,
        ...(releaseDate ? { releaseDate: new Date(releaseDate) } : {}),
      })
      .where(and(eq(tracksTable.id, id), eq(tracksTable.artistId, req.user!.id)))
      .returning();
    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    res.json({ track: { ...track, artist: miniUser(req.user!) } });
  } catch (err) {
    next(err);
  }
});

router.delete("/tracks/:id", requireArtist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db
      .delete(tracksTable)
      .where(and(eq(tracksTable.id, id), eq(tracksTable.artistId, req.user!.id)))
      .returning({ id: tracksTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Record a play: play_history row, play_count increment, and artist earnings
 * credit (the blueprint's `play_increment_balances` backend workflow).
 */
router.post("/tracks/:id/play", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [track] = await db
      .select()
      .from(tracksTable)
      .where(eq(tracksTable.id, id))
      .limit(1);
    if (!track || (!track.isPublished && track.artistId !== req.user!.id)) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    await db.insert(playHistoryTable).values({
      listenerId: req.user!.id,
      trackId: id,
    });
    await db
      .update(tracksTable)
      .set({ playCount: sql`${tracksTable.playCount} + 1` })
      .where(eq(tracksTable.id, id));
    // Self-plays don't earn revenue.
    if (track.artistId !== req.user!.id) {
      await db
        .update(usersTable)
        .set({
          streamBalance: sql`${usersTable.streamBalance} + ${PLAY_RATE}`,
          totalEarnings: sql`${usersTable.totalEarnings} + ${PLAY_RATE}`,
        })
        .where(eq(usersTable.id, track.artistId));
    }
    res.json({ ok: true, playCount: track.playCount + 1 });
  } catch (err) {
    next(err);
  }
});

router.post("/tracks/:id/like", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [track] = await db
      .select({ id: tracksTable.id })
      .from(tracksTable)
      .where(and(eq(tracksTable.id, id), eq(tracksTable.isPublished, true)))
      .limit(1);
    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    await db
      .insert(likedTracksTable)
      .values({ listenerId: req.user!.id, trackId: id })
      .onConflictDoNothing();
    res.json({ ok: true, likedByMe: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/tracks/:id/like", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(likedTracksTable)
      .where(
        and(
          eq(likedTracksTable.listenerId, req.user!.id),
          eq(likedTracksTable.trackId, id),
        ),
      );
    res.json({ ok: true, likedByMe: false });
  } catch (err) {
    next(err);
  }
});

/** Personal library: liked songs, followed artists, listen stats. */
router.get("/library", requireOnboarded, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [likedRows, followRows, [playStats]] = await Promise.all([
      db
        .select({ liked: likedTracksTable, track: tracksTable, artist: usersTable })
        .from(likedTracksTable)
        .innerJoin(tracksTable, eq(likedTracksTable.trackId, tracksTable.id))
        .innerJoin(usersTable, eq(tracksTable.artistId, usersTable.id))
        .where(eq(likedTracksTable.listenerId, userId))
        .orderBy(desc(likedTracksTable.likedDate)),
      db
        .select({ following: followingsTable, artist: usersTable })
        .from(followingsTable)
        .innerJoin(usersTable, eq(followingsTable.artistId, usersTable.id))
        .where(eq(followingsTable.followerId, userId))
        .orderBy(desc(followingsTable.followedDate)),
      db
        .select({
          plays: count(),
          seconds: sum(tracksTable.durationSeconds),
        })
        .from(playHistoryTable)
        .innerJoin(tracksTable, eq(playHistoryTable.trackId, tracksTable.id))
        .where(eq(playHistoryTable.listenerId, userId)),
    ]);
    res.json({
      likedTracks: likedRows.map((r) => ({
        ...r.track,
        artist: miniUser(r.artist),
        likedByMe: true,
        likedDate: r.liked.likedDate,
      })),
      following: followRows.map((r) => ({
        ...miniUser(r.artist),
        bio: r.artist.bio,
        followedDate: r.following.followedDate,
      })),
      stats: {
        likedCount: likedRows.length,
        followingCount: followRows.length,
        totalPlays: playStats?.plays ?? 0,
        totalListenSeconds: Number(playStats?.seconds ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
