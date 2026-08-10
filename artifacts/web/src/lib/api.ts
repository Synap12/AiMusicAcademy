export class ApiError extends Error {
  status: number;
  banned?: boolean;
  needsSubscription?: boolean;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.banned = extra?.banned === true;
    this.needsSubscription = extra?.needsSubscription === true;
  }
}

async function handle(res: Response) {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, json.error || `Request failed (${res.status})`, json);
  }
  return json;
}

export function apiGet(path: string) {
  return fetch(`/api${path}`, { credentials: "include" }).then(handle);
}

export function apiSend(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
) {
  return fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(handle);
}

export function apiForm(
  method: "POST" | "PATCH",
  path: string,
  form: FormData,
) {
  return fetch(`/api${path}`, {
    method,
    credentials: "include",
    body: form,
  }).then(handle);
}

// ---------- shared types (mirror API responses) ----------

export interface MiniUser {
  id: number;
  artistName: string;
  profileImage: string | null;
  userType: string;
}

export interface Me {
  id: number;
  email: string;
  artistName: string;
  bio: string;
  profileImage: string | null;
  coverImage: string | null;
  socialLinks: string;
  userType: "ARTIST" | "LISTENER";
  isAdmin: boolean;
  isBanned: boolean;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  hasOnboarded: boolean;
  streamBalance: number;
  totalEarnings: number;
  payoutMethod: string;
  notifyNewFollower: boolean;
  notifyCommunity: boolean;
  createdAt: string;
}

export interface Track {
  id: number;
  trackName: string;
  artistId: number;
  audioFile: string;
  coverArt: string | null;
  genre: string;
  releaseDate: string;
  isPublished: boolean;
  playCount: number;
  durationSeconds: number | null;
  artist: MiniUser;
  likedByMe?: boolean;
}

export interface MerchProduct {
  id: number;
  productName: string;
  artistId: number;
  description: string;
  category: string;
  price: number;
  productImage: string | null;
  buyLink: string;
  isActive: boolean;
  artist?: MiniUser;
}

export interface Post {
  id: number;
  authorId: number;
  content: string;
  image: string | null;
  trackId: number | null;
  likeCount: number;
  createdAt: string;
  author: MiniUser;
  track: Track | null;
  commentCount: number;
  likedByMe: boolean;
  isMine: boolean;
}

export interface Plan {
  id: string;
  name: string;
  role: "LISTENER" | "ARTIST";
  price: number;
  merchSlots: number;
  features: string[];
}
