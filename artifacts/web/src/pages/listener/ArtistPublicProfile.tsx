import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, type Track, type MerchProduct } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { Avatar, Cover, EmptyState, Spinner } from "@/components/ui";
import { money, timeAgo, formatDate } from "@/lib/format";
import { Play, ExternalLink, Music } from "lucide-react";

export default function ArtistPublicProfile({ id }: { id: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["artist-profile", id],
    queryFn: () => apiGet(`/users/${id}`),
  });

  const follow = useMutation({
    mutationFn: () =>
      apiSend(data?.isFollowing ? "DELETE" : "POST", `/users/${id}/follow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-profile", id] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  if (isLoading) return <Spinner center />;
  if (isError || !data)
    return (
      <EmptyState icon={<Music size={40} />} title="Profile not found" />
    );

  const { profile, tracks, merch, posts, followerCount, isFollowing } = data as {
    profile: {
      id: number;
      artistName: string;
      profileImage: string | null;
      coverImage: string | null;
      bio: string;
      userType: string;
      socialLinks: string;
      createdAt: string;
    };
    tracks: Track[];
    merch: MerchProduct[];
    posts: { id: number; content: string; createdAt: string; locked?: boolean }[];
    followerCount: number;
    isFollowing: boolean;
  };

  return (
    <div>
      {/* header */}
      <div
        className="rounded-2xl h-44 md:h-56 bg-card border border-line bg-cover bg-center"
        style={
          profile.coverImage
            ? { backgroundImage: `url(${profile.coverImage})` }
            : { background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(181,55,255,0.25))" }
        }
      />
      <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-10 md:-mt-12 px-6">
        <div className="ring-4 ring-bg rounded-full w-fit">
          <Avatar
            src={profile.profileImage}
            name={profile.artistName}
            size={104}
            accent={profile.userType === "ARTIST" ? "purple" : "cyan"}
          />
        </div>
        <div className="flex-1 pb-1">
          <h1 className="text-3xl font-bold">{profile.artistName}</h1>
          <p className="text-txt2 text-sm mt-1">
            {followerCount.toLocaleString()} follower{followerCount === 1 ? "" : "s"} · Joined{" "}
            {formatDate(profile.createdAt)}
          </p>
        </div>
        <div className="flex gap-3 pb-1">
          {tracks.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => playTrack(tracks[0], tracks)}
            >
              <Play size={16} /> Play All
            </button>
          )}
          {user?.id !== id && (
            <button
              className={isFollowing ? "btn btn-ghost" : "btn btn-secondary"}
              onClick={() => follow.mutate()}
              disabled={follow.isPending}
            >
              {isFollowing ? "Following ✓" : "Follow"}
            </button>
          )}
        </div>
      </div>

      {profile.bio && <p className="text-txt2 mt-6 px-6 max-w-3xl">{profile.bio}</p>}
      {profile.socialLinks && (
        <div className="flex gap-3 flex-wrap mt-3 px-6">
          {profile.socialLinks
            .split(/\s+/)
            .filter((l) => l.startsWith("http"))
            .map((l) => (
              <a
                key={l}
                href={l}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan text-sm hover:underline flex items-center gap-1"
              >
                {new URL(l).hostname.replace("www.", "")} <ExternalLink size={12} />
              </a>
            ))}
        </div>
      )}

      {/* tracks */}
      <h2 className="text-2xl font-bold mt-10 mb-4">Tracks</h2>
      {tracks.length === 0 ? (
        <p className="text-txt3">No published tracks yet.</p>
      ) : (
        <div className="card !p-0 divide-y divide-line">
          {tracks.map((t, i) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] group">
              <span className="text-txt3 text-sm w-5 text-right">{i + 1}</span>
              <Cover src={t.coverArt} name={t.trackName} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{t.trackName}</p>
                <p className="text-txt3 text-sm">{t.genre}</p>
              </div>
              <span className="text-txt3 text-sm hidden sm:block">
                {t.playCount.toLocaleString()} plays
              </span>
              <button
                onClick={() => playTrack(t, tracks)}
                className="gradient-bg rounded-full w-9 h-9 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Play"
              >
                <Play size={15} className="ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* merch */}
      {merch.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-10 mb-4">Merch</h2>
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {merch.map((p) => (
              <div key={p.id} className="card !p-4">
                {p.productImage && (
                  <img
                    src={p.productImage}
                    alt={p.productName}
                    className="w-full aspect-square object-cover rounded-lg mb-3"
                  />
                )}
                <p className="font-semibold">{p.productName}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold">{money(p.price)}</span>
                  <a
                    href={p.buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    Buy <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* recent posts */}
      {posts.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-10 mb-4">Recent Posts</h2>
          <div className="space-y-4 max-w-2xl">
            {posts.map((p) => (
              <div key={p.id} className="card">
                <p className="text-txt3 text-xs mb-2">{timeAgo(p.createdAt)}</p>
                {p.locked ? (
                  <p className="text-txt3 text-sm italic">
                    🔒 Exclusive post — upgrade to Listener Pro to unlock.
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{p.content}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
