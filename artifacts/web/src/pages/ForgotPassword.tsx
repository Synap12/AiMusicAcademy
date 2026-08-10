import { useState } from "react";
import { Link } from "wouter";
import { apiSend, ApiError } from "@/lib/api";
import { AuthShell } from "./AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await apiSend("POST", "/auth/forgot-password", { email });
      setSent(true);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll send you a reset link">
      {sent ? (
        <div className="text-center space-y-4">
          <p className="text-green font-semibold">Reset link requested ✓</p>
          <p className="text-txt2 text-sm">
            If an account exists for <b>{email}</b>, a reset link is on its way.
          </p>
          {devToken && (
            <div className="card !p-4 text-left">
              <p className="text-txt3 text-xs mb-2">
                Email delivery isn't configured yet, so here's your reset link:
              </p>
              <Link
                href={`/reset_password?token=${devToken}`}
                className="text-cyan text-sm break-all hover:underline"
              >
                Reset password now →
              </Link>
            </div>
          )}
          <Link href="/login" className="btn btn-secondary w-full">Back to Login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
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
          {error && <p className="text-red text-sm">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send Reset Link"}
          </button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-txt2 hover:text-txt">Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
