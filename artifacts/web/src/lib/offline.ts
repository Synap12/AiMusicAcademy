import { ApiError, type Me, type Track } from "./api";

/**
 * Offline music storage (Listener Pro perk). Downloaded tracks live in
 * IndexedDB — audio and cover art as Blobs plus enough metadata to render
 * and play them with no network at all.
 */

const DB_NAME = "offline-music";
const STORE = "tracks";
const OWNER_INDEX = "ownerId";

export interface StoredTrack {
  id: number;
  /** The user who downloaded it — records are private to that account. */
  ownerId: number;
  trackName: string;
  artistName: string;
  genre: string;
  durationSeconds: number | null;
  audio: Blob;
  cover: Blob | null;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      // v1 keyed records by track id alone, which made downloads visible to
      // every account on the browser. Rebuild keyed per-owner; v1 records
      // have no owner to attribute them to, so they are dropped.
      if (req.result.objectStoreNames.contains(STORE)) {
        req.result.deleteObjectStore(STORE);
      }
      const store = req.result.createObjectStore(STORE, {
        keyPath: ["ownerId", "id"],
      });
      store.createIndex(OWNER_INDEX, "ownerId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Who gets the download button. The server enforces the same rule. */
export function canDownload(user: Me | null, track: Track): boolean {
  if (!user) return false;
  return (
    user.isAdmin ||
    user.subscriptionPlan === "listener_pro" ||
    user.subscriptionPlan === "artist_pro" ||
    (user.userType === "ARTIST" && track.artistId === user.id)
  );
}

/** Download a track's audio (and cover) and store it for offline playback. */
export async function saveOffline(track: Track, ownerId: number): Promise<void> {
  const res = await fetch(`/api/tracks/${track.id}/download`, {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || "Download failed");
  }
  const audio = await res.blob();
  let cover: Blob | null = null;
  if (track.coverArt) {
    cover = await fetch(track.coverArt)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
  }
  const record: StoredTrack = {
    id: track.id,
    ownerId,
    trackName: track.trackName,
    artistName: track.artist.artistName,
    genre: track.genre,
    durationSeconds: track.durationSeconds,
    audio,
    cover,
    savedAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(record));
}

export function listOffline(ownerId: number): Promise<StoredTrack[]> {
  return tx(
    "readonly",
    (s) => s.index(OWNER_INDEX).getAll(ownerId) as IDBRequest<StoredTrack[]>,
  );
}

export async function offlineIds(ownerId: number): Promise<Set<number>> {
  const keys = await tx("readonly", (s) =>
    s.index(OWNER_INDEX).getAllKeys(ownerId),
  );
  return new Set((keys as [number, number][]).map(([, trackId]) => trackId));
}

export function removeOffline(ownerId: number, id: number): Promise<undefined> {
  return tx("readwrite", (s) => s.delete([ownerId, id]));
}

/**
 * Convert a stored record into a playable Track for the shared player.
 * Object URLs stay alive for the session; the browser reclaims them on reload.
 */
export function toPlayableTrack(stored: StoredTrack): Track {
  return {
    id: stored.id,
    trackName: stored.trackName,
    artistId: 0,
    audioFile: URL.createObjectURL(stored.audio),
    coverArt: stored.cover ? URL.createObjectURL(stored.cover) : null,
    genre: stored.genre,
    releaseDate: new Date(stored.savedAt).toISOString(),
    isPublished: true,
    playCount: 0,
    durationSeconds: stored.durationSeconds,
    artist: { id: 0, artistName: stored.artistName, profileImage: null, userType: "ARTIST" },
  };
}
