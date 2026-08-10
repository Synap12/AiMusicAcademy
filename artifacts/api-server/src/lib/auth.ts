import crypto from "node:crypto";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const SCRYPT_N = 16384;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, 64, { N: SCRYPT_N })
    .toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto
    .scryptSync(password, salt, 64, { N: SCRYPT_N })
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived));
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    id: token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function getSessionUser(token: string): Promise<User | null> {
  const rows = await db
    .select({ user: usersTable, session: sessionsTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.id, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, token));
    return null;
  }
  return row.user;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, token));
}

export async function destroyUserSessions(userId: number): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}

export const SESSION_COOKIE = "sid";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS,
  path: "/",
};

/** Strip private fields before sending a user object to the client. */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    artistName: u.artistName,
    bio: u.bio,
    profileImage: u.profileImage,
    coverImage: u.coverImage,
    socialLinks: u.socialLinks,
    userType: u.userType,
    isAdmin: u.isAdmin,
    isBanned: u.isBanned,
    subscriptionPlan: u.subscriptionPlan,
    subscriptionStatus: u.subscriptionStatus,
    hasOnboarded: u.hasOnboarded,
    streamBalance: u.streamBalance,
    totalEarnings: u.totalEarnings,
    payoutMethod: u.payoutMethod,
    notifyNewFollower: u.notifyNewFollower,
    notifyCommunity: u.notifyCommunity,
    createdAt: u.createdAt,
  };
}

/** Minimal shape safe to embed on tracks, posts, etc. (mirrors "public fields only" privacy rule). */
export function miniUser(u: {
  id: number;
  artistName: string;
  profileImage: string | null;
  userType: string;
  bio?: string;
  coverImage?: string | null;
}) {
  return {
    id: u.id,
    artistName: u.artistName,
    profileImage: u.profileImage,
    userType: u.userType,
  };
}
