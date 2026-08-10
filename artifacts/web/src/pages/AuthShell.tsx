import type { ReactNode } from "react";
import { Link } from "wouter";

export function AuthShell({
  title,
  subtitle,
  children,
  wide,
}: {
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="gradient-bg rounded-lg w-9 h-9 flex items-center justify-center text-white font-bold text-lg">
          ♪
        </span>
        <span className="font-extrabold text-lg tracking-wide">
          AI <span className="gradient-text">MUSIC ACADEMY</span>
        </span>
      </Link>
      <div className={`card w-full ${wide ? "max-w-4xl" : "max-w-md"}`}>
        <h1 className="text-2xl font-bold text-center">{title}</h1>
        {subtitle && <p className="text-txt2 text-sm text-center mt-2">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}
