import Link from "next/link";
import { PLAYERS } from "@/data/players";
import { SEASON_CONTEXT, TEAMS } from "@/data/teams";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { TeamLogo } from "@/components/TeamLogo";
import { OverseasChip, RoleBadge } from "@/components/Badges";
import { fmtPrice } from "@/lib/xi";

export const metadata = {
  title: "Released Players — IPL 2027 Retention Window | IPL XI Builder",
  description:
    "Every player released by all ten IPL franchises at the 17 Nov 2026 retention deadline, grouped by team.",
};

export default function ReleasedPage() {
  const released = PLAYERS.filter((p) => p.status === "released");
  const groups = TEAMS.map((team) => ({
    team,
    players: released.filter((p) => p.team === team.id).sort((a, b) => b.price - a.price),
  }));
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
            retention deadline — every cut, in one place. They are out of the selection pools but can be picked up
            at the mini auction on <b className='text-white/85'>{SEASON_CONTEXT.auctionDate}</b> in{" "}
            {SEASON_CONTEXT.auctionVenue}.
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

        {/* quick jump */}
        <div className='mt-5 flex flex-wrap gap-2'>
          {groups.map(({ team, players }) => (
            <a
              key={team.id}
              href={`#${team.id.toLowerCase()}`}
              className='chip transition-colors hover:border-white/30 hover:text-white/90'
              style={{ borderColor: `${team.c2}66` }}>
              <TeamLogo team={team} size={18} />
              {team.short} <span className='text-white/40'>{players.length}</span>
            </a>
          ))}
        </div>

        {/* one section per franchise */}
        <div className='mt-6 space-y-6'>
          {groups.map(({ team, players }) => (
            <section
              key={team.id}
              id={team.id.toLowerCase()}
              className='plate overflow-hidden'
              style={{ borderColor: `${team.c2}55`, scrollMarginTop: 16 }}>
              <div
                className='flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5'
                style={{ background: `linear-gradient(100deg, ${team.c2}22, transparent 65%)` }}>
                <TeamLogo team={team} size={40} />
                <div className='min-w-0'>
                  <h2 className='plate-head text-lg font-bold text-white/90' style={{ fontFamily: "var(--font-display)" }}>
                    {team.name}
                  </h2>
                  <p className='text-xs text-white/45'>
                    {players.length} released · {fmtPrice(players.reduce((sum, p) => sum + p.price, 0))} freed
                  </p>
                </div>
                <Link
                  href={`/team/${team.id}`}
                  className='chip ml-auto transition-colors hover:border-white/30 hover:text-white/90'
                  style={{ fontFamily: "var(--font-cond)" }}>
                  View squad →
                </Link>
              </div>

              <div className='grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3'>
                {players.map((p) => (
                  <div key={p.id} className='flex items-center gap-3 rounded-lg bg-white/[0.035] p-2.5'>
                    <PlayerPhoto
                      player={p}
                      c1={team.c1}
                      c2={team.c2}
                      ink={team.ink}
                      size={56}
                      ring={false}
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-bold text-white/90' style={{ fontFamily: "var(--font-cond)" }}>
                        {p.name}
                      </div>
                      <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                        <RoleBadge role={p.role} compact />
                        <OverseasChip overseas={p.overseas} />
                        <span className='text-xs font-bold' style={{ color: "#ffc75a" }}>
                          {fmtPrice(p.price)}
                        </span>
                      </div>
                      {p.note && <p className='mt-1 line-clamp-2 text-[11px] leading-snug text-white/40'>{p.note}</p>}
                    </div>
                  </div>
                ))}
                {players.length === 0 && (
                  <p className='p-3 text-sm text-white/45'>No releases — full squad retained.</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className='mt-8 text-center text-xs text-white/35'>
          Career stats through IPL 2026 · Retentions &amp; trades verified {SEASON_CONTEXT.retentionDeadline} · Released
          players may still be re-signed at the {SEASON_CONTEXT.auctionVenue} mini auction.
        </p>
      </div>
    </main>
  );
}
