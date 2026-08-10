import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  usersTable,
  postsTable,
  commentsTable,
  postLikesTable,
  reportsTable,
  tracksTable,
} from "@workspace/db";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { requireOnboarded } from "../middlewares/auth";
import { miniUser } from "../lib/auth";
import { imageUpload, uploadUrl } from "../lib/uploads";
import { checkProfanity } from "../lib/profanity";

const router: IRouter = Router();

const PROFANITY_MSG =
  "Your post contains language that isn't allowed in the community.";

async function hydratePosts(postIds: number[], viewerId: number) {
  if (postIds.length === 0)
    return { comments: new Map(), likes: new Set<number>() };
  const [commentRows, likeRows] = await Promise.all([
    db
      .select({ postId: commentsTable.postId, n: sql<number>`count(*)::int` })
      .from(commentsTable)
      .where(inArray(commentsTable.postId, postIds))
      .groupBy(commentsTable.postId),
    db
      .select({ postId: postLikesTable.postId })
      .from(postLikesTable)
      .where(
        and(
          inArray(postLikesTable.postId, postIds),
          eq(postLikesTable.userId, viewerId),
        ),
      ),
  ]);
  return {
    comments: new Map(commentRows.map((r) => [r.postId, r.n])),
    likes: new Set(likeRows.map((r) => r.postId)),
  };
}

router.get("/posts", requireOnboarded, async (req, res, next) => {
  try {
    const authorId = req.query.author ? Number(req.query.author) : null;
    const conditions = authorId ? [eq(postsTable.authorId, authorId)] : [];
    const rows = await db
      .select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(postsTable.createdAt))
      .limit(100);

    const trackIds = rows
      .map((r) => r.post.trackId)
      .filter((t): t is number => t != null);
    const tracks = trackIds.length
      ? await db
          .select({ track: tracksTable, artist: usersTable })
          .from(tracksTable)
          .innerJoin(usersTable, eq(tracksTable.artistId, usersTable.id))
          .where(inArray(tracksTable.id, trackIds))
      : [];
    const trackMap = new Map(
      tracks.map((t) => [t.track.id, { ...t.track, artist: miniUser(t.artist) }]),
    );
    const { comments, likes } = await hydratePosts(
      rows.map((r) => r.post.id),
      req.user!.id,
    );
    res.json({
      posts: rows.map((r) => ({
        ...r.post,
        author: miniUser(r.author),
        track: r.post.trackId ? (trackMap.get(r.post.trackId) ?? null) : null,
        commentCount: comments.get(r.post.id) ?? 0,
        likedByMe: likes.has(r.post.id),
        isMine: r.post.authorId === req.user!.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/posts",
  requireOnboarded,
  imageUpload.single("image"),
  async (req, res, next) => {
    try {
      const schema = z.object({
        content: z.string().min(1).max(5000),
        trackId: z.coerce.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Post content is required" });
        return;
      }
      if (await checkProfanity(parsed.data.content)) {
        res.status(400).json({ error: PROFANITY_MSG });
        return;
      }
      let trackId: number | null = null;
      if (parsed.data.trackId) {
        const [track] = await db
          .select({ id: tracksTable.id })
          .from(tracksTable)
          .where(
            and(
              eq(tracksTable.id, parsed.data.trackId),
              eq(tracksTable.isPublished, true),
            ),
          )
          .limit(1);
        if (track) trackId = track.id;
      }
      const [post] = await db
        .insert(postsTable)
        .values({
          authorId: req.user!.id,
          content: parsed.data.content,
          image: req.file ? uploadUrl("images", req.file.filename) : null,
          trackId,
        })
        .returning();
      res.status(201).json({
        post: {
          ...post,
          author: miniUser(req.user!),
          track: null,
          commentCount: 0,
          likedByMe: false,
          isMine: true,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch("/posts/:id", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ content: z.string().min(1).max(5000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Post content is required" });
      return;
    }
    if (await checkProfanity(parsed.data.content)) {
      res.status(400).json({ error: PROFANITY_MSG });
      return;
    }
    const [post] = await db
      .update(postsTable)
      .set({ content: parsed.data.content, updatedAt: new Date() })
      .where(and(eq(postsTable.id, id), eq(postsTable.authorId, req.user!.id)))
      .returning();
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json({ post });
  } catch (err) {
    next(err);
  }
});

router.delete("/posts/:id", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const conditions = req.user!.isAdmin
      ? [eq(postsTable.id, id)]
      : [eq(postsTable.id, id), eq(postsTable.authorId, req.user!.id)];
    const deleted = await db
      .delete(postsTable)
      .where(and(...conditions))
      .returning({ id: postsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/posts/:id/like", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const inserted = await db
      .insert(postLikesTable)
      .values({ postId: id, userId: req.user!.id })
      .onConflictDoNothing()
      .returning({ id: postLikesTable.id });
    if (inserted.length > 0) {
      await db
        .update(postsTable)
        .set({ likeCount: sql`${postsTable.likeCount} + 1` })
        .where(eq(postsTable.id, id));
    }
    res.json({ ok: true, likedByMe: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/posts/:id/like", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db
      .delete(postLikesTable)
      .where(
        and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, req.user!.id)),
      )
      .returning({ id: postLikesTable.id });
    if (deleted.length > 0) {
      await db
        .update(postsTable)
        .set({ likeCount: sql`greatest(${postsTable.likeCount} - 1, 0)` })
        .where(eq(postsTable.id, id));
    }
    res.json({ ok: true, likedByMe: false });
  } catch (err) {
    next(err);
  }
});

router.get("/posts/:id/comments", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select({ comment: commentsTable, commenter: usersTable })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.commenterId, usersTable.id))
      .where(eq(commentsTable.postId, id))
      .orderBy(commentsTable.createdAt);
    res.json({
      comments: rows.map((r) => ({
        ...r.comment,
        commenter: miniUser(r.commenter),
        isMine: r.comment.commenterId === req.user!.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/posts/:id/comments", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ content: z.string().min(1).max(2000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Comment cannot be empty" });
      return;
    }
    if (await checkProfanity(parsed.data.content)) {
      res.status(400).json({ error: PROFANITY_MSG });
      return;
    }
    const [post] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const [comment] = await db
      .insert(commentsTable)
      .values({ postId: id, commenterId: req.user!.id, content: parsed.data.content })
      .returning();
    res.status(201).json({
      comment: { ...comment, commenter: miniUser(req.user!), isMine: true },
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/comments/:id", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const conditions = req.user!.isAdmin
      ? [eq(commentsTable.id, id)]
      : [eq(commentsTable.id, id), eq(commentsTable.commenterId, req.user!.id)];
    const deleted = await db
      .delete(commentsTable)
      .where(and(...conditions))
      .returning({ id: commentsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/posts/:id/report", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ reason: z.string().min(1).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A reason is required" });
      return;
    }
    const [post] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    await db.insert(reportsTable).values({
      reporterId: req.user!.id,
      postId: id,
      reason: parsed.data.reason,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
