import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { apiGet, apiSend, ApiError, type Playlist, type Track } from "@/lib/api";
import { usePlayer } from "@/lib/player";
import { useToast } from "@/lib/toast";
import { Cover, EmptyState, Spinner } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { ArrowLeft, ListMusic, Pencil, Play, Shuffle, Trash2, X } from "lucide-react";

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { playTrack } = usePlayer();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const oops = (fallback: string) => (err: unknown) =>
    toast(err instanceof ApiError ? err.message : fallback, "error");

  const { data, isLoading, error } = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => apiGet(`/playlists/${id}`),
  });

  const rename = useMutation({
    mutationFn: () => apiSend("PATCH", `/playlists/${id}`, { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlist", id] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
      setRenaming(false);
    },
    onError: oops("Could not rename playlist"),
  });
  const removeTrack = useMutation({
    mutationFn: (trackId: number) => apiSend("DELETE", `/playlists/${id}/tracks/${trackId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlist", id] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
    onError: oops("Could not remove track"),
  });
  const removePlaylist = useMutation({
    mutationFn: () => apiSend("DELETE", `/playlists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      toast("Playlist deleted");
      navigate("/library");
    },
    onError: oops("Could not delete playlist"),
  });

  if (isLoading) return <Spinner center />;
  if (error || !data?.playlist) {
    return (
      <EmptyState
        icon={<ListMusic size={40} />}
        title="Playlist not found"
        action={<Link href="/library" className="btn btn-secondary">Back to Library</Link>}
      />
    );
  }
  const playlist: Playlist = data.playlist;
  const tracks: Track[] = data.tracks ?? [];
  const totalSeconds = tracks.reduce((s, t) => s + (t.durationSeconds ?? 0), 0);

  return (
    <div>
      <Link href="/library" className="text-txt2 text-sm hover:text-cyan inline-flex items-center gap-1.5 mb-4">
        <ArrowLeft size={15} /> My Library
      </Link>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) rename.mutate();
              }}
            >
              <input
                className="input text-xl font-bold"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
              />
              <button type="submit" className="btn btn-primary !py-1.5">Save</button>
              <button type="button" className="btn btn-secondary !py-1.5" onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <h1 className="text-[32px] font-bold gradient-text truncate flex items-center gap-3">
              {playlist.name}
              <button
                onClick={() => {
                  setName(playlist.name);
                  setRenaming(true);
                }}
                className="text-txt3 hover:text-txt"
                aria-label="Rename playlist"
              >
                <Pencil size={18} />
              </button>
            </h1>
          )}
          <p className="text-txt2 text-sm mt-1">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
            {totalSeconds > 0 && <> · {formatDuration(totalSeconds)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              tracks.length > 0 && playTrack(tracks[0], tracks, { shuffle: false })
            }
            disabled={tracks.length === 0}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Play size={16} /> Play All
          </button>
          <button
            onClick={() => {
              if (tracks.length > 0) {
                playTrack(
                  tracks[Math.floor(Math.random() * tracks.length)],
                  tracks,
                  { shuffle: true },
                );
              }
            }}
            disabled={tracks.length === 0}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <Shuffle size={15} /> Shuffle
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete playlist "${playlist.name}"? Tracks themselves are not deleted.`)) {
                removePlaylist.mutate();
              }
            }}
            className="btn btn-secondary !text-red inline-flex items-center gap-2"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={<ListMusic size={40} />}
          title="This playlist is empty"
          subtitle="Use the + icon on any track to add it here."
          action={<Link href="/browse" className="btn btn-secondary">Browse Music</Link>}
        />
      ) : (
        <div className="card !p-0 divide-y divide-line">
          {tracks.map((t, i) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03]">
              <span className="text-txt3 text-sm w-5 text-right">{i + 1}</span>
              <button
                onClick={() => playTrack(t, tracks)}
                className="gradient-bg rounded-full w-9 h-9 flex items-center justify-center text-white shrink-0"
                aria-label="Play"
              >
                <Play size={15} className="ml-0.5" />
              </button>
              <Cover src={t.coverArt} name={t.trackName} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{t.trackName}</p>
                <Link href={`/artists/${t.artist.id}`} className="text-txt2 text-sm hover:text-cyan">
                  {t.artist.artistName}
                </Link>
              </div>
              <span className="text-txt3 text-sm hidden sm:block">{t.genre}</span>
              <span className="text-txt3 text-sm hidden sm:block w-12 text-right">
                {t.durationSeconds ? formatDuration(t.durationSeconds) : "—"}
              </span>
              <button
                onClick={() => removeTrack.mutate(t.id)}
                className="text-txt3 hover:text-red"
                aria-label="Remove from playlist"
                title="Remove from playlist"
              >
                <X size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
