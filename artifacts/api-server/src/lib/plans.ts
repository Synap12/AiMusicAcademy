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
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  listener_basic: {
    id: "listener_basic",
    name: "Listener Basic",
    role: "LISTENER",
    price: 6.99,
    merchSlots: 0,
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
    features: [
      "Unlimited track uploads",
      "1 active merch slot",
      "Analytics",
      "AI cover art generator",
      "Community",
    ],
  },
  artist_pro: {
    id: "artist_pro",
    name: "Artist Pro",
    role: "ARTIST",
    price: 99.99,
    merchSlots: 3,
    features: ["Everything in Artist Basic", "3 active merch slots"],
  },
};

export function merchSlotsFor(plan: string | null): number {
  if (!plan) return 0;
  return PLANS[plan as PlanId]?.merchSlots ?? 0;
}

/** Revenue credited to the artist per tracked play, in USD. */
export const PLAY_RATE = 0.004;
