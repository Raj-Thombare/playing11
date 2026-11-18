"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player, TeamId } from "@/data/teams";
import { OVERSEAS_CAP, PURSE, TEAMS } from "@/data/teams";
import { PlayerPhoto } from "./PlayerPhoto";
import { TeamLogo } from "./TeamLogo";
import { OverseasChip, RoleBadge } from "./Badges";
import { fmtPrice, ROLE_LABEL, ROLE_ORDER } from "@/lib/xi";
import { isCapped, readAuction, writeAuction, type AuctionPicks } from "@/lib/auction";

type Category = "all" | "capped" | "uncapped" | "overseas" | "indian" | "sold" | "unsold";

const CATEGORIES: [Category, string][] = [
  ["all", "All"],
  ["capped", "Capped"],
  ["uncapped", "Uncapped"],
  ["overseas", "Overseas"],
  ["indian", "Indian"],
  ["sold", "Sold"],
  ["unsold", "Unsold"],
];

/** IPL-style auction room for the released pool: role sections + capped /
 *  overseas filters and a franchise selector for every player. Picks are
 *  stored locally and show up in that franchise's XI builder. */
export function AuctionBoard({ released }: { released: Player[] }) {
  const [picks, setPicks] = useState<AuctionPicks>({});
  const [choice, setChoice] = useState<Record<string, TeamId | "">>({});
  const [category, setCategory] = useState<Category>("all");
  const [flash, setFlash] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPicks(readAuction());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeAuction(picks);
  }, [picks, ready]);

  const teamSummary = useMemo(
    () =>
      TEAMS.map((team) => {
        const bought = released.filter((p) => picks[p.id]?.team === team.id);
        const spent = bought.reduce((sum, p) => sum + (picks[p.id]?.price ?? 0), 0);
        return {
          team,
          bought: bought.length,
          spent,
          left: PURSE - team.payroll - spent,
          overseas: team.overseasCount + bought.filter((p) => p.overseas).length,
          slots: team.rosterSize + bought.length,
        };
      }),
    [picks, released]
  );

  const visible = useMemo(
    () =>
      released.filter((p) => {
        switch (category) {
          case "capped":
            return isCapped(p);
          case "uncapped":
            return !isCapped(p);
          case "overseas":
            return p.overseas;
          case "indian":
            return !p.overseas;
          case "sold":
            return !!picks[p.id];
          case "unsold":
            return !picks[p.id];
          default:
            return true;
        }
      }),
    [released, category, picks]
  );

  const groups = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        role,
        list: visible
          .filter((p) => p.role === role)
          .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name)),
      })).filter((g) => g.list.length),
    [visible]
  );

  const soldCount = Object.keys(picks).length;
  const soldValue = released.reduce((sum, p) => sum + (picks[p.id]?.price ?? 0), 0);

  const sell = (p: Player) => {
    const teamId = choice[p.id];
    if (!teamId) return;
    setPicks((cur) => ({ ...cur, [p.id]: { team: teamId, price: p.price } }));
    setFlash(`🔨 ${p.name} sold to ${TEAMS.find((t) => t.id === teamId)?.name} for ${fmtPrice(p.price)}`);
  };
  const unsell = (id: string) => {
    setPicks((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
    setFlash("Auction pick reversed — player back in the pool.");
  };

  return (
    <div className="mt-5 space-y-5">
      {/* franchise purse board */}
      <div className="plate p-3">
        <div className="plate-head mb-2 text-sm text-white/75">Auction room · franchise purses</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {teamSummary.map(({ team, bought, spent, left, overseas, slots }) => (
            <div
              key={team.id}
              className="rounded-lg border border-white/10 bg-black/30 p-2.5"
              style={{ borderTop: `2px solid ${team.c2}` }}>
              <div className="flex items-center gap-2">
                <TeamLogo team={team} size={26} />
                <span className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-cond)" }}>
                  {team.short}
                </span>
              </div>
              <div className="mt-1.5 text-lg font-bold" style={{ fontFamily: "var(--font-cond)", color: left >= 0 ? "#8fd694" : "#ff8a8a" }}>
                {fmtPrice(Math.max(0, left))}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/45" style={{ fontFamily: "var(--font-cond)" }}>
                purse left · {fmtPrice(spent)} spent
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-white/50" style={{ fontFamily: "var(--font-cond)" }}>
                {slots}/25 squad · ✈ {overseas}/{OVERSEAS_CAP + 4} · +{bought} bought
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Purses start from retained-contract payroll and update as you sell. Sold players appear in that franchise&apos;s
          XI builder pool — this is a local what-if auction, not official data.
        </p>
      </div>

      {flash && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
          {flash}
        </div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className="rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
              fontFamily: "var(--font-cond)",
              background: category === id ? "#f6cc1b" : "rgba(255,255,255,.05)",
              color: category === id ? "#0b2a55" : "rgba(255,255,255,.65)",
              borderColor: category === id ? "#f6cc1b" : "rgba(255,255,255,.1)",
            }}>
            {label}
          </button>
        ))}
        <span className="chip ml-auto" style={{ color: "#ffc75a" }}>
          🔨 {soldCount} sold · {fmtPrice(soldValue)}
        </span>
      </div>

      {/* role jump links */}
      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.map((role) => (
          <a
            key={role}
            href={`#auction-${role}`}
            className="chip transition-colors hover:border-white/30 hover:text-white/90"
            style={{ fontFamily: "var(--font-cond)" }}>
            {ROLE_LABEL[role]}s
            <span className="text-white/40">{released.filter((p) => p.role === role).length}</span>
          </a>
        ))}
      </div>

      {/* role-grouped pool */}
      <div className="space-y-5">
        {groups.map(({ role, list }) => (
          <section key={role} id={`auction-${role}`} className="plate overflow-hidden" style={{ scrollMarginTop: 16 }}>
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
              <RoleBadge role={role} />
              <h2 className="plate-head text-base font-bold text-white/85" style={{ fontFamily: "var(--font-display)" }}>
                {ROLE_LABEL[role]}s
              </h2>
              <span className="chip ml-auto">{list.length} available</span>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => {
                const pick = picks[p.id];
                const selected = choice[p.id] ?? pick?.team ?? "";
                const team = pick ? TEAMS.find((t) => t.id === pick.team) : undefined;
                return (
                  <div key={p.id} className="flex flex-col gap-2 rounded-lg bg-white/[0.035] p-2.5">
                    <div className="flex items-center gap-2.5">
                      <PlayerPhoto player={p} c1="#1b2540" c2="#f6cc1b" ink="#fff" size={48} ring={false} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-white/90" style={{ fontFamily: "var(--font-cond)" }}>
                            {p.name}
                          </span>
                          {p.overseas && <span className="text-[10px] text-sky-300">✈</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45" style={{ fontFamily: "var(--font-cond)" }}>
                          <span>ex-{p.team}</span>
                          <span>·</span>
                          <span className="font-bold text-amber-200/85">{fmtPrice(p.price)}</span>
                          <span className="chip" style={{ fontSize: "0.65rem", padding: "0.05rem 0.4rem" }}>
                            {isCapped(p) ? "Capped" : "Uncapped"}
                          </span>
                          <OverseasChip overseas={p.overseas} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selected}
                        onChange={(e) => setChoice((cur) => ({ ...cur, [p.id]: e.target.value as TeamId | "" }))}
                        aria-label={`Franchise for ${p.name}`}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white/85 outline-none focus:border-white/35"
                        style={{ fontFamily: "var(--font-cond)" }}>
                        <option value="">Select franchise…</option>
                        {TEAMS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.short} · {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => sell(p)}
                        disabled={!selected}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-transform enabled:hover:scale-[1.03] disabled:opacity-40"
                        style={{ fontFamily: "var(--font-cond)", background: "#f6cc1b", color: "#0b2a55" }}>
                        {pick ? "Re-sell" : "Sell"}
                      </button>
                      {pick && (
                        <button
                          onClick={() => unsell(p.id)}
                          title="Undo auction pick"
                          className="h-7 w-7 shrink-0 rounded-full text-sm text-red-300/70 hover:bg-red-400/10 hover:text-red-300">
                          ✕
                        </button>
                      )}
                    </div>
                    {pick && team && (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/90" style={{ fontFamily: "var(--font-cond)" }}>
                        ✓ Sold to {team.name} · {fmtPrice(pick.price)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="py-10 text-center text-sm text-white/45">No players match this filter.</div>
        )}
      </div>
    </div>
  );
}
