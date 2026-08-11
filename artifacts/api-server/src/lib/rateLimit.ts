import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Small in-memory fixed-window rate limiter for a single-instance deploy.
 * Buckets are keyed per route + client IP (+ an optional request-derived key,
 * e.g. the login email, so one address can't lock out a whole office NAT).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

function sweep(now: number) {
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Extra key material per request (e.g. submitted email). */
  keyFor?: (req: Request) => string;
  message?: string;
}

declare global {
  namespace Express {
    interface Request {
      rateLimitKey?: string;
    }
  }
}

export function rateLimit(name: string, opts: RateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (buckets.size > MAX_BUCKETS) sweep(now);
    const key = `${name}:${req.ip}:${opts.keyFor?.(req) ?? ""}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > opts.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error:
          opts.message ??
          "Too many attempts — please wait a few minutes and try again.",
      });
      return;
    }
    req.rateLimitKey = key;
    next();
  };
}

/** Forgive the bucket after a legitimate success (e.g. correct password). */
export function clearRateLimit(req: Request): void {
  if (req.rateLimitKey) buckets.delete(req.rateLimitKey);
}
