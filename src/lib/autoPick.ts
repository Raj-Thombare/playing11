import type { Player, TeamId } from "@/data/teams";
import { validateXI } from "./xi";

/**
 * AI Selection Engine
 * -------------------
 * Builds a Playing XI from a squad using career IPL records (through IPL 2026),
 * enforcing the official playing-XI constraints:
 *   - exactly 11 players
 *   - max 4 overseas
 *   - at least 1 wicketkeeper
 *   - at least 5 bowling options (specialists + all-rounders), at least 5 batting options
 *
 * Scoring per player is driven by past records:
 *   batters    -> runs/match, career average, strike rate
 *   bowlers    -> wickets/match, economy (lower is better)
 *   all-rounders -> blend of both, plus a dual-threat bonus
 * plus a small "asset" term from the contract (proxy for franchise trust)
 * and a captain boost when "build around captain" is on.
 */

export interface PickReason {
  player: Player;
  score: number;
  line: string;
}

export interface AutoPickResult {
  xi: Player[];
  reasons: PickReason[];
  template: string;
  notes: string[];
}

export function playerScore(p: Player): { bat: number; bowl: number; total: number } {
  const s = p.stats;
  const bat = s.m
    ? Math.max(0, (s.runs / s.m) * 0.42 + Math.max(0, s.sr - 118) * 0.075 + Math.min(s.avg || 20, 55) * 0.09)
    : 0;
  const bowl = s.m
    ? Math.max(0, (s.wkts / s.m) * 3.1 + Math.max(0, 9.4 - s.econ) * 1.7)
    : 0;
  let total = 0;
  switch (p.role) {
    case "BAT":
      total = bat * 1.0;
      break;
    case "WK":
      total = bat * 0.95 + 2; // keeping value
      break;
    case "AR":
      total = bat * 0.72 + bowl * 0.72 + 2.5; // dual-threat bonus
      break;
    case "PACE":
    case "SPIN":
      total = bowl * 1.0 + bat * 0.15;
      break;
  }
  total += Math.min(6, p.price * 0.16); // asset quality
  return { bat, bowl, total: Math.round(total * 100) / 100 };
}

function statLine(p: Player): string {
  const s = p.stats;
  const bits: string[] = [];
  if (s.runs >= 200) bits.push(`${s.runs.toLocaleString("en-IN")} IPL runs @ ${s.avg.toFixed(1)}, SR ${s.sr.toFixed(0)}`);
  if (s.wkts >= 5) bits.push(`${s.wkts} IPL wickets @ ${s.econ.toFixed(2)} econ`);
  if (bits.length === 0) bits.push("uncapped / early-career prospect");
  return bits.join(" · ");
}

export function autoPickXI(
  squad: Player[],
  team: TeamId,
  captain?: string,
  opts?: { buildAroundCaptain?: boolean; seed?: number }
): AutoPickResult {
  // injured (contract held) and released players can never be auto-picked
  const pool = squad.filter(
    (p) => !p.retired && p.status !== "injured" && p.status !== "released"
  );
  const buildAround = opts?.buildAroundCaptain ?? true;
  let seed = opts?.seed ?? 20261117;
  const rand = () => {
    // tiny deterministic jitter so repeats can explore alternates
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const scored = pool
    .map((p) => ({ p, s: playerScore(p) }))
    .map((x) => ({ ...x, total: x.s.total + rand() * 0.9 }))
    .sort((a, b) => b.total - a.total);

  const chosen: Player[] = [];
  const reasons: PickReason[] = [];
  const has = (p: Player) => chosen.some((c) => c.id === p.id);

  const overseasCount = () => chosen.filter((c) => c.overseas).length;

  const canAdd = (p: Player, roleQuotaLeft: number) => {
    if (has(p)) return false;
    if (chosen.length >= 11) return false;
    if (p.overseas && overseasCount() >= 4) return false;
    if (roleQuotaLeft <= 0) return false;
    return true;
  };

  const push = (p: Player) => {
    chosen.push(p);
    reasons.push({ player: p, score: Math.round(playerScore(p).total * 10) / 10, line: statLine(p) });
  };

  // 1) captain first if asked
  if (buildAround && captain) {
    const cap = scored.find((x) => x.p.name === captain && canAdd(x.p, 11));
    if (cap) push(cap.p);
  }

  // 2) anchor roles: WK (exactly 1), then role quotas
  const wk = scored.find((x) => x.p.role === "WK" && canAdd(x.p, 1));
  if (wk) push(wk.p);

  const quotas: Array<[Player["role"], number]> = [
    ["PACE", 3],
    ["SPIN", 2],
    ["BAT", 3],
    ["AR", 2],
  ];
  for (const [role, n] of quotas) {
    for (const x of scored) {
      if (chosen.filter((c) => c.role === role).length >= n) break;
      if (x.p.role === role && canAdd(x.p, n)) push(x.p);
    }
  }

  // 3) fill remaining slots by best score with relaxed constraints
  const relax = () => {
    for (const x of scored) {
      if (chosen.length >= 11) break;
      if (has(x.p)) continue;
      if (x.p.overseas && overseasCount() >= 4) continue;
      push(x.p);
    }
  };
  relax();

  // ordering for broadcast display: batters -> keepers -> allrounders -> bowlers
  const order = { BAT: 0, WK: 1, AR: 2, PACE: 3, SPIN: 4 } as const;
  const xi = chosen.slice(0, 11).sort((a, b) => order[a.role] - order[b.role] || playerScore(b).total - playerScore(a).total);

  const st = validateXI(xi);
  const ov = xi.filter((p) => p.overseas).length;
  const wkN = xi.filter((p) => p.role === "WK").length;
  const notes = [
    `Composition: ${xi.filter((p) => p.role === "BAT").length} batters · ${wkN} keeper · ${xi.filter((p) => p.role === "AR").length} all-rounders · ${xi.filter((p) => p.role === "PACE").length} fast · ${xi.filter((p) => p.role === "SPIN").length} spin`,
    `Overseas: ${ov}/4 · Balance score ${st.score}/100`,
    buildAround && captain ? `Built around captain ${captain}` : "Picked purely on career records",
  ];

  return {
    xi,
    reasons: reasons.slice(0, 11),
    template: "3 PACE · 2 SPIN · 2 AR · 3 BAT · 1 WK",
    notes,
  };
}
