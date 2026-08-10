import { usePlayer } from "@/lib/player";
import { formatDuration } from "@/lib/format";
import { Cover } from "./ui";
import { LikeButton } from "./TrackCard";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Link } from "wouter";

export function PlayerBar() {
  const { current, playing, progress, duration, volume, toggle, next, prev, seek, setVolume } =
    usePlayer();
  if (!current) return null;
  return (
    <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-40 bg-card border-t border-line px-4 py-2.5">
      <div className="flex items-center gap-4 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 w-56 min-w-0">
          <Cover src={current.coverArt} name={current.trackName} size={48} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{current.trackName}</p>
            <Link
              href={`/artists/${current.artist.id}`}
              className="text-txt2 text-xs truncate hover:text-cyan block"
            >
              {current.artist.artistName}
            </Link>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button onClick={prev} className="text-txt2 hover:text-txt" aria-label="Previous">
              <SkipBack size={18} />
            </button>
            <button
              onClick={toggle}
              className="gradient-bg rounded-full w-9 h-9 flex items-center justify-center text-white"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
            </button>
            <button onClick={next} className="text-txt2 hover:text-txt" aria-label="Next">
              <SkipForward size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-xl">
            <span className="text-txt3 text-[11px] w-9 text-right">
              {formatDuration(progress)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.5}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="flex-1"
              aria-label="Seek"
            />
            <span className="text-txt3 text-[11px] w-9">{formatDuration(duration)}</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 w-40">
          <Volume2 size={16} className="text-txt2" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1"
            aria-label="Volume"
          />
          <LikeButton track={current} />
        </div>
      </div>
    </div>
  );
}
