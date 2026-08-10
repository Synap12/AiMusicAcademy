import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Avatar, EmptyState, Spinner } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/format";
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface ReportItem {
  id: number;
  reason: string;
  createdAt: string;
  post: {
    id: number;
    content: string;
    image: string | null;
    createdAt: string;
    author: { id: number; artistName: string; profileImage: string | null; userType: string };
  };
  reporter: { id: number; artistName: string } | null;
}

export default function AdminModeration() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => apiGet("/admin/reports"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-reports"] });
  const dismiss = useMutation({
    mutationFn: (id: number) => apiSend("POST", `/admin/reports/${id}/dismiss`),
    onSuccess: () => {
      invalidate();
      toast("Report dismissed — post kept");
    },
  });
  const deletePost = useMutation({
    mutationFn: (postId: number) => apiSend("DELETE", `/admin/posts/${postId}`),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast("Post deleted and reports resolved");
    },
  });

  const reports: ReportItem[] = data?.reports ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-[32px] font-bold gradient-text mb-2">Moderation Queue</h1>
      <p className="text-txt2 mb-7">
        {reports.length} pending report{reports.length === 1 ? "" : "s"}
      </p>

      {isLoading ? (
        <Spinner center />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={40} />}
          title="All clear!"
          subtitle="No pending reports. The community is behaving."
        />
      ) : (
        <div className="space-y-5">
          {reports.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  src={r.post.author.profileImage}
                  name={r.post.author.artistName}
                  accent={r.post.author.userType === "ARTIST" ? "purple" : "cyan"}
                />
                <div className="flex-1">
                  <p className="font-semibold">{r.post.author.artistName}</p>
                  <p className="text-txt3 text-xs">Posted {formatDate(r.post.createdAt)}</p>
                </div>
                <span className="badge" style={{ background: "rgba(255,68,68,0.12)", color: "#FF4444" }}>
                  <AlertTriangle size={11} /> Reported
                </span>
              </div>

              <div className="bg-bg border border-line rounded-xl p-4 mb-3">
                <p className="whitespace-pre-wrap break-words text-sm">{r.post.content}</p>
                {r.post.image && (
                  <img src={r.post.image} alt="" className="mt-3 rounded-lg max-h-64 object-cover" />
                )}
              </div>

              <p className="text-txt2 text-sm">
                Reported by <b>{r.reporter?.artistName ?? "Unknown"}</b> {timeAgo(r.createdAt)}
              </p>
              <p className="text-txt2 text-sm mb-4">
                Reason: <span className="text-orange">{r.reason}</span>
              </p>

              <div className="flex gap-3">
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() => dismiss.mutate(r.id)}
                  disabled={dismiss.isPending}
                >
                  Dismiss (keep post)
                </button>
                <button
                  className="btn btn-danger flex-1"
                  onClick={() => deletePost.mutate(r.post.id)}
                  disabled={deletePost.isPending}
                >
                  Delete Post
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
