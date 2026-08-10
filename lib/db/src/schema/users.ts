import {
  pgTable,
  text,
  serial,
  boolean,
  doublePrecision,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    artistName: text("artist_name").notNull().default(""),
    bio: text("bio").notNull().default(""),
    profileImage: text("profile_image"),
    coverImage: text("cover_image"),
    socialLinks: text("social_links").notNull().default(""),
    userType: text("user_type").notNull().default("LISTENER"), // ARTIST | LISTENER
    isAdmin: boolean("is_admin").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    subscriptionPlan: text("subscription_plan"), // listener_basic | listener_pro | artist_basic | artist_pro
    subscriptionStatus: text("subscription_status"), // active | past_due | canceled
    hasOnboarded: boolean("has_onboarded").notNull().default(false),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    streamBalance: doublePrecision("stream_balance").notNull().default(0),
    totalEarnings: doublePrecision("total_earnings").notNull().default(0),
    payoutMethod: text("payout_method").notNull().default(""),
    notifyNewFollower: boolean("notify_new_follower").notNull().default(true),
    notifyCommunity: boolean("notify_community").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("users_type_idx").on(t.userType)],
);

export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random token
    userId: serial("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetsTable = pgTable("password_resets", {
  token: text("token").primaryKey(),
  userId: serial("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
