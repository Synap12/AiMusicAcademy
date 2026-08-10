import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner, StatCard } from "@/components/ui";
import { money, planLabel } from "@/lib/format";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => apiGet("/admin/metrics"),
  });

  if (isLoading) return <Spinner center />;
  const users = data?.users ?? { total: 0, activeListeners: 0, activeArtists: 0, freeUsers: 0 };
  const revenue = data?.revenue ?? { mrr: 0, perTier: {} };
  const content = data?.content ?? { tracks: 0, merchProducts: 0, posts: 0 };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <h1 className="text-[32px] font-bold gradient-text">Admin Dashboard</h1>
        <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
          {user?.email}
        </span>
      </div>

      <h2 className="text-lg font-bold mb-3">Users</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={users.total} />
        <StatCard label="Active Listeners" value={users.activeListeners} accent="#00D4FF" />
        <StatCard label="Active Artists" value={users.activeArtists} accent="#B537FF" />
        <StatCard label="Free Users" value={users.freeUsers} accent="#FFA500" />
      </div>

      <h2 className="text-lg font-bold mb-3">Revenue</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card lg:col-span-1 flex flex-col justify-center">
          <p className="text-txt2 text-sm font-semibold">Monthly Recurring Revenue</p>
          <p className="text-[42px] font-extrabold gradient-text leading-tight">
            {money(revenue.mrr)}
          </p>
          <p className="text-txt3 text-xs">across all active subscriptions</p>
        </div>
        <div className="card lg:col-span-2">
          <p className="text-txt2 text-sm font-semibold mb-4">Per-tier breakdown</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(
              revenue.perTier as Record<string, { subscribers: number; mrr: number }>,
            ).map(([plan, t]) => (
              <div key={plan} className="flex items-center justify-between border border-line rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-sm">{planLabel(plan)}</p>
                  <p className="text-txt3 text-xs">{t.subscribers} subscriber{t.subscribers === 1 ? "" : "s"}</p>
                </div>
                <span className="font-bold text-green">{money(t.mrr)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">Content</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Tracks" value={content.tracks} accent="#00D4FF" />
        <StatCard label="Merch Products" value={content.merchProducts} accent="#B537FF" />
        <StatCard label="Community Posts" value={content.posts} accent="#00FF88" />
      </div>
    </div>
  );
}
