import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { apiSend, ApiError, type Me } from "@/lib/api";
import { useAuth, homeFor } from "@/lib/auth";
import { AuthShell } from "./AuthShell";

export default function Login() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
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
      const res = await apiSend("POST", "/auth/login", { email, password });
      await refresh();
      navigate(homeFor(res.user as Me));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your account">
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
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-red text-sm">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log In"}
        </button>
      </form>
      <div className="flex justify-between mt-5 text-sm">
        <Link href="/forgot_password" className="text-cyan hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-txt2 hover:text-txt">
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
}
