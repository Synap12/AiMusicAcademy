import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiGet, apiSend, type Track, type MiniUser, type Playlist } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { listOffline, removeOffline, toPlayableTrack } from "@/lib/offline";
import { DownloadButton } from "@/components/TrackCard";
import { Avatar, Cover, EmptyState, Spinner, StatCard } from "@/components/ui";
import { formatDuration, listenTime } from "@/lib/format";
import { Heart, Users, Play, Download, Trash2, WifiOff, ListMusic, Plus } from "lucide-react";
import clsx from "clsx";

interface FollowedArtist extends MiniUser {
  bio: string;
  followedDate: string;
}

function DownloadsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const { data: stored } = useQuery({
    queryKey: ["offline-tracks", user?.id],
    queryFn: () => listOffline(user!.id),
    enabled: !!user,
  });
  // Object URLs are created once per fetched list so play/remove don't leak.
  const playable = useMemo(
    () => (stored ?? []).map((s) => ({ stored: s, track: toPlayableTrack(s) })),
    [stored],
  );
  const remove = useMutation({
    mutationFn: (id: number) => removeOffline(user!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offline-tracks"] });
      qc.invalidateQueries({ queryKey: ["offline-ids"] });
    },
  });

  if (playable.length === 0) {
    return (
      <EmptyState
        icon={<Download size={40} />}
        title="No downloads yet"
        subtitle="Tap the download icon on any track to save it for offline listening."
        action={<Link href="/browse" className="btn btn-secondary">Browse Music</Link>}
      />
    );
  }
  return (
    <>
      <p className="text-txt3 text-sm mb-4 flex items-center gap-2">
        <WifiOff size={15} />
        These tracks are stored on this device and play even without internet.
      </p>
      <div className="card !p-0 divide-y divide-line">
        {playable.map(({ stored: s, track: t }) => (
          <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03]">
            <button
              onClick={() =>
                playTrack(t, playable.map((p) => p.track))
              }
              className="gradient-bg rounded-full w-9 h-9 flex items-center justify-center text-white shrink-0"
              aria-label="Play"
            >
              <Play size={15} className="ml-0.5" />
            </button>
            <Cover src={t.coverArt} name={t.trackName} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{t.trackName}</p>
              <p className="text-txt2 text-sm">{t.artist.artistName}</p>
            </div>
            <span className="text-txt3 text-sm hidden sm:block">{t.genre}</span>
            <span className="text-txt3 text-sm hidden sm:block w-16 text-right">
              {(s.audio.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              onClick={() => remove.mutate(t.id)}
              className="text-txt3 hover:text-red"
              aria-label="Remove download"
              title="Remove from this device"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function PlaylistsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => apiGet("/playlists"),
  });
  const playlists: Playlist[] = data?.playlists ?? [];
  const create = useMutation({
    mutationFn: () => apiSend("POST", "/playlists", { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      setName("");
    },
  });

  return (
    <>
      <form
        className="flex items-center gap-2 mb-5 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !create.isPending) create.mutate();
        }}
      >
        <input
          className="input flex-1"
          placeholder="New playlist name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className="btn btn-primary inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Create
        </button>
      </form>
      {playlists.length === 0 ? (
        <EmptyState
          icon={<ListMusic size={40} />}
          title="No playlists yet"
          subtitle="Create one above, or use the + icon on any track."
          action={<Link href="/browse" className="btn btn-secondary">Browse Music</Link>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {playlists.map((p) => (
            <Link
              key={p.id}
              href={`/playlists/${p.id}`}
              className="card !p-4 group hover:border-cyan/50 transition-colors block"
            >
              <div className="aspect-square rounded-lg overflow-hidden mb-3 grid grid-cols-2 grid-rows-2 gap-0.5 bg-white/[0.04]">
                {p.covers.length > 0 ? (
                  [0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-full h-full overflow-hidden">
                      {p.covers[i % p.covers.length] ? (
                        <img
                          src={p.covers[i % p.covers.length]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 row-span-2 flex items-center justify-center text-txt3">
                    <ListMusic size={36} />
                  </div>
                )}
              </div>
              <p className="font-semibold truncate group-hover:text-cyan transition-colors">
                {p.name}
              </p>
              <p className="text-txt3 text-sm">
                {p.trackCount} {p.trackCount === 1 ? "track" : "tracks"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function Library() {
  const [tab, setTab] = useState<"liked" | "playlists" | "following" | "downloads">("liked");
  const qc = useQueryClient();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const { data, isLoading } = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet("/library"),
  });
  const showDownloads =
    !!user &&
    (user.isAdmin ||
      user.subscriptionPlan === "listener_pro" ||
      user.subscriptionPlan === "artist_pro" ||
      user.userType === "ARTIST");

  const unlike = useMutation({
    mutationFn: (trackId: number) => apiSend("DELETE", `/tracks/${trackId}/like`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
  const unfollow = useMutation({
    mutationFn: (artistId: number) => apiSend("DELETE", `/users/${artistId}/follow`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });

  if (isLoading) return <Spinner center />;
  const liked: Track[] = data?.likedTracks ?? [];
  const following: FollowedArtist[] = data?.following ?? [];
  const stats = data?.stats ?? { likedCount: 0, followingCount: 0, totalListenSeconds: 0 };

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-6">My Library</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Liked Songs" value={stats.likedCount} accent="#00D4FF" />
        <StatCard label="Following" value={stats.followingCount} accent="#B537FF" />
        <StatCard label="Total Listen Time" value={listenTime(stats.totalListenSeconds)} accent="#00FF88" />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: "liked" as const, label: "Liked Songs" },
          { id: "playlists" as const, label: "Playlists" },
          { id: "following" as const, label: "Following" },
          ...(showDownloads ? [{ id: "downloads" as const, label: "Downloads" }] : []),
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "px-5 py-2 rounded-full text-sm font-semibold border transition-colors",
              tab === t.id
                ? "gradient-bg text-white border-transparent"
                : "border-line text-txt2 hover:text-txt",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "liked" &&
        (liked.length === 0 ? (
          <EmptyState
            icon={<Heart size={40} />}
            title="No liked songs yet"
            subtitle="Tap the heart on any track to save it here."
            action={<Link href="/browse" className="btn btn-secondary">Browse Music</Link>}
          />
        ) : (
          <div className="card !p-0 divide-y divide-line">
            {liked.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03]">
                <button
                  onClick={() => playTrack(t, liked)}
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
                <DownloadButton track={t} />
                <button
                  onClick={() => unlike.mutate(t.id)}
                  className="text-red hover:opacity-70"
                  aria-label="Unlike"
                  title="Remove from liked songs"
                >
                  <Heart size={18} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === "playlists" && <PlaylistsTab />}

      {tab === "downloads" && showDownloads && <DownloadsTab />}

      {tab === "following" &&
        (following.length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="Not following anyone yet"
            subtitle="Follow artists to keep up with their releases and posts."
            action={<Link href="/browse" className="btn btn-secondary">Discover Artists</Link>}
          />
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {following.map((a) => (
              <div key={a.id} className="card flex flex-col items-center text-center">
                <Avatar src={a.profileImage} name={a.artistName} size={72} accent="purple" />
                <Link href={`/artists/${a.id}`} className="font-bold mt-3 hover:text-cyan">
                  {a.artistName}
                </Link>
                <p className="text-txt3 text-sm line-clamp-2 mt-1">{a.bio || "AI music artist"}</p>
                <button
                  onClick={() => unfollow.mutate(a.id)}
                  className="btn btn-ghost btn-sm mt-4"
                >
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
