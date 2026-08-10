import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable, merchProductsTable } from "@workspace/db";
import { and, eq, desc, count, ne } from "drizzle-orm";
import { requireOnboarded, requireArtist } from "../middlewares/auth";
import { miniUser } from "../lib/auth";
import { imageUpload, uploadUrl } from "../lib/uploads";
import { merchSlotsFor } from "../lib/plans";

const router: IRouter = Router();

/** Browse all active merch across artists. */
router.get("/merch", requireOnboarded, async (req, res, next) => {
  try {
    const category = String(req.query.category ?? "").trim();
    const conditions = [eq(merchProductsTable.isActive, true)];
    if (category && category !== "all") {
      conditions.push(eq(merchProductsTable.category, category));
    }
    const rows = await db
      .select({ product: merchProductsTable, artist: usersTable })
      .from(merchProductsTable)
      .innerJoin(usersTable, eq(merchProductsTable.artistId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(merchProductsTable.createdAt))
      .limit(200);
    res.json({
      products: rows.map((r) => ({ ...r.product, artist: miniUser(r.artist) })),
    });
  } catch (err) {
    next(err);
  }
});

/** Artist's own products with slot usage. */
router.get("/merch/mine", requireArtist, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(merchProductsTable)
      .where(eq(merchProductsTable.artistId, req.user!.id))
      .orderBy(desc(merchProductsTable.createdAt));
    const slots = merchSlotsFor(req.user!.subscriptionPlan);
    res.json({
      products: rows,
      slotLimit: slots,
      slotsUsed: rows.filter((p) => p.isActive).length,
    });
  } catch (err) {
    next(err);
  }
});

async function activeCount(artistId: number, excludeId?: number) {
  const conditions = [
    eq(merchProductsTable.artistId, artistId),
    eq(merchProductsTable.isActive, true),
  ];
  if (excludeId) conditions.push(ne(merchProductsTable.id, excludeId));
  const [row] = await db
    .select({ n: count() })
    .from(merchProductsTable)
    .where(and(...conditions));
  return row?.n ?? 0;
}

// Multipart form fields arrive as strings, where "false" must mean false.
const boolish = z.preprocess(
  (v) => v === true || v === "true" || v === "1" || v === 1,
  z.boolean(),
);

const productSchema = z.object({
  productName: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  category: z.enum(["t-shirt", "hoodie", "accessories"]),
  price: z.coerce.number().positive().max(100000),
  buyLink: z.string().url().max(1000),
  isActive: boolish.optional().default(false),
});

router.post(
  "/merch",
  requireArtist,
  imageUpload.single("image"),
  async (req, res, next) => {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
        return;
      }
      if (parsed.data.isActive) {
        const slots = merchSlotsFor(req.user!.subscriptionPlan);
        const used = await activeCount(req.user!.id);
        if (used >= slots) {
          res.status(400).json({
            error: `Your plan allows ${slots} active merch slot${slots === 1 ? "" : "s"}. Deactivate a product or upgrade to Artist Pro.`,
          });
          return;
        }
      }
      const [product] = await db
        .insert(merchProductsTable)
        .values({
          ...parsed.data,
          artistId: req.user!.id,
          productImage: req.file ? uploadUrl("images", req.file.filename) : null,
        })
        .returning();
      res.status(201).json({ product });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/merch/:id",
  requireArtist,
  imageUpload.single("image"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = productSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
        return;
      }
      const [existing] = await db
        .select()
        .from(merchProductsTable)
        .where(
          and(
            eq(merchProductsTable.id, id),
            eq(merchProductsTable.artistId, req.user!.id),
          ),
        )
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      if (parsed.data.isActive === true && !existing.isActive) {
        const slots = merchSlotsFor(req.user!.subscriptionPlan);
        const used = await activeCount(req.user!.id, id);
        if (used >= slots) {
          res.status(400).json({
            error: `Your plan allows ${slots} active merch slot${slots === 1 ? "" : "s"}. Deactivate a product or upgrade to Artist Pro.`,
          });
          return;
        }
      }
      const [product] = await db
        .update(merchProductsTable)
        .set({
          ...parsed.data,
          ...(req.file
            ? { productImage: uploadUrl("images", req.file.filename) }
            : {}),
        })
        .where(eq(merchProductsTable.id, id))
        .returning();
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);

router.delete("/merch/:id", requireArtist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db
      .delete(merchProductsTable)
      .where(
        and(
          eq(merchProductsTable.id, id),
          eq(merchProductsTable.artistId, req.user!.id),
        ),
      )
      .returning({ id: merchProductsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
