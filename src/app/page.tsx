"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SEASON_CONTEXT, TEAMS, TRADES } from "@/data/teams";
import { LEAGUE_STATS, PLAYERS, playersOfTeam } from "@/data/players";
import { TeamLogo } from "@/components/TeamLogo";
import { fmtPrice } from "@/lib/xi";

function AuctionCountdown() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const target = new Date("2026-12-16T10:00:00+05:30").getTime();
    const tick = () => {
      const ms = Math.max(0, target - Date.now());
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setLeft(`${d}d ${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{left}</span>;
}

function SavedBadge({ teamId }: { teamId: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`iplxi:sel:${teamId}`);
      const arr = raw ? JSON.parse(raw) : null;
      // slots are sparse (length 11 with nulls) — count only real picks
      setSaved(Array.isArray(arr) && arr.filter(Boolean).length === 11);
    } catch {}
  }, [teamId]);
  return saved ? (
    <span className="chip" style={{ color: "#8fd694", borderColor: "rgba(143,214,148,.4)" }}>XI SET ✓</span>
  ) : (
    <span className="chip" style={{ color: "rgba(255,255,255,.55)" }}>BUILD XI →</span>
  );
}

export default function Home() {
  return (
    <main className='relative'>
      <div className='pointer-events-none absolute inset-0 beams' />
      <div className='pointer-events-none absolute inset-0 vignette' />
      <div className='pointer-events-none absolute inset-0 grain' />

      <div className='relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6'>
        {/* hero slab */}
        <div className='sheen overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#131a2b] via-[#0b0e16] to-[#131a2b] p-6 sm:p-9'>
          <div className='flex flex-wrap items-center gap-2'>
            <span
              className='chip'
              style={{
                background: "#f6cc1b",
                color: "#123458",
                borderColor: "transparent",
              }}>
              TATA IPL
            </span>
            <span className='chip' style={{ color: "#ffc75a" }}>
              2027 SEASON CONSOLE
            </span>
            <span
              className='chip glow'
              style={{ color: "#ff8a8a", borderColor: "rgba(255,138,138,.4)" }}>
              ● LIVE — Retention deadline: {SEASON_CONTEXT.retentionDeadline}
            </span>
          </div>
          <h1
            className='mt-4 text-4xl font-bold uppercase leading-[0.95] tracking-wide sm:text-6xl'
            style={{ fontFamily: "var(--font-display)" }}>
            IPL Team &amp; XI Builder
          </h1>
          <p className='mt-2 max-w-2xl text-white/65'>
            Pick every franchise&apos;s Playing XI under broadcast-TV graphics —
            4 overseas cap, 1 keeper and balance rules enforced live. The AI
            selection engine auto-builds XIs from career IPL records. Full
            squads, trades, retentions, releases and captains — data verified{" "}
            <b className='text-white/85'>{SEASON_CONTEXT.retentionDeadline}</b>.
          </p>
          <div className='mt-4 flex flex-wrap gap-2 text-sm'>
            <span
              className='plate px-3 py-2'
              style={{ fontFamily: "var(--font-cond)" }}>
              🏟 {LEAGUE_STATS.totalPlayers} players · {LEAGUE_STATS.overseas}{" "}
              overseas
            </span>
            <span
              className='plate px-3 py-2'
              style={{ fontFamily: "var(--font-cond)" }}>
              🔁 6 confirmed 2027 trades · 14 players moved
            </span>
            <Link
              href='/released'
              className='plate px-3 py-2 transition-colors hover:border-white/30 hover:bg-white/10'
              style={{ fontFamily: "var(--font-cond)", color: "#ff8a8a" }}>
              🔴 View all {PLAYERS.filter((p) => p.status === "released").length} released players →
            </Link>
            <span
              className='plate px-3 py-2'
              style={{ fontFamily: "var(--font-cond)", color: "#8fd694" }}>
              ✅ All squads fit — 2026 injuries recovered for 2027
            </span>
            <span
              className='plate px-3 py-2'
              style={{ fontFamily: "var(--font-cond)" }}>
              🏆 {SEASON_CONTEXT.lastChampion}
            </span>
            <span
              className='plate px-3 py-2'
              style={{ fontFamily: "var(--font-cond)", color: "#ffc75a" }}>
              ⏳ Mini auction in <AuctionCountdown /> (
              {SEASON_CONTEXT.auctionVenue}, {SEASON_CONTEXT.auctionDate})
            </span>
          </div>
        </div>

        {/* trade feed ticker */}
        <div className='mt-4 overflow-hidden rounded-full border border-white/10 bg-black/50'>
          <div className='flex items-center'>
            <span
              className='z-10 shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest'
              style={{
                background: "#7b2ff7",
                color: "#fff",
                fontFamily: "var(--font-cond)",
              }}>
              TRADE DESK
            </span>
            <div className='relative flex-1 overflow-hidden py-1.5'>
              <div
                className='ticker-track flex w-max gap-10 whitespace-nowrap text-xs uppercase tracking-wider text-white/70'
                style={{ fontFamily: "var(--font-cond)" }}>
                {[0, 1].map((k) => (
                  <span key={k} className='flex gap-10'>
                    {TRADES.map((t) => (
                      <span key={t.title}>
                        {t.moves
                          .map((m) => `${m.name} ${m.from}→${m.to}`)
                          .join(" · ")}{" "}
                        (
                        {new Date(t.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                        )
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* team grid */}
        <h2
          className='mt-10 text-xl font-bold uppercase tracking-[0.25em] text-white/70'
          style={{ fontFamily: "var(--font-display)" }}>
          Choose your franchise
        </h2>
        <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          {TEAMS.map((team, i) => {
            const squad = playersOfTeam(team.id).filter(
              (p) => p.status !== "released",
            );
            const injured = squad.filter((p) => p.status === "injured").length;
            const ov = squad.filter((p) => p.overseas).length;
            return (
              <Link
                key={team.id}
                href={`/team/${team.id}`}
                className='anim-up group relative overflow-hidden rounded-2xl border border-white/10 p-4 transition-transform hover:-translate-y-1'
                style={{
                  animationDelay: `${i * 0.05}s`,
                  background: `linear-gradient(160deg, ${team.c1}cc 0%, ${team.c1}55 40%, rgba(10,12,20,.9) 100%)`,
                  boxShadow: `0 20px 50px -30px ${team.c1}`,
                }}>
                <div className='absolute inset-0 grain opacity-60' />
                <div className='relative'>
                  <div className='flex items-start justify-between'>
                    <TeamLogo team={team} size={52} />
                    {team.titles > 0 && (
                      <span
                        className='chip'
                        style={{
                          background: "rgba(0,0,0,.35)",
                          color: team.ink,
                          borderColor: "transparent",
                        }}>
                        ★ {team.titles}
                      </span>
                    )}
                  </div>
                  <div
                    className='mt-3 text-lg font-bold uppercase leading-tight'
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "#fff",
                    }}>
                    {team.name}
                  </div>
                  <div
                    className='text-[11px] uppercase tracking-[0.2em]'
                    style={{ fontFamily: "var(--font-cond)", color: team.ink }}>
                    {team.city}
                  </div>
                  <div className='mt-3 space-y-1 text-xs text-white/75'>
                    <div className='flex justify-between'>
                      <span className='text-white/50'>Captain</span>
                      <span className='font-semibold'>
                        {team.captain ?? "TBA"}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-white/50'>Squad</span>
                      <span>
                        {squad.length} · {ov} OV
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-white/50'>Purse left</span>
                      <span>{fmtPrice(Math.max(0, 130 - team.payroll))}</span>
                    </div>
                  </div>
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {injured > 0 && (
                      <span
                        className='chip'
                        style={{
                          color: "#ffb84d",
                          borderColor: "rgba(255,184,77,.35)",
                        }}
                        title='Injured players — contracts held, not released'>
                        🩹 {injured}
                      </span>
                    )}
                    <SavedBadge teamId={team.id} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* latest moves */}
        <h2
          className='mt-12 text-xl font-bold uppercase tracking-[0.25em] text-white/70'
          style={{ fontFamily: "var(--font-display)" }}>
          Off-season ledger — trades, retentions &amp; releases
        </h2>
        <div className='mt-4 grid gap-3 lg:grid-cols-2'>
          <div className='plate p-4'>
            <div className='plate-head text-sm text-white/80'>
              Confirmed 2027 trades
            </div>
            <div className='mt-3 space-y-3'>
              {TRADES.filter((t) => t.date >= "2026-06-01").map((t) => (
                <div
                  key={t.date}
                  className='border-l-2 pl-3'
                  style={{ borderColor: "#7b2ff7" }}>
                  <div
                    className='text-sm font-bold uppercase tracking-wide'
                    style={{ fontFamily: "var(--font-cond)" }}>
                    {new Date(t.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    — {t.title}
                  </div>
                  <div className='mt-1 flex flex-wrap gap-1.5'>
                    {t.moves.map((m) => (
                      <span key={m.name} className='chip'>
                        {m.name} {m.from}→{m.to} · {fmtPrice(m.fee)}
                      </span>
                    ))}
                  </div>
                  <p className='mt-1 text-xs text-white/50'>{t.summary}</p>
                </div>
              ))}
            </div>
          </div>
          <div className='plate p-4'>
            <div className='plate-head text-sm text-white/80'>
              Retention &amp; release landscape
            </div>
            <ul className='mt-3 space-y-2 text-sm text-white/60'>
              <li>
                • <b className='text-white/85'>Ajinkya Rahane (KKR)</b> retired
                from IPL cricket in July 2026 — KKR&apos;s next captain is
                pending.
              </li>
              <li>
                • <b className='text-white/85'>Hardik Pandya</b> leaves the MI
                captaincy for PBKS; MI yet to name a skipper (Rohit Sharma
                linked).
              </li>
              <li>
                • <b className='text-white/85'>Rishabh Pant</b> returns to DC;
                LSG must appoint a new captain (Pooran the front-runner).
              </li>
              <li>
                • CSK (27 fit / 25, 10/8 OV) and SRH (26/25) must make mandatory
                cuts by 17 Nov; KKR hold the biggest purse (~₹43 Cr).
              </li>
              <li>
                • <b className='text-white/85'>Injured core stays contracted</b>{" "}
                — de Kock (MI), Marsh &amp; Hasaranga (LSG), Pathirana, Harshit
                Rana &amp; Akash Deep (KKR), Duckett (DC), Carse (SRH), Banton
                (GT), Milne (RR), Mhatre &amp; Ghosh (CSK) were ruled out in
                2026 but are NOT released; if a franchise voluntarily cuts one
                before 17 Nov, it moves to the released pool and its fee returns
                to the purse.
              </li>
              <li>
                • Retention deadline{" "}
                <b className='text-white/85'>
                  {SEASON_CONTEXT.retentionDeadline}
                </b>{" "}
                · Registration closes {SEASON_CONTEXT.registrationClose} ·
                Pruned list {SEASON_CONTEXT.prunedList} · Mini auction{" "}
                {SEASON_CONTEXT.auctionDate}, {SEASON_CONTEXT.auctionVenue}.
              </li>
            </ul>
            <p className='mt-3 text-xs text-white/40'>{SEASON_CONTEXT.note}</p>
          </div>
        </div>

        <footer className='sheen mt-14 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#131a2b] via-[#0b0e16] to-[#131a2b] px-6 py-10 text-center'>
          <p className='text-[10px] font-bold uppercase tracking-[0.4em] text-white/35' style={{ fontFamily: "var(--font-cond)" }}>
            Built &amp; maintained by
          </p>
          <h2
            className='mt-3 text-5xl font-extrabold uppercase leading-none tracking-wide sm:text-7xl'
            style={{
              fontFamily: "var(--font-display)",
              backgroundImage:
                "linear-gradient(100deg, #f6cc1b 5%, #ff9d3f 30%, #ff4fa3 55%, #b02ff7 78%, #4f8dff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "#f6cc1b",
              filter: "drop-shadow(0 10px 34px rgba(176,47,247,.35))",
            }}
          >
            Raj Thombare
          </h2>
          <div className='mt-6 flex items-center justify-center gap-3 text-xs'>
            <a
              href='https://www.instagram.com/RajTh0mbare'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-white/50 transition-colors hover:border-white/30 hover:text-white/85'
            >
              <svg aria-hidden='true' width='13' height='13' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6zm0 2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm6.1-2.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z' />
              </svg>
              Instagram
            </a>
            <a
              href='https://x.com/RajTh0mbare'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-white/50 transition-colors hover:border-white/30 hover:text-white/85'
            >
              <svg aria-hidden='true' width='12' height='12' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M18.9 2H22l-6.8 7.8L23.3 22h-7.3l-5-6.6L5.3 22H2.2l7.4-8.5L1.2 2h7.5l4.6 6.1L18.9 2zm-1.3 18h1.7L7 3.9H5.1L17.6 20z' />
              </svg>
              Twitter / X
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
