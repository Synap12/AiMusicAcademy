import { useState } from "react";
import { Link, useLocation, useSearchParams } from "wouter";
import { apiSend, ApiError } from "@/lib/api";
import { AuthShell } from "./AuthShell";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [, navigate] = useLocation();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await apiSend("POST", "/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid reset link">
        <p className="text-txt2 text-sm text-center mb-5">
          This link is missing its reset token. Request a new one below.
        </p>
        <Link href="/forgot_password" className="btn btn-primary w-full">
          Request New Link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password">
      {done ? (
        <p className="text-green text-center font-semibold">
          Password updated ✓ Redirecting to login…
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">New password</label>
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
          <div>
            <label className="label">Confirm password</label>
            <input
              className="input"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
            />
          </div>
          {error && <p className="text-red text-sm">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Updating…" : "Update Password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
