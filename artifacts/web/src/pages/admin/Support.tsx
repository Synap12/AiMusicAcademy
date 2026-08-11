import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError, type SupportTicket } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Spinner, EmptyState, Modal, Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { LifeBuoy, Zap, CheckCircle2, RotateCcw } from "lucide-react";

export default function AdminSupport() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [closing, setClosing] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support"],
    queryFn: () => apiGet("/admin/support"),
  });

  const update = useMutation({
    mutationFn: ({ id, status, reply }: { id: number; status: string; reply?: string }) =>
      apiSend("PATCH", `/admin/support/${id}`, { status, reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support"] });
      setClosing(null);
      setReply("");
      toast("Ticket updated");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not update", "error"),
  });

  const tickets: SupportTicket[] = data?.tickets ?? [];
  const open = tickets.filter((t) => t.status === "open");

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-2">Support</h1>
      <p className="text-txt2 mb-6">
        {open.length} open ticket{open.length === 1 ? "" : "s"} — priority requests come
        from Pro subscribers and are listed first.
      </p>

      {isLoading ? (
        <Spinner center />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={40} />}
          title="No support tickets"
          subtitle="User requests will appear here."
        />
      ) : (
        <div className="space-y-4 max-w-3xl">
          {tickets.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center gap-3 flex-wrap">
                {t.user && (
                  <Avatar
                    src={t.user.profileImage}
                    name={t.user.artistName}
                    size={34}
                    accent={t.user.userType === "ARTIST" ? "purple" : "cyan"}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t.subject}</p>
                  <p className="text-txt3 text-xs">
                    {t.user?.artistName} · {t.user?.subscriptionPlan ?? "no plan"} ·{" "}
                    {timeAgo(t.createdAt)}
                  </p>
                </div>
                {t.isPriority && (
                  <span
                    className="badge inline-flex items-center gap-1"
                    style={{ background: "rgba(0,255,136,0.12)", color: "#00FF88" }}
                  >
                    <Zap size={11} /> Priority
                  </span>
                )}
                <span
                  className="badge capitalize"
                  style={{
                    background:
                      t.status === "open" ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.06)",
                    color: t.status === "open" ? "#00D4FF" : undefined,
                  }}
                >
                  {t.status}
                </span>
              </div>
              <p className="text-txt2 text-sm mt-3 whitespace-pre-wrap break-words">{t.message}</p>
              {t.reply && (
                <div className="mt-3 rounded-lg bg-bg border border-line p-3">
                  <p className="text-cyan text-xs font-bold mb-1">Reply sent</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{t.reply}</p>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                {t.status === "open" ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setClosing(t);
                      setReply(t.reply ?? "");
                    }}
                  >
                    <CheckCircle2 size={14} /> Reply &amp; Close
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => update.mutate({ id: t.id, status: "open", reply: t.reply ?? undefined })}
                  >
                    <RotateCcw size={14} /> Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={closing !== null}
        onClose={() => setClosing(null)}
        title={`Close: ${closing?.subject ?? ""}`}
      >
        <label className="label">Reply to the user (optional)</label>
        <textarea
          className="textarea"
          value={reply}
          placeholder="What should the user see as the resolution?"
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button className="btn btn-ghost flex-1" onClick={() => setClosing(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            disabled={update.isPending}
            onClick={() =>
              closing &&
              update.mutate({ id: closing.id, status: "closed", reply: reply.trim() || undefined })
            }
          >
            Close Ticket
          </button>
        </div>
      </Modal>
    </div>
  );
}
