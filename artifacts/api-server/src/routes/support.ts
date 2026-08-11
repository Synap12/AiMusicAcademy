import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, supportTicketsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireOnboarded, requireAdmin } from "../middlewares/auth";
import { miniUser } from "../lib/auth";

const router: IRouter = Router();

/** Pro subscribers (listener or artist) get priority handling. */
function isPriorityUser(plan: string | null): boolean {
  return plan === "listener_pro" || plan === "artist_pro";
}

router.post("/support", requireOnboarded, async (req, res, next) => {
  try {
    const schema = z.object({
      subject: z.string().min(3).max(150),
      message: z.string().min(10).max(5000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Add a subject (3+ characters) and a message (10+ characters)",
      });
      return;
    }
    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({
        userId: req.user!.id,
        subject: parsed.data.subject,
        message: parsed.data.message,
        isPriority: isPriorityUser(req.user!.subscriptionPlan),
      })
      .returning();
    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
});

router.get("/support/mine", requireOnboarded, async (req, res, next) => {
  try {
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.userId, req.user!.id))
      .orderBy(desc(supportTicketsTable.createdAt));
    res.json({
      tickets,
      isPriority: isPriorityUser(req.user!.subscriptionPlan),
    });
  } catch (err) {
    next(err);
  }
});

// ---- Admin queue ----

router.get("/admin/support", requireAdmin, async (req, res, next) => {
  try {
    const rows = await db
      .select({ ticket: supportTicketsTable, user: usersTable })
      .from(supportTicketsTable)
      .innerJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
      .orderBy(desc(supportTicketsTable.createdAt));
    const tickets = rows.map((r) => ({
      ...r.ticket,
      user: { ...miniUser(r.user), subscriptionPlan: r.user.subscriptionPlan },
    }));
    // Open tickets first, priority first within each group.
    tickets.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/support/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      status: z.enum(["open", "closed"]),
      reply: z.string().max(5000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const [ticket] = await db
      .update(supportTicketsTable)
      .set({
        status: parsed.data.status,
        // Leave the stored reply untouched unless a new one is provided.
        ...(parsed.data.reply !== undefined ? { reply: parsed.data.reply } : {}),
        resolvedAt: parsed.data.status === "closed" ? new Date() : null,
      })
      .where(eq(supportTicketsTable.id, id))
      .returning();
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});

export default router;
