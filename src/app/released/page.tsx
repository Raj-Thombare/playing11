import Link from "next/link";
import { PLAYERS } from "@/data/players";
import { SEASON_CONTEXT } from "@/data/teams";
import { AuctionBoard } from "@/components/AuctionBoard";
import { fmtPrice } from "@/lib/xi";

export const metadata = {
  title: "Released Players — IPL 2027 Auction Room | IPL XI Builder",
  description:
    "Every player released by all ten IPL franchises at the 17 Nov 2026 retention deadline — grouped by role and capped/uncapped, with a local what-if auction.",
};

export default function ReleasedPage() {
  const released = PLAYERS.filter((p) => p.status === "released");
  const overseas = released.filter((p) => p.overseas).length;
  const value = released.reduce((sum, p) => sum + p.price, 0);

  return (
    <main className='relative min-h-screen'>
      <div className='pointer-events-none absolute inset-0 beams' />
      <div className='pointer-events-none absolute inset-0 vignette' />
      <div className='pointer-events-none absolute inset-0 grain' />

      <div className='relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6'>
        <nav className='mb-5 flex flex-wrap items-center gap-2 text-sm text-white/50'>
          <Link
            href='/'
            className='rounded-lg border border-white/10 px-3 py-1.5 font-semibold uppercase tracking-widest hover:bg-white/5'
            style={{ fontFamily: "var(--font-cond)" }}>
            ← All Teams
          </Link>
          <span className='chip' style={{ color: "#ff8a8a", borderColor: "rgba(255,138,138,.35)" }}>
            ● Released · {SEASON_CONTEXT.retentionDeadline}
          </span>
        </nav>

        {/* hero */}
        <div className='sheen overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#131a2b] via-[#0b0e16] to-[#131a2b] p-6 sm:p-9'>
          <span className='chip' style={{ color: "#ff8a8a", borderColor: "rgba(255,138,138,.4)" }}>
            🔴 Retention window · 17 Nov 2026
          </span>
          <h1
            className='mt-4 text-4xl font-extrabold uppercase leading-none tracking-wide sm:text-6xl'
            style={{
              fontFamily: "var(--font-display)",
              backgroundImage: "linear-gradient(100deg, #ff8a8a 5%, #ff4fa3 45%, #b02ff7 85%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            Released Players
          </h1>
          <p className='mt-3 max-w-2xl text-sm text-white/60 sm:text-base'>
            All <b className='text-white/85'>{released.length}</b> players let go by the ten franchises at the 2027
            retention deadline — grouped like an auction pool (batter, keeper, all-rounder, bowlers) with capped /
            uncapped and overseas / Indian filters. Sell anyone to a franchise and he joins that squad&apos;s XI builder.
          </p>
          <div className='mt-5 flex flex-wrap gap-2 text-sm'>
            <span className='plate px-3 py-2' style={{ fontFamily: "var(--font-cond)", color: "#ff8a8a" }}>
              🔴 {released.length} released
            </span>
            <span className='plate px-3 py-2' style={{ fontFamily: "var(--font-cond)", color: "#9cc3ff" }}>
              ✈ {overseas} overseas
            </span>
            <span className='plate px-3 py-2' style={{ fontFamily: "var(--font-cond)", color: "#ffc75a" }}>
              💰 {fmtPrice(value)} of contracts freed
            </span>
          </div>
        </div>

        <AuctionBoard released={released} />

        <p className='mt-8 text-center text-xs text-white/35'>
          Career stats through IPL 2026 · Retentions &amp; trades verified {SEASON_CONTEXT.retentionDeadline} · Auction
          picks are saved in this browser only — they are a what-if tool, not official IPL data.
        </p>
      </div>
    </main>
  );
}
