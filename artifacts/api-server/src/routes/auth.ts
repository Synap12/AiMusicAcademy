import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db, usersTable, passwordResetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyUserSessions,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  userType: z.enum(["ARTIST", "LISTENER"]),
  artistName: z.string().min(1).max(80),
});

router.post("/auth/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }
    const { email, password, userType, artistName } = parsed.data;
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        userType,
        artistName,
      })
      .returning();
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }
    const { email, password } = parsed.data;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({
        error: "This account has been banned. Contact support for help.",
        banned: true,
      });
      return;
    }
    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) });
});

router.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const email = z.string().email().safeParse(req.body?.email);
    if (!email.success) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.data.toLowerCase()))
      .limit(1);
    // Always respond OK so the endpoint can't be used to probe accounts.
    if (!user) {
      res.json({ ok: true });
      return;
    }
    const token = crypto.randomBytes(24).toString("hex");
    await db.insert(passwordResetsTable).values({
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });
    // No email provider is configured yet, so the reset link is logged and
    // (in non-production) returned so the flow is fully testable.
    logger.info({ email: user.email, token }, "Password reset requested");
    const payload: Record<string, unknown> = { ok: true };
    if (process.env.NODE_ENV !== "production") payload.devResetToken = token;
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

router.post("/auth/reset-password", async (req, res, next) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    const [reset] = await db
      .select()
      .from(passwordResetsTable)
      .where(eq(passwordResetsTable.token, parsed.data.token))
      .limit(1);
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "This reset link is invalid or expired" });
      return;
    }
    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(parsed.data.password) })
      .where(eq(usersTable.id, reset.userId));
    await db
      .update(passwordResetsTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetsTable.token, reset.token));
    await destroyUserSessions(reset.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
