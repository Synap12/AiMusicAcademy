import type { ReactNode } from "react";
import clsx from "clsx";

export function Avatar({
  src,
  name,
  size = 40,
  accent = "cyan",
}: {
  src?: string | null;
  name: string;
  size?: number;
  accent?: "cyan" | "purple";
}) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background:
          accent === "purple"
            ? "linear-gradient(135deg, #B537FF, #7a1fbf)"
            : "linear-gradient(135deg, #00D4FF, #0077b6)",
      }}
    >
      {initial}
    </div>
  );
}

export function Cover({
  src,
  name,
  size,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const style = size ? { width: size, height: size } : undefined;
  return src ? (
    <img
      src={src}
      alt={name}
      style={style}
      className={clsx("rounded-lg object-cover shrink-0 bg-card", className)}
    />
  ) : (
    <div
      style={style}
      className={clsx(
        "rounded-lg shrink-0 flex items-center justify-center bg-card border border-line text-txt3",
        className,
      )}
    >
      <span style={{ fontSize: size ? size * 0.4 : 32 }}>♪</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className={clsx(
          "card w-full max-h-[85vh] overflow-y-auto",
          wide ? "max-w-2xl" : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-txt3 hover:text-txt text-2xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <div className="text-txt3 mb-3">{icon}</div>
      <p className="font-semibold text-lg">{title}</p>
      {subtitle && <p className="text-txt2 text-sm mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card">
      <p className="text-txt2 text-sm font-semibold">{label}</p>
      <p
        className="text-[28px] font-bold mt-1 leading-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-txt3 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export function Spinner({ center }: { center?: boolean }) {
  const el = <div className="spinner" />;
  return center ? (
    <div className="flex justify-center items-center py-16">{el}</div>
  ) : (
    el
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: "rgba(0,255,136,0.12)", color: "#00FF88" },
    FREE: { bg: "rgba(255,165,0,0.12)", color: "#FFA500" },
    BANNED: { bg: "rgba(255,68,68,0.12)", color: "#FF4444" },
    PAST_DUE: { bg: "rgba(255,165,0,0.12)", color: "#FFA500" },
    CANCELED: { bg: "rgba(255,68,68,0.12)", color: "#FF4444" },
    PENDING: { bg: "rgba(255,165,0,0.12)", color: "#FFA500" },
    PAID: { bg: "rgba(0,255,136,0.12)", color: "#00FF88" },
    LISTENER: { bg: "rgba(0,212,255,0.12)", color: "#00D4FF" },
    ARTIST: { bg: "rgba(181,55,255,0.12)", color: "#B537FF" },
    ADMIN: { bg: "rgba(255,255,255,0.12)", color: "#FFFFFF" },
    PUBLISHED: { bg: "rgba(0,255,136,0.12)", color: "#00FF88" },
    DRAFT: { bg: "rgba(255,165,0,0.12)", color: "#FFA500" },
  };
  const style = map[status.toUpperCase()] ?? {
    bg: "rgba(170,170,170,0.12)",
    color: "#AAAAAA",
  };
  return (
    <span
      className="badge"
      style={{ background: style.bg, color: style.color }}
    >
      {status.replace("_", " ")}
    </span>
  );
}
