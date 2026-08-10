import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Avatar, EmptyState, Spinner, StatusBadge } from "@/components/ui";
import { money, formatDate } from "@/lib/format";
import { DollarSign } from "lucide-react";

interface PayoutArtist {
  id: number;
  artistName: string;
  profileImage: string | null;
  email: string;
  streamBalance: number;
  totalEarnings: number;
  payoutMethod: string;
}

interface PayoutRequest {
  id: number;
  amount: number;
  status: string;
  requestedAt: string;
  paidAt: string | null;
  artist: { id: number; artistName: string; email: string };
}

export default function AdminPayouts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => apiGet("/admin/payouts"),
  });

  const markPaid = useMutation({
    mutationFn: (artistId: number) =>
      apiSend("POST", `/admin/payouts/${artistId}/mark-paid`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      toast("Marked as paid — balance reset");
    },
  });

  if (isLoading) return <Spinner center />;
  const artists: PayoutArtist[] = data?.artists ?? [];
  const pending: PayoutRequest[] = data?.pendingRequests ?? [];
  const history: PayoutRequest[] = data?.history ?? [];

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-6">Payouts</h1>

      <div className="card mb-8 flex items-center gap-5">
        <div className="gradient-bg rounded-xl w-12 h-12 flex items-center justify-center text-white">
          <DollarSign size={22} />
        </div>
        <div>
          <p className="text-txt2 text-sm font-semibold">Total payable (all artist balances)</p>
          <p className="text-3xl font-extrabold text-green">{money(data?.totalPayable ?? 0)}</p>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">Pending Withdrawal Requests</h2>
      {pending.length === 0 ? (
        <p className="text-txt3 text-sm mb-8">No pending requests.</p>
      ) : (
        <div className="card !p-0 divide-y divide-line mb-8">
          {pending.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 flex-wrap">
              <div className="flex-1 min-w-40">
                <p className="font-semibold">{r.artist.artistName}</p>
                <p className="text-txt3 text-xs">
                  {r.artist.email} · requested {formatDate(r.requestedAt)}
                </p>
              </div>
              <span className="font-bold text-lg">{money(r.amount)}</span>
              <StatusBadge status={r.status} />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => markPaid.mutate(r.artist.id)}
                disabled={markPaid.isPending}
              >
                Mark as Paid
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">Artists with Outstanding Balances</h2>
      {artists.length === 0 ? (
        <EmptyState
          icon={<DollarSign size={36} />}
          title="No outstanding balances"
          subtitle="Artist stream earnings will appear here as listeners play their tracks."
        />
      ) : (
        <div className="card !p-0 divide-y divide-line mb-8">
          {artists.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 flex-wrap">
              <Avatar src={a.profileImage} name={a.artistName} size={38} accent="purple" />
              <div className="flex-1 min-w-40">
                <p className="font-semibold">{a.artistName}</p>
                <p className="text-txt3 text-xs">
                  {a.email}
                  {a.payoutMethod && ` · ${a.payoutMethod}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green">{money(a.streamBalance)}</p>
                <p className="text-txt3 text-xs">lifetime {money(a.totalEarnings)}</p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => markPaid.mutate(a.id)}
                disabled={markPaid.isPending}
              >
                Mark as Paid
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">Payment History</h2>
      {history.length === 0 ? (
        <p className="text-txt3 text-sm">No completed payouts yet.</p>
      ) : (
        <div className="card !p-0 divide-y divide-line">
          {history.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1">
                <p className="font-semibold text-sm">{r.artist.artistName}</p>
                <p className="text-txt3 text-xs">
                  paid {r.paidAt ? formatDate(r.paidAt) : "—"}
                </p>
              </div>
              <span className="font-semibold">{money(r.amount)}</span>
              <StatusBadge status="PAID" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
