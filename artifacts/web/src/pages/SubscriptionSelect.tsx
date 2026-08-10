import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError, type Plan } from "@/lib/api";
import { useAuth, homeFor } from "@/lib/auth";
import { AuthShell } from "./AuthShell";
import { money } from "@/lib/format";
import { Spinner } from "@/components/ui";

export default function SubscriptionSelect() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [error, setError] = useState("");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet("/subscriptions/plans"),
  });

  if (loading) return <Spinner center />;
  if (!user) return <Redirect to="/login" />;
  if (user.hasOnboarded) return <Redirect to={homeFor(user)} />;

  const plans: Plan[] = (data?.plans ?? []).filter(
    (p: Plan) => p.role === user.userType,
  );

  const choose = async (plan: Plan) => {
    setError("");
    setBusyPlan(plan.id);
    try {
      const res = await apiSend("POST", "/subscriptions/checkout", { plan: plan.id });
      if (res.mock) {
        // Stripe isn't connected yet — the built-in mock checkout completes
        // the same webhook-driven flow instantly.
        await apiSend("POST", "/subscriptions/mock-complete");
        navigate("/subscription_success");
      } else {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
      setBusyPlan(null);
    }
  };

  return (
    <AuthShell
      wide
      title={
        <>
          Choose your <span className="gradient-text">plan</span>
        </>
      }
      subtitle={`Welcome, ${user.artistName}! Pick a ${user.userType.toLowerCase()} plan to get started. Cancel anytime.`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((p) => (
          <div
            key={p.id}
            className="card flex flex-col"
            style={p.id.endsWith("_pro") ? { borderColor: "#B537FF" } : undefined}
          >
            {p.id.endsWith("_pro") && (
              <span className="badge self-start mb-2" style={{ background: "rgba(181,55,255,0.12)", color: "#B537FF" }}>
                Most popular
              </span>
            )}
            <h3 className="font-bold text-xl">{p.name}</h3>
            <p className="text-3xl font-extrabold mt-2">
              {money(p.price)}
              <span className="text-sm text-txt2 font-medium">/mo</span>
            </p>
            <ul className="text-txt2 text-sm mt-4 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-green">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary mt-6 w-full"
              disabled={busyPlan !== null}
              onClick={() => choose(p)}
            >
              {busyPlan === p.id ? "Redirecting…" : `Subscribe — ${money(p.price)}/mo`}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-red text-sm mt-4 text-center">{error}</p>}
      {data && !data.stripeConfigured && (
        <p className="text-txt3 text-xs text-center mt-6">
          Payments run in demo mode until Stripe is connected — subscribing is
          instant and free for now.
        </p>
      )}
    </AuthShell>
  );
}
