import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiForm, apiSend, ApiError, type MerchProduct } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { EmptyState, Modal, Spinner, StatusBadge } from "@/components/ui";
import { money } from "@/lib/format";
import { Plus, Pencil, Trash2, ShoppingBag, Eye, EyeOff } from "lucide-react";

interface ProductForm {
  productName: string;
  description: string;
  category: string;
  price: string;
  buyLink: string;
  isActive: boolean;
  image: File | null;
}

const EMPTY: ProductForm = {
  productName: "",
  description: "",
  category: "t-shirt",
  price: "",
  buyLink: "",
  isActive: false,
  image: null,
};

export default function ArtistMerch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MerchProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<MerchProduct | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["merch-mine"],
    queryFn: () => apiGet("/merch/mine"),
  });
  const products: MerchProduct[] = data?.products ?? [];
  const slotLimit: number = data?.slotLimit ?? 0;
  const slotsUsed: number = data?.slotsUsed ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["merch-mine"] });
    qc.invalidateQueries({ queryKey: ["merch"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.set("productName", form.productName);
      fd.set("description", form.description);
      fd.set("category", form.category);
      fd.set("price", form.price);
      fd.set("buyLink", form.buyLink);
      fd.set("isActive", String(form.isActive));
      if (form.image) fd.set("image", form.image);
      return editing
        ? apiForm("PATCH", `/merch/${editing.id}`, fd)
        : apiForm("POST", "/merch", fd);
    },
    onSuccess: () => {
      setModalOpen(false);
      invalidate();
      toast(editing ? "Product updated" : "Product added");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Save failed", "error"),
  });

  const toggle = useMutation({
    mutationFn: (p: MerchProduct) =>
      apiSend("PATCH", `/merch/${p.id}`, { isActive: !p.isActive }),
    onSuccess: invalidate,
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not toggle", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend("DELETE", `/merch/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      toast("Product deleted");
    },
  });

  const openAdd = () => {
    if (slotsUsed >= slotLimit && products.length >= slotLimit) {
      // Adding as inactive is always allowed; only warn when they're at the
      // visible-slot limit so they know the new product will start hidden.
      toast(
        `Heads up: your plan shows ${slotLimit} active product${slotLimit === 1 ? "" : "s"} — new products start hidden.`,
      );
    }
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (p: MerchProduct) => {
    setEditing(p);
    setForm({
      productName: p.productName,
      description: p.description,
      category: p.category,
      price: String(p.price),
      buyLink: p.buyLink,
      isActive: p.isActive,
      image: null,
    });
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[32px] font-bold gradient-text">Merch Store</h1>
          <p className="text-txt2">
            Active slots:{" "}
            <b className={slotsUsed >= slotLimit ? "text-orange" : "text-green"}>
              {slotsUsed}/{slotLimit}
            </b>{" "}
            {slotLimit === 1 && "— upgrade to Artist Pro for 3 slots"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {isLoading ? (
        <Spinner center />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={40} />}
          title="No products yet"
          subtitle="Add merch and link it to your Printful, Shopify, or Etsy store. You keep 100% of every sale."
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Your First Product
            </button>
          }
        />
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}
        >
          {products.map((p) => (
            <div key={p.id} className="card !p-4 flex flex-col">
              {p.productImage ? (
                <img src={p.productImage} alt={p.productName} className="w-full aspect-square object-cover rounded-lg mb-3" />
              ) : (
                <div className="w-full aspect-square rounded-lg mb-3 bg-bg border border-line flex items-center justify-center text-txt3">
                  <ShoppingBag size={36} />
                </div>
              )}
              <div className="flex items-center justify-between mb-1">
                <StatusBadge status={p.isActive ? "ACTIVE" : "DRAFT"} />
                <span className="text-txt3 text-xs">{p.category}</span>
              </div>
              <p className="font-semibold">{p.productName}</p>
              <p className="font-bold text-lg mt-1">{money(p.price)}</p>
              <div className="flex gap-2 mt-4 pt-3 border-t border-line">
                <button className="btn btn-ghost btn-sm flex-1" onClick={() => openEdit(p)}>
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm flex-1"
                  onClick={() => toggle.mutate(p)}
                  title={p.isActive ? "Hide from store" : "Show in store"}
                >
                  {p.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  {p.isActive ? "Hide" : "Show"}
                </button>
                <button
                  className="btn btn-ghost btn-sm !text-red"
                  onClick={() => setDeleteTarget(p)}
                  aria-label="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit product" : "Add product"}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Product name</label>
            <input
              className="input"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              placeholder="e.g. Neon Logo Tee"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="textarea !min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                className="select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="t-shirt">T-Shirt</option>
                <option value="hoodie">Hoodie</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>
            <div>
              <label className="label">Price (USD)</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Buy link (Printful / Shopify / Etsy)</label>
            <input
              className="input"
              type="url"
              value={form.buyLink}
              onChange={(e) => setForm({ ...form, buyLink: e.target.value })}
              placeholder="https://your-store.com/product"
            />
          </div>
          <div>
            <label className="label">Product image</label>
            <input
              type="file"
              accept="image/*"
              className="text-sm text-txt2"
              onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-5 h-5 accent-[#00D4FF]"
            />
            <span className="text-txt2 text-sm">Visible in store (uses an active slot)</span>
          </label>
          <button
            className="btn btn-primary w-full"
            disabled={
              !form.productName.trim() || !form.price || !form.buyLink.trim() || save.isPending
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete product?"
      >
        <p className="text-txt2 text-sm mb-5">
          <b>{deleteTarget?.productName}</b> will be permanently removed from your store.
        </p>
        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button
            className="btn btn-danger flex-1"
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
