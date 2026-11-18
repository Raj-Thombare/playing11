import type { Player, Role } from "@/data/teams";

export const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batter",
  WK: "Wicketkeeper",
  AR: "All-rounder",
  PACE: "Fast bowler",
  SPIN: "Spinner",
};

export const ROLE_ORDER: Role[] = ["BAT", "WK", "AR", "PACE", "SPIN"];

export function fmtPrice(cr: number): string {
  if (cr >= 1) {
    const s = cr.toFixed(cr % 1 === 0 ? 0 : 2);
    return `₹${s} Cr`;
  }
  return `₹${Math.round(cr * 100)} L`;
}

export function fmtName(n: string): string {
  return n.toUpperCase();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface XIState {
  count: Check[];
  valid: boolean;
  overseas: number;
  wks: number;
  bowlers: number;      // PACE + SPIN (specialists)
  bowlOpts: number;     // PACE + SPIN + AR (all bowling options)
  ars: number;
  batters: number;      // BAT + WK + AR
  score: number;        // balance score 0-100
}

export function validateXI(xi: Player[]): XIState {
  const n = xi.length;
  const overseas = xi.filter((p) => p.overseas).length;
  const wks = xi.filter((p) => p.role === "WK").length;
  const bowlers = xi.filter((p) => p.role === "PACE" || p.role === "SPIN").length;
  const ars = xi.filter((p) => p.role === "AR").length;
  const bowlOpts = bowlers + ars;
  const batters = xi.filter((p) => p.role === "BAT" || p.role === "WK" || p.role === "AR").length;

  const count: Check[] = [
    { key: "total", label: "PLAYERS 11/11", ok: n === 11, detail: `${n} of 11 selected` },
    { key: "ov", label: `OVERSEAS ${overseas}/4`, ok: overseas <= 4, detail: "Max 4 overseas players in the XI" },
    { key: "wk", label: `KEEPER ${wks >= 1 ? "✓" : "0"}`, ok: wks >= 1, detail: "At least 1 wicketkeeper required" },
    { key: "bowl", label: `BOWLING ${bowlOpts}/5`, ok: bowlOpts >= 5, detail: "At least 5 bowling options (fast, spin, all-rounders)" },
    { key: "bat", label: `BATTING ${batters}/5`, ok: batters >= 5, detail: "At least 5 batting options (batters, keepers, all-rounders)" },
  ];

  // Balance score: reward realistic template, penalise deviations
  let score = 0;
  if (n === 11) score += 25;
  if (overseas <= 4) score += 15;
  if (overseas >= 3) score += 5;
  if (wks >= 1) score += 15;
  if (bowlOpts >= 5) score += 20;
  if (batters >= 5) score += 15;
  if (wks >= 2 && wks <= 3) score += 3;
  if (bowlOpts >= 6) score += 2;

  return { count, valid: count.every((c) => c.ok), overseas, wks, bowlers, bowlOpts, ars, batters, score };
}
