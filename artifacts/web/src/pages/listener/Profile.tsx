import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiSend, apiForm, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Avatar, Modal, Spinner, StatusBadge } from "@/components/ui";
import { planLabel } from "@/lib/format";
import { Camera, LogOut } from "lucide-react";

/**
 * Shared account settings page (listener profile). Artists get extra fields on
 * their own artist profile page; this covers name/bio/avatar, password,
 * notifications, and subscription management.
 */
export default function Profile({ artistExtras }: { artistExtras?: boolean }) {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.artistName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [social, setSocial] = useState(user?.socialLinks ?? "");
  const [payout, setPayout] = useState(user?.payoutMethod ?? "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [portalOpen, setPortalOpen] = useState(false);
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const signOut = useMutation({
    mutationFn: () => apiSend("POST", "/auth/logout"),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate("/login");
    },
  });

  const saveProfile = useMutation({
    mutationFn: () =>
      apiSend("PATCH", "/users/me", {
        artistName: name,
        bio,
        ...(artistExtras ? { socialLinks: social, payoutMethod: payout } : {}),
      }),
    onSuccess: () => {
      refresh();
      toast("Profile saved");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Save failed", "error"),
  });

  const changePw = useMutation({
    mutationFn: () =>
      apiSend("POST", "/users/me/password", {
        currentPassword: pw.current,
        newPassword: pw.next,
      }),
    onSuccess: () => {
      setPw({ current: "", next: "", confirm: "" });
      toast("Password updated");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Update failed", "error"),
  });

  const uploadImage = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: "avatar" | "cover" }) => {
      const form = new FormData();
      form.set("image", file);
      return apiForm("POST", `/users/me/${kind}`, form);
    },
    onSuccess: () => {
      refresh();
      toast("Image updated");
    },
    onError: () => toast("Image upload failed", "error"),
  });

  const toggleNotify = useMutation({
    mutationFn: (patch: Record<string, boolean>) => apiSend("PATCH", "/users/me", patch),
    onSuccess: () => refresh(),
  });

  const portal = useMutation({
    mutationFn: () => apiSend("POST", "/subscriptions/portal"),
    onSuccess: (res) => {
      if (res.mock) setPortalOpen(true);
      else window.location.href = res.url;
    },
  });

  const cancelSub = useMutation({
    mutationFn: () => apiSend("POST", "/subscriptions/cancel"),
    onSuccess: () => {
      setPortalOpen(false);
      refresh();
      toast("Subscription canceled");
    },
  });

  if (!user) return <Spinner center />;

  return (
    <div className="max-w-5xl">
      <h1 className="text-[32px] font-bold gradient-text mb-6">My Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* left column: identity */}
      <div className="card">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            <Avatar
              src={user.profileImage}
              name={user.artistName}
              size={80}
              accent={user.userType === "ARTIST" ? "purple" : "cyan"}
            />
            <label className="absolute -bottom-1 -right-1 gradient-bg rounded-full w-8 h-8 flex items-center justify-center text-white cursor-pointer">
              <Camera size={14} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage.mutate({ file: f, kind: "avatar" });
                }}
              />
            </label>
          </div>
          <div>
            <p className="font-bold text-xl">{user.artistName}</p>
            <p className="text-txt2 text-sm">{user.email}</p>
            <div className="flex gap-2 mt-2">
              <StatusBadge status={user.userType} />
              <StatusBadge
                status={
                  user.isBanned
                    ? "BANNED"
                    : user.subscriptionStatus === "active"
                      ? "ACTIVE"
                      : (user.subscriptionStatus ?? "FREE").toUpperCase()
                }
              />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="textarea" value={bio} maxLength={2000} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself…" />
          </div>
          {artistExtras && (
            <>
              <div>
                <label className="label">Social links (one per line)</label>
                <textarea
                  className="textarea !min-h-[80px]"
                  value={social}
                  onChange={(e) => setSocial(e.target.value)}
                  placeholder={"https://x.com/yourname\nhttps://instagram.com/yourname"}
                />
              </div>
              <div>
                <label className="label">Payout method</label>
                <input
                  className="input"
                  value={payout}
                  onChange={(e) => setPayout(e.target.value)}
                  placeholder="e.g. PayPal: you@example.com"
                />
                <p className="text-txt3 text-xs mt-1.5">
                  Used by the platform team when processing your stream-earnings withdrawals.
                </p>
              </div>
            </>
          )}
          <button
            className="btn btn-primary"
            disabled={saveProfile.isPending || !name.trim()}
            onClick={() => saveProfile.mutate()}
          >
            {saveProfile.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* right column: account cards */}
      <div className="space-y-6">
      {/* password */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">Change Password</h2>
        <div className="space-y-4">
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="New password (8+ characters)"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Confirm new password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
          <button
            className="btn btn-secondary"
            disabled={
              !pw.current || pw.next.length < 8 || pw.next !== pw.confirm || changePw.isPending
            }
            onClick={() => changePw.mutate()}
          >
            Update Password
          </button>
          {pw.next && pw.confirm && pw.next !== pw.confirm && (
            <p className="text-red text-sm">Passwords don't match</p>
          )}
        </div>
      </div>

      {/* notifications */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">Notification Preferences</h2>
        {(
          [
            { key: "notifyNewFollower", label: "New followers", value: user.notifyNewFollower },
            { key: "notifyCommunity", label: "Community activity on my posts", value: user.notifyCommunity },
          ] as const
        ).map((n) => (
          <label key={n.key} className="flex items-center justify-between py-2.5 cursor-pointer">
            <span className="text-txt2">{n.label}</span>
            <input
              type="checkbox"
              checked={n.value}
              onChange={(e) => toggleNotify.mutate({ [n.key]: e.target.checked })}
              className="w-5 h-5 accent-[#00D4FF]"
            />
          </label>
        ))}
      </div>

      {/* subscription */}
      <div className="card">
        <h2 className="font-bold text-lg mb-2">Subscription</h2>
        <p className="text-txt2 text-sm mb-4">
          Current plan: <b className="text-txt">{planLabel(user.subscriptionPlan)}</b>
          {user.subscriptionStatus === "past_due" && (
            <span className="text-orange"> — payment past due</span>
          )}
        </p>
        <button className="btn btn-secondary" onClick={() => portal.mutate()} disabled={portal.isPending}>
          Manage Subscription
        </button>
      </div>

      {/* sign out */}
      <div className="card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg">Sign Out</h2>
          <p className="text-txt2 text-sm">End your session on this device.</p>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut size={16} /> {signOut.isPending ? "Signing out…" : "Sign Out"}
        </button>
      </div>
      </div>
      </div>

      <Modal open={portalOpen} onClose={() => setPortalOpen(false)} title="Manage subscription">
        <p className="text-txt2 text-sm mb-5">
          Stripe billing isn't connected yet, so card management and invoices are
          unavailable. You can still cancel your subscription below.
        </p>
        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={() => setPortalOpen(false)}>
            Keep Subscription
          </button>
          <button
            className="btn btn-danger flex-1"
            disabled={cancelSub.isPending}
            onClick={() => cancelSub.mutate()}
          >
            Cancel Subscription
          </button>
        </div>
      </Modal>
    </div>
  );
}
