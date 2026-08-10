import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Cover, Modal, Spinner, StatCard, StatusBadge } from "@/components/ui";
import { money, timeAgo, formatDate } from "@/lib/format";
import { Wallet } from "lucide-react";

interface Withdrawal {
  id: number;
  amount: number;
  status: string;
  requestedAt: string;
  paidAt: string | null;
}

export default function ArtistDashboard() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["artist-dashboard"],
    queryFn: () => apiGet("/artist/dashboard"),
  });

  const withdraw = useMutation({
    mutationFn: () => apiSend("POST", "/artist/withdrawals", { amount: Number(amount) }),
    onSuccess: () => {
      setWithdrawOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["artist-dashboard"] });
      refresh();
      toast("Withdrawal requested — the team will process it shortly");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Request failed", "error"),
  });

  if (isLoading) return <Spinner center />;
  const stats = data?.stats ?? {
    totalTracks: 0,
    totalPlays: 0,
    streamBalance: 0,
    totalEarnings: 0,
  };
  const activity: {
    trackName: string;
    coverArt: string | null;
    listenerName: string;
    playedAt: string;
  }[] = data?.recentActivity ?? [];
  const withdrawals: Withdrawal[] = data?.withdrawals ?? [];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[32px] font-bold gradient-text">Artist Dashboard</h1>
          <p className="text-txt2">Welcome back, {user?.artistName}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setAmount(stats.streamBalance.toFixed(2));
            setWithdrawOpen(true);
          }}
          disabled={stats.streamBalance <= 0}
        >
          <Wallet size={16} /> Request Withdrawal
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tracks" value={stats.totalTracks} />
        <StatCard label="Total Plays" value={stats.totalPlays.toLocaleString()} accent="#00D4FF" />
        <StatCard label="Stream Earnings" value={money(stats.streamBalance)} accent="#00FF88" sub="Available to withdraw" />
        <StatCard label="All Time Revenue" value={money(stats.totalEarnings)} accent="#B537FF" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="text-txt3 text-sm py-6 text-center">
              No plays yet — publish tracks to start earning.
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Cover src={a.coverArt} name={a.trackName} size={38} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      <b>{a.listenerName}</b> played <b>{a.trackName}</b>
                    </p>
                    <p className="text-txt3 text-xs">{timeAgo(a.playedAt)}</p>
                  </div>
                  <span className="text-green text-xs font-semibold">+ earnings</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Withdrawal History</h2>
          {withdrawals.length === 0 ? (
            <p className="text-txt3 text-sm py-6 text-center">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0">
                  <div>
                    <p className="font-semibold">{money(w.amount)}</p>
                    <p className="text-txt3 text-xs">
                      Requested {formatDate(w.requestedAt)}
                      {w.paidAt && ` · Paid ${formatDate(w.paidAt)}`}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Request withdrawal">
        <p className="text-txt2 text-sm mb-4">
          Available balance: <b className="text-green">{money(stats.streamBalance)}</b>
        </p>
        <label className="label">Amount (USD)</label>
        <input
          className="input"
          type="number"
          min="0.01"
          step="0.01"
          max={stats.streamBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex gap-3 mt-5">
          <button className="btn btn-ghost flex-1" onClick={() => setWithdrawOpen(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            disabled={!amount || Number(amount) <= 0 || withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            Request
          </button>
        </div>
      </Modal>
    </div>
  );
}
