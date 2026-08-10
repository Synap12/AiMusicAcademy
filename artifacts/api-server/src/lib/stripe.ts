import crypto from "node:crypto";
import type { PlanId } from "./plans";

/**
 * Stripe integration via the raw REST API (no SDK needed).
 * Fully optional: when STRIPE_SECRET_KEY is not set, the subscription flow
 * falls back to a built-in mock checkout so the whole platform works end-to-end
 * before any keys are provided.
 */

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

const PAYMENT_LINK_ENV: Record<PlanId, string> = {
  listener_basic: "STRIPE_PAYMENT_LINK_LISTENER_BASIC",
  listener_pro: "STRIPE_PAYMENT_LINK_LISTENER_PRO",
  artist_basic: "STRIPE_PAYMENT_LINK_ARTIST_BASIC",
  artist_pro: "STRIPE_PAYMENT_LINK_ARTIST_PRO",
};

const PRICE_ENV: Record<PlanId, string> = {
  listener_basic: "STRIPE_PRICE_LISTENER_BASIC",
  listener_pro: "STRIPE_PRICE_LISTENER_PRO",
  artist_basic: "STRIPE_PRICE_ARTIST_BASIC",
  artist_pro: "STRIPE_PRICE_ARTIST_PRO",
};

export function paymentLinkFor(plan: PlanId, userId: number): string | null {
  const link = process.env[PAYMENT_LINK_ENV[plan]];
  if (!link) return null;
  const sep = link.includes("?") ? "&" : "?";
  return `${link}${sep}client_reference_id=${userId}`;
}

export function planForPriceId(priceId: string): PlanId | null {
  for (const [plan, env] of Object.entries(PRICE_ENV)) {
    if (process.env[env] && process.env[env] === priceId) return plan as PlanId;
  }
  return null;
}

async function stripeFetch(
  path: string,
  method: "GET" | "POST" | "DELETE",
  params?: Record<string, string>,
): Promise<any> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : body,
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe error ${res.status}`);
  }
  return json;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripeFetch("/billing_portal/sessions", "POST", {
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url as string;
}

export async function cancelStripeSubscription(subId: string): Promise<void> {
  await stripeFetch(`/subscriptions/${subId}`, "DELETE");
}

/** Verify a Stripe webhook signature (t=...,v1=... scheme). */
export function verifyStripeSignature(
  rawBody: Buffer,
  sigHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!sigHeader) return false;
  const parts = new Map<string, string[]>();
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=", 2);
    if (!k || !v) continue;
    const list = parts.get(k.trim()) ?? [];
    list.push(v.trim());
    parts.set(k.trim(), list);
  }
  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(age) || age > toleranceSeconds) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}
