import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Me } from "@/lib/api";
import { AuthShell } from "./AuthShell";
import { homeFor, useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";

/**
 * Post-checkout landing page. Polls the account every 2.5s until the Stripe
 * webhook (or mock completion) flips has_onboarded, then redirects.
 */
export default function SubscriptionSuccess() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { data } = useQuery({
    queryKey: ["onboard-poll"],
    queryFn: async () => {
      const res = await apiGet("/auth/me");
      return res.user as Me;
    },
    refetchInterval: 2500,
  });

  useEffect(() => {
    if (data?.hasOnboarded) {
      refresh().then(() => navigate(homeFor(data)));
    }
  }, [data, navigate, refresh]);

  return (
    <AuthShell title="Setting up your account…" subtitle="Confirming your subscription with our payment provider.">
      <div className="flex flex-col items-center gap-5 py-6">
        <Spinner />
        <p className="text-txt2 text-sm text-center">
          This usually takes a few seconds. You'll be redirected automatically.
        </p>
      </div>
    </AuthShell>
  );
}
