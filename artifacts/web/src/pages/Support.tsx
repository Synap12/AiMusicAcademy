import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError, type SupportTicket } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Spinner, EmptyState } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { LifeBuoy, Zap } from "lucide-react";
import clsx from "clsx";

export default function Support() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["support-mine"],
    queryFn: () => apiGet("/support/mine"),
  });

  const submit = useMutation({
    mutationFn: () => apiSend("POST", "/support", { subject, message }),
    onSuccess: () => {
      setSubject("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["support-mine"] });
      toast("Support request sent — we'll get back to you");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not send", "error"),
  });

  const tickets: SupportTicket[] = data?.tickets ?? [];
  const isPriority: boolean = data?.isPriority ?? false;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-[32px] font-bold gradient-text mb-2">Support</h1>
      <p className="text-txt2 mb-6">
        Questions, problems, or feedback — send us a message.
        {isPriority && (
          <span
            className="badge ml-2 inline-flex items-center gap-1"
            style={{ background: "rgba(0,255,136,0.12)", color: "#00FF88" }}
          >
            <Zap size={11} /> Priority support (Pro)
          </span>
        )}
      </p>

      <div className="card mb-8">
        <label className="label">Subject</label>
        <input
          className="input"
          value={subject}
          maxLength={150}
          placeholder="What do you need help with?"
          onChange={(e) => setSubject(e.target.value)}
        />
        <label className="label mt-4">Message</label>
        <textarea
          className="textarea"
          value={message}
          maxLength={5000}
          placeholder="Describe the issue or question in detail…"
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className="btn btn-primary mt-4"
          disabled={subject.trim().length < 3 || message.trim().length < 10 || submit.isPending}
          onClick={() => submit.mutate()}
        >
          <LifeBuoy size={16} />
          {submit.isPending ? "Sending…" : "Send Request"}
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-4">My Requests</h2>
      {isLoading ? (
        <Spinner center />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={40} />}
          title="No support requests yet"
          subtitle="Anything you send appears here along with our reply."
        />
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold flex-1">{t.subject}</p>
                {t.isPriority && (
                  <span
                    className="badge inline-flex items-center gap-1"
                    style={{ background: "rgba(0,255,136,0.12)", color: "#00FF88" }}
                  >
                    <Zap size={11} /> Priority
                  </span>
                )}
                <span
                  className={clsx(
                    "badge capitalize",
                    t.status === "open" ? "text-cyan" : "text-txt3",
                  )}
                  style={{
                    background:
                      t.status === "open" ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {t.status}
                </span>
              </div>
              <p className="text-txt3 text-xs mt-1">{timeAgo(t.createdAt)}</p>
              <p className="text-txt2 text-sm mt-2 whitespace-pre-wrap break-words">{t.message}</p>
              {t.reply && (
                <div className="mt-3 rounded-lg bg-bg border border-line p-3">
                  <p className="text-cyan text-xs font-bold mb-1">Support team</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{t.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
