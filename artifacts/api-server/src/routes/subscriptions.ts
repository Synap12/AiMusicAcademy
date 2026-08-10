import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PLANS, type PlanId } from "../lib/plans";
import {
  isStripeConfigured,
  paymentLinkFor,
  createPortalSession,
  cancelStripeSubscription,
} from "../lib/stripe";
import { requireAuth } from "../middlewares/auth";
import { publicUser } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/subscriptions/plans", (_req, res) => {
  res.json({ plans: Object.values(PLANS), stripeConfigured: isStripeConfigured() });
});

const checkoutSchema = z.object({
  plan: z.enum(["listener_basic", "listener_pro", "artist_basic", "artist_pro"]),
});

/**
 * Start checkout for a plan. With Stripe configured this returns the Payment
 * Link (with client_reference_id); without it, it returns mock=true and the
 * frontend confirms via /subscriptions/mock-complete to simulate the webhook.
 */
router.post("/subscriptions/checkout", requireAuth, async (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Unknown plan" });
      return;
    }
    const plan = PLANS[parsed.data.plan];
    if (plan.role !== req.user!.userType) {
      res.status(400).json({ error: `That plan is for ${plan.role.toLowerCase()}s` });
      return;
    }
    // Remember the chosen plan; the webhook (or mock completion) activates it.
    await db
      .update(usersTable)
      .set({ subscriptionPlan: plan.id })
      .where(eq(usersTable.id, req.user!.id));

    const link = paymentLinkFor(plan.id as PlanId, req.user!.id);
    if (isStripeConfigured() && link) {
      res.json({ mock: false, url: link });
      return;
    }
    res.json({ mock: true });
  } catch (err) {
    next(err);
  }
});

/** Simulates checkout.session.completed when Stripe isn't connected yet. */
router.post("/subscriptions/mock-complete", requireAuth, async (req, res, next) => {
  try {
    if (isStripeConfigured()) {
      res.status(400).json({ error: "Stripe is configured; use real checkout" });
      return;
    }
    const plan = req.user!.subscriptionPlan;
    if (!plan || !PLANS[plan as PlanId]) {
      res.status(400).json({ error: "Choose a plan first" });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set({
        subscriptionStatus: "active",
        hasOnboarded: true,
        stripeCustomerId: `mock_cus_${req.user!.id}`,
        stripeSubscriptionId: `mock_sub_${req.user!.id}`,
      })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    logger.info({ userId: user.id, plan }, "Mock checkout completed");
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/** Stripe Customer Portal (or mock portal when Stripe isn't connected). */
router.post("/subscriptions/portal", requireAuth, async (req, res, next) => {
  try {
    if (isStripeConfigured() && req.user!.stripeCustomerId?.startsWith("cus_")) {
      const origin = `${req.protocol}://${req.get("host")}`;
      const url = await createPortalSession(
        req.user!.stripeCustomerId!,
        `${origin}/profile`,
      );
      res.json({ mock: false, url });
      return;
    }
    res.json({ mock: true });
  } catch (err) {
    next(err);
  }
});

/** Cancel subscription (used by the mock portal; real Stripe cancels via webhook too). */
router.post("/subscriptions/cancel", requireAuth, async (req, res, next) => {
  try {
    if (
      isStripeConfigured() &&
      req.user!.stripeSubscriptionId?.startsWith("sub_")
    ) {
      await cancelStripeSubscription(req.user!.stripeSubscriptionId!);
    }
    const [user] = await db
      .update(usersTable)
      .set({ subscriptionStatus: "canceled", hasOnboarded: false })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
