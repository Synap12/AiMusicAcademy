import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiGet, type MerchProduct } from "@/lib/api";
import { EmptyState, Spinner } from "@/components/ui";
import { money } from "@/lib/format";
import { ShoppingBag, ExternalLink } from "lucide-react";
import clsx from "clsx";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "t-shirt", label: "T-Shirts" },
  { id: "hoodie", label: "Hoodies" },
  { id: "accessories", label: "Accessories" },
];

export default function MerchBrowse() {
  const [category, setCategory] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["merch", category],
    queryFn: () => apiGet(`/merch?category=${category}`),
  });
  const products: MerchProduct[] = data?.products ?? [];

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-6">Browse Merch</h1>
      <div className="flex gap-2 flex-wrap mb-7">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
              category === c.id
                ? "gradient-bg text-white border-transparent"
                : "border-line text-txt2 hover:text-txt hover:border-txt3",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner center />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={40} />}
          title="No merch available"
          subtitle="Artists haven't listed products in this category yet."
        />
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {products.map((p) => (
            <div key={p.id} className="card !p-4 flex flex-col">
              {p.productImage ? (
                <img
                  src={p.productImage}
                  alt={p.productName}
                  className="w-full aspect-square object-cover rounded-lg mb-3 bg-bg"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg mb-3 bg-bg border border-line flex items-center justify-center text-txt3">
                  <ShoppingBag size={36} />
                </div>
              )}
              <span className="badge self-start mb-2" style={{ background: "rgba(181,55,255,0.12)", color: "#B537FF" }}>
                {p.category}
              </span>
              <p className="font-semibold">{p.productName}</p>
              {p.artist && (
                <Link href={`/artists/${p.artist.id}`} className="text-txt2 text-sm hover:text-cyan">
                  {p.artist.artistName}
                </Link>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                <span className="font-bold text-lg">{money(p.price)}</span>
                <a
                  href={p.buyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Buy Now <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-txt3 text-xs mt-8 text-center">
        Purchases are completed on the artist's external store — artists keep 100% of merch revenue.
      </p>
    </div>
  );
}
