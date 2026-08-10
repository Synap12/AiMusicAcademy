import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiSend, type Track } from "./api";
import { useQueryClient } from "@tanstack/react-query";

interface PlayerState {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  playTrack: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const qc = useQueryClient();

  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.9;
    audioRef.current = audio;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const playTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrent(track);
      if (newQueue) setQueue(newQueue);
      audio.src = track.audioFile;
      audio.play().catch(() => {});
      setPlaying(true);
      // Record the play (updates play count + artist earnings ledger).
      apiSend("POST", `/tracks/${track.id}/play`)
        .then(() => qc.invalidateQueries({ queryKey: ["tracks"] }))
        .catch(() => {});
    },
    [qc],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [current]);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!current || queue.length === 0) return;
      const idx = queue.findIndex((t) => t.id === current.id);
      const nextIdx = (idx + dir + queue.length) % queue.length;
      const track = queue[nextIdx];
      if (track) playTrack(track);
    },
    [current, queue, playTrack],
  );

  // Auto-advance when a track finishes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => step(1);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [step]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    setVolumeState(v);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        current,
        queue,
        playing,
        progress,
        duration,
        volume,
        playTrack,
        toggle,
        next: () => step(1),
        prev: () => step(-1),
        seek,
        setVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
