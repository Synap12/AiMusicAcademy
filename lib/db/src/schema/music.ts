import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tracksTable = pgTable(
  "tracks",
  {
    id: serial("id").primaryKey(),
    trackName: text("track_name").notNull(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    audioFile: text("audio_file").notNull(),
    // Compressed 128kbps rendition served to non-Pro listeners; the original
    // upload in audioFile is the HQ version. Null until transcoding completes.
    audioFileLq: text("audio_file_lq"),
    coverArt: text("cover_art"),
    genre: text("genre").notNull().default("Electronic"),
    releaseDate: timestamp("release_date").notNull().defaultNow(),
    isPublished: boolean("is_published").notNull().default(false),
    playCount: integer("play_count").notNull().default(0),
    durationSeconds: doublePrecision("duration_seconds"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tracks_artist_idx").on(t.artistId),
    index("tracks_published_idx").on(t.isPublished),
  ],
);

export const playHistoryTable = pgTable(
  "play_history",
  {
    id: serial("id").primaryKey(),
    listenerId: integer("listener_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracksTable.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at").notNull().defaultNow(),
  },
  (t) => [
    index("play_history_track_idx").on(t.trackId),
    index("play_history_listener_idx").on(t.listenerId),
    index("play_history_played_at_idx").on(t.playedAt),
  ],
);

export const likedTracksTable = pgTable(
  "liked_tracks",
  {
    id: serial("id").primaryKey(),
    listenerId: integer("listener_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracksTable.id, { onDelete: "cascade" }),
    likedDate: timestamp("liked_date").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("liked_tracks_unique").on(t.listenerId, t.trackId)],
);

export const followingsTable = pgTable(
  "followings",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    artistId: integer("artist_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    followedDate: timestamp("followed_date").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("followings_unique").on(t.followerId, t.artistId)],
);

export const coverArtsTable = pgTable(
  "cover_arts",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    image: text("image").notNull(),
    prompt: text("prompt").notNull().default(""),
    style: text("style").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("cover_arts_artist_idx").on(t.artistId)],
);

// Permanent log of AI cover generations, used for monthly quota accounting.
// Rows are never deleted, so removing a cover from the gallery does not
// refund the artist's quota.
export const coverArtGenerationsTable = pgTable(
  "cover_art_generations",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("cover_art_generations_artist_idx").on(t.artistId, t.createdAt)],
);

export const insertTrackSchema = createInsertSchema(tracksTable).omit({
  id: true,
  createdAt: true,
  playCount: true,
});
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracksTable.$inferSelect;
export type PlayHistory = typeof playHistoryTable.$inferSelect;
export type LikedTrack = typeof likedTracksTable.$inferSelect;
export type Following = typeof followingsTable.$inferSelect;
export type CoverArt = typeof coverArtsTable.$inferSelect;
export type CoverArtGeneration = typeof coverArtGenerationsTable.$inferSelect;
