#!/bin/bash
# End-to-end smoke test for AI Music Academy API
B="http://localhost:5000/api"
EMAIL="e2e-$(date +%s)@example.com"
T="$(mktemp -d)"
PASS=0; FAIL=0
ck() { # ck <name> <expected-substr-or-code> <actual>
  if echo "$3" | grep -q "$2"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $1 — expected [$2] got: $(echo "$3" | head -c 300)"; fi
}
jget() { curl -s -b "$1" "$B$2"; }
jpost() { curl -s -b "$1" -X POST -H 'Content-Type: application/json' -d "$3" "$B$2"; }
jpatch() { curl -s -b "$1" -X PATCH -H 'Content-Type: application/json' -d "$3" "$B$2"; }
jdel() { curl -s -b "$1" -X DELETE "$B$2"; }

LIS="$T/lis.ck"; ART="$T/art.ck"; ADM="$T/adm.ck"; NEW="$T/new.ck"; SYN="$T/syn.ck"

# ---------- auth ----------
r=$(curl -s -c "$LIS" -X POST -H 'Content-Type: application/json' -d '{"email":"listener@demo.com","password":"demo1234"}' "$B/auth/login"); ck "login listener" '"userType":"LISTENER"' "$r"
r=$(curl -s -c "$ART" -X POST -H 'Content-Type: application/json' -d '{"email":"nova@demo.com","password":"demo1234"}' "$B/auth/login"); ck "login artist" '"userType":"ARTIST"' "$r"
r=$(curl -s -c "$SYN" -X POST -H 'Content-Type: application/json' -d '{"email":"synthlord@demo.com","password":"demo1234"}' "$B/auth/login"); ck "login artist2" 'SynthLord' "$r"
r=$(curl -s -c "$ADM" -X POST -H 'Content-Type: application/json' -d '{"email":"admin@aimusic.academy","password":"admin1234"}' "$B/auth/login"); ck "login admin" '"isAdmin":true' "$r"
r=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"email":"listener@demo.com","password":"wrong"}' "$B/auth/login"); ck "bad password rejected" 'Invalid email or password' "$r"
r=$(jget "$LIS" /auth/me); ck "auth/me" 'listener@demo.com' "$r"
r=$(curl -s "$B/auth/me"); ck "unauthenticated 401" 'Not logged in' "$r"

# signup + mock subscription flow
r=$(curl -s -c "$NEW" -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"password123\",\"userType\":\"ARTIST\",\"artistName\":\"E2E Tester\"}" "$B/auth/signup"); ck "signup" '"hasOnboarded":false' "$r"
r=$(jpost "$NEW" /subscriptions/checkout '{"plan":"listener_basic"}'); ck "wrong-role plan rejected" 'for listener' "$r"
r=$(jpost "$NEW" /subscriptions/checkout '{"plan":"artist_basic"}'); ck "checkout mock mode" '"mock":true' "$r"
r=$(jget "$NEW" /tracks); ck "not-onboarded gated" 'Subscription required' "$r"
r=$(jpost "$NEW" /subscriptions/mock-complete ''); ck "mock-complete onboards" '"hasOnboarded":true' "$r"
r=$(jget "$NEW" /tracks); ck "onboarded can browse" '"tracks"' "$r"

# forgot/reset password
r=$(jpost "" /auth/forgot-password "{\"email\":\"$EMAIL\"}"); ck "forgot password" 'devResetToken' "$r"
TOKEN=$(echo "$r" | sed 's/.*"devResetToken":"\([^"]*\)".*/\1/')
r=$(jpost "" /auth/reset-password "{\"token\":\"$TOKEN\",\"password\":\"newpassword1\"}"); ck "reset password" '"ok":true' "$r"
r=$(curl -s -c "$NEW" -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"newpassword1\"}" "$B/auth/login"); ck "login with new password" 'E2E Tester' "$r"
r=$(jpost "$NEW" /subscriptions/mock-complete ''); : # re-onboard after reset (sessions were revoked, plan retained)

# ---------- role gates ----------
r=$(jget "$LIS" /artist/dashboard); ck "listener blocked from artist API" 'Artist account required' "$r"
r=$(jget "$LIS" /admin/metrics); ck "listener blocked from admin API" 'Admin access required' "$r"
r=$(jget "$ART" /admin/users); ck "artist blocked from admin API" 'Admin access required' "$r"

# ---------- tracks ----------
r=$(jget "$LIS" /tracks); ck "browse tracks" 'Midnight Circuit' "$r"
r=$(jget "$LIS" "/tracks?genre=Lo-Fi"); ck "genre filter" 'Coffee' "$r"
r=$(jget "$LIS" "/tracks?search=nova"); ck "search by artist" 'Nova Circuit' "$r"
r=$(jget "$LIS" /genres); ck "genres list" 'Jazz' "$r"
TRACK_ID=$(jget "$LIS" /tracks | sed 's/.*"tracks":\[{"id":\([0-9]*\).*/\1/')
r=$(jpost "$LIS" "/tracks/$TRACK_ID/play" ''); ck "record play" '"ok":true' "$r"
r=$(jpost "$LIS" "/tracks/$TRACK_ID/like" ''); ck "like track" '"likedByMe":true' "$r"
r=$(jget "$LIS" /library); ck "library shows like" '"likedTracks"' "$r"
r=$(jdel "$LIS" "/tracks/$TRACK_ID/like"); ck "unlike track" '"likedByMe":false' "$r"

# artist upload (multipart)
r=$(curl -s -b "$ART" -F "trackName=Smoke Test Track" -F "genre=Electronic" -F "isPublished=true" -F "durationSeconds=12" -F "audio=@/home/runner/workspace/uploads/audio/demo-midnight-circuit.wav;type=audio/wav" "$B/tracks"); ck "upload track" 'Smoke Test Track' "$r"
NEW_TRACK=$(echo "$r" | sed 's/.*"track":{"id":\([0-9]*\).*/\1/')
r=$(jpatch "$ART" "/tracks/$NEW_TRACK" '{"trackName":"Smoke Test Renamed","isPublished":false}'); ck "edit track" 'Smoke Test Renamed' "$r"
r=$(jget "$LIS" "/tracks?search=smoke"); ck "unpublished hidden from browse" '"tracks":\[\]' "$r"
r=$(jpatch "$SYN" "/tracks/$NEW_TRACK" '{"trackName":"hijack"}'); ck "cannot edit others track" 'not found' "$r"
r=$(jdel "$ART" "/tracks/$NEW_TRACK"); ck "delete track" '"ok":true' "$r"

# ---------- follows + public profile ----------
NOVA_ID=$(jget "$LIS" "/tracks?search=nova" | sed 's/.*"artistId":\([0-9]*\).*/\1/')
r=$(jpost "$LIS" "/users/$NOVA_ID/follow" ''); ck "follow artist" '"isFollowing":true' "$r"
r=$(jget "$LIS" "/users/$NOVA_ID"); ck "public artist profile" '"followerCount"' "$r"
r=$(jdel "$LIS" "/users/$NOVA_ID/follow"); ck "unfollow" '"isFollowing":false' "$r"

# ---------- merch ----------
r=$(jget "$LIS" /merch); ck "browse merch" 'Neon Circuit Tee' "$r"
r=$(jget "$LIS" "/merch?category=hoodie"); ck "merch category filter" 'Midnight Hoodie' "$r"
r=$(jget "$SYN" /merch/mine); ck "merch slots reported" '"slotLimit":1' "$r"
# synthlord (basic, 1 slot, 1 active) tries to activate a second product
r=$(curl -s -b "$SYN" -F "productName=Second Item" -F "category=accessories" -F "price=9.99" -F "buyLink=https://example.com/x" -F "isActive=true" "$B/merch"); ck "slot limit enforced" 'allows 1 active merch slot' "$r"
r=$(curl -s -b "$SYN" -F "productName=Second Item" -F "category=accessories" -F "price=9.99" -F "buyLink=https://example.com/x" -F "isActive=false" "$B/merch"); ck "inactive product allowed" 'Second Item' "$r"
PROD_ID=$(echo "$r" | sed 's/.*"product":{"id":\([0-9]*\).*/\1/')
r=$(jpatch "$SYN" "/merch/$PROD_ID" '{"isActive":true}'); ck "activate over limit blocked" 'allows 1 active merch slot' "$r"
r=$(jpatch "$SYN" "/merch/$PROD_ID" '{"price":12.5}'); ck "edit merch" '12.5' "$r"
r=$(jdel "$SYN" "/merch/$PROD_ID"); ck "delete merch" '"ok":true' "$r"

# ---------- community ----------
r=$(jpost "$LIS" /posts '{"content":"Smoke test post — loving the platform!"}'); ck "create post" 'Smoke test post' "$r"
POST_ID=$(echo "$r" | sed 's/.*"post":{"id":\([0-9]*\).*/\1/')
r=$(jpost "$LIS" /posts '{"content":"this contains badword here"}'); ck "profanity blocked" "isn't allowed" "$r"
r=$(jpost "$ART" "/posts/$POST_ID/like" ''); ck "like post" '"likedByMe":true' "$r"
r=$(jpost "$ART" "/posts/$POST_ID/comments" '{"content":"Nice one!"}'); ck "comment" 'Nice one' "$r"
r=$(jpatch "$LIS" "/posts/$POST_ID" '{"content":"Smoke test post (edited)"}'); ck "edit own post" 'edited' "$r"
r=$(jpatch "$ART" "/posts/$POST_ID" '{"content":"hijack"}'); ck "cannot edit others post" 'not found' "$r"
r=$(jpost "$ART" "/posts/$POST_ID/report" '{"reason":"Testing the moderation queue"}'); ck "report post" '"ok":true' "$r"

# ---------- artist dashboard/analytics/withdrawals/cover art ----------
r=$(jget "$ART" /artist/dashboard); ck "artist dashboard" '"totalTracks"' "$r"
r=$(jget "$ART" "/artist/analytics?range=30"); ck "analytics 30d" '"topTracks"' "$r"
r=$(jget "$ART" "/artist/analytics?range=all"); ck "analytics all" '"revenue"' "$r"
# fund nova's balance with a fresh payer account (seeded accounts may have
# used their 10 counted plays for the day)
PAYER="$T/payer.ck"
curl -s -c "$PAYER" -X POST -H 'Content-Type: application/json' -d "{\"email\":\"payer-$(date +%s%N)@example.com\",\"password\":\"password123\",\"userType\":\"LISTENER\",\"artistName\":\"Payer\"}" "$B/auth/signup" >/dev/null
jpost "$PAYER" /subscriptions/checkout '{"plan":"listener_basic"}' >/dev/null
jpost "$PAYER" /subscriptions/mock-complete '' >/dev/null
NOVA_TRACK=$(jget "$LIS" "/tracks?search=nova" | sed 's/.*"tracks":\[{"id":\([0-9]*\).*/\1/')
for i in 1 2 3 4; do jpost "$PAYER" "/tracks/$NOVA_TRACK/play" '' >/dev/null; done
# daily cap: 6 more plays exhaust the quota of 10; the 11th must be uncounted
for i in 1 2 3 4 5 6; do jpost "$PAYER" "/tracks/$NOVA_TRACK/play" '' >/dev/null; done
r=$(jpost "$PAYER" "/tracks/$NOVA_TRACK/play" ''); ck "11th daily play uncounted" '"counted":false' "$r"
r=$(jpost "$ART" /artist/withdrawals '{"amount":99999}'); ck "over-balance withdrawal blocked" 'withdraw up to' "$r"
r=$(jpost "$ART" /artist/withdrawals '{"amount":0.01}'); ck "withdrawal request" '"status":"pending"' "$r"
r=$(jpost "$ART" /artist/withdrawals '{"amount":0.01}'); ck "duplicate withdrawal blocked" 'pending withdrawal' "$r"
r=$(jpost "$ART" /artist/cover-art '{"prompt":"neon city at midnight","style":"cyberpunk"}'); ck "generate cover art" '"generator":"placeholder"' "$r"
ART_ID=$(echo "$r" | sed 's/.*"art":{"id":\([0-9]*\).*/\1/')
r=$(jget "$ART" /artist/cover-art); ck "cover art gallery" 'neon city' "$r"
FIRST_TRACK=$(jget "$ART" /tracks/mine | sed 's/.*"tracks":\[{"id":\([0-9]*\).*/\1/')
r=$(jpost "$ART" "/artist/cover-art/$ART_ID/assign" "{\"trackId\":$FIRST_TRACK}"); ck "assign cover to track" '"coverArt"' "$r"
r=$(jdel "$ART" "/artist/cover-art/$ART_ID"); ck "delete cover art" '"ok":true' "$r"

# ---------- profile ----------
r=$(jpatch "$LIS" /users/me '{"bio":"Updated bio from smoke test"}'); ck "update profile" 'Updated bio' "$r"
r=$(jpost "$LIS" /users/me/password '{"currentPassword":"demo1234","newPassword":"demo12345"}'); ck "change password" '"ok":true' "$r"
r=$(jpost "$LIS" /users/me/password '{"currentPassword":"demo12345","newPassword":"demo1234"}'); ck "restore password" '"ok":true' "$r"
r=$(jpost "$LIS" /subscriptions/portal ''); ck "portal mock" '"mock":true' "$r"

# ---------- admin ----------
r=$(jget "$ADM" /admin/metrics); ck "admin metrics" '"mrr"' "$r"
r=$(jget "$ADM" "/admin/users?search=nova"); ck "admin user search" 'nova@demo.com' "$r"
r=$(jget "$ADM" "/admin/users?type=ARTIST"); ck "admin type filter" 'SynthLord' "$r"
E2E_ID=$(jget "$ADM" "/admin/users?search=$EMAIL" | sed 's/.*"id":\([0-9]*\).*/\1/')
r=$(jpost "$ADM" "/admin/users/$E2E_ID/ban" ''); ck "ban user" '"isBanned":true' "$r"
r=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"newpassword1\"}" "$B/auth/login"); ck "banned login blocked" 'banned' "$r"
r=$(jpost "$ADM" "/admin/users/$E2E_ID/unban" ''); ck "unban user" '"isBanned":false' "$r"
r=$(jget "$ADM" /admin/reports); ck "moderation queue" 'Testing the moderation queue' "$r"
REPORT_ID=$(echo "$r" | sed 's/.*"reports":\[{"id":\([0-9]*\).*/\1/')
r=$(jdel "$ADM" "/admin/posts/$POST_ID"); ck "admin delete reported post" '"ok":true' "$r"
r=$(jget "$ADM" /admin/reports); ck "reports resolved after delete" '"reports":\[\]' "$r"
r=$(jget "$ADM" /admin/payouts); ck "payouts overview" '"totalPayable"' "$r"
r=$(jpost "$ADM" "/admin/payouts/$NOVA_ID/mark-paid" ''); ck "mark paid" '"ok":true' "$r"
r=$(jget "$ADM" /admin/payouts); ck "balance reset after payout" '"history":\[{' "$r"
r=$(jpost "$ADM" /admin/banned-words '{"word":"testbannedword"}'); ck "add banned word" 'testbannedword' "$r"
BW_ID=$(echo "$r" | sed 's/.*"id":\([0-9]*\).*/\1/')
r=$(jpost "$LIS" /posts '{"content":"post with testbannedword inside"}'); ck "new banned word filters" "isn't allowed" "$r"
r=$(jdel "$ADM" "/admin/banned-words/$BW_ID"); ck "remove banned word" '"ok":true' "$r"

# ---------- webhook (no secret set → processes unsigned events) ----------
r=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"type\":\"invoice.payment_failed\",\"data\":{\"object\":{\"customer\":\"mock_cus_none\"}}}" "$B/webhooks/stripe"); ck "stripe webhook accepts event" '"received":true' "$r"

# ---------- logout ----------
r=$(jpost "$LIS" /auth/logout ''); ck "logout" '"ok":true' "$r"
r=$(jget "$LIS" /auth/me); ck "session destroyed" 'Not logged in' "$r"

echo ""
echo "==================== RESULTS: $PASS passed, $FAIL failed ===================="
exit $FAIL
