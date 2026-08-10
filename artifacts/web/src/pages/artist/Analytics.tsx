import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Cover, Spinner, StatCard } from "@/components/ui";
import { money, formatDuration } from "@/lib/format";
import clsx from "clsx";

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "all", label: "All time" },
];

function BarChart({ data }: { data: { day: string; plays: number }[] }) {
  if (data.length === 0)
    return <p className="text-txt3 text-sm py-8 text-center">No play data in this range.</p>;
  const max = Math.max(...data.map((d) => d.plays), 1);
  return (
    <div className="flex items-end gap-1 h-40 overflow-x-auto pt-2">
      {data.map((d) => (
        <div key={d.day} className="flex flex-col items-center gap-1 min-w-[26px] flex-1 group">
          <span className="text-[10px] text-txt2 opacity-0 group-hover:opacity-100">{d.plays}</span>
          <div
            className="w-full max-w-[34px] rounded-t gradient-bg"
            style={{ height: `${Math.max((d.plays / max) * 100, 4)}%` }}
            title={`${d.day}: ${d.plays} plays`}
          />
          <span className="text-[9px] text-txt3 rotate-0">{d.day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ArtistAnalytics() {
  const [range, setRange] = useState("30");
  const { data, isLoading } = useQuery({
    queryKey: ["artist-analytics", range],
    queryFn: () => apiGet(`/artist/analytics?range=${range}`),
  });

  const stats = data?.stats ?? { plays: 0, listeners: 0, revenue: 0, avgListenSeconds: 0 };
  const audience = data?.audience ?? { newListeners: 0, returningListeners: 0 };
  const breakdown = data?.revenueBreakdown ?? { streaming: 0, merch: 0, tips: 0 };
  const totalAudience = audience.newListeners + audience.returningListeners;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-[32px] font-bold gradient-text">Analytics</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={clsx(
                "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
                range === r.id
                  ? "gradient-bg text-white border-transparent"
                  : "border-line text-txt2 hover:text-txt",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner center />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Plays" value={stats.plays.toLocaleString()} accent="#00D4FF" />
            <StatCard label="Unique Listeners" value={stats.listeners.toLocaleString()} accent="#B537FF" />
            <StatCard label="Stream Revenue" value={money(stats.revenue)} accent="#00FF88" />
            <StatCard label="Avg Listen Time" value={formatDuration(stats.avgListenSeconds)} />
          </div>

          <div className="card mb-6">
            <h2 className="font-bold text-lg mb-2">Daily Plays</h2>
            <BarChart data={data?.dailyPlays ?? []} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card lg:col-span-1">
              <h2 className="font-bold text-lg mb-4">Top Tracks</h2>
              {(data?.topTracks ?? []).length === 0 ? (
                <p className="text-txt3 text-sm py-4 text-center">No plays yet.</p>
              ) : (
                <div className="space-y-3">
                  {(data?.topTracks ?? []).map(
                    (
                      t: { trackId: number; trackName: string; coverArt: string | null; genre: string; plays: number },
                      i: number,
                    ) => (
                      <div key={t.trackId} className="flex items-center gap-3">
                        <span className="text-txt3 font-bold w-4">{i + 1}</span>
                        <Cover src={t.coverArt} name={t.trackName} size={38} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{t.trackName}</p>
                          <p className="text-txt3 text-xs">{t.genre}</p>
                        </div>
                        <span className="text-cyan text-sm font-semibold">{t.plays}</span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="font-bold text-lg mb-4">Revenue Breakdown</h2>
              {(
                [
                  { label: "Streaming", value: breakdown.streaming, color: "#00D4FF" },
                  { label: "Merch (external, 100% yours)", value: breakdown.merch, color: "#B537FF" },
                  { label: "Tips", value: breakdown.tips, color: "#00FF88" },
                ] as const
              ).map((r) => (
                <div key={r.label} className="mb-4">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-txt2">{r.label}</span>
                    <span className="font-semibold">{money(r.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${stats.revenue > 0 ? (r.value / stats.revenue) * 100 : 0}%`,
                        background: r.color,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-txt3 text-xs mt-2">
                Merch sales happen on your external store, so that revenue goes straight to you.
              </p>
            </div>

            <div className="card">
              <h2 className="font-bold text-lg mb-4">Audience</h2>
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-3xl font-bold text-cyan">{audience.newListeners}</p>
                  <p className="text-txt2 text-sm">New listeners</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple">{audience.returningListeners}</p>
                  <p className="text-txt2 text-sm">Returning</p>
                </div>
              </div>
              {totalAudience > 0 && (
                <div className="h-3 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(audience.newListeners / totalAudience) * 100}%`, background: "#00D4FF" }}
                  />
                  <div
                    style={{ width: `${(audience.returningListeners / totalAudience) * 100}%`, background: "#B537FF" }}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
