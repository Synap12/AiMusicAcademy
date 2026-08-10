/**
 * Seeds the AI Music Academy database with demo accounts, playable tracks,
 * merch, community posts, and play history so every feature is testable.
 *
 * Run: pnpm --filter @workspace/scripts run seed
 * Idempotent: skips seeding if the admin account already exists.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  db,
  pool,
  usersTable,
  tracksTable,
  merchProductsTable,
  postsTable,
  commentsTable,
  postLikesTable,
  likedTracksTable,
  followingsTable,
  playHistoryTable,
  bannedWordsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const UPLOADS = path.join(ROOT, "uploads");
fs.mkdirSync(path.join(UPLOADS, "audio"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS, "images"), { recursive: true });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384 }).toString("hex");
  return `${salt}:${derived}`;
}

// ---- WAV synthesis: short melodic loops so the player is actually usable ----

const SAMPLE_RATE = 22050;

function note(n: number): number {
  return 220 * Math.pow(2, n / 12);
}

function synthWav(pattern: number[], seconds: number, wobble: number): Buffer {
  const total = SAMPLE_RATE * seconds;
  const data = Buffer.alloc(total * 2);
  const noteLen = Math.floor(total / pattern.length);
  for (let i = 0; i < total; i++) {
    const idx = Math.min(Math.floor(i / noteLen), pattern.length - 1);
    const freq = note(pattern[idx]);
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, ((i % noteLen) / 400) || 0.01) * (1 - (i % noteLen) / noteLen) ** 0.35;
    const s =
      Math.sin(2 * Math.PI * freq * t) * 0.5 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.18 +
      Math.sin(2 * Math.PI * (freq / 2) * t + wobble * Math.sin(2 * Math.PI * 0.5 * t)) * 0.22;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(s * env * 22000))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function coverSvg(rawTitle: string, c1: string, c2: string): Buffer {
  const title = rawTitle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="600" height="600" fill="#0a0a0a"/>
  <circle cx="440" cy="150" r="200" fill="${c1}" opacity="0.25"/>
  <circle cx="140" cy="470" r="240" fill="${c2}" opacity="0.25"/>
  <rect width="600" height="600" fill="url(#g)" opacity="0.35"/>
  <text x="40" y="520" font-family="Arial" font-size="40" font-weight="bold" fill="#fff">${title}</text>
  <text x="40" y="560" font-family="Arial" font-size="18" fill="#fff" opacity="0.6">AI MUSIC ACADEMY</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

function saveUpload(sub: "audio" | "images", name: string, buf: Buffer): string {
  fs.writeFileSync(path.join(UPLOADS, sub, name), buf);
  return `/uploads/${sub}/${name}`;
}

async function main() {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "admin@aimusic.academy"))
    .limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped: admin@aimusic.academy already exists.");
    return;
  }

  console.log("Seeding users…");
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: "admin@aimusic.academy",
      passwordHash: hashPassword("admin1234"),
      artistName: "Platform Admin",
      userType: "LISTENER",
      isAdmin: true,
      hasOnboarded: true,
      subscriptionStatus: "active",
      subscriptionPlan: "listener_pro",
    })
    .returning();

  const [nova] = await db
    .insert(usersTable)
    .values({
      email: "nova@demo.com",
      passwordHash: hashPassword("demo1234"),
      artistName: "Nova Circuit",
      bio: "Synthwave dreams generated at 3am. Every track is a conversation between me and the machine.",
      userType: "ARTIST",
      hasOnboarded: true,
      subscriptionStatus: "active",
      subscriptionPlan: "artist_pro",
      socialLinks: "https://x.com/novacircuit https://instagram.com/novacircuit",
      payoutMethod: "PayPal: nova@demo.com",
    })
    .returning();

  const [synth] = await db
    .insert(usersTable)
    .values({
      email: "synthlord@demo.com",
      passwordHash: hashPassword("demo1234"),
      artistName: "SynthLord",
      bio: "Lo-fi AI beats for late-night coding sessions.",
      userType: "ARTIST",
      hasOnboarded: true,
      subscriptionStatus: "active",
      subscriptionPlan: "artist_basic",
      payoutMethod: "Venmo: @synthlord",
    })
    .returning();

  const [maya] = await db
    .insert(usersTable)
    .values({
      email: "listener@demo.com",
      passwordHash: hashPassword("demo1234"),
      artistName: "Maya R.",
      bio: "Always hunting for the next great AI track.",
      userType: "LISTENER",
      hasOnboarded: true,
      subscriptionStatus: "active",
      subscriptionPlan: "listener_basic",
    })
    .returning();

  console.log("Generating demo audio + covers…");
  const trackDefs = [
    { name: "Midnight Circuit", artist: nova, genre: "Electronic", pattern: [0, 3, 7, 10, 7, 3, 0, -2], colors: ["#00D4FF", "#B537FF"], wobble: 3 },
    { name: "Neon Rain", artist: nova, genre: "Ambient", pattern: [0, 5, 3, 8, 7, 12, 10, 5], colors: ["#B537FF", "#FF71CE"], wobble: 1.4 },
    { name: "Ghost Protocol", artist: nova, genre: "Electronic", pattern: [-5, 0, 2, 7, 5, 2, 0, -5], colors: ["#00FF88", "#00D4FF"], wobble: 5 },
    { name: "Coffee & Code", artist: synth, genre: "Lo-Fi", pattern: [0, 4, 7, 11, 9, 7, 4, 2], colors: ["#FFA500", "#FF4444"], wobble: 0.8 },
    { name: "3AM Compile", artist: synth, genre: "Lo-Fi", pattern: [-2, 2, 5, 9, 7, 5, 2, -2], colors: ["#B537FF", "#00D4FF"], wobble: 1 },
    { name: "Server Room Jazz", artist: synth, genre: "Jazz", pattern: [0, 4, 6, 11, 14, 11, 6, 4], colors: ["#00D4FF", "#00FF88"], wobble: 2.2 },
  ];

  const tracks = [];
  for (const [i, def] of trackDefs.entries()) {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const seconds = 12;
    const audioUrl = saveUpload("audio", `demo-${slug}.wav`, synthWav(def.pattern, seconds, def.wobble));
    const coverUrl = saveUpload("images", `demo-${slug}.svg`, coverSvg(def.name, def.colors[0], def.colors[1]));
    const [track] = await db
      .insert(tracksTable)
      .values({
        trackName: def.name,
        artistId: def.artist.id,
        audioFile: audioUrl,
        coverArt: coverUrl,
        genre: def.genre,
        isPublished: true,
        durationSeconds: seconds,
        releaseDate: new Date(Date.now() - (trackDefs.length - i) * 5 * 86400_000),
      })
      .returning();
    tracks.push(track);
  }

  console.log("Seeding merch…");
  await db.insert(merchProductsTable).values([
    {
      productName: "Neon Circuit Tee",
      artistId: nova.id,
      description: "Glow-in-the-dark circuit board print on premium black cotton.",
      category: "t-shirt",
      price: 29.99,
      buyLink: "https://www.printful.com/custom/mens/t-shirts",
      isActive: true,
      productImage: saveUpload("images", "demo-merch-tee.svg", coverSvg("Neon Tee", "#00D4FF", "#B537FF")),
    },
    {
      productName: "Midnight Hoodie",
      artistId: nova.id,
      description: "Heavyweight hoodie with embroidered Nova Circuit logo.",
      category: "hoodie",
      price: 54.99,
      buyLink: "https://www.printful.com/custom/mens/hoodies",
      isActive: true,
      productImage: saveUpload("images", "demo-merch-hoodie.svg", coverSvg("Hoodie", "#B537FF", "#0a0a5a")),
    },
    {
      productName: "Lo-Fi Beanie",
      artistId: synth.id,
      description: "Cozy knit beanie for late-night sessions.",
      category: "accessories",
      price: 19.99,
      buyLink: "https://www.etsy.com/",
      isActive: true,
      productImage: saveUpload("images", "demo-merch-beanie.svg", coverSvg("Beanie", "#FFA500", "#FF4444")),
    },
  ]);

  console.log("Seeding community…");
  const [post1] = await db
    .insert(postsTable)
    .values({
      authorId: nova.id,
      content:
        "Just dropped 'Midnight Circuit' — my most ambitious generation yet. 40+ prompt iterations to get that bass line right. Give it a spin! 🎧",
      trackId: tracks[0].id,
      likeCount: 2,
    })
    .returning();
  const [post2] = await db
    .insert(postsTable)
    .values({
      authorId: maya.id,
      content: "The Lo-Fi section on this platform is criminally underrated. Coffee & Code has been on repeat all week.",
      likeCount: 1,
    })
    .returning();
  await db.insert(postsTable).values({
    authorId: synth.id,
    content: "Working on a full album of server room field recordings blended with AI jazz. Sneak peek soon 👀",
    likeCount: 0,
  });
  await db.insert(commentsTable).values([
    { postId: post1.id, commenterId: maya.id, content: "That bass line is unreal. Instant like!" },
    { postId: post1.id, commenterId: synth.id, content: "Teach me your prompt ways 🙏" },
    { postId: post2.id, commenterId: synth.id, content: "Appreciate you! More lo-fi coming this month." },
  ]);
  await db.insert(postLikesTable).values([
    { postId: post1.id, userId: maya.id },
    { postId: post1.id, userId: synth.id },
    { postId: post2.id, userId: nova.id },
  ]);

  console.log("Seeding follows, likes, and play history…");
  await db.insert(followingsTable).values([
    { followerId: maya.id, artistId: nova.id },
    { followerId: maya.id, artistId: synth.id },
    { followerId: synth.id, artistId: nova.id },
  ]);
  await db.insert(likedTracksTable).values([
    { listenerId: maya.id, trackId: tracks[0].id },
    { listenerId: maya.id, trackId: tracks[3].id },
    { listenerId: admin.id, trackId: tracks[0].id },
  ]);

  const PLAY_RATE = 0.004;
  const playCounts = [42, 28, 17, 55, 23, 11];
  for (const [i, track] of tracks.entries()) {
    const listeners = [maya.id, admin.id, nova.id === track.artistId ? synth.id : nova.id];
    const rows = Array.from({ length: playCounts[i] }, (_, j) => ({
      listenerId: listeners[j % listeners.length],
      trackId: track.id,
      playedAt: new Date(Date.now() - Math.floor((j / playCounts[i]) * 29 + 0.5) * 86400_000 - (j % 7) * 3600_000),
    }));
    await db.insert(playHistoryTable).values(rows);
    await db
      .update(tracksTable)
      .set({ playCount: playCounts[i] })
      .where(eq(tracksTable.id, track.id));
    await db
      .update(usersTable)
      .set({
        streamBalance: sql`${usersTable.streamBalance} + ${playCounts[i] * PLAY_RATE}`,
        totalEarnings: sql`${usersTable.totalEarnings} + ${playCounts[i] * PLAY_RATE}`,
      })
      .where(eq(usersTable.id, track.artistId));
  }

  console.log("Seeding banned words…");
  await db
    .insert(bannedWordsTable)
    .values([{ word: "badword" }, { word: "slur1" }, { word: "spamlink" }])
    .onConflictDoNothing();

  console.log(`
Seed complete ✓

Demo accounts (password for all: demo1234, admin: admin1234)
  Admin     admin@aimusic.academy / admin1234
  Artist    nova@demo.com         (Artist Pro, 3 merch slots)
  Artist    synthlord@demo.com    (Artist Basic, 1 merch slot)
  Listener  listener@demo.com     (Listener Basic)
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
