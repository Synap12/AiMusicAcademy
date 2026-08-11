// End-to-end smoke test. Run against a live dev server:  node scripts/e2e.mjs
// Needs .env at the repo root (webhook signing) and the seeded demo accounts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import crypto from "node:crypto";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5000";
const RUN = Date.now().toString(36);
const env = Object.fromEntries(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../.env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

let pass = 0,
  fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name} ${detail}`);
  }
}

function session() {
  let cookie = "";
  return {
    async req(method, path, body, opts = {}) {
      const res = await fetch(BASE + path, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(opts.headers || {}),
        },
        body: body
          ? typeof body === "string"
            ? body
            : JSON.stringify(body)
          : undefined,
        redirect: "manual",
      });
      const sc = res.headers.getSetCookie?.() ?? [];
      if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
      let json = null;
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, json, text };
    },
  };
}

function signedWebhook(payload) {
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(`${t}.${body}`)
    .digest("hex");
  return { body, header: `t=${t},v1=${sig}` };
}

console.log("== 1. App serves frontend ==");
{
  const res = await fetch(BASE + "/");
  const html = await res.text();
  check("GET / returns 200 HTML", res.status === 200 && html.includes("<div id=\"root\""), String(res.status));
}

console.log("== 2. Signup & session ==");
const pro = session();
const basic = session();
let proId, basicId;
{
  let r = await pro.req("POST", "/api/auth/signup", {
    email: `e2e-pro-${RUN}@test.com`,
    password: "testpass123",
    userType: "LISTENER",
    artistName: `E2E Pro ${RUN}`,
  });
  check("pro signup 201", r.status === 201, JSON.stringify(r.json));
  proId = r.json?.user?.id;
  r = await basic.req("POST", "/api/auth/signup", {
    email: `e2e-basic-${RUN}@test.com`,
    password: "testpass123",
    userType: "LISTENER",
    artistName: `E2E Basic ${RUN}`,
  });
  check("basic signup 201", r.status === 201);
  basicId = r.json?.user?.id;
  r = await pro.req("GET", "/api/auth/me");
  check("session cookie works (/auth/me)", r.status === 200 && r.json?.user?.id === proId);
}

console.log("== 3. Stripe checkout flow ==");
{
  let r = await pro.req("GET", "/api/subscriptions/plans");
  check("stripeConfigured=true", r.json?.stripeConfigured === true);
  r = await pro.req("POST", "/api/subscriptions/checkout", { plan: "listener_pro" });
  check(
    "checkout returns real Stripe link",
    r.json?.mock === false &&
      r.json?.url?.startsWith("https://buy.stripe.com/") &&
      r.json?.url?.includes(`client_reference_id=${proId}`),
    JSON.stringify(r.json),
  );
  r = await pro.req("POST", "/api/subscriptions/checkout", { plan: "artist_pro" });
  check("role-mismatched plan rejected", r.status === 400);
  r = await pro.req("POST", "/api/subscriptions/mock-complete", {});
  check("mock checkout blocked when Stripe live", r.status === 400, String(r.status));
  await basic.req("POST", "/api/subscriptions/checkout", { plan: "listener_basic" });
}

console.log("== 4. Webhook security & activation ==");
{
  const evil = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { client_reference_id: proId } },
  });
  let res = await fetch(BASE + "/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: evil,
  });
  check("forged webhook rejected 400", res.status === 400, String(res.status));
  res = await fetch(BASE + "/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: evil,
  });
  check("unsigned webhook rejected 400", res.status === 400, String(res.status));

  for (const [id, cus, sub] of [
    [proId, `cus_e2e_pro_${RUN}`, `sub_e2e_pro_${RUN}`],
    [basicId, `cus_e2e_basic_${RUN}`, `sub_e2e_basic_${RUN}`],
  ]) {
    const { body, header } = signedWebhook({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: id, customer: cus, subscription: sub } },
    });
    res = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": header },
      body,
    });
    check(`signed checkout.session.completed accepted (user ${id})`, res.status === 200);
  }
  const r = await pro.req("GET", "/api/auth/me");
  check(
    "webhook activated subscription",
    r.json?.user?.subscriptionStatus === "active" && r.json?.user?.hasOnboarded === true,
    JSON.stringify(r.json?.user),
  );
}

console.log("== 5. HQ vs LQ streaming tiers ==");
let sampleTrack;
{
  const rp = await pro.req("GET", "/api/tracks");
  const rb = await basic.req("GET", "/api/tracks");
  check("browse returns tracks", (rp.json?.tracks?.length ?? 0) > 0);
  const proTracks = rp.json?.tracks ?? [];
  const basicTracks = rb.json?.tracks ?? [];
  const byId = new Map(basicTracks.map((t) => [t.id, t]));
  const diff = proTracks.find(
    (t) => byId.get(t.id) && byId.get(t.id).audioFile !== t.audioFile && byId.get(t.id).audioFile.includes("-lq"),
  );
  sampleTrack = diff ?? proTracks[0];
  check(
    "basic hears 128kbps rendition, pro hears HQ",
    !!diff,
    "no track served different renditions",
  );
  check("audioFileLq never leaks in API", !JSON.stringify(rp.json).includes("audioFileLq"));
}

console.log("== 6. Offline download gating ==");
{
  const rb = await basic.req("GET", `/api/tracks/${sampleTrack.id}/download`);
  check("basic listener blocked from download (403)", rb.status === 403, String(rb.status));
  const rp = await pro.req("GET", `/api/tracks/${sampleTrack.id}/download`);
  check(
    "pro listener downloads audio",
    rp.status === 200 && rp.text.length > 10000,
    `status=${rp.status} bytes=${rp.text.length}`,
  );
}

console.log("== 7. Play counting ==");
{
  const r = await pro.req("POST", `/api/tracks/${sampleTrack.id}/play`, {
    listenedSeconds: 9999,
  });
  check("play endpoint responds ok", r.status === 200 && r.json?.ok === true, JSON.stringify(r.json));
}

console.log("== 8. Support tickets & priority ==");
const admin = session();
{
  let r = await pro.req("POST", "/api/support", {
    subject: `E2E priority ${RUN}`,
    message: "Testing that pro tickets are flagged as priority.",
  });
  check("pro ticket created priority", r.status === 201 && r.json?.ticket?.isPriority === true, JSON.stringify(r.json));
  r = await basic.req("POST", "/api/support", {
    subject: `E2E normal ${RUN}`,
    message: "Testing that basic tickets are not priority.",
  });
  check("basic ticket not priority", r.status === 201 && r.json?.ticket?.isPriority === false);
  r = await admin.req("POST", "/api/auth/login", {
    email: "admin@aimusic.academy",
    password: "admin1234",
  });
  check("admin login", r.status === 200 && r.json?.user?.isAdmin === true);
  r = await admin.req("GET", "/api/admin/support");
  const tickets = r.json?.tickets ?? [];
  const mine = tickets.filter((t) => t.subject.endsWith(RUN));
  const openIdx = (s) => tickets.findIndex((t) => t.subject === s);
  check("admin sees both tickets", mine.length === 2);
  check(
    "priority ticket sorted first",
    openIdx(`E2E priority ${RUN}`) < openIdx(`E2E normal ${RUN}`),
  );
  const target = mine.find((t) => t.isPriority);
  r = await admin.req("PATCH", `/api/admin/support/${target.id}`, {
    status: "closed",
    reply: "Resolved by e2e test.",
  });
  check("admin reply-and-close", r.status === 200);
  r = await pro.req("GET", "/api/support/mine");
  const closed = (r.json?.tickets ?? []).find((t) => t.id === target.id);
  check(
    "user sees reply and closed status",
    closed?.status === "closed" && closed?.reply === "Resolved by e2e test.",
    JSON.stringify(closed),
  );
  check("basic user blocked from admin queue", (await basic.req("GET", "/api/admin/support")).status === 403);
}

console.log("== 9. Community & exclusive posts ==");
const artist = session();
let exclusivePostId;
{
  let r = await artist.req("POST", "/api/auth/login", {
    email: "nova@demo.com",
    password: "demo1234",
  });
  check("artist login", r.status === 200);
  r = await artist.req("POST", "/api/posts", {
    content: `E2E exclusive drop ${RUN}`,
    isExclusive: true,
  });
  check("artist creates exclusive post", r.status === 201, JSON.stringify(r.json));
  exclusivePostId = r.json?.post?.id;

  const feedPro = await pro.req("GET", "/api/posts");
  const feedBasic = await basic.req("GET", "/api/posts");
  const pPro = (feedPro.json?.posts ?? []).find((p) => p.id === exclusivePostId);
  const pBasic = (feedBasic.json?.posts ?? []).find((p) => p.id === exclusivePostId);
  check("pro sees exclusive content", pPro && pPro.locked === false && pPro.content.includes("E2E"), JSON.stringify(pPro));
  check("basic gets locked teaser (no content)", pBasic && pBasic.locked === true && pBasic.content === "", JSON.stringify(pBasic));
  r = await basic.req("POST", `/api/posts/${exclusivePostId}/comments`, { content: "can I see?" });
  check("basic blocked from commenting on exclusive", r.status === 403, String(r.status));
  r = await basic.req("POST", "/api/posts", { content: "this is shit lol" });
  check("profanity blocked", r.status === 400, String(r.status));
}

console.log("== 10. Playlists ==");
{
  let r = await pro.req("POST", "/api/playlists", { name: `Road Trip ${RUN}` });
  check("create playlist", r.status === 201 && r.json?.playlist?.name === `Road Trip ${RUN}`);
  const plId = r.json?.playlist?.id;

  const browse = await pro.req("GET", "/api/tracks");
  const all = browse.json?.tracks ?? [];
  if (all.length < 2) {
    check("playlist tests need 2+ seeded published tracks", false, `only ${all.length} found`);
  } else {
  // Reserve one of the logged-in artist's tracks for the unpublish test;
  // the playlist under test uses other tracks.
  const artistId = (await artist.req("GET", "/api/auth/me")).json?.user?.id;
  const novaTrack = all.find((t) => t.artist.id === artistId);
  const pool = all.filter((t) => t.id !== novaTrack?.id);
  const [t1, t2] = pool.length >= 2 ? pool : all;
  r = await pro.req("POST", `/api/playlists/${plId}/tracks`, { trackId: t1.id });
  check("add first track", r.status === 201 && r.json?.added === true);
  r = await pro.req("POST", `/api/playlists/${plId}/tracks`, { trackId: t2.id });
  check("add second track", r.status === 201);
  r = await pro.req("POST", `/api/playlists/${plId}/tracks`, { trackId: t1.id });
  check(
    "duplicate add reports added:false",
    r.status === 200 && r.json?.added === false,
    JSON.stringify(r.json),
  );
  check(
    "non-numeric playlist id is 404, not 500",
    (await pro.req("GET", "/api/playlists/abc")).status === 404,
  );

  // Unpublishing a track must hide it from playlists (and restore on republish).
  if (novaTrack && ![t1.id, t2.id].includes(novaTrack.id)) {
    await pro.req("POST", `/api/playlists/${plId}/tracks`, { trackId: novaTrack.id });
    await artist.req("PATCH", `/api/tracks/${novaTrack.id}`, { isPublished: false });
    const detail = await pro.req("GET", `/api/playlists/${plId}`);
    check(
      "unpublished track hidden from playlist",
      !(detail.json?.tracks ?? []).some((t) => t.id === novaTrack.id),
    );
    await artist.req("PATCH", `/api/tracks/${novaTrack.id}`, { isPublished: true });
    const detail2 = await pro.req("GET", `/api/playlists/${plId}`);
    check(
      "republished track reappears in playlist",
      (detail2.json?.tracks ?? []).some((t) => t.id === novaTrack.id),
    );
    await pro.req("DELETE", `/api/playlists/${plId}/tracks/${novaTrack.id}`);
  } else {
    console.log("  (skipping unpublish test — no spare Nova track)");
  }

  r = await pro.req("GET", `/api/playlists/${plId}`);
  const got = r.json?.tracks ?? [];
  check(
    "detail keeps order, ignores duplicate add",
    got.length === 2 && got[0].id === t1.id && got[1].id === t2.id,
    JSON.stringify(got.map((t) => t.id)),
  );
  r = await pro.req("GET", "/api/playlists");
  const mine = (r.json?.playlists ?? []).find((p) => p.id === plId);
  check("list shows track count", mine?.trackCount === 2, JSON.stringify(mine));

  check(
    "another user cannot see my playlist",
    (await artist.req("GET", `/api/playlists/${plId}`)).status === 404,
  );
  check(
    "another user cannot modify my playlist",
    (await artist.req("POST", `/api/playlists/${plId}/tracks`, { trackId: t1.id })).status === 404,
  );

  r = await pro.req("PATCH", `/api/playlists/${plId}`, { name: `Renamed ${RUN}` });
  check("rename playlist", r.status === 200 && r.json?.playlist?.name === `Renamed ${RUN}`);
  r = await pro.req("DELETE", `/api/playlists/${plId}/tracks/${t1.id}`);
  check("remove track", r.status === 200);
  r = await pro.req("GET", `/api/playlists/${plId}`);
  check("track removed from detail", (r.json?.tracks ?? []).length === 1);
  r = await pro.req("DELETE", `/api/playlists/${plId}`);
  check("delete playlist", r.status === 200);
  r = await pro.req("GET", `/api/playlists/${plId}`);
  check("deleted playlist is gone", r.status === 404);
  }
}

console.log("== 11. Subscription lifecycle webhooks ==");
{
  const { body, header } = signedWebhook({
    type: "customer.subscription.deleted",
    data: { object: { customer: `cus_e2e_basic_${RUN}` } },
  });
  const res = await fetch(BASE + "/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body,
  });
  check("subscription.deleted accepted", res.status === 200);
  const r = await basic.req("GET", "/api/auth/me");
  check(
    "canceled user loses access",
    r.json?.user?.subscriptionStatus === "canceled" && r.json?.user?.hasOnboarded === false,
    JSON.stringify(r.json?.user),
  );
  check("canceled user blocked from browse", (await basic.req("GET", "/api/tracks")).status === 403);
}

console.log("== cleanup ==");
{
  const r = await artist.req("DELETE", `/api/posts/${exclusivePostId}`);
  check("test post removed", r.status === 200 || r.status === 204, String(r.status));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
