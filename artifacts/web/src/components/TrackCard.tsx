import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiSend, ApiError, type Track } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { canDownload, offlineIds, removeOffline, saveOffline } from "@/lib/offline";
import { usePlayer } from "@/lib/player";
import { Cover } from "./ui";
import { Play, Pause, Heart, Download, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import clsx from "clsx";

export function LikeButton({ track, size = 18 }: { track: Track; size?: number }) {
  const qc = useQueryClient();
  const liked = track.likedByMe ?? false;
  const mutation = useMutation({
    mutationFn: () =>
      apiSend(liked ? "DELETE" : "POST", `/tracks/${track.id}/like`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate();
      }}
      className={clsx(
        "transition-colors",
        liked ? "text-red" : "text-txt2 hover:text-red",
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <Heart size={size} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}

/** Pro-only: save/remove a track for offline playback (Downloads tab in My Library). */
export function DownloadButton({ track, size = 17 }: { track: Track; size?: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: downloaded } = useQuery({
    queryKey: ["offline-ids", user?.id],
    queryFn: () => offlineIds(user!.id),
    enabled: !!user,
    staleTime: 10_000,
  });
  const isSaved = downloaded?.has(track.id) ?? false;
  const mutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await removeOffline(user!.id, track.id);
        return "removed";
      }
      await saveOffline(track, user!.id);
      return "saved";
    },
    onSuccess: (what) => {
      qc.invalidateQueries({ queryKey: ["offline-ids"] });
      qc.invalidateQueries({ queryKey: ["offline-tracks"] });
      toast(
        what === "saved"
          ? `"${track.trackName}" saved for offline listening`
          : `"${track.trackName}" removed from downloads`,
      );
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Download failed", "error"),
  });

  if (!canDownload(user, track)) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!mutation.isPending) mutation.mutate();
      }}
      className={clsx(
        "transition-colors",
        isSaved ? "text-green" : "text-txt2 hover:text-cyan",
        mutation.isPending && "animate-pulse",
      )}
      aria-label={isSaved ? "Remove download" : "Download for offline"}
      title={isSaved ? "Downloaded — click to remove" : "Download for offline listening"}
    >
      {isSaved ? <CheckCircle2 size={size} /> : <Download size={size} />}
    </button>
  );
}

export function TrackCard({ track, queue }: { track: Track; queue: Track[] }) {
  const { current, playing, playTrack, toggle } = usePlayer();
  const isCurrent = current?.id === track.id;
  return (
    <div className="card !p-4 group hover:border-cyan/50 transition-colors">
      <div className="relative mb-3">
        <Cover src={track.coverArt} name={track.trackName} className="w-full aspect-square" />
        <button
          onClick={() => (isCurrent ? toggle() : playTrack(track, queue))}
          className={clsx(
            "absolute bottom-2 right-2 gradient-bg rounded-full w-11 h-11 flex items-center justify-center text-white shadow-lg transition-opacity",
            isCurrent && playing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          aria-label="Play"
        >
          {isCurrent && playing ? (
            <Pause size={18} />
          ) : (
            <Play size={18} className="ml-0.5" />
          )}
        </button>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate" title={track.trackName}>
            {track.trackName}
          </p>
          <Link
            href={`/artists/${track.artist.id}`}
            className="text-txt2 text-sm truncate hover:text-cyan block"
          >
            {track.artist.artistName}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <DownloadButton track={track} />
          <LikeButton track={track} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="badge" style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF" }}>
          {track.genre}
        </span>
        <span className="text-txt3 text-xs">{track.playCount.toLocaleString()} plays</span>
      </div>
    </div>
  );
}
