import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { apiSend, ApiError } from "@/lib/api";
import { useAuth, homeFor } from "@/lib/auth";
import { AuthShell } from "./AuthShell";
import { Headphones, Mic2 } from "lucide-react";
import clsx from "clsx";

export default function Signup() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [userType, setUserType] = useState<"LISTENER" | "ARTIST">("LISTENER");
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect to={homeFor(user)} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiSend("POST", "/auth/signup", { email, password, userType, artistName });
      await refresh();
      navigate("/subscription_select");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Join AI Music Academy">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { type: "LISTENER", icon: <Headphones size={22} />, label: "Listener", desc: "Stream & discover" },
              { type: "ARTIST", icon: <Mic2 size={22} />, label: "Artist", desc: "Upload & earn" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setUserType(opt.type)}
              className={clsx(
                "card !p-4 text-left transition-all",
                userType === opt.type
                  ? opt.type === "ARTIST"
                    ? "!border-purple ring-2 ring-purple/30"
                    : "!border-cyan ring-2 ring-cyan/30"
                  : "hover:!border-txt3",
              )}
            >
              <div className={userType === opt.type ? (opt.type === "ARTIST" ? "text-purple" : "text-cyan") : "text-txt2"}>
                {opt.icon}
              </div>
              <p className="font-bold mt-2">{opt.label}</p>
              <p className="text-txt3 text-xs">{opt.desc}</p>
            </button>
          ))}
        </div>
        <div>
          <label className="label">{userType === "ARTIST" ? "Artist name" : "Display name"}</label>
          <input
            className="input"
            required
            maxLength={80}
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder={userType === "ARTIST" ? "e.g. Nova Circuit" : "e.g. Alex"}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <p className="text-red text-sm">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Sign Up"}
        </button>
        <p className="text-txt3 text-xs text-center">
          By signing up you agree to our{" "}
          <Link href="/terms_conditions" className="text-cyan hover:underline">Terms</Link> and{" "}
          <Link href="/privacy_policy" className="text-cyan hover:underline">Privacy Policy</Link>.
        </p>
      </form>
      <p className="text-center text-sm text-txt2 mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-cyan hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
