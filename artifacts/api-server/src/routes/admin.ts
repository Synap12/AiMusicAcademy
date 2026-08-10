import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  usersTable,
  tracksTable,
  merchProductsTable,
  postsTable,
  reportsTable,
  withdrawalRequestsTable,
  bannedWordsTable,
} from "@workspace/db";
import { and, eq, desc, count, sql, gt, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { destroyUserSessions, miniUser } from "../lib/auth";
import { PLANS, type PlanId } from "../lib/plans";

const router: IRouter = Router();

router.use("/admin", requireAdmin);

router.get("/admin/metrics", async (_req, res, next) => {
  try {
    const [users, [trackCount], [merchCount], [postCount]] = await Promise.all([
      db
        .select({
          userType: usersTable.userType,
          subscriptionPlan: usersTable.subscriptionPlan,
          subscriptionStatus: usersTable.subscriptionStatus,
        })
        .from(usersTable),
      db.select({ n: count() }).from(tracksTable),
      db.select({ n: count() }).from(merchProductsTable),
      db.select({ n: count() }).from(postsTable),
    ]);

    const active = (u: (typeof users)[number]) => u.subscriptionStatus === "active";
    const perTier: Record<string, { subscribers: number; mrr: number }> = {};
    for (const plan of Object.values(PLANS)) {
      const subs = users.filter(
        (u) => active(u) && u.subscriptionPlan === plan.id,
      ).length;
      perTier[plan.id] = { subscribers: subs, mrr: subs * plan.price };
    }
    const mrr = Object.values(perTier).reduce((s, t) => s + t.mrr, 0);

    res.json({
      users: {
        total: users.length,
        activeListeners: users.filter((u) => u.userType === "LISTENER" && active(u)).length,
        activeArtists: users.filter((u) => u.userType === "ARTIST" && active(u)).length,
        freeUsers: users.filter((u) => !active(u)).length,
      },
      revenue: { mrr, perTier },
      content: {
        tracks: trackCount?.n ?? 0,
        merchProducts: merchCount?.n ?? 0,
        posts: postCount?.n ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/users", async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const type = String(req.query.type ?? "").trim().toUpperCase();
    const conditions = [];
    if (type === "LISTENER" || type === "ARTIST") {
      conditions.push(eq(usersTable.userType, type));
    }
    if (search) {
      conditions.push(
        sql`(lower(${usersTable.artistName}) like ${"%" + search + "%"} or lower(${usersTable.email}) like ${"%" + search + "%"})`,
      );
    }
    const rows = await db
      .select()
      .from(usersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(500);
    res.json({
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        artistName: u.artistName,
        profileImage: u.profileImage,
        userType: u.userType,
        subscriptionPlan: u.subscriptionPlan,
        subscriptionStatus: u.subscriptionStatus,
        isAdmin: u.isAdmin,
        isBanned: u.isBanned,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/users/:id/ban", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      res.status(400).json({ error: "You cannot ban yourself" });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set({ isBanned: true })
      .where(and(eq(usersTable.id, id), eq(usersTable.isAdmin, false)))
      .returning();
    if (!user) {
      res.status(404).json({ error: "User not found (admins cannot be banned)" });
      return;
    }
    await destroyUserSessions(id);
    res.json({ ok: true, isBanned: true });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/users/:id/unban", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [user] = await db
      .update(usersTable)
      .set({ isBanned: false })
      .where(eq(usersTable.id, id))
      .returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ok: true, isBanned: false });
  } catch (err) {
    next(err);
  }
});

/** Moderation queue: pending reports with post + author + reporter context. */
router.get("/admin/reports", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        report: reportsTable,
        post: postsTable,
        author: usersTable,
      })
      .from(reportsTable)
      .innerJoin(postsTable, eq(reportsTable.postId, postsTable.id))
      .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(eq(reportsTable.isReviewed, false))
      .orderBy(desc(reportsTable.createdAt));

    const reporterIds = [...new Set(rows.map((r) => r.report.reporterId))];
    const reporters = reporterIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(inArray(usersTable.id, reporterIds))
      : [];
    const reporterMap = new Map(reporters.map((u) => [u.id, miniUser(u)]));

    res.json({
      reports: rows.map((r) => ({
        ...r.report,
        post: { ...r.post, author: miniUser(r.author) },
        reporter: reporterMap.get(r.report.reporterId) ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/reports/:id/dismiss", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [report] = await db
      .update(reportsTable)
      .set({ isReviewed: true })
      .where(eq(reportsTable.id, id))
      .returning();
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Delete a reported post: mark all its reports reviewed, then delete. */
router.delete("/admin/posts/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(reportsTable)
      .set({ isReviewed: true })
      .where(eq(reportsTable.postId, id));
    const deleted = await db
      .delete(postsTable)
      .where(eq(postsTable.id, id))
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

/** Payout management. */
router.get("/admin/payouts", async (_req, res, next) => {
  try {
    const [artistsWithBalance, pendingRequests, history, [totals]] =
      await Promise.all([
        db
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.userType, "ARTIST"), gt(usersTable.streamBalance, 0)))
          .orderBy(desc(usersTable.streamBalance)),
        db
          .select({ request: withdrawalRequestsTable, artist: usersTable })
          .from(withdrawalRequestsTable)
          .innerJoin(usersTable, eq(withdrawalRequestsTable.artistId, usersTable.id))
          .where(eq(withdrawalRequestsTable.status, "pending"))
          .orderBy(desc(withdrawalRequestsTable.requestedAt)),
        db
          .select({ request: withdrawalRequestsTable, artist: usersTable })
          .from(withdrawalRequestsTable)
          .innerJoin(usersTable, eq(withdrawalRequestsTable.artistId, usersTable.id))
          .where(eq(withdrawalRequestsTable.status, "paid"))
          .orderBy(desc(withdrawalRequestsTable.paidAt))
          .limit(50),
        db
          .select({ total: sql<string>`coalesce(sum(${usersTable.streamBalance}), 0)` })
          .from(usersTable),
      ]);
    res.json({
      totalPayable: Number(totals?.total ?? 0),
      artists: artistsWithBalance.map((a) => ({
        ...miniUser(a),
        email: a.email,
        streamBalance: a.streamBalance,
        totalEarnings: a.totalEarnings,
        payoutMethod: a.payoutMethod,
      })),
      pendingRequests: pendingRequests.map((r) => ({
        ...r.request,
        artist: { ...miniUser(r.artist), email: r.artist.email },
      })),
      history: history.map((r) => ({
        ...r.request,
        artist: { ...miniUser(r.artist), email: r.artist.email },
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Mark an artist paid: zero their balance and settle pending requests. */
router.post("/admin/payouts/:artistId/mark-paid", async (req, res, next) => {
  try {
    const artistId = Number(req.params.artistId);
    const [artist] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, artistId))
      .limit(1);
    if (!artist) {
      res.status(404).json({ error: "Artist not found" });
      return;
    }
    await db
      .update(withdrawalRequestsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(
        and(
          eq(withdrawalRequestsTable.artistId, artistId),
          eq(withdrawalRequestsTable.status, "pending"),
        ),
      );
    await db
      .update(usersTable)
      .set({ streamBalance: 0 })
      .where(eq(usersTable.id, artistId));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Banned word management for the profanity filter. */
router.get("/admin/banned-words", async (_req, res, next) => {
  try {
    const words = await db.select().from(bannedWordsTable).orderBy(bannedWordsTable.word);
    res.json({ words });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/banned-words", async (req, res, next) => {
  try {
    const schema = z.object({ word: z.string().min(2).max(60) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Word must be at least 2 characters" });
      return;
    }
    const [word] = await db
      .insert(bannedWordsTable)
      .values({ word: parsed.data.word.toLowerCase().trim() })
      .onConflictDoNothing()
      .returning();
    res.status(201).json({ word: word ?? null });
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/banned-words/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(bannedWordsTable).where(eq(bannedWordsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
