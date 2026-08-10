import { Router, type IRouter, raw } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyStripeSignature, planForPriceId } from "../lib/stripe";
import { logger } from "../lib/logger";

/**
 * Stripe webhook endpoint. Mounted BEFORE express.json() so the raw body is
 * available for signature verification.
 */
const router: IRouter = Router();

router.post(
  "/webhooks/stripe",
  raw({ type: "*/*", limit: "1mb" }),
  async (req, res) => {
    try {
      const rawBody = req.body as Buffer;
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (secret) {
        const ok = verifyStripeSignature(
          rawBody,
          req.headers["stripe-signature"] as string | undefined,
          secret,
        );
        if (!ok) {
          res.status(400).json({ error: "Invalid signature" });
          return;
        }
      }
      const event = JSON.parse(rawBody.toString("utf8"));
      const type = event?.type as string;
      const obj = event?.data?.object ?? {};

      switch (type) {
        case "checkout.session.completed": {
          const userId = Number(obj.client_reference_id);
          if (!userId) break;
          await db
            .update(usersTable)
            .set({
              subscriptionStatus: "active",
              hasOnboarded: true,
              stripeCustomerId: obj.customer ?? null,
              stripeSubscriptionId: obj.subscription ?? null,
            })
            .where(eq(usersTable.id, userId));
          logger.info({ userId }, "checkout.session.completed processed");
          break;
        }
        case "customer.subscription.updated": {
          const customerId = obj.customer as string;
          if (!customerId) break;
          const priceId = obj.items?.data?.[0]?.price?.id as string | undefined;
          const plan = priceId ? planForPriceId(priceId) : null;
          const status =
            obj.status === "active" || obj.status === "trialing"
              ? "active"
              : obj.status === "past_due" || obj.status === "unpaid"
                ? "past_due"
                : obj.status === "canceled"
                  ? "canceled"
                  : undefined;
          await db
            .update(usersTable)
            .set({
              ...(plan ? { subscriptionPlan: plan, stripePriceId: priceId } : {}),
              ...(status ? { subscriptionStatus: status } : {}),
            })
            .where(eq(usersTable.stripeCustomerId, customerId));
          break;
        }
        case "customer.subscription.deleted": {
          const customerId = obj.customer as string;
          if (!customerId) break;
          await db
            .update(usersTable)
            .set({ subscriptionStatus: "canceled", hasOnboarded: false })
            .where(eq(usersTable.stripeCustomerId, customerId));
          break;
        }
        case "invoice.payment_failed": {
          const customerId = obj.customer as string;
          if (!customerId) break;
          await db
            .update(usersTable)
            .set({ subscriptionStatus: "past_due" })
            .where(eq(usersTable.stripeCustomerId, customerId));
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook processing failed");
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

export default router;
