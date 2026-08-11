import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError, type Track, type Playlist } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { canDownload, offlineIds, removeOffline, saveOffline } from "@/lib/offline";
import { usePlayer } from "@/lib/player";
import { Cover } from "./ui";
import { Play, Pause, Heart, Download, CheckCircle2, ListPlus, Plus } from "lucide-react";
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

/** Small popover to add a track to one of my playlists (or a new one). */
export function AddToPlaylistButton({ track, size = 17 }: { track: Track; size?: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  const { data } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => apiGet("/playlists"),
    enabled: open,
  });
  const playlists: Playlist[] = data?.playlists ?? [];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const add = useMutation({
    mutationFn: async (playlistId: number) => {
      await apiSend("POST", `/playlists/${playlistId}/tracks`, { trackId: track.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist"] });
      toast(`"${track.trackName}" added to playlist`);
      setOpen(false);
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not add track", "error"),
  });

  const createAndAdd = useMutation({
    mutationFn: async () => {
      const res = await apiSend("POST", "/playlists", { name: newName.trim() });
      await apiSend("POST", `/playlists/${res.playlist.id}/tracks`, { trackId: track.id });
      return res.playlist as Playlist;
    },
    onSuccess: (playlist) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      toast(`Created "${playlist.name}" and added the track`);
      setNewName("");
      setOpen(false);
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not create playlist", "error"),
  });

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={clsx("transition-colors", open ? "text-cyan" : "text-txt2 hover:text-cyan")}
        aria-label="Add to playlist"
        title="Add to playlist"
      >
        <ListPlus size={size} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-56 card !p-2 z-50 shadow-xl">
          <p className="text-txt3 text-xs font-semibold px-2 py-1">Add to playlist</p>
          <div className="max-h-44 overflow-y-auto">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => add.mutate(p.id)}
                disabled={add.isPending}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-white/[0.06] truncate"
              >
                {p.name}
                <span className="text-txt3 text-xs ml-1.5">{p.trackCount}</span>
              </button>
            ))}
            {playlists.length === 0 && (
              <p className="text-txt3 text-xs px-2 py-1.5">No playlists yet</p>
            )}
          </div>
          <form
            className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-line px-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim() && !createAndAdd.isPending) createAndAdd.mutate();
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New playlist…"
              className="input !py-1 !px-2 text-sm flex-1 min-w-0"
              maxLength={80}
            />
            <button
              type="submit"
              disabled={!newName.trim() || createAndAdd.isPending}
              className="text-cyan disabled:text-txt3"
              aria-label="Create playlist"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
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
          <AddToPlaylistButton track={track} />
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
