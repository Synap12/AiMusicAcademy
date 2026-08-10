import { Link, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Plan } from "@/lib/api";
import { useAuth, homeFor } from "@/lib/auth";
import { money } from "@/lib/format";
import { Music, Mic2, TrendingUp, ShoppingBag, Sparkles, Users } from "lucide-react";

const FEATURES = [
  {
    icon: <Music size={26} />,
    title: "Stream AI Music",
    text: "Discover a growing catalog of AI-generated tracks across every genre, ad-free.",
  },
  {
    icon: <Mic2 size={26} />,
    title: "Publish Your Sound",
    text: "Artists upload unlimited tracks and reach listeners who love AI-made music.",
  },
  {
    icon: <TrendingUp size={26} />,
    title: "Earn Per Play",
    text: "Every stream credits your earnings ledger. Withdraw whenever you're ready.",
  },
  {
    icon: <ShoppingBag size={26} />,
    title: "Sell Merch, Keep 100%",
    text: "Link your Printful, Shopify, or Etsy store. No commission, no platform fees.",
  },
  {
    icon: <Sparkles size={26} />,
    title: "AI Cover Art",
    text: "Generate stunning cover art for your releases with the built-in AI studio.",
  },
  {
    icon: <Users size={26} />,
    title: "One Community",
    text: "Artists and listeners share one public feed — post, comment, and connect.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I uploaded my first AI track on a Tuesday and had 400 plays by the weekend. The earnings ledger is beautifully simple.",
    name: "Nova Circuit",
    role: "AI Artist",
  },
  {
    quote:
      "Finally a platform that treats AI music as real music. The curation and community are unmatched.",
    name: "Maya R.",
    role: "Listener Pro subscriber",
  },
  {
    quote:
      "Zero commission on merch means my hoodie sales are actually mine. Linked my Shopify in two minutes.",
    name: "SynthLord",
    role: "Artist Pro",
  },
];

function HeroPlayerCard() {
  return (
    <div className="relative isolate w-full max-w-[420px] mx-auto">
      {/* floating stat card — top right */}
      <div className="absolute -top-4 -right-5 z-10 bg-card border border-line rounded-[14px] py-3 px-4 flex items-center gap-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] animate-float">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg"
          style={{ background: "rgba(0,255,136,0.1)" }}
        >
          📈
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-tight">+1,240 plays</p>
          <p className="text-[11px] text-txt2">Today's streams</p>
        </div>
      </div>

      {/* main player card */}
      <div className="relative rounded-3xl border border-line p-7 shadow-[0_40px_80px_rgba(0,0,0,0.5)]" style={{ background: "#111111" }}>
        <div className="absolute -inset-px rounded-[25px] gradient-bg opacity-25 -z-10" />

        <p className="text-[11px] font-semibold tracking-[2px] text-txt2 uppercase mb-5">
          ▶ Now Playing
        </p>

        {/* cover with equalizer */}
        <div
          className="w-full aspect-square rounded-2xl mb-5 flex items-center justify-center text-[80px] relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)" }}
        >
          🎵
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg,rgba(0,212,255,0.1),rgba(181,55,255,0.1))" }}
          />
          <div className="absolute bottom-4 right-4 flex items-end gap-[3px] h-5">
            {[8, 14, 10, 18, 6].map((h, i) => (
              <div
                key={i}
                className="eq-bar"
                style={{ height: h, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>

        <p className="text-xl font-bold mb-1">Neon Dreams</p>
        <p className="text-sm text-txt2 mb-4">DJ Synthwave · Electronic</p>

        {/* progress */}
        <div className="h-1 rounded-sm overflow-hidden mb-2" style={{ background: "#222222" }}>
          <div
            className="h-full rounded-sm"
            style={{ width: "45%", background: "linear-gradient(90deg,#00D4FF,#B537FF)" }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-txt2 mb-5">
          <span>1:23</span>
          <span>3:47</span>
        </div>

        {/* controls (decorative) */}
        <div className="flex items-center justify-center gap-5" aria-hidden="true">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-txt2 text-base">
            ⏮
          </span>
          <span className="w-[52px] h-[52px] rounded-full gradient-bg flex items-center justify-center text-white text-xl shadow-[0_8px_24px_rgba(0,212,255,0.4)]">
            ⏸
          </span>
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-txt2 text-base">
            ⏭
          </span>
        </div>
      </div>

      {/* floating release card — bottom left */}
      <div className="absolute bottom-[60px] -left-5 z-10 bg-card border border-line rounded-[14px] py-3 px-4 flex items-center gap-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] animate-float-delayed">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{ background: "rgba(181,55,255,0.15)" }}
        >
          🎨
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-tight">New Release</p>
          <p className="text-[11px] text-txt2">Cyber Flow — J Techno</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet("/subscriptions/plans"),
  });
  if (user && user.hasOnboarded) return <Redirect to={homeFor(user)} />;
  const plans: Plan[] = data?.plans ?? [];

  return (
    <div className="min-h-full">
      {/* nav */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="gradient-bg rounded-lg w-9 h-9 flex items-center justify-center text-white font-bold text-lg">
            ♪
          </span>
          <span className="font-extrabold text-lg tracking-wide">
            AI <span className="gradient-text">MUSIC ACADEMY</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn btn-ghost btn-sm">Log In</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
        </div>
      </header>

      {/* hero */}
      <section className="px-6 md:px-12 pt-16 pb-20 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div className="text-center lg:text-left">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Where <span className="gradient-text">AI music</span> finds its audience
          </h1>
          <p className="text-txt2 text-lg mt-6 max-w-2xl mx-auto lg:mx-0">
            Stream AI-generated tracks, follow the artists behind them, and if you
            create — earn from every play and sell merch with zero commission.
          </p>
          <div className="flex items-center justify-center lg:justify-start gap-4 mt-9 flex-wrap">
            <Link href="/signup" className="btn btn-primary !px-8 !py-4 text-lg">
              Start Listening
            </Link>
            <Link href="/signup" className="btn btn-secondary !px-8 !py-4 text-lg">
              I'm an Artist
            </Link>
          </div>
        </div>
        <div className="hidden sm:block pt-6 lg:pt-0">
          <HeroPlayerCard />
        </div>
      </section>

      {/* what is */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          What is <span className="gradient-text">AI Music Academy</span>?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="text-cyan mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-1.5">{f.title}</h3>
              <p className="text-txt2 text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">
          Simple monthly pricing
        </h2>
        <p className="text-txt2 text-center mb-12">Cancel anytime. No hidden fees.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className="card flex flex-col"
              style={
                p.id.endsWith("_pro")
                  ? { borderColor: p.role === "ARTIST" ? "#B537FF" : "#00D4FF" }
                  : undefined
              }
            >
              <span
                className="badge self-start mb-3"
                style={{
                  background:
                    p.role === "ARTIST" ? "rgba(181,55,255,0.12)" : "rgba(0,212,255,0.12)",
                  color: p.role === "ARTIST" ? "#B537FF" : "#00D4FF",
                }}
              >
                {p.role}
              </span>
              <h3 className="font-bold text-lg">{p.name}</h3>
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
              <Link href="/signup" className="btn btn-primary mt-6 w-full">
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* testimonials */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          Loved by artists & listeners
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card">
              <p className="text-txt2 italic leading-relaxed">“{t.quote}”</p>
              <p className="font-semibold mt-4">{t.name}</p>
              <p className="text-txt3 text-sm">{t.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line px-6 py-10 text-center text-txt3 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/privacy_policy" className="hover:text-txt">Privacy Policy</Link>
          <Link href="/terms_conditions" className="hover:text-txt">Terms & Conditions</Link>
        </div>
        © 2025 AI Music Academy. All rights reserved.
      </footer>
    </div>
  );
}
