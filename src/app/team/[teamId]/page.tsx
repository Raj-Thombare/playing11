import Link from "next/link";
import { notFound } from "next/navigation";
import { PLAYERS } from "@/data/players";
import { TRADES, teamById } from "@/data/teams";
import { TeamWorkspace } from "@/components/TeamWorkspace";

export function generateStaticParams() {
  return ["MI", "CSK", "RCB", "KKR", "DC", "PBKS", "RR", "SRH", "GT", "LSG"].map((teamId) => ({ teamId }));
}

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = teamById(teamId.toUpperCase());
  if (!team) notFound();

  const squad = PLAYERS.filter((p) => p.team === team.id);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-sm text-white/50">
        <Link href="/" className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold uppercase tracking-widest hover:bg-white/5" style={{ fontFamily: "var(--font-cond)" }}>
          ← All Teams
        </Link>
        <Link href="/released" className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold uppercase tracking-widest text-[#ff8a8a] hover:bg-white/5" style={{ fontFamily: "var(--font-cond)" }}>
          🔴 Released Players
        </Link>
        <span className="chip" style={{ color: "#ffc75a" }}>Season data: 17 Nov 2026</span>
      </nav>
      <TeamWorkspace team={team} squad={squad} trades={TRADES} />
    </div>
  );
}
