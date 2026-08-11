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
  playTrack: (track: Track, queue?: Track[], opts?: { shuffle?: boolean }) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

/** A random permutation of `list`, with `first` (if given) moved to the front. */
function shuffled(list: Track[], first?: Track): Track[] {
  const rest = first ? list.filter((t) => t.id !== first.id) : [...list];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first ? [first, ...rest] : rest;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const qc = useQueryClient();

  // Refs mirror the state the audio-event handlers need, so those handlers
  // (and playTrack/step) stay stable and never read stale closures.
  const currentRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  // When shuffle is on, this fixed permutation is the play order — so Previous
  // really goes back one track and the queue still has a defined "end".
  const shuffleOrderRef = useRef<Track[] | null>(null);

  // Play-counting: a play is reported once per listen-through, and only after
  // the listener has heard 50% of it. The server then applies the daily cap.
  const currentIdRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  const setQueue = (q: Track[]) => {
    queueRef.current = q;
    setQueueState(q);
  };
  const setShuffle = (v: boolean) => {
    shuffleRef.current = v;
    setShuffleState(v);
  };

  const activeQueue = () =>
    shuffleRef.current && shuffleOrderRef.current
      ? shuffleOrderRef.current
      : queueRef.current;

  const playTrack = useCallback(
    (track: Track, newQueue?: Track[], opts?: { shuffle?: boolean }) => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrent(track);
      currentRef.current = track;
      if (newQueue) setQueue(newQueue);
      if (opts?.shuffle !== undefined) setShuffle(opts.shuffle);
      if (shuffleRef.current) {
        // Reshuffle only on a fresh start (new queue / explicit mode change),
        // not on every auto-advance — the order must stay fixed mid-run.
        if (newQueue || opts?.shuffle !== undefined || !shuffleOrderRef.current) {
          shuffleOrderRef.current = shuffled(queueRef.current, track);
        }
      } else {
        shuffleOrderRef.current = null;
      }
      currentIdRef.current = track.id;
      reportedRef.current = false;
      audio.src = track.audioFile;
      audio.play().catch(() => {});
      setPlaying(true);
    },
    [],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const cur = currentRef.current;
      const q = activeQueue();
      if (!cur || q.length === 0) return;
      const idx = q.findIndex((t) => t.id === cur.id);
      const nextIdx = (idx + dir + q.length) % q.length;
      if (q[nextIdx]) playTrack(q[nextIdx]);
    },
    [playTrack],
  );

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
    const onEnded = () => {
      if (repeatRef.current === "one") {
        // Each replay is a fresh listen — let it count again.
        reportedRef.current = false;
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      const cur = currentRef.current;
      const q = activeQueue();
      const idx = cur ? q.findIndex((t) => t.id === cur.id) : -1;
      if (repeatRef.current === "off" && idx === q.length - 1) {
        setPlaying(false);
        return;
      }
      step(1);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [qc, step]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentRef.current) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    setVolumeState(v);
  }, []);

  const toggleShuffle = useCallback(() => {
    const on = !shuffleRef.current;
    setShuffle(on);
    shuffleOrderRef.current = on
      ? shuffled(queueRef.current, currentRef.current ?? undefined)
      : null;
  }, []);

  const cycleRepeat = useCallback(() => {
    const next: RepeatMode =
      repeatRef.current === "off" ? "all" : repeatRef.current === "all" ? "one" : "off";
    repeatRef.current = next;
    setRepeatState(next);
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
        toggleShuffle,
        cycleRepeat,
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
