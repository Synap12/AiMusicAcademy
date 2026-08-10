import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const merchProductsTable = pgTable(
  "merch_products",
  {
    id: serial("id").primaryKey(),
    productName: text("product_name").notNull(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("t-shirt"), // t-shirt | hoodie | accessories
    price: doublePrecision("price").notNull(),
    productImage: text("product_image"),
    buyLink: text("buy_link").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("merch_artist_idx").on(t.artistId),
    index("merch_active_idx").on(t.isActive),
  ],
);

export const withdrawalRequestsTable = pgTable(
  "withdrawal_requests",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    amount: doublePrecision("amount").notNull(),
    status: text("status").notNull().default("pending"), // pending | paid
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (t) => [
    index("withdrawals_artist_idx").on(t.artistId),
    index("withdrawals_status_idx").on(t.status),
  ],
);

export const insertMerchProductSchema = createInsertSchema(
  merchProductsTable,
).omit({ id: true, createdAt: true });
export type InsertMerchProduct = z.infer<typeof insertMerchProductSchema>;
export type MerchProduct = typeof merchProductsTable.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;
