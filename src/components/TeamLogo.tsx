import type { Team } from "@/data/teams";

export function TeamLogo({ team, size = 44 }: { team: Team; size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center font-display font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(140deg, ${team.c2} 0%, ${team.c1} 70%)`,
        color: team.ink,
        boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,.25), 0 6px 18px -6px ${team.c1}cc`,
        fontSize: size * 0.38,
        letterSpacing: "0.02em",
        textShadow: "0 1px 2px rgba(0,0,0,.35)",
      }}
      aria-label={team.name}
    >
      {team.short}
    </span>
  );
}
