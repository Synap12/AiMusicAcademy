import type { Request, Response, NextFunction } from "express";
import type { User } from "@workspace/db";
import { getSessionUser, SESSION_COOKIE } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Attach req.user when a valid session cookie is present (never rejects). */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      const user = await getSessionUser(token);
      if (user) req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  if (req.user.isBanned) {
    res.status(403).json({ error: "Your account has been banned", banned: true });
    return;
  }
  next();
}

/** Requires an onboarded (active subscription) account. */
export function requireOnboarded(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  if (req.user.isBanned) {
    res.status(403).json({ error: "Your account has been banned", banned: true });
    return;
  }
  if (!req.user.isAdmin) {
    if (!req.user.hasOnboarded) {
      res.status(403).json({ error: "Subscription required", needsSubscription: true });
      return;
    }
    // A subscription that is no longer paid revokes access, no matter which
    // Stripe webhook delivered the status change (updated vs. deleted).
    const status = req.user.subscriptionStatus;
    if (status === "past_due" || status === "canceled") {
      res.status(403).json({
        error: "Your subscription is no longer active",
        needsSubscription: true,
      });
      return;
    }
  }
  next();
}

export function requireArtist(req: Request, res: Response, next: NextFunction) {
  requireOnboarded(req, res, () => {
    if (req.user!.userType !== "ARTIST" && !req.user!.isAdmin) {
      res.status(403).json({ error: "Artist account required" });
      return;
    }
    next();
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  if (!req.user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
