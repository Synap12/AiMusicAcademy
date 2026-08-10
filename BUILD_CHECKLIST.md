# ✅ AI Music Academy — Build Checklist & Progress

**Status: COMPLETE — all features built and tested (82/82 automated end-to-end tests passing)**

Built as a real full-stack web app (React + Express + PostgreSQL), replacing the Bubble.io platform from the blueprint. Every page, button, and backend workflow from the blueprint is implemented and functional.

**Demo accounts** (seeded, ready to use):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@aimusic.academy` | `admin1234` |
| Artist (Pro, 3 merch slots) | `nova@demo.com` | `demo1234` |
| Artist (Basic, 1 merch slot) | `synthlord@demo.com` | `demo1234` |
| Listener | `listener@demo.com` | `demo1234` |

---

## 1. Foundation

- [x] PostgreSQL database (14 tables, all blueprint data types + sessions/password resets)
- [x] Express 5 API server (60+ endpoints, zod validation, central error handling)
- [x] React SPA (26 pages, dark cyan/purple design system per blueprint)
- [x] File uploads (audio + images, stored under `/uploads`)
- [x] Run button starts API (port 3001) + web dev server (port 5000, proxied)
- [x] Deployment config: single server serves API + built frontend + uploads

## 2. Auth & Access Control

- [x] Signup with role selector (Artist / Listener), uppercase `user_type` enforced
- [x] Login with role-based redirect (admin → admin panel, artist → dashboard, listener → browse)
- [x] Logout, session cookies (httpOnly, 30-day)
- [x] Forgot password + reset flow (dev reset link shown until email provider is added)
- [x] Change password (verifies current password, revokes reset tokens)
- [x] Banned users: login blocked, sessions destroyed on ban
- [x] Route guards client-side + role middleware server-side (listener/artist/admin/onboarded)
- [x] Server-side data protection mirroring the blueprint's privacy rules (own-data access, public-fields-only for others, admin override)

## 3. Subscriptions (Stripe-ready with demo mode)

- [x] 4 plans: Listener Basic $6.99 / Listener Pro $14.99 / Artist Basic $49.99 / Artist Pro $99.99
- [x] Plan selection page (shows only plans for your role)
- [x] Checkout → success page polling `has_onboarded` → auto-redirect (exact blueprint flow)
- [x] **Demo mode**: works fully with no Stripe keys (instant mock checkout)
- [x] **Stripe mode (activates when keys are added)**: Payment Links with `client_reference_id`, webhook endpoint with signature verification handling `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`
- [x] Manage Subscription → Stripe Customer Portal (or built-in cancel dialog in demo mode)
- [x] Cancel / past-due status handling

## 4. Music (Listener)

- [x] Browse Music: search (tracks/artists/genres), genre filter tabs, responsive card grid
- [x] Persistent bottom music player: play/pause, prev/next, seek bar, volume, like — **actually plays audio** (seeded tracks include generated demo audio)
- [x] Play tracking → play count + artist earnings ledger ($0.004/play)
- [x] **Play-counting rules**: only the first 10 plays per listener per day count toward play counts/earnings (silent — streaming never blocked, resets midnight UTC); a play counts only after 50% of the track is heard; artists never earn from self-plays
- [x] Like / unlike tracks
- [x] My Library: stats (liked count, following count, listen time), Liked Songs tab, Following tab, empty states
- [x] Follow / unfollow artists
- [x] Public artist profile: cover, bio, social links, Play All, track list, merch grid, recent posts, follower count

## 5. Merch

- [x] Browse Merch: category filters, product cards, Buy Now → external store (new tab, zero commission)
- [x] Artist merch manager: add/edit/delete products, image upload, category, price, buy link
- [x] Active-slot limits enforced (1 for Basic, 3 for Pro) with upgrade prompt
- [x] Show/Hide visibility toggle respecting slot limits

## 6. Community

- [x] Compose posts: text + optional image + optional track attachment
- [x] Feed with role-colored avatars (cyan listener / purple artist), timestamps
- [x] Like, comment (threaded panel), edit/delete own posts & comments
- [x] Report posts → moderation queue
- [x] Profanity filter: PurgoMalum API + custom Banned_Word list (verified blocking)
- [x] Attached tracks playable from the feed

## 7. Artist Dashboard

- [x] Dashboard: 4 stat cards (tracks, plays, stream earnings, all-time revenue), recent play activity, embedded withdrawal history
- [x] Request Withdrawal (balance-capped, one pending at a time)
- [x] Analytics: 7/30/90-day/all-time ranges, plays/listeners/revenue/avg listen time, daily plays chart, top 5 tracks, revenue breakdown, new vs returning listeners
- [x] Upload Audio: audio file, cover art, genre, release date, publish toggle, auto-duration detection
- [x] My Releases: search, sort (newest/oldest/plays/A-Z/Z-A), edit popup, delete confirmation, publish/draft toggle, play from list
- [x] AI Cover Art studio: prompt + 6 style presets, gallery, download, delete, assign-to-track — **works now** with a local generator; automatically upgrades to OpenAI `gpt-image-1` when an API key is added
- [x] Artist profile: avatar + cover image upload, bio, social links, payout method

## 8. Admin Panel

- [x] Dashboard: user metrics (total/active listeners/active artists/free), MRR hero card + per-tier revenue breakdown, content metrics
- [x] User Management: search, type filter, USER/TYPE/PLAN/STATUS table with colored badges, ban/unban toggle (admins protected)
- [x] Moderation Queue: pending reports with post preview, reporter + reason, Dismiss (keep post) / Delete Post (cascades report resolution)
- [x] Payouts: total payable, pending withdrawal requests, artists with balances, Mark as Paid (resets balance + settles requests), payment history
- [x] Banned-word management API (add/remove filter terms)

## 9. Testing (82/82 passing)

- [x] Auth: signup, login (all 4 roles), wrong password, session lifecycle, logout
- [x] Password reset end-to-end (token → new password → login)
- [x] Role gates: listener blocked from artist/admin APIs, artist blocked from admin
- [x] Subscription flow: plan role-matching, mock checkout, onboarding gate
- [x] Tracks: browse/search/filter, upload (multipart), edit, delete, ownership checks, draft hidden from browse
- [x] Plays credited to artist ledger; likes; library; follows
- [x] Merch: slot-limit enforcement (found & fixed a form-boolean coercion bug), CRUD
- [x] Community: post/comment/like/edit/report, profanity blocking (both filter layers)
- [x] Artist: dashboard, analytics ranges, withdrawal limits & duplicates, cover art generate/assign/delete
- [x] Admin: metrics, user search/ban/unban (banned login blocked), moderation dismiss/delete cascade, payouts mark-paid, banned words
- [x] Stripe webhook event processing
- [x] Browser verification: landing page, login flow, browse grid, community feed rendered & screenshot-checked (found & fixed an SVG escaping bug)

## 10. Waiting on you (later — as agreed)

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, payment link + price env vars → real billing
- [ ] `OPENAI_API_KEY` → real AI cover art generation
- [ ] Email provider → reset links via email instead of on-screen dev link

---

**Bugs found during testing & fixed immediately:**
1. Multipart form booleans (`"false"` string) coerced to `true` — broke merch slot limits & draft uploads. Fixed with proper boolean parsing.
2. Unescaped `&` in seeded SVG cover art made "Coffee & Code" cover fail to render. Fixed generator + repaired existing files.
3. Stale drizzle type declarations and a Stripe response typing error caught by typecheck. Fixed.
