import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  usersTable,
  tracksTable,
  merchProductsTable,
  postsTable,
  followingsTable,
} from "@workspace/db";
import { and, eq, desc, count } from "drizzle-orm";
import { requireAuth, requireOnboarded } from "../middlewares/auth";
import { hashPassword, verifyPassword, publicUser, miniUser } from "../lib/auth";
import { imageUpload, uploadUrl } from "../lib/uploads";
import { withAudioForUser } from "../lib/audio";

const router: IRouter = Router();

const profileSchema = z.object({
  artistName: z.string().min(1).max(80).optional(),
  bio: z.string().max(2000).optional(),
  socialLinks: z.string().max(1000).optional(),
  payoutMethod: z.string().max(500).optional(),
  notifyNewFollower: z.boolean().optional(),
  notifyCommunity: z.boolean().optional(),
});

router.patch("/users/me", requireAuth, async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

router.post("/users/me/password", requireAuth, async (req, res, next) => {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }
    if (!verifyPassword(parsed.data.currentPassword, req.user!.passwordHash)) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(parsed.data.newPassword) })
      .where(eq(usersTable.id, req.user!.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/users/me/avatar",
  requireAuth,
  imageUpload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image uploaded" });
        return;
      }
      const [user] = await db
        .update(usersTable)
        .set({ profileImage: uploadUrl("images", req.file.filename) })
        .where(eq(usersTable.id, req.user!.id))
        .returning();
      res.json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/users/me/cover",
  requireAuth,
  imageUpload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image uploaded" });
        return;
      }
      const [user] = await db
        .update(usersTable)
        .set({ coverImage: uploadUrl("images", req.file.filename) })
        .where(eq(usersTable.id, req.user!.id))
        .returning();
      res.json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  },
);

/** Public artist profile: bio, published tracks, active merch, recent posts. */
router.get("/users/:id", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const [profile] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!profile || profile.isBanned) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [tracks, merch, posts, [followers], [following]] = await Promise.all([
      db
        .select()
        .from(tracksTable)
        .where(and(eq(tracksTable.artistId, id), eq(tracksTable.isPublished, true)))
        .orderBy(desc(tracksTable.releaseDate)),
      db
        .select()
        .from(merchProductsTable)
        .where(and(eq(merchProductsTable.artistId, id), eq(merchProductsTable.isActive, true))),
      db
        .select()
        .from(postsTable)
        .where(eq(postsTable.authorId, id))
        .orderBy(desc(postsTable.createdAt))
        .limit(5),
      db
        .select({ n: count() })
        .from(followingsTable)
        .where(eq(followingsTable.artistId, id)),
      db
        .select({ n: count() })
        .from(followingsTable)
        .where(
          and(
            eq(followingsTable.artistId, id),
            eq(followingsTable.followerId, req.user!.id),
          ),
        ),
    ]);
    res.json({
      profile: {
        ...miniUser(profile),
        bio: profile.bio,
        coverImage: profile.coverImage,
        socialLinks: profile.socialLinks,
        createdAt: profile.createdAt,
      },
      tracks: tracks.map((t) => ({
        ...withAudioForUser(t, req.user!),
        artist: miniUser(profile),
      })),
      merch: merch.map((m) => ({ ...m, artist: miniUser(profile) })),
      posts: posts.map((p) => {
        const locked =
          p.isExclusive &&
          p.authorId !== req.user!.id &&
          !req.user!.isAdmin &&
          req.user!.userType !== "ARTIST" &&
          req.user!.subscriptionPlan !== "listener_pro";
        return {
          ...p,
          content: locked ? "" : p.content,
          image: locked ? null : p.image,
          locked,
        };
      }),
      followerCount: followers?.n ?? 0,
      isFollowing: (following?.n ?? 0) > 0,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/follow", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id === req.user!.id) {
      res.status(400).json({ error: "Cannot follow this user" });
      return;
    }
    const [target] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await db
      .insert(followingsTable)
      .values({ followerId: req.user!.id, artistId: id })
      .onConflictDoNothing();
    res.json({ ok: true, isFollowing: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id/follow", requireOnboarded, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(followingsTable)
      .where(
        and(
          eq(followingsTable.followerId, req.user!.id),
          eq(followingsTable.artistId, id),
        ),
      );
    res.json({ ok: true, isFollowing: false });
  } catch (err) {
    next(err);
  }
});

export default router;
