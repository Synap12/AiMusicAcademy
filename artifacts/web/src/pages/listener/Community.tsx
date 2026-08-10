import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiGet, apiSend, apiForm, ApiError, type Post, type Track } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { usePlayer } from "@/lib/player";
import { Avatar, Cover, EmptyState, Modal, Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import {
  Heart,
  MessageCircle,
  Flag,
  Trash2,
  Pencil,
  ImagePlus,
  Music,
  Play,
  Send,
  MessageSquare,
} from "lucide-react";

function Composer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [attachTrack, setAttachTrack] = useState<Track | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: trackData } = useQuery({
    queryKey: ["tracks", "picker"],
    queryFn: () => apiGet("/tracks"),
    enabled: pickerOpen,
  });

  const post = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("content", content);
      if (image) form.set("image", image);
      if (attachTrack) form.set("trackId", String(attachTrack.id));
      return apiForm("POST", "/posts", form);
    },
    onSuccess: () => {
      setContent("");
      setImage(null);
      setAttachTrack(null);
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast("Posted to the community");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not post", "error"),
  });

  return (
    <div className="card mb-6">
      <div className="flex gap-3">
        <Avatar
          src={user?.profileImage}
          name={user?.artistName ?? "?"}
          accent={user?.userType === "ARTIST" ? "purple" : "cyan"}
        />
        <textarea
          className="textarea flex-1"
          placeholder="Share something with the community…"
          value={content}
          maxLength={5000}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      {(image || attachTrack) && (
        <div className="flex gap-3 mt-3 ml-[52px] flex-wrap">
          {image && (
            <span className="badge" style={{ background: "rgba(0,212,255,0.12)", color: "#00D4FF" }}>
              📷 {image.name}
              <button onClick={() => setImage(null)} className="ml-1">×</button>
            </span>
          )}
          {attachTrack && (
            <span className="badge" style={{ background: "rgba(181,55,255,0.12)", color: "#B537FF" }}>
              ♪ {attachTrack.trackName}
              <button onClick={() => setAttachTrack(null)} className="ml-1">×</button>
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 ml-[52px]">
        <div className="flex gap-2">
          <label className="btn btn-ghost btn-sm cursor-pointer">
            <ImagePlus size={15} /> Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => setPickerOpen(true)}>
            <Music size={15} /> Track
          </button>
        </div>
        <button
          className="btn btn-primary btn-sm"
          disabled={!content.trim() || post.isPending}
          onClick={() => post.mutate()}
        >
          {post.isPending ? "Posting…" : "Post"}
        </button>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Attach a track">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(trackData?.tracks ?? []).map((t: Track) => (
            <button
              key={t.id}
              className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-white/5"
              onClick={() => {
                setAttachTrack(t);
                setPickerOpen(false);
              }}
            >
              <Cover src={t.coverArt} name={t.trackName} size={40} />
              <div>
                <p className="font-semibold text-sm">{t.trackName}</p>
                <p className="text-txt3 text-xs">{t.artist.artistName}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Comments({ post }: { post: Post }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => apiGet(`/posts/${post.id}/comments`),
  });

  const add = useMutation({
    mutationFn: () => apiSend("POST", `/posts/${post.id}/comments`, { content: text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", post.id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not comment", "error"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiSend("DELETE", `/comments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", post.id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <div className="mt-4 pt-4 border-t border-line space-y-3">
      {isLoading && <Spinner />}
      {(data?.comments ?? []).map(
        (c: {
          id: number;
          content: string;
          createdAt: string;
          isMine: boolean;
          commenter: { id: number; artistName: string; profileImage: string | null; userType: string };
        }) => (
          <div key={c.id} className="flex gap-2.5 group">
            <Avatar
              src={c.commenter.profileImage}
              name={c.commenter.artistName}
              size={30}
              accent={c.commenter.userType === "ARTIST" ? "purple" : "cyan"}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{c.commenter.artistName}</span>{" "}
                <span className="text-txt3 text-xs">{timeAgo(c.createdAt)}</span>
              </p>
              <p className="text-txt2 text-sm break-words">{c.content}</p>
            </div>
            {c.isMine && (
              <button
                onClick={() => remove.mutate(c.id)}
                className="text-txt3 hover:text-red opacity-0 group-hover:opacity-100"
                aria-label="Delete comment"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      )}
      <div className="flex gap-2">
        <input
          className="input !h-10 text-sm"
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && add.mutate()}
        />
        <button
          className="btn btn-secondary btn-sm"
          disabled={!text.trim() || add.isPending}
          onClick={() => add.mutate()}
          aria-label="Send comment"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { playTrack } = usePlayer();
  const [showComments, setShowComments] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.content);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["posts"] });
  const like = useMutation({
    mutationFn: () =>
      apiSend(post.likedByMe ? "DELETE" : "POST", `/posts/${post.id}/like`),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => apiSend("DELETE", `/posts/${post.id}`),
    onSuccess: () => {
      invalidate();
      toast("Post deleted");
    },
  });
  const edit = useMutation({
    mutationFn: () => apiSend("PATCH", `/posts/${post.id}`, { content: editText }),
    onSuccess: () => {
      setEditOpen(false);
      invalidate();
      toast("Post updated");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not update", "error"),
  });
  const report = useMutation({
    mutationFn: () => apiSend("POST", `/posts/${post.id}/report`, { reason: reportReason }),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason("");
      toast("Report submitted — moderators will review it");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not report", "error"),
  });

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <Link href={`/artists/${post.author.id}`}>
          <Avatar
            src={post.author.profileImage}
            name={post.author.artistName}
            accent={post.author.userType === "ARTIST" ? "purple" : "cyan"}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/artists/${post.author.id}`} className="font-semibold hover:text-cyan">
            {post.author.artistName}
          </Link>
          <p className="text-txt3 text-xs">
            {post.author.userType === "ARTIST" ? "Artist" : "Listener"} · {timeAgo(post.createdAt)}
          </p>
        </div>
        <div className="flex gap-1.5">
          {post.isMine ? (
            <>
              <button
                className="text-txt3 hover:text-txt p-1.5"
                onClick={() => {
                  setEditText(post.content);
                  setEditOpen(true);
                }}
                aria-label="Edit post"
              >
                <Pencil size={16} />
              </button>
              <button
                className="text-txt3 hover:text-red p-1.5"
                onClick={() => remove.mutate()}
                aria-label="Delete post"
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : (
            <button
              className="text-txt3 hover:text-orange p-1.5"
              onClick={() => setReportOpen(true)}
              aria-label="Report post"
              title="Report"
            >
              <Flag size={16} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words">{post.content}</p>
      {post.image && (
        <img src={post.image} alt="" className="mt-3 rounded-xl max-h-96 object-cover" />
      )}
      {post.track && (
        <div className="mt-3 flex items-center gap-3 bg-bg border border-line rounded-xl p-3">
          <Cover src={post.track.coverArt} name={post.track.trackName} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{post.track.trackName}</p>
            <p className="text-txt3 text-xs">{post.track.artist.artistName}</p>
          </div>
          <button
            onClick={() => playTrack(post.track!, [post.track!])}
            className="gradient-bg rounded-full w-9 h-9 flex items-center justify-center text-white"
            aria-label="Play attached track"
          >
            <Play size={15} className="ml-0.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-5 mt-4 text-sm">
        <button
          onClick={() => like.mutate()}
          className={`flex items-center gap-1.5 ${post.likedByMe ? "text-red" : "text-txt2 hover:text-red"}`}
        >
          <Heart size={17} fill={post.likedByMe ? "currentColor" : "none"} />
          {post.likeCount}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-txt2 hover:text-cyan"
        >
          <MessageCircle size={17} />
          {post.commentCount}
        </button>
      </div>

      {showComments && <Comments post={post} />}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this post">
        <p className="text-txt2 text-sm mb-3">
          Tell the moderators what's wrong with this post.
        </p>
        <textarea
          className="textarea"
          placeholder="Reason (spam, harassment, inappropriate content…)"
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button className="btn btn-ghost flex-1" onClick={() => setReportOpen(false)}>
            Cancel
          </button>
          <button
            className="btn btn-danger flex-1"
            disabled={!reportReason.trim() || report.isPending}
            onClick={() => report.mutate()}
          >
            Submit Report
          </button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit post">
        <textarea
          className="textarea"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button className="btn btn-ghost flex-1" onClick={() => setEditOpen(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            disabled={!editText.trim() || edit.isPending}
            onClick={() => edit.mutate()}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function Community() {
  const { data, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => apiGet("/posts"),
  });
  const posts: Post[] = data?.posts ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-[32px] font-bold gradient-text mb-6">Community</h1>
      <Composer />
      {isLoading ? (
        <Spinner center />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={40} />}
          title="No posts yet"
          subtitle="Be the first to share something with the community!"
        />
      ) : (
        <div className="space-y-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
