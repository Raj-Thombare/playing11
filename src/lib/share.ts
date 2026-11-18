import type { Player, Team } from "@/data/teams";

/**
 * Share plumbing for a built XI.
 *
 * The XI lives in localStorage (`iplxi:sel:{team}`) per browser, so sharing
 * encodes it into the team URL: /team/MI?xi=id,id,~,id&cap=id
 *   - slots are comma-joined in slot order (1–11); an empty slot is "~"
 *   - trailing empty slots are trimmed
 *   - `cap` carries the captain's player id (optional)
 *   - `impact` carries the 12th / Impact Player's id (optional)
 *   - `view=reveal` makes the link open straight into the broadcast overlay
 */

export interface ShareEntry {
  /** XI player in slot order */
  p: Player;
  /** 1-based slot number */
  slot: number;
}

const EMPTY = "~";

/** sparse slots (slot-ordered) → "id,id,~,id…" (trailing empties trimmed) */
export function encodeSlots(slots: (string | null)[]): string {
  const arr = [...slots];
  while (arr.length && !arr[arr.length - 1]) arr.pop();
  return arr.map((id) => id ?? EMPTY).join(",");
}

/** "id,id,~,id…" → sparse slots of length 11 (unknown tokens kept for validation) */
export function decodeSlots(raw: string): (string | null)[] {
  const out: (string | null)[] = Array<string | null>(11).fill(null);
  raw.split(",").slice(0, 11).forEach((tok, i) => {
    if (tok && tok !== EMPTY) out[i] = tok;
  });
  return out;
}

export function sharePath(
  teamId: string,
  slots: (string | null)[],
  captainId?: string | null,
  impactId?: string | null
): string {
  const params = new URLSearchParams();
  params.set("xi", encodeSlots(slots));
  if (captainId) params.set("cap", captainId);
  if (impactId) params.set("impact", impactId);
  return `/team/${teamId}?${params.toString()}`;
}

/** absolute share URL (empty string during SSR — never rendered as text) */
export function shareUrl(
  teamId: string,
  slots: (string | null)[],
  captainId?: string | null,
  impactId?: string | null
): string {
  const path = sharePath(teamId, slots, captainId, impactId);
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
}

/** absolute link that opens straight into the broadcast "Reveal on Air" overlay.
 *  The recipient sees only the on-air graphic until they close it, then lands
 *  in the builder with the shared XI loaded (read-only — their own saved XI is
 *  untouched). */
export function revealUrl(
  teamId: string,
  slots: (string | null)[],
  captainId?: string | null,
  impactId?: string | null
): string {
  const url = shareUrl(teamId, slots, captainId, impactId);
  return url.includes("?") ? `${url}&view=reveal` : `${url}?view=reveal`;
}

/** copy text to the clipboard, with an execCommand fallback for older browsers */
export function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
  }
}

/** human-readable share text: team, slotted XI, captain, balance */
export function shareText(
  team: Team,
  ordered: ShareEntry[],
  captainId?: string | null,
  score?: number
): string {
  const lines: string[] = [];
  lines.push(`🏏 ${team.name} — My Playing XI (IPL 2027)`);
  lines.push("");
  for (const e of ordered) {
    const tags = [e.p.id === captainId ? "©" : "", e.p.overseas ? "✈" : ""].filter(Boolean).join(" ");
    lines.push(`${e.slot}. ${e.p.name}${tags ? ` ${tags}` : ""}`);
  }
  if (captainId) {
    const cap = ordered.find((e) => e.p.id === captainId)?.p;
    lines.push("");
    lines.push(`★ Captain: ${cap?.name ?? captainId}`);
  }
  const xi = ordered.map((e) => e.p);
  const ov = xi.filter((p) => p.overseas).length;
  const value = xi.reduce((a, p) => a + p.price, 0);
  lines.push("");
  lines.push(`✈ Overseas ${ov}/4 · Balance ${score ?? "—"}/100 · XI ₹${value.toFixed(2).replace(/\.00$/, "")} Cr`);
  lines.push("");
  lines.push("Build & share your own XI ↓");
  return lines.join("\n");
}
