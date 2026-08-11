import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tracksTable } from "./music";

export const postsTable = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    image: text("image"),
    trackId: integer("track_id").references(() => tracksTable.id, {
      onDelete: "set null",
    }),
    // Exclusive posts are visible in full only to Pro listeners, artists, and
    // admins; Basic listeners get a locked teaser.
    isExclusive: boolean("is_exclusive").notNull().default(false),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("posts_author_idx").on(t.authorId),
    index("posts_created_idx").on(t.createdAt),
  ],
);

export const commentsTable = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    commenterId: integer("commenter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);

export const postLikesTable = pgTable(
  "post_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("post_likes_unique").on(t.postId, t.userId)],
);

export const reportsTable = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    isReviewed: boolean("is_reviewed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reports_reviewed_idx").on(t.isReviewed)],
);

export const bannedWordsTable = pgTable("banned_words", {
  id: serial("id").primaryKey(),
  word: text("word").notNull().unique(),
});

export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    // Pro-plan subscribers get priority handling in the admin queue.
    isPriority: boolean("is_priority").notNull().default(false),
    status: text("status").notNull().default("open"), // open | closed
    reply: text("reply"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [index("support_tickets_status_idx").on(t.status, t.isPriority)],
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likeCount: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
export type Comment = typeof commentsTable.$inferSelect;
export type PostLike = typeof postLikesTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type BannedWord = typeof bannedWordsTable.$inferSelect;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
