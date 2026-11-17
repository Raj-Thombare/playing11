import type { Role } from "@/data/teams";
import { ROLE_LABEL } from "@/lib/xi";

const GLYPH: Record<Role, string> = {
  BAT: "🏏",
  WK: "🧤",
  AR: "⚡",
  PACE: "🔥",
  SPIN: "🎯",
};

export function RoleBadge({ role, compact = false }: { role: Role; compact?: boolean }) {
  return (
    <span className="chip" style={{ gap: compact ? 2 : 6 }}>
      <span aria-hidden>{GLYPH[role]}</span>
      {!compact && <span>{ROLE_LABEL[role]}</span>}
    </span>
  );
}

export function OverseasChip({ overseas }: { overseas: boolean }) {
  return overseas ? (
    <span className="chip" style={{ borderColor: "rgba(120,180,255,.4)", color: "#9cc3ff" }} title="Overseas player">
      ✈ OV
    </span>
  ) : (
    <span className="chip" style={{ color: "#8fd694" }} title="Indian player">
      IN
    </span>
  );
}

export function StatusBadge({ status, note }: { status: string; note?: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    retained: { bg: "rgba(120,220,150,.12)", fg: "#8fd694", label: "RETAINED" },
    "trade-in": { bg: "rgba(255,190,70,.14)", fg: "#ffc75a", label: "TRADED IN" },
    auction: { bg: "rgba(150,140,255,.16)", fg: "#b9aeff", label: "AUCTION BUY" },
    replacement: { bg: "rgba(255,255,255,.08)", fg: "#aab2c3", label: "REPLACEMENT" },
    injured: { bg: "rgba(255,170,60,.16)", fg: "#ffb84d", label: "🩹 INJURED" },
    released: { bg: "rgba(255,90,90,.16)", fg: "#ff7a7a", label: "RELEASED" },
    retired: { bg: "rgba(255,110,110,.12)", fg: "#ff8a8a", label: "RETIRED" },
  };
  const s = map[status] ?? map.retained;
  return (
    <span
      className="chip"
      style={{ background: s.bg, color: s.fg, borderColor: "transparent", cursor: note ? "help" : undefined }}
      title={note}
    >
      {s.label}
    </span>
  );
}
