import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Track } from "@/lib/api";
import { TrackCard } from "@/components/TrackCard";
import { EmptyState, Spinner } from "@/components/ui";
import { Search, Music } from "lucide-react";
import clsx from "clsx";

const DEFAULT_GENRES = [
  "All",
  "Electronic",
  "Hip-Hop",
  "Rock",
  "R&B",
  "Jazz",
  "Classical",
  "Ambient",
];

export default function Browse() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const { data: genreData } = useQuery({
    queryKey: ["genres"],
    queryFn: () => apiGet("/genres"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["tracks", "browse", search, genre],
    queryFn: () =>
      apiGet(
        `/tracks?search=${encodeURIComponent(search)}&genre=${encodeURIComponent(genre)}`,
      ),
  });

  const genres: string[] = [
    "All",
    ...new Set([...DEFAULT_GENRES.slice(1), ...(genreData?.genres ?? [])]),
  ];
  const tracks: Track[] = data?.tracks ?? [];

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-6">Browse Music</h1>
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-txt3" />
        <input
          className="input !pl-11"
          placeholder="Search tracks, artists, or genres…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex gap-2 flex-wrap mb-7">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
              genre === g
                ? "gradient-bg text-white border-transparent"
                : "border-line text-txt2 hover:text-txt hover:border-txt3",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner center />
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={<Music size={40} />}
          title="No tracks found"
          subtitle={
            search || genre !== "All"
              ? "Try a different search or genre."
              : "No music has been published yet — check back soon!"
          }
        />
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}
        >
          {tracks.map((t) => (
            <TrackCard key={t.id} track={t} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  );
}
