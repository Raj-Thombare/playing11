"use client";

import { useEffect } from "react";
import type { Player, Role, Team } from "@/data/teams";
import { PlayerPhoto } from "./PlayerPhoto";
import { TeamLogo } from "./TeamLogo";
import { fmtPrice, validateXI } from "@/lib/xi";

const NUM_FONT: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariantNumeric: "tabular-nums",
};

/** cream → gold plaque used for name bars and the SUBSTITUTES header */
const PLAQUE: React.CSSProperties = {
  background: "linear-gradient(180deg, #f9edc4 0%, #e7c569 100%)",
  color: "#0b2a55",
};

/** broadcast card backdrop: club-blue sunburst rising from the bottom */
const burst = (c2: string, c1: string): React.CSSProperties => ({
  background:
    "repeating-conic-gradient(from 110deg at 50% 115%, rgba(255,255,255,.14) 0deg 3deg, rgba(255,255,255,0) 3deg 8.5deg)," +
    `linear-gradient(180deg, ${c2} 0%, ${c1} 72%, #061631 100%)`,
});

/** white line-art role icons, like the TV graphic's bat/ball glyphs */
function RoleGlyph({ role, size = 17 }: { role: Role; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (role) {
    case "BAT":
      return (
        <svg {...common}>
          <path d="M14.2 3.2l6.6 6.6-8.2 8.2-6.6-6.6z" />
          <path d="M6 11.4L2.8 14.6" />
        </svg>
      );
    case "WK":
      return (
        <svg {...common}>
          <path d="M8 21h8a1 1 0 0 0 1-1v-7a5 5 0 0 0-10 0v7a1 1 0 0 0 1 1z" />
          <path d="M10.8 13.4h2.4" />
        </svg>
      );
    case "AR":
      return (
        <svg {...common}>
          <path d="M15.5 2.5l6 6-7.5 7.5-6-6z" />
          <path d="M8 10l-4.6 4.6" />
          <circle cx="17.6" cy="18.4" r="3.1" />
        </svg>
      );
    case "PACE":
      return (
        <svg {...common}>
          <circle cx="14.5" cy="14" r="6" />
          <path d="M2.5 9.5h4.6M1.6 13h3.7M2.5 16.5h4.6" />
        </svg>
      );
    case "SPIN":
      return (
        <svg {...common}>
          <circle cx="13.5" cy="13.5" r="7" />
          <path d="M9.6 7.9c3.8 1.9 5.9 4.9 6.3 9.2" />
        </svg>
      );
  }
}

/** stacked "AT n" badge (batting position), with the captain's C beneath it */
function AtBadge({ n, cap }: { n: number; cap?: boolean }) {
  return (
    <div className="absolute left-1.5 top-1.5 z-10 flex flex-col items-center gap-1">
      <div className="flex flex-col items-center rounded-md border border-white/25 bg-[#04162f]/70 px-1.5 pb-1 pt-0.5 leading-none">
        <span className="text-[8px] font-semibold tracking-[0.25em] text-white/70" style={{ fontFamily: "var(--font-cond)" }}>
          AT
        </span>
        <span className="text-base font-bold" style={{ ...NUM_FONT, color: "#f3cf6f" }}>
          {n}
        </span>
      </div>
      {cap && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/85 bg-black/45 text-[11px] font-bold text-white">
          C
        </div>
      )}
    </div>
  );
}

function PhotoArea({ p, team }: { p: Player; team: Team }) {
  return (
    <div className="relative min-h-0 flex-1 px-1 pt-1">
      <PlayerPhoto
        player={p}
        c1={team.c1}
        c2={team.c2}
        ink={team.ink}
        shape="card"
        fill
        ring={false}
        className="block h-full w-full"
      />
    </div>
  );
}

/** one XI card: AT badge, overseas ✈, headshot on the sunburst, name plaque, role glyph */
function PlayerCard({ p, slot, delay, team }: { p: Player; slot: number; delay: number; team: Team }) {
  return (
    <div
      className="anim-up relative flex h-56 flex-col overflow-hidden rounded-lg border border-white/15 lg:h-auto"
      style={{ ...burst(team.c2, team.c1), animationDelay: `${delay}s` }}
    >
      <AtBadge n={slot} />
      {p.overseas && (
        <span className="absolute right-1.5 top-1.5 z-10 text-sm text-sky-300 drop-shadow-[0_1px_4px_rgba(0,0,0,.6)]">✈</span>
      )}
      <PhotoArea p={p} team={team} />
      <div className="px-1 pb-1 pt-1.5">
        <div
          className="truncate rounded-sm px-1 py-1 text-center text-[11px] font-bold uppercase leading-tight tracking-wide"
          style={{ ...PLAQUE, fontFamily: "var(--font-cond)" }}
        >
          {p.name}
        </div>
        <div className="flex justify-center py-1 text-white/90">
          <RoleGlyph role={p.role} />
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen broadcast-TV "OFFICIAL PLAYING XI" reveal, modelled on the
 * IPL telecast graphic: glowing masthead with the club crest, the captain
 * featured large on the left, the other ten as numbered headshot cards
 * (AT = batting slot, ✈ = overseas, role glyph under the name plaque),
 * a gold SUBSTITUTES rail on the right, stat lower-third and trade ticker.
 */
export function BroadcastOverlay({
  team,
  ordered,
  captainId,
  subs,
  onClose,
}: {
  team: Team;
  /** XI in slot order with each player's 1-based slot number */
  ordered: { p: Player; slot: number }[];
  captainId?: string | null;
  /** bench options: highest-contract players not in the XI */
  subs: Player[];
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const xi = ordered.map((e) => e.p);
  const st = validateXI(xi);
  const capEntry = ordered.find((e) => e.p.id === captainId);
  const featured = capEntry ?? ordered[0];
  const others = ordered.filter((e) => e !== featured);
  const wk = xi.find((p) => p.role === "WK");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-label={`${team.name} playing eleven`}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(100% 80% at 50% -10%, rgba(23,64,128,.5), rgba(2,8,20,.96) 70%)" }} />
      <div className="absolute inset-0 beams opacity-40" />
      <div className="absolute inset-0 grain" />
      <div className="fixed right-4 top-4 z-20 flex flex-col items-end gap-2">
        <button
          onClick={onClose}
          aria-label="Close broadcast view"
          className="rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm font-semibold uppercase tracking-widest hover:bg-black/70"
          style={{ fontFamily: "var(--font-cond)" }}
        >
          ✕ Close
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[1460px] px-3 pb-10 pt-5 sm:px-6">
        {/* the broadcast panel */}
        <div
          className="anim-up relative overflow-hidden rounded-2xl border"
          style={{
            borderColor: "rgba(243,207,111,.4)",
            background: "linear-gradient(180deg, #0d2f63 0%, #08214a 48%, #04102a 100%)",
            boxShadow: `0 50px 140px -50px ${team.c1}`,
          }}
        >
          {/* gold corner streaks */}
          <div
            className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 opacity-50"
            style={{
              background:
                "conic-gradient(from 18deg at 65% 35%, transparent 0deg 36deg, rgba(243,207,111,.55) 38deg 39.5deg, transparent 41deg 74deg, rgba(243,207,111,.35) 76deg 77deg, transparent 79deg)",
            }}
          />
          <div
            className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 opacity-40"
            style={{
              background:
                "conic-gradient(from 195deg at 30% 75%, transparent 0deg 26deg, rgba(243,207,111,.5) 28deg 29.5deg, transparent 31deg)",
            }}
          />

          {/* masthead */}
          <div className="relative flex items-center gap-4 border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 sm:h-20 sm:w-20"
              style={{ borderColor: "rgba(243,207,111,.55)", background: "rgba(0,0,0,.35)" }}
            >
              <TeamLogo team={team} size={44} />
            </div>
            <div className="min-w-0">
              <div
                className="truncate text-3xl font-extrabold leading-none sm:text-5xl"
                style={{ color: "#a9d2ff", textShadow: "0 2px 22px rgba(64,140,255,.65)", fontFamily: "var(--font-display)" }}
              >
                {team.nameHi ?? team.name}
              </div>
              <div
                className="mt-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55 sm:text-xs"
                style={{ fontFamily: "var(--font-cond)" }}
              >
                {team.name} · Official Playing XI
              </div>
            </div>
            <div className="ml-auto hidden flex-col items-end gap-1.5 sm:flex">
              <span className="chip" style={{ background: "rgba(0,0,0,.4)", color: "#fff", borderColor: "transparent" }}>
                TATA IPL
              </span>
              <span className="chip" style={{ background: "rgba(0,0,0,.4)", color: "#f3cf6f", borderColor: "transparent" }}>
                SEASON 2027
              </span>
            </div>
          </div>

          {/* body: featured captain · 10 numbered cards · substitutes rail */}
          <div className="relative grid gap-2 p-3 sm:grid-cols-3 sm:gap-2.5 lg:h-[600px] lg:grid-cols-[200px_repeat(5,minmax(0,1fr))_238px] lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:p-4">
            {/* featured captain */}
            {featured && (
              <div
                className="anim-up relative col-span-2 flex h-80 flex-col overflow-hidden rounded-xl border-2 sm:col-span-3 lg:col-span-1 lg:row-span-2 lg:h-auto"
                style={{
                  ...burst(team.c2, team.c1),
                  borderColor: "rgba(243,207,111,.5)",
                  animationDelay: "0.08s",
                }}
              >
                <AtBadge n={featured.slot} cap={!!capEntry} />
                {featured.p.overseas && (
                  <span className="absolute right-2 top-2 z-10 text-base text-sky-300 drop-shadow-[0_1px_4px_rgba(0,0,0,.6)]">✈</span>
                )}
                <PhotoArea p={featured.p} team={team} />
                <div className="px-2 pb-2 pt-1.5">
                  <div
                    className="truncate rounded px-2 py-1.5 text-center text-base font-bold uppercase leading-tight tracking-wide"
                    style={{ ...PLAQUE, fontFamily: "var(--font-cond)" }}
                  >
                    {featured.p.name}
                  </div>
                  <div className="flex items-center justify-center gap-2 py-1.5 text-white/90">
                    <RoleGlyph role={featured.p.role} size={19} />
                    {capEntry && <span className="text-sm font-bold" style={{ ...NUM_FONT, color: "#f3cf6f" }}>★ CAPTAIN</span>}
                  </div>
                </div>
              </div>
            )}

            {/* the other ten, in slot order */}
            {others.map((e, i) => (
              <PlayerCard key={e.p.id} p={e.p} slot={e.slot} delay={0.16 + i * 0.07} team={team} />
            ))}

            {/* substitutes rail */}
            <div
              className="anim-r col-span-2 flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#04162f]/85 sm:col-span-3 lg:col-span-1 lg:row-span-2 lg:col-start-7 lg:row-start-1"
              style={{ animationDelay: "0.55s" }}
            >
              <div
                className="px-3 py-2.5 text-center text-lg font-bold uppercase tracking-wider"
                style={{ ...PLAQUE, fontFamily: "var(--font-cond)" }}
              >
                Substitutes
              </div>
              <div className="flex-1 divide-y divide-white/10 overflow-y-auto">
                {subs.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 px-3.5 py-3">
                    <span className="shrink-0 text-white/90">
                      <RoleGlyph role={p.role} size={18} />
                    </span>
                    <span className="text-sm font-semibold leading-tight text-white/95" style={{ fontFamily: "var(--font-cond)" }}>
                      {p.name}
                    </span>
                  </div>
                ))}
                {subs.length === 0 && <div className="px-3.5 py-4 text-sm text-white/40">Bench listed at the toss.</div>}
              </div>
            </div>
          </div>

          {/* lower-third stat strip */}
          <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-white/10 px-4 py-2.5 sm:px-6">
            {[
              ["Captain", capEntry ? capEntry.p.name : team.captain ?? "—", team.c2],
              ["Wicketkeeper", wk ? wk.name : "—", undefined],
              ["Overseas", `${st.overseas}/4`, st.overseas <= 4 ? "#8fd694" : "#ff8a8a"],
              ["Balance", `${st.score}/100`, team.c2],
              ["XI Value", fmtPrice(xi.reduce((a, p) => a + p.price, 0)), undefined],
            ].map(([label, value, color]) => (
              <div key={label as string}>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/40" style={{ fontFamily: "var(--font-cond)" }}>
                  {label}
                </div>
                <div className="text-sm font-bold uppercase" style={{ fontFamily: "var(--font-cond)", color: (color as string) || "rgba(255,255,255,.9)" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* trade-desk ticker */}
        <div className="anim-up mt-5 overflow-hidden rounded-full border border-white/10 bg-black/60" style={{ animationDelay: "1.4s" }}>
          <div className="flex items-center">
            <span
              className="z-10 shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
              style={{ background: "#7b2ff7", color: "#fff", fontFamily: "var(--font-cond)" }}
            >
              TRADE DESK
            </span>
            <div className="relative flex-1 overflow-hidden py-1.5">
              <div
                className="ticker-track flex w-max gap-10 whitespace-nowrap text-xs uppercase tracking-wider text-white/70"
                style={{ fontFamily: "var(--font-cond)" }}
              >
                {[0, 1].map((k) => (
                  <span key={k} className="flex gap-10">
                    <span>Shami &amp; Siddharth → RR · Sam Curran → LSG (Nov 17)</span>
                    <span>Harshal Patel → GT (Nov 17)</span>
                    <span>Hardik Pandya → PBKS · Arshdeep Singh → MI (Nov 11)</span>
                    <span>Livingstone &amp; Edwards → CSK · Khaleel &amp; Ellis → SRH (Nov 5)</span>
                    <span>Natarajan → SRH · Zeeshan Ansari → DC (Oct 14)</span>
                    <span>Pant → DC · Kuldeep Yadav → LSG (Jun 23)</span>
                    <span>Retentions locked 17 Nov 2026 · 184 retained, 89 released · Mini auction: 16 Dec 2026, Goa</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
