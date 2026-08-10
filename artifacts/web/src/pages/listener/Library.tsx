import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiGet, apiSend, type Track, type MiniUser } from "@/lib/api";
import { usePlayer } from "@/lib/player";
import { Avatar, Cover, EmptyState, Spinner, StatCard } from "@/components/ui";
import { formatDuration, listenTime } from "@/lib/format";
import { Heart, Users, Play } from "lucide-react";
import clsx from "clsx";

interface FollowedArtist extends MiniUser {
  bio: string;
  followedDate: string;
}

export default function Library() {
  const [tab, setTab] = useState<"liked" | "following">("liked");
  const qc = useQueryClient();
  const { playTrack } = usePlayer();
  const { data, isLoading } = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet("/library"),
  });

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

      <div className="flex gap-2 mb-6">
        {(
          [
            { id: "liked", label: "Liked Songs" },
            { id: "following", label: "Following" },
          ] as const
        ).map((t) => (
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
