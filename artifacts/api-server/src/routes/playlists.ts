import { Router, type IRouter } from "express";
import {
  db,
  playlistsTable,
  playlistTracksTable,
  tracksTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, count, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireOnboarded } from "../middlewares/auth";
import { miniUser } from "../lib/auth";
import { withAudioForUser } from "../lib/audio";

const router: IRouter = Router();

const nameSchema = z.object({ name: z.string().min(1).max(80) });

/** Load a playlist only if it belongs to the requester. */
async function ownPlaylist(id: number, userId: number) {
  if (!Number.isInteger(id)) return null;
  const [playlist] = await db
    .select()
    .from(playlistsTable)
    .where(and(eq(playlistsTable.id, id), eq(playlistsTable.userId, userId)))
    .limit(1);
  return playlist ?? null;
}

/** My playlists, newest first, with track counts and up to 4 cover thumbs. */
router.get("/playlists", requireOnboarded, async (req, res, next) => {
  try {
    // Unpublished/taken-down tracks stay in the join tables (they reappear if
    // republished) but are never counted, shown, or served.
    const playlists = await db
      .select({
        playlist: playlistsTable,
        trackCount: count(tracksTable.id),
      })
      .from(playlistsTable)
      .leftJoin(
        playlistTracksTable,
        eq(playlistTracksTable.playlistId, playlistsTable.id),
      )
      .leftJoin(
        tracksTable,
        and(
          eq(playlistTracksTable.trackId, tracksTable.id),
          eq(tracksTable.isPublished, true),
        ),
      )
      .where(eq(playlistsTable.userId, req.user!.id))
      .groupBy(playlistsTable.id)
      .orderBy(desc(playlistsTable.createdAt));

    const ids = playlists.map((p) => p.playlist.id);
    const covers = new Map<number, string[]>();
    if (ids.length > 0) {
      const rows = await db
        .select({
          playlistId: playlistTracksTable.playlistId,
          coverArt: tracksTable.coverArt,
        })
        .from(playlistTracksTable)
        .innerJoin(tracksTable, eq(playlistTracksTable.trackId, tracksTable.id))
        .where(
          and(
            sql`${playlistTracksTable.playlistId} in ${ids}`,
            eq(tracksTable.isPublished, true),
          ),
        )
        .orderBy(asc(playlistTracksTable.position));
      for (const r of rows) {
        const list = covers.get(r.playlistId) ?? [];
        if (list.length < 4 && r.coverArt) list.push(r.coverArt);
        covers.set(r.playlistId, list);
      }
    }
    res.json({
      playlists: playlists.map((p) => ({
        ...p.playlist,
        trackCount: p.trackCount,
        covers: covers.get(p.playlist.id) ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/playlists", requireOnboarded, async (req, res, next) => {
  try {
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Give your playlist a name (max 80 characters)" });
      return;
    }
    const [playlist] = await db
      .insert(playlistsTable)
      .values({ userId: req.user!.id, name: parsed.data.name })
      .returning();
    res.status(201).json({ playlist: { ...playlist, trackCount: 0, covers: [] } });
  } catch (err) {
    next(err);
  }
});

/** Playlist detail with its tracks in order (audio tier applied per viewer). */
router.get("/playlists/:id", requireOnboarded, async (req, res, next) => {
  try {
    const playlist = await ownPlaylist(Number(req.params.id), req.user!.id);
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    const rows = await db
      .select({ track: tracksTable, artist: usersTable })
      .from(playlistTracksTable)
      .innerJoin(tracksTable, eq(playlistTracksTable.trackId, tracksTable.id))
      .innerJoin(usersTable, eq(tracksTable.artistId, usersTable.id))
      .where(
        and(
          eq(playlistTracksTable.playlistId, playlist.id),
          eq(tracksTable.isPublished, true),
        ),
      )
      .orderBy(asc(playlistTracksTable.position));
    res.json({
      playlist,
      tracks: rows.map((r) => ({
        ...withAudioForUser(r.track, req.user!),
        artist: miniUser(r.artist),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/playlists/:id", requireOnboarded, async (req, res, next) => {
  try {
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Give your playlist a name (max 80 characters)" });
      return;
    }
    const playlist = await ownPlaylist(Number(req.params.id), req.user!.id);
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    const [updated] = await db
      .update(playlistsTable)
      .set({ name: parsed.data.name })
      .where(eq(playlistsTable.id, playlist.id))
      .returning();
    res.json({ playlist: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/playlists/:id", requireOnboarded, async (req, res, next) => {
  try {
    const playlist = await ownPlaylist(Number(req.params.id), req.user!.id);
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    await db.delete(playlistsTable).where(eq(playlistsTable.id, playlist.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/playlists/:id/tracks", requireOnboarded, async (req, res, next) => {
  try {
    const parsed = z.object({ trackId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "trackId is required" });
      return;
    }
    const playlist = await ownPlaylist(Number(req.params.id), req.user!.id);
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    const [track] = await db
      .select({ id: tracksTable.id, isPublished: tracksTable.isPublished })
      .from(tracksTable)
      .where(eq(tracksTable.id, parsed.data.trackId))
      .limit(1);
    if (!track || !track.isPublished) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    // Single statement so concurrent adds can't compute the same position;
    // RETURNING tells us whether the row was new or a duplicate no-op.
    const result = await db.execute(sql`
      insert into playlist_tracks (playlist_id, track_id, position)
      values (
        ${playlist.id},
        ${track.id},
        coalesce((select max(position) from playlist_tracks where playlist_id = ${playlist.id}), 0) + 1
      )
      on conflict do nothing
      returning id
    `);
    const added = (result.rows ?? []).length > 0;
    res.status(added ? 201 : 200).json({ ok: true, added });
  } catch (err) {
    next(err);
  }
});

router.delete(
  "/playlists/:id/tracks/:trackId",
  requireOnboarded,
  async (req, res, next) => {
    try {
      const playlist = await ownPlaylist(Number(req.params.id), req.user!.id);
      const trackId = Number(req.params.trackId);
      if (!playlist || !Number.isInteger(trackId)) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }
      await db
        .delete(playlistTracksTable)
        .where(
          and(
            eq(playlistTracksTable.playlistId, playlist.id),
            eq(playlistTracksTable.trackId, trackId),
          ),
        );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
