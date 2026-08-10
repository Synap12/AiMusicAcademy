# AI Music Academy

Two-sided music streaming + artist monetization platform: artists upload AI-generated music, sell merch via external stores, and earn per-play stream revenue; listeners subscribe to stream, follow artists, and join a shared community. Admins manage users, moderation, and payouts.

## Run & Operate

- **Run button** ("Project") — starts API server (port 3001) + Vite dev server (port 5000, proxies `/api` and `/uploads`)
- `pnpm --filter @workspace/api-server run dev` — API server alone (needs `PORT`)
- `pnpm --filter @workspace/web run dev` — frontend alone (needs API on 3001 or `API_URL`)
- `pnpm run typecheck` / `pnpm run build` — full typecheck / build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed demo data (idempotent; skips if admin exists)
- **Deployment**: builds everything, then runs `node artifacts/api-server/dist/index.mjs` which serves the API, the built SPA, and `/uploads` on one port
- Required env: `DATABASE_URL` (already provisioned). Optional (features auto-upgrade when set): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_LINK_<PLAN>`, `STRIPE_PRICE_<PLAN>` (plan = LISTENER_BASIC/LISTENER_PRO/ARTIST_BASIC/ARTIST_PRO), `OPENAI_API_KEY`

## Demo accounts

`admin@aimusic.academy`/`admin1234`, `nova@demo.com` (Artist Pro), `synthlord@demo.com` (Artist Basic), `listener@demo.com` (Listener Basic) — password `demo1234`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`) — cookie sessions, multer uploads, zod validation
- Web: React 19 + Vite + Tailwind v4 + wouter + TanStack Query (`artifacts/web`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)

## Where things live

- `lib/db/src/schema/` — **source of truth for the DB schema** (users, tracks, merch, community, payouts)
- `artifacts/api-server/src/routes/` — one router per domain (auth, users, subscriptions, tracks, merch, posts, artist, admin, webhooks)
- `artifacts/api-server/src/lib/` — auth/session helpers, plan catalog (`plans.ts`, incl. `PLAY_RATE`), Stripe client, profanity filter, cover-art generator, uploads
- `artifacts/web/src/pages/` — pages grouped by role (`listener/`, `artist/`, `admin/`, public at root)
- `artifacts/web/src/index.css` — design system (colors, `.card`/`.btn`/`.input` component classes)
- `uploads/` — user/seed media (committed so demo audio survives deploys)
- `BUILD_CHECKLIST.md` — feature checklist + test status

## Architecture decisions

- **Payments degrade gracefully**: with no Stripe env, checkout runs a built-in mock flow (same webhook-shaped state changes) so the whole product works pre-keys; real Stripe activates automatically via env vars. Same pattern for OpenAI cover art (local SVG generator fallback).
- Stripe webhook (`/api/webhooks/stripe`) is mounted **before** `express.json()` for raw-body signature verification.
- Sessions are DB-backed random tokens in an httpOnly cookie (no JWT); passwords use scrypt.
- Play tracking (`POST /tracks/:id/play`) writes play history + increments play count + credits artist `stream_balance`/`total_earnings` at `PLAY_RATE`; self-plays excluded.
- The API serves the built SPA in production (SPA fallback for non-`/api`, non-`/uploads` paths); Vite proxies in dev.

## Gotchas

- Multipart form booleans arrive as strings — routes use a `boolish` preprocess (plain `z.coerce.boolean()` turns `"false"` into `true`).
- After editing `lib/db` schema, run `pnpm run typecheck:libs` (tsc --build) or api-server sees stale types; then `pnpm --filter @workspace/db run push`.
- `mockup-sandbox` is scaffold-only (not part of the app); its vite config defaults PORT/BASE_PATH so `pnpm run build` passes.
- Seeded demo audio is generated WAV; SVG text content must be XML-escaped (seed does this).

## User preferences

- Build everything fully functional first; env keys (Stripe/OpenAI/email) provided later — never block on them.
- Test everything after building; fix bugs immediately.
- Wants at-a-glance progress checklists (see BUILD_CHECKLIST.md).
