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

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
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
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const qc = useQueryClient();
  // Play-counting: a play is reported once per track-load, and only after the
  // listener has heard 50% of it. The server then applies the daily cap.
  const currentIdRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.9;
    audioRef.current = audio;
    const onTime = () => {
      setProgress(audio.currentTime);
      if (
        !reportedRef.current &&
        currentIdRef.current !== null &&
        audio.duration > 0 &&
        audio.currentTime >= audio.duration / 2
      ) {
        reportedRef.current = true;
        apiSend("POST", `/tracks/${currentIdRef.current}/play`)
          .then((res) => {
            if (res.counted) qc.invalidateQueries({ queryKey: ["tracks"] });
          })
          .catch(() => {});
      }
    };
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
  }, [qc]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(track);
    if (newQueue) setQueue(newQueue);
    currentIdRef.current = track.id;
    reportedRef.current = false;
    audio.src = track.audioFile;
    audio.play().catch(() => {});
    setPlaying(true);
  }, []);

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
      if (shuffle && queue.length > 1) {
        let idx = Math.floor(Math.random() * queue.length);
        if (queue[idx].id === current.id) idx = (idx + 1) % queue.length;
        playTrack(queue[idx]);
        return;
      }
      const idx = queue.findIndex((t) => t.id === current.id);
      const nextIdx = (idx + dir + queue.length) % queue.length;
      const track = queue[nextIdx];
      if (track) playTrack(track);
    },
    [current, queue, shuffle, playTrack],
  );

  // Auto-advance when a track finishes, honoring repeat mode.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (repeat === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setPlaying(true);
        return;
      }
      const lastIdx = queue.findIndex((t) => t.id === current?.id);
      const atEnd = lastIdx === queue.length - 1;
      if (repeat === "off" && atEnd && !shuffle) return;
      step(1);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [step, repeat, shuffle, queue, current]);

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
        shuffle,
        repeat,
        playTrack,
        toggle,
        next: () => step(1),
        prev: () => step(-1),
        seek,
        setVolume,
        toggleShuffle: () => setShuffle((s) => !s),
        cycleRepeat: () =>
          setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
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
