import { useState, type ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth, homeFor } from "@/lib/auth";
import { apiSend } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { PlayerBar } from "./PlayerBar";
import { Spinner } from "./ui";
import {
  Music,
  Heart,
  ShoppingBag,
  MessageSquare,
  User,
  LayoutDashboard,
  BarChart3,
  Store,
  Image,
  Upload,
  Disc3,
  LogOut,
  Users,
  Shield,
  DollarSign,
  Menu,
  X,
} from "lucide-react";

function NavLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`nav-item ${active ? "active" : ""}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function LogoutButton() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  return (
    <button
      className="nav-item w-full text-left"
      onClick={async () => {
        await apiSend("POST", "/auth/logout");
        await qc.invalidateQueries({ queryKey: ["me"] });
        navigate("/login");
      }}
    >
      <LogOut size={18} />
      <span>Logout</span>
    </button>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-3 py-4">
      <span className="gradient-bg rounded-lg w-8 h-8 flex items-center justify-center text-white font-bold">
        ♪
      </span>
      <span className="font-extrabold tracking-wide">
        AI <span className="gradient-text">MUSIC</span>
      </span>
    </Link>
  );
}

function Shell({
  sidebar,
  children,
  withPlayer,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  withPlayer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-full flex">
      {/* mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-line flex items-center justify-between px-4 h-14">
        <Brand />
        <button onClick={() => setOpen(!open)} aria-label="Menu" className="text-txt2">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {/* sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-30 h-screen w-60 bg-card border-r border-line flex-col px-3 pb-4 transition-transform lg:translate-x-0 lg:flex ${
          open ? "translate-x-0 flex pt-14 lg:pt-0" : "-translate-x-full hidden lg:flex"
        }`}
      >
        <div onClick={() => setOpen(false)} className="flex flex-col h-full">
          {sidebar}
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <main
        className={`flex-1 min-w-0 px-4 md:px-8 pt-20 lg:pt-8 ${withPlayer ? "pb-32" : "pb-12"}`}
      >
        <div className="max-w-[1400px] mx-auto">{children}</div>
      </main>
      {withPlayer && <PlayerBar />}
    </div>
  );
}

/** Guard + layout for pages any onboarded user (listener or artist) can access. */
export function ListenerLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner center />;
  if (!user) return <Redirect to="/login" />;
  if (!user.hasOnboarded && !user.isAdmin) return <Redirect to="/subscription_select" />;
  return (
    <Shell
      withPlayer
      sidebar={
        <>
          <div className="hidden lg:block">
            <Brand />
          </div>
          <nav className="flex flex-col gap-1 mt-2 flex-1">
            <NavLink href="/browse" icon={<Music size={18} />} label="Browse Music" />
            <NavLink href="/library" icon={<Heart size={18} />} label="My Library" />
            <NavLink href="/merch" icon={<ShoppingBag size={18} />} label="Browse Merch" />
            <NavLink href="/community" icon={<MessageSquare size={18} />} label="Community" />
            <NavLink href="/profile" icon={<User size={18} />} label="My Profile" />
            {user.userType === "ARTIST" && (
              <>
                <div className="border-t border-line my-3" />
                <NavLink
                  href="/artist"
                  icon={<LayoutDashboard size={18} />}
                  label="Artist Dashboard"
                />
              </>
            )}
          </nav>
          <LogoutButton />
        </>
      }
    >
      {children}
    </Shell>
  );
}

/** Guard + layout for artist-only pages. */
export function ArtistLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner center />;
  if (!user) return <Redirect to="/login" />;
  if (user.userType !== "ARTIST" && !user.isAdmin) return <Redirect to={homeFor(user)} />;
  if (!user.hasOnboarded && !user.isAdmin) return <Redirect to="/subscription_select" />;
  return (
    <Shell
      withPlayer
      sidebar={
        <>
          <div className="hidden lg:block">
            <Brand />
          </div>
          <p className="text-txt3 text-[11px] font-bold tracking-widest px-3 mt-2 mb-1">
            DASHBOARD
          </p>
          <nav className="flex flex-col gap-1 flex-1">
            <NavLink href="/artist" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <NavLink href="/artist/analytics" icon={<BarChart3 size={18} />} label="Analytics" />
            <NavLink href="/artist/merch" icon={<Store size={18} />} label="Merch Store" />
            <NavLink href="/artist/cover-art" icon={<Image size={18} />} label="Cover Art" />
            <NavLink href="/artist/upload" icon={<Upload size={18} />} label="Upload Audio" />
            <NavLink href="/artist/releases" icon={<Disc3 size={18} />} label="My Releases" />
            <NavLink href="/artist/profile" icon={<User size={18} />} label="My Profile" />
            <div className="border-t border-line my-3" />
            <NavLink href="/browse" icon={<Music size={18} />} label="Browse Music" />
          </nav>
          <LogoutButton />
          <p className="text-txt3 text-[11px] px-3 mt-3">© 2025 AI Music Academy</p>
        </>
      }
    >
      {children}
    </Shell>
  );
}

/** Guard + layout for admin pages. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner center />;
  if (!user) return <Redirect to="/login" />;
  if (!user.isAdmin) return <Redirect to={homeFor(user)} />;
  return (
    <Shell
      sidebar={
        <>
          <div className="px-3 py-4">
            <p className="font-extrabold tracking-wide text-cyan">ADMIN PANEL</p>
            <p className="text-txt3 text-xs">AI Music Academy</p>
          </div>
          <nav className="flex flex-col gap-1 flex-1">
            <NavLink href="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <NavLink href="/admin/users" icon={<Users size={18} />} label="Users" />
            <NavLink href="/admin/moderation" icon={<Shield size={18} />} label="Moderation" />
            <NavLink href="/admin/payouts" icon={<DollarSign size={18} />} label="Payouts" />
          </nav>
          <p className="text-txt3 text-xs px-3 mb-2 truncate">{user.email}</p>
          <LogoutButton />
        </>
      }
    >
      {children}
    </Shell>
  );
}
