export type PlanId =
  | "listener_basic"
  | "listener_pro"
  | "artist_basic"
  | "artist_pro";

export interface Plan {
  id: PlanId;
  name: string;
  role: "LISTENER" | "ARTIST";
  price: number;
  merchSlots: number;
  /** AI cover art generations allowed per calendar month (resets on the 1st, UTC). */
  coverArtGenerations: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  listener_basic: {
    id: "listener_basic",
    name: "Listener Basic",
    role: "LISTENER",
    price: 6.99,
    merchSlots: 0,
    coverArtGenerations: 0,
    features: [
      "Ad-free streaming",
      "Standard quality audio",
      "Public community access",
    ],
  },
  listener_pro: {
    id: "listener_pro",
    name: "Listener Pro",
    role: "LISTENER",
    price: 14.99,
    merchSlots: 0,
    coverArtGenerations: 0,
    features: [
      "HQ audio",
      "Offline downloads",
      "Exclusive artist content",
      "Priority support",
    ],
  },
  artist_basic: {
    id: "artist_basic",
    name: "Artist Basic",
    role: "ARTIST",
    price: 49.99,
    merchSlots: 1,
    coverArtGenerations: 5,
    features: [
      "Unlimited track uploads",
      "1 active merch slot",
      "Analytics",
      "AI cover art generator (5/month)",
      "Community",
    ],
  },
  artist_pro: {
    id: "artist_pro",
    name: "Artist Pro",
    role: "ARTIST",
    price: 99.99,
    merchSlots: 3,
    coverArtGenerations: 20,
    features: [
      "Everything in Artist Basic",
      "3 active merch slots",
      "AI cover art generator (20/month)",
    ],
  },
};

export function merchSlotsFor(plan: string | null): number {
  if (!plan) return 0;
  return PLANS[plan as PlanId]?.merchSlots ?? 0;
}

export function coverArtGenerationsFor(plan: string | null): number {
  if (!plan) return 0;
  return PLANS[plan as PlanId]?.coverArtGenerations ?? 0;
}

/** Revenue credited to the artist per counted play, in USD. */
export const PLAY_RATE = 0.004;

/**
 * Anti-abuse play counting rules:
 * - Only the first N plays per listener per day (UTC midnight reset) count
 *   toward play counts and artist earnings. Streaming itself is never blocked;
 *   uncounted plays are silently ignored by the ledger.
 * - The frontend reports a play only after 50% of the track has been heard.
 * - Self-plays never earn (enforced in the play route).
 */
export const DAILY_COUNTED_PLAYS = 10;
