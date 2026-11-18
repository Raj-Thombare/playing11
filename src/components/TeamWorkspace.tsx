"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { Player, Team, Trade } from "@/data/teams";
import { OVERSEAS_CAP, PURSE } from "@/data/teams";
import { PlayerPhoto, getPhotoMode, setPhotoMode, PREF_EVENT, type PhotoMode } from "./PlayerPhoto";
import { OverseasChip, RoleBadge, StatusBadge } from "./Badges";
import { TeamLogo } from "./TeamLogo";
import { BroadcastOverlay } from "./BroadcastOverlay";
import { ROLE_LABEL, ROLE_ORDER, fmtPrice, validateXI, type Check } from "@/lib/xi";
import { autoPickXI, type AutoPickResult } from "@/lib/autoPick";
import { copyToClipboard, decodeSlots, revealUrl } from "@/lib/share";

type Tab = "builder" | "squad" | "trades";

/* ====================================================================
 * Sparse XI slots — a player can be placed in ANY slot 1–11, even if
 * he is the only one selected. Empty slots stay null; order is the slot
 * index, so drag & drop simply rearranges the array.
 * ==================================================================== */

type Slots = (string | null)[];

const emptySlots = (): Slots => Array<string | null>(11).fill(null);

interface DragPayload {
  id: string;
  from: "slot" | "pool";
  idx?: number;
}

const DND_MIME = "text/plain";

function startDrag(e: React.DragEvent, payload: DragPayload): void {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

function readPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return null;
    const d = JSON.parse(raw) as DragPayload;
    return d && typeof d.id === "string" ? d : null;
  } catch {
    return null;
  }
}

/** every occupied slot must reference a pickable player; caps enforced */
function legalXI(slots: Slots, byId: Map<string, Player>): boolean {
  let n = 0;
  let ov = 0;
  for (const id of slots) {
    if (!id) continue;
    const p = byId.get(id);
    if (!p || p.retired || p.status === "injured" || p.status === "released") return false;
    n += 1;
    if (p.overseas) ov += 1;
  }
  return n <= 11 && ov <= OVERSEAS_CAP;
}

/**
 * Place player `id` at slot `targetIdx` (DnD semantics):
 *   - already in the XI → move / swap with the target slot's occupant
 *   - from the pool → empty target: add; occupied target: the occupant
 *     shifts to the first empty slot (or returns to the pool if the XI is full)
 * Returns the next slots, or null when the move is illegal.
 */
function computePlace(cur: Slots, targetIdx: number, id: string, byId: Map<string, Player>): Slots | null {
  if (targetIdx < 0 || targetIdx > 10) return null;
  const p = byId.get(id);
  if (!p || p.retired || p.status === "injured" || p.status === "released") return null;
  const fromIdx = cur.indexOf(id);
  if (fromIdx === targetIdx) return null;
  const next = [...cur];
  if (fromIdx !== -1) {
    const occupant = next[targetIdx];
    next[targetIdx] = id;
    next[fromIdx] = occupant;
    return next;
  }
  const occupant = next[targetIdx];
  if (!occupant) {
    next[targetIdx] = id;
  } else {
    const emptyIdx = next.indexOf(null);
    if (emptyIdx !== -1) {
      next[targetIdx] = id;
      next[emptyIdx] = occupant;
    } else {
      // XI full — the displaced player goes back to the pool
      next[targetIdx] = id;
    }
  }
  return legalXI(next, byId) ? next : null;
}

/* ====================================================================
 * Sub-components are hoisted to module scope with stable identity.
 * Previously they were defined inside TeamWorkspace, so every selection
 * change created a new component type and React remounted the entire
 * squad list — resetting every PlayerPhoto (the avatar "refresh" bug).
 * ==================================================================== */

const ValidationStrip = memo(function ValidationStrip({ checks }: { checks: Check[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {checks.map((c) => (
        <span
          key={c.key}
          className="chip"
          title={c.detail}
          style={{
            color: c.ok ? "#8fd694" : "#ff9b8a",
            borderColor: c.ok ? "rgba(143,214,148,.35)" : "rgba(255,155,138,.35)",
            background: c.ok ? "rgba(143,214,148,.08)" : "rgba(255,155,138,.08)",
          }}
        >
          {c.ok ? "✓" : "✕"} {c.label}
        </span>
      ))}
    </div>
  );
});

const BalanceMeter = memo(function BalanceMeter({ score, c1, c2 }: { score: number; c1: string; c2: string }) {
  return (
    <div>
      <div
        className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/50"
        style={{ fontFamily: "var(--font-cond)" }}
      >
        <span>Squad balance</span>
        <span style={{ color: c2 }}>{score}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, ${c1}, ${c2})` }}
        />
      </div>
    </div>
  );
});

const PhotoModeToggle = memo(function PhotoModeToggle() {
  const [mode, setLocal] = useState<PhotoMode>(getPhotoMode());
  useEffect(() => {
    const on = () => setLocal(getPhotoMode());
    window.addEventListener(PREF_EVENT, on);
    return () => window.removeEventListener(PREF_EVENT, on);
  }, []);
  const wiki = mode === "wiki";
  return (
    <button
      type="button"
      onClick={() => setPhotoMode(wiki ? "ipl" : "wiki")}
      className="chip"
      title={
        wiki
          ? "Photos: official IPL headshots first, Wikipedia fallback"
          : "Strictly official IPL team headshots — click to allow a Wikipedia fallback for players without one"
      }
      style={{ color: wiki ? "#9cc3ff" : "#8fd694", borderColor: "rgba(255,255,255,.18)" }}
    >
      {wiki ? "🌐 Photos: IPL + Wiki" : "🛡️ Photos: IPL only"}
    </button>
  );
});

const Slot = memo(function Slot({
  n,
  player,
  team,
  isCap,
  dragActive,
  onCaptain,
  onMove,
  onRemove,
  onDropPlace,
  onDragStart,
  onDragEnd,
}: {
  n: number;
  player?: Player;
  team: Team;
  isCap: boolean;
  dragActive: string | null; // id currently being dragged, if any
  onCaptain: (id: string) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onDropPlace: (idx: number, id: string) => void;
  onDragStart: (payload: DragPayload) => void;
  onDragEnd: () => void;
}) {
  const [over, setOver] = useState(false);
  const i = n - 1;

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragActive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!over) setOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const d = readPayload(e);
    if (d) onDropPlace(i, d.id);
  };

  const dropHighlight = over
    ? { background: `${team.c1}33`, border: `1px dashed ${team.c2}` }
    : undefined;

  if (!player)
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 transition-colors"
        style={{ borderColor: over ? team.c2 : "rgba(255,255,255,.15)", color: over ? "#fff" : "rgba(255,255,255,.35)", ...dropHighlight }}
      >
        <span className="w-8 text-right text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {n}
        </span>
        <span className="text-sm uppercase tracking-widest" style={{ fontFamily: "var(--font-cond)" }}>
          {over ? "Drop to pick slot " + n : "Slot " + n + " — drop a player here"}
        </span>
      </div>
    );

  return (
    <div
      draggable
      onDragStart={(e) => {
        startDrag(e, { id: player.id, from: "slot", idx: i });
        onDragStart({ id: player.id, from: "slot", idx: i });
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
      style={{
        background: over ? `${team.c1}33` : "rgba(255,255,255,.045)",
        border: `1px solid ${over ? team.c2 : team.c2 + "33"}`,
        borderStyle: over ? "dashed" : "solid",
        cursor: "grab",
      }}
    >
      <span className="w-8 text-right text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: team.c2 }}>
        {n}
      </span>
      <PlayerPhoto player={player} c1={team.c1} c2={team.c2} ink={team.ink} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: "var(--font-cond)" }}>
            {player.name}
          </span>
          {player.overseas && <span className="text-[10px] text-sky-300">✈</span>}
          {isCap && <span title="Captain">★</span>}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-white/45">
          {ROLE_LABEL[player.role]} · {fmtPrice(player.price)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onCaptain(player.id)}
          title="Set as captain"
          className={`h-6 w-6 rounded ${isCap ? "text-amber-300" : "text-white/35 hover:text-white"}`}
        >
          ★
        </button>
        <button onClick={() => onMove(i, -1)} title="Move up / swap with slot above" className="h-6 w-6 rounded text-white/40 hover:text-white">
          ↑
        </button>
        <button onClick={() => onMove(i, 1)} title="Move down / swap with slot below" className="h-6 w-6 rounded text-white/40 hover:text-white">
          ↓
        </button>
        <button onClick={() => onRemove(player.id)} title="Remove from XI (or drag back to the squad)" className="h-6 w-6 rounded text-red-300/70 hover:text-red-300">
          ✕
        </button>
      </div>
    </div>
  );
});

const PlayerRow = memo(function PlayerRow({
  p,
  team,
  inXI,
  slotNo,
  blocked,
  ovFull,
  locked,
  dragActive,
  onToggle,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  p: Player;
  team: Team;
  inXI: boolean;
  slotNo: number | null; // 1-based slot when in the XI
  blocked: boolean; // XI already full
  ovFull: boolean; // overseas cap reached in current XI
  locked: boolean; // injured / released — cannot be picked
  dragActive: string | null;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (payload: DragPayload) => void;
  onDragEnd: () => void;
}) {
  const [over, setOver] = useState(false);
  const disabled = !inXI && (blocked || locked || (ovFull && p.overseas));
  const title = inXI
    ? "Remove from XI (slot " + slotNo + ") — or drag into any free slot"
    : locked
      ? p.status === "injured"
        ? "Injured — contract held, unavailable for the XI"
        : "Released — no longer on the roster"
      : blocked
        ? "XI is full (11)"
        : ovFull && p.overseas
          ? "Overseas cap (4) reached in XI"
          : "Add to XI";

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragActive || dragActive === p.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!over) setOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const d = readPayload(e);
    if (d && d.id !== p.id) onRemove(d.id);
  };

  return (
    <div
      draggable={!locked && !p.retired}
      onDragStart={(e) => {
        if (locked || p.retired) return;
        startDrag(e, { id: p.id, from: "pool" });
        onDragStart({ id: p.id, from: "pool" });
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors"
      style={{
        background: over ? "rgba(255,107,107,.12)" : inXI ? `${team.c1}26` : "rgba(255,255,255,.03)",
        boxShadow: over
          ? "inset 0 0 0 1px rgba(255,107,107,.5)"
          : inXI
            ? `inset 0 0 0 1px ${team.c2}66`
            : undefined,
        opacity: locked ? 0.55 : blocked && !inXI ? 0.45 : 1,
        cursor: locked || p.retired ? "not-allowed" : "grab",
      }}
      title={locked || p.retired ? undefined : "Drag into any slot 1–11"}
    >
      <PlayerPhoto player={p} c1={team.c1} c2={team.c2} ink={team.ink} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ fontFamily: "var(--font-cond)" }}>
            {p.name}
          </span>
          {inXI && slotNo && (
            <span className="chip hidden sm:inline-flex" style={{ color: team.c2, borderColor: `${team.c2}55`, fontSize: "0.68rem" }}>
              slot {slotNo}
            </span>
          )}
          {p.releaseWatch && (
            <span
              className="chip hidden sm:inline-flex"
              style={{ color: "#ffbf6b", borderColor: "rgba(255,191,107,.3)" }}
              title={`Release watch: ${p.releaseWatch}`}
            >
              ⚠
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45">
          <span>{p.country}</span>
          <span>·</span>
          <span>{fmtPrice(p.price)}</span>
          <StatusBadge status={p.status} note={p.note} />
        </div>
      </div>
      <RoleBadge role={p.role} compact />
      <button
        onClick={() => onToggle(p.id)}
        disabled={disabled}
        className={`h-7 w-7 shrink-0 rounded-full border text-sm font-bold transition-colors ${
          inXI
            ? "border-red-400/40 text-red-300 hover:bg-red-400/10"
            : "border-white/25 text-white/80 enabled:hover:bg-white/10 disabled:cursor-not-allowed"
        }`}
        title={title}
      >
        {inXI ? "−" : "+"}
      </button>
    </div>
  );
});

/* ==================================================================== */

export function TeamWorkspace({
  team,
  squad,
  trades,
}: {
  team: Team;
  squad: Player[]; // full roster incl. retired records
  trades: Trade[];
}) {
  const byId = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);

  /* roster splits — all data-derived */
  const contracted = useMemo(() => squad.filter((p) => !p.retired && p.status !== "released"), [squad]);
  const fit = useMemo(() => contracted.filter((p) => p.status !== "injured"), [contracted]);
  const injuredList = useMemo(() => contracted.filter((p) => p.status === "injured"), [contracted]);
  const releasedList = useMemo(() => squad.filter((p) => p.status === "released"), [squad]);
  const retiredList = useMemo(() => squad.filter((p) => p.retired), [squad]);
  const ovContracted = useMemo(() => contracted.filter((p) => p.overseas).length, [contracted]);
  const ovFit = useMemo(() => fit.filter((p) => p.overseas).length, [fit]);

  const [tab, setTab] = useState<Tab>("builder");
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [ai, setAi] = useState<AutoPickResult | null>(null);
  const [onAir, setOnAir] = useState(false);
  const [q, setQ] = useState("");
  const [ovFilter, setOvFilter] = useState<"all" | "IN" | "OV">("all");
  const [freed, setFreed] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  /** copy a link that opens this XI straight in the on-air reveal */
  const copyRevealLink = useCallback(() => {
    copyToClipboard(revealUrl(team.id, slots, captainId));
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2200);
  }, [team.id, slots, captainId]);

  /* ---- persistence (loads once, then only saves after hydration) ----
     A shared link (?xi=…&cap=…) wins over this browser's saved XI, so the
     recipient sees the shared XI exactly as it was built. With view=reveal
     the page opens straight into the broadcast overlay — the friend sees
     only the on-air reveal until they close it. */
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const xiParam = params.get("xi");
      if (xiParam) {
        const next = emptySlots();
        decodeSlots(xiParam).forEach((id, i) => {
          if (!id) return;
          const p = byId.get(id);
          next[i] = p && !p.retired && p.status !== "injured" && p.status !== "released" ? id : null;
        });
        setSlots(next);
        setFromLink(true);
        const cap = params.get("cap");
        if (cap && byId.has(cap)) setCaptainId(cap);
        if (params.get("view") === "reveal") setOnAir(true);
        setReady(true);
        return;
      }
      const s = localStorage.getItem(`iplxi:sel:${team.id}`);
      if (s) {
        const arr = JSON.parse(s) as (string | null)[];
        if (Array.isArray(arr)) {
          const next = emptySlots();
          arr.slice(0, 11).forEach((id, i) => {
            if (!id) return;
            const p = byId.get(id);
            next[i] = p && !p.retired && p.status !== "injured" && p.status !== "released" ? id : null;
          });
          setSlots(next);
        }
      }
      const c = localStorage.getItem(`iplxi:cap:${team.id}`);
      if (c && byId.has(c)) setCaptainId(c);
    } catch {}
    setReady(true);
  }, [team.id, byId]);

  /* a shared XI is read-only in the recipient's browser — never overwrite
     their own locally-saved XI with someone else's picks */
  useEffect(() => {
    if (!ready || fromLink) return;
    try {
      localStorage.setItem(`iplxi:sel:${team.id}`, JSON.stringify(slots));
    } catch {}
  }, [slots, ready, fromLink, team.id]);

  useEffect(() => {
    if (!ready || fromLink) return;
    try {
      if (captainId) localStorage.setItem(`iplxi:cap:${team.id}`, captainId);
    } catch {}
  }, [captainId, ready, fromLink, team.id]);

  /* ---- derived ---- */
  const xi = useMemo(
    () =>
      slots
        .filter((x): x is string => !!x)
        .map((id) => byId.get(id))
        .filter((p): p is Player => !!p),
    [slots, byId]
  );
  /** XI in slot order with 1-based slot numbers (batting positions for the reveal) */
  const ordered = useMemo(
    () =>
      slots
        .map((id, i) => {
          const p = id ? byId.get(id) : undefined;
          return p ? { p, slot: i + 1 } : null;
        })
        .filter((x): x is { p: Player; slot: number } => !!x),
    [slots, byId]
  );
  /** bench options for the reveal: biggest contracts not in the XI */
  const subs = useMemo(
    () =>
      fit
        .filter((p) => !slots.includes(p.id))
        .sort((a, b) => b.price - a.price)
        .slice(0, 5),
    [fit, slots]
  );
  /** reveal link — opens this XI straight in the on-air overlay */
  const revealHref = useMemo(() => revealUrl(team.id, slots, captainId), [team.id, slots, captainId]);
  const picked = xi.length;
  const st = validateXI(xi);
  const captain = captainId ? byId.get(captainId)?.name : team.captain;
  const watched = useMemo(() => squad.filter((p) => p.releaseWatch && p.status !== "released"), [squad]);
  const freedTotal = watched.filter((p) => freed[p.id]).reduce((a, p) => a + p.price, 0);

  const onDragStart = useCallback((payload: DragPayload) => setDragId(payload.id), []);
  const onDragEnd = useCallback(() => setDragId(null), []);

  /** drop a dragged player onto slot idx (from a slot or the pool) */
  const dropPlace = useCallback(
    (idx: number, id: string) => {
      setSaved(false);
      setSlots((cur) => computePlace(cur, idx, id, byId) ?? cur);
    },
    [byId]
  );

  /** "＋" on a pool row → first empty slot (any order the user wants, arrows/DnD refine it) */
  const placeFirstEmpty = useCallback(
    (id: string) => {
      setSaved(false);
      setSlots((cur) => {
        const p = byId.get(id);
        if (!p || p.retired || p.status === "injured" || p.status === "released") return cur;
        if (cur.includes(id)) return cur.filter((x) => x !== id); // acts as "−" for XI players
        const emptyIdx = cur.indexOf(null);
        if (emptyIdx === -1) return cur;
        const next = [...cur];
        next[emptyIdx] = id;
        return legalXI(next, byId) ? next : cur;
      });
    },
    [byId]
  );

  /** ✕ on a slot, or dropping a player back onto the squad */
  const removeFromXI = useCallback((id: string) => {
    setSaved(false);
    setSlots((cur) => (cur.includes(id) ? cur.map((x) => (x === id ? null : x)) : cur));
  }, []);

  const move = useCallback((i: number, dir: -1 | 1) => {
    setSlots((cur) => {
      const j = i + dir;
      if (j < 0 || j > 10) return cur;
      const next = [...cur];
      const a = next[i];
      next[i] = next[j];
      next[j] = a;
      return next;
    });
  }, []);

  const reset = () => {
    setSlots(emptySlots());
    setAi(null);
    setSaved(false);
  };

  const runAI = () => {
    // AI never picks injured or released players
    const result = autoPickXI(fit, team.id, captain ?? undefined);
    setAi(result);
    const next = emptySlots();
    result.xi.slice(0, 11).forEach((p, i) => {
      next[i] = p.id;
    });
    setSlots(next);
    if (!result.xi.some((p) => p.id === captainId)) setCaptainId(result.xi[0]?.id ?? null);
  };

  const pool = useMemo(() => {
    return contracted
      .filter((p) => (ovFilter === "all" ? true : ovFilter === "OV" ? p.overseas : !p.overseas))
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.price - a.price);
  }, [contracted, q, ovFilter]);

  const grouped = useMemo(() => {
    return ROLE_ORDER.map((r) => ({ role: r, list: pool.filter((p) => p.role === r) })).filter((g) => g.list.length);
  }, [pool]);

  const teamTrades = trades.filter((t) => t.moves.some((m) => m.from === team.id || m.to === team.id));

  /* ============ render ============ */

  return (
    <div>
      {/* team header */}
      <div className='relative overflow-hidden rounded-2xl border border-white/10'>
        <div className='absolute inset-0 beams' />
        <div
          className='absolute inset-0'
          style={{
            background: `linear-gradient(120deg, ${team.c1}e6 0%, ${team.c1}99 45%, transparent 100%)`,
          }}
        />
        <div className='absolute inset-0 vignette' />
        <div className='relative flex flex-wrap items-center gap-4 p-5 sm:p-7'>
          <TeamLogo team={team} size={64} />
          <div className='min-w-0'>
            <h1
              className='text-3xl font-bold uppercase leading-none tracking-wide sm:text-4xl'
              style={{ fontFamily: "var(--font-display)", color: "#fff" }}>
              {team.name}
            </h1>
            <div
              className='mt-1 text-sm font-semibold uppercase tracking-[0.25em]'
              style={{ fontFamily: "var(--font-cond)", color: team.ink }}>
              {team.city} · {team.venue}
            </div>
          </div>
          <div className='ml-auto grid grid-cols-2 gap-2 text-center sm:grid-cols-4'>
            {[
              [
                "Titles",
                team.titles
                  ? `${team.titles} (${team.titleYears.join(", ")})`
                  : "0",
              ],
              ["Captain", team.captain ?? "TBA"],
              ["Contracts", `${contracted.length}/25`],
              ["Overseas", `${ovContracted}/8`],
            ].map(([k, v]) => (
              <div
                key={k}
                className='rounded-lg bg-black/30 px-3 py-2 backdrop-blur'>
                <div className='text-[10px] uppercase tracking-widest text-white/60'>
                  {k}
                </div>
                <div
                  className='text-sm font-bold'
                  style={{ fontFamily: "var(--font-cond)", color: team.ink }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
          <p className='w-full text-sm text-white/85'>{team.statusLine}</p>
          {injuredList.length > 0 && (
            <div className='w-full'>
              <span
                className='chip'
                style={{
                  color: "#ffb84d",
                  borderColor: "rgba(255,184,77,.35)",
                  background: "rgba(255,184,77,.08)",
                }}
                title={injuredList.map((p) => p.name).join(", ")}>
                🩹 {injuredList.length} injured — contracts held, not released
              </span>
            </div>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className='mt-4 flex flex-wrap gap-1.5'>
        {(
          [
            ["builder", "XI Builder"],
            ["squad", "Squad & Retention"],
            ["trades", "Trades & Captains"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className='rounded-full px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors'
            style={{
              fontFamily: "var(--font-cond)",
              background:
                tab === id
                  ? `linear-gradient(100deg, ${team.c1}, ${team.c2})`
                  : "rgba(255,255,255,.05)",
              color: tab === id ? "#fff" : "rgba(255,255,255,.65)",
              border: "1px solid rgba(255,255,255,.1)",
            }}>
            {label}
          </button>
        ))}
        <span className='ml-auto self-center text-xs text-white/40'>
          {saved
            ? "XI saved ✓"
            : fromLink
              ? "🔗 Shared XI loaded — read-only; your own saved XI is untouched"
              : "XI auto-saves to this browser"}
        </span>
      </div>

      {/* ================= BUILDER ================= */}
      {tab === "builder" && (
        <div className='mt-4 grid gap-4 lg:grid-cols-5'>
          {/* pool */}
          <div className='lg:col-span-3'>
            <div className='plate p-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder='Search squad…'
                  className='min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-white/30'
                />
                {(["all", "IN", "OV"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setOvFilter(f)}
                    className='rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest'
                    style={{
                      fontFamily: "var(--font-cond)",
                      background:
                        ovFilter === f ? `${team.c1}` : "rgba(255,255,255,.05)",
                      color: ovFilter === f ? "#fff" : "rgba(255,255,255,.6)",
                    }}>
                    {f === "all" ? "All" : f === "IN" ? "Indian" : "Overseas"}
                  </button>
                ))}
                <PhotoModeToggle />
                {injuredList.length > 0 && (
                  <span
                    className='chip'
                    style={{
                      color: "#ffb84d",
                      borderColor: "rgba(255,184,77,.3)",
                    }}
                    title="Injured players hold contracts but can't be picked in the XI">
                    🩹 injured locked
                  </span>
                )}
              </div>
              <p
                className='mt-2 text-[11px] uppercase tracking-widest text-white/35'
                style={{ fontFamily: "var(--font-cond)" }}>
                Drag any player into any slot 1–11 — or drop him back here to
                remove
              </p>
              <div className='mt-3 max-h-[70vh] space-y-4 overflow-y-auto pr-1'>
                {grouped.map((g) => (
                  <div key={g.role}>
                    <div
                      className='mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50'
                      style={{ fontFamily: "var(--font-cond)" }}>
                      {ROLE_LABEL[g.role]}s
                      <span className='h-px flex-1 bg-white/10' />
                      <span>{g.list.length}</span>
                    </div>
                    <div className='grid gap-1.5 sm:grid-cols-2'>
                      {g.list.map((p) => (
                        <PlayerRow
                          key={p.id}
                          p={p}
                          team={team}
                          inXI={slots.includes(p.id)}
                          slotNo={slots.indexOf(p.id) + 1}
                          blocked={picked >= 11}
                          ovFull={st.overseas >= OVERSEAS_CAP}
                          locked={
                            p.status === "injured" || p.status === "released"
                          }
                          dragActive={dragId}
                          onToggle={placeFirstEmpty}
                          onRemove={removeFromXI}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {pool.length === 0 && (
                  <div className='py-10 text-center text-white/40'>
                    No players match the filters.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* XI board */}
          <div className='lg:col-span-2'>
            <div
              className='plate sticky top-4 p-3'
              style={{ boxShadow: `0 30px 80px -40px ${team.c1}` }}>
              <div
                className='sheen flex items-center justify-between rounded-lg px-3 py-2'
                style={{
                  background: `linear-gradient(100deg, ${team.c1}, ${team.c2})`,
                }}>
                <span
                  className='text-lg font-bold uppercase tracking-widest text-white'
                  style={{ fontFamily: "var(--font-display)" }}>
                  Playing XI
                </span>
                <span
                  className='chip'
                  style={{
                    background: "rgba(0,0,0,.3)",
                    color: team.ink,
                    borderColor: "transparent",
                  }}>
                  {picked}/11
                </span>
              </div>
              <p
                className='mt-2 px-1 text-[11px] uppercase tracking-widest text-white/35'
                style={{ fontFamily: "var(--font-cond)" }}>
                Drag between slots to reorder · drop a player on a filled slot
                to swap
              </p>
              <div className='mt-2 space-y-1.5'>
                {Array.from({ length: 11 }, (_, i) => (
                  <Slot
                    key={i}
                    n={i + 1}
                    player={slots[i] ? byId.get(slots[i] as string) : undefined}
                    team={team}
                    isCap={!!slots[i] && slots[i] === captainId}
                    dragActive={dragId}
                    onCaptain={setCaptainId}
                    onMove={move}
                    onRemove={removeFromXI}
                    onDropPlace={dropPlace}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
              <div className='mt-3'>
                <ValidationStrip checks={st.count} />
              </div>
              <div className='mt-3'>
                <BalanceMeter score={st.score} c1={team.c1} c2={team.c2} />
              </div>
              <div className='mt-3 grid grid-cols-2 gap-2'>
                <button
                  onClick={runAI}
                  className='rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-[1.02]'
                  style={{
                    fontFamily: "var(--font-cond)",
                    background: "linear-gradient(100deg, #7b2ff7, #b02ff7)",
                    boxShadow: "0 10px 30px -12px #7b2ff7",
                  }}>
                  ⚡ Auto-Pick XI (AI)
                </button>
                <button
                  onClick={() => picked > 0 && setOnAir(true)}
                  disabled={!picked}
                  className='rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-widest transition-transform enabled:hover:scale-[1.02] disabled:opacity-40'
                  style={{
                    fontFamily: "var(--font-cond)",
                    background: `linear-gradient(100deg, ${team.c1}, ${team.c2})`,
                    color: team.ink,
                  }}
                  title={
                    picked
                      ? "Show the broadcast playing-XI graphic — empty slots appear as placeholders"
                      : "Pick at least one player first"
                  }>
                  📺 View Playing XI
                </button>
                <button
                  onClick={reset}
                  className='rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/5'
                  style={{ fontFamily: "var(--font-cond)" }}>
                  Reset
                </button>
                <button
                  onClick={() => setSaved(true)}
                  className='rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:bg-white/5'
                  style={{ fontFamily: "var(--font-cond)" }}>
                  Mark as Final
                </button>
                <button
                  onClick={copyRevealLink}
                  disabled={!xi.length}
                  className='col-span-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-widest transition-transform enabled:hover:scale-[1.01] enabled:hover:bg-white/5 disabled:opacity-40'
                  style={{
                    fontFamily: "var(--font-cond)",
                    color: linkCopied ? "#8fd694" : undefined,
                  }}
                  title='Copy a link — whoever opens it sees this XI as the full-screen on-air reveal'>
                  {linkCopied
                    ? "🔗 Playing XI link copied ✓"
                    : "🔗 Copy Playing XI Link"}
                </button>
              </div>
              {ai && (
                <div className='mt-3 rounded-lg border border-purple-400/20 bg-purple-500/5 p-3'>
                  <div
                    className='text-xs font-bold uppercase tracking-[0.2em] text-purple-300'
                    style={{ fontFamily: "var(--font-cond)" }}>
                    AI Selection Engine — why this XI
                  </div>
                  <div className='mt-1 text-[11px] text-white/55'>
                    {ai.notes.join(" · ")}
                  </div>
                  <div className='mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1'>
                    {ai.reasons.map((r) => (
                      <div
                        key={r.player.id}
                        className='rounded bg-black/30 px-2.5 py-1.5 text-xs'>
                        <span className='font-bold text-white'>
                          {r.player.name}
                        </span>
                        <span className='ml-2 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-200'>
                          {r.score.toFixed(1)}
                        </span>
                        <div className='mt-0.5 text-white/50'>{r.line}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= SQUAD & RETENTION ================= */}
      {tab === "squad" && (
        <div className='mt-4 space-y-4'>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {[
              [
                "Contracts",
                `${contracted.length}/25 cap`,
                contracted.length > 25
                  ? "over limit — cuts due"
                  : "all contracts counted",
              ],
              ["Fit now", `${fit.length}`, "available for the 2027 XI"],
              ["Overseas", `${ovContracted}/8 cap`, `fit: ${ovFit}`],
              ["Payroll", fmtPrice(team.payroll), "known contracts"],
              [
                "Purse left",
                fmtPrice(Math.max(0, PURSE - team.payroll)),
                "of ₹130 Cr (est.)",
              ],
              ["Deadline", "17 Nov 2026", "retentions & cuts due"],
            ].map(([k, v, sub], i) => (
              <div key={i} className='plate p-3'>
                <div className='text-[10px] uppercase tracking-widest text-white/45'>
                  {k}
                </div>
                <div
                  className='mt-0.5 text-xl font-bold'
                  style={{ fontFamily: "var(--font-display)", color: team.c2 }}>
                  {v}
                </div>
                <div className='text-[11px] text-white/40'>{sub}</div>
              </div>
            ))}
          </div>

          <div className='plate p-4'>
            <div className='plate-head text-sm text-white/80'>
              Mini-auction retention rules
            </div>
            <p className='mt-1 text-sm text-white/60'>
              Unlimited retentions inside the ₹130 Cr purse — exact contract
              fees (or trade fees) are deducted, no ₹18/14/11 Cr slabs and no
              RTM cards. Squad cap 25, overseas cap 8. Released contracts return
              100% of fee to the purse for the 16 Dec 2026 Goa mini auction.
              Retention &amp; release lists due{" "}
              <b className='text-white/80'>17 Nov 2026</b>; registration closes
              23 Nov; pruned list 3 Dec.
            </p>
          </div>

          {injuredList.length > 0 && (
            <div className='plate p-4'>
              <div className='plate-head text-sm text-white/80'>
                🩹 Injured — contracts held (not released)
              </div>
              <p className='mt-1 text-xs text-white/45'>
                Ruled out during IPL 2026 but kept on the roster — they count
                toward contracts, not the fit XI. Franchises are not required to
                release them; only a voluntary cut frees purse, which would move
                them to the released pool below.
              </p>
              <div className='mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3'>
                {injuredList.map((p) => (
                  <div
                    key={p.id}
                    className='flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2'>
                    <PlayerPhoto
                      player={p}
                      c1={team.c1}
                      c2={team.c2}
                      ink={team.ink}
                      size={30}
                    />
                    <div className='min-w-0 flex-1'>
                      <div
                        className='truncate text-sm font-semibold'
                        style={{ fontFamily: "var(--font-cond)" }}>
                        {p.name}
                      </div>
                      <div className='truncate text-[11px] text-white/40'>
                        {p.note}
                      </div>
                    </div>
                    <span className='text-xs text-white/50'>
                      {fmtPrice(p.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {releasedList.length > 0 && (
            <div className='plate p-4'>
              <div className='plate-head text-sm text-white/80'>
                Released — free agents in the Goa pool (16 Dec 2026)
              </div>
              <p className='mt-1 text-xs text-white/45'>
                100% of each released fee returns to the ₹130 Cr purse.
              </p>
              <div className='mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3'>
                {releasedList.map((p) => (
                  <div
                    key={p.id}
                    className='flex items-center gap-2 rounded-lg bg-red-500/[0.05] px-3 py-2'>
                    <PlayerPhoto
                      player={p}
                      c1={team.c1}
                      c2={team.c2}
                      ink={team.ink}
                      size={30}
                    />
                    <div className='min-w-0 flex-1'>
                      <div
                        className='truncate text-sm font-semibold'
                        style={{ fontFamily: "var(--font-cond)" }}>
                        {p.name}
                      </div>
                      <div className='truncate text-[11px] text-white/40'>
                        {p.note ?? "Released before the 17 Nov 2026 deadline"}
                      </div>
                    </div>
                    <span
                      className='chip'
                      style={{
                        color: "#ff7a7a",
                        borderColor: "rgba(255,122,122,.3)",
                      }}>
                      {fmtPrice(p.price)} freed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='plate overflow-hidden'>
            <div className='flex items-center justify-between border-b border-white/10 px-4 py-3'>
              <span className='plate-head text-sm text-white/80'>
                Full squad ({contracted.length})
              </span>
              <span className='text-xs text-white/40'>sorted by contract</span>
            </div>
            <div className='max-h-[60vh] overflow-y-auto'>
              <table className='w-full text-left text-sm'>
                <thead className='sticky top-0 bg-[#0b0e16] text-[10px] uppercase tracking-widest text-white/40'>
                  <tr>
                    <th className='px-4 py-2'>Player</th>
                    <th className='px-3 py-2'>Role</th>
                    <th className='px-3 py-2'>Country</th>
                    <th className='px-3 py-2'>Fee</th>
                    <th className='px-3 py-2'>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...contracted]
                    .sort((a, b) => b.price - a.price)
                    .map((p) => (
                      <tr
                        key={p.id}
                        className='border-t border-white/5 hover:bg-white/[0.03]'>
                        <td className='px-4 py-2'>
                          <div className='flex items-center gap-2.5'>
                            <PlayerPhoto
                              player={p}
                              c1={team.c1}
                              c2={team.c2}
                              ink={team.ink}
                              size={30}
                            />
                            <div className='min-w-0'>
                              <div
                                className='truncate font-semibold'
                                style={{ fontFamily: "var(--font-cond)" }}>
                                {p.name}
                              </div>
                              {p.note && (
                                <div className='truncate text-[11px] text-white/40'>
                                  {p.note}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className='px-3 py-2'>
                          <RoleBadge role={p.role} />
                        </td>
                        <td className='px-3 py-2'>
                          <div className='flex items-center gap-2'>
                            {p.country}
                            <OverseasChip overseas={p.overseas} />
                          </div>
                        </td>
                        <td
                          className='px-3 py-2 font-semibold'
                          style={{ fontFamily: "var(--font-display)" }}>
                          {fmtPrice(p.price)}
                        </td>
                        <td className='px-3 py-2'>
                          <div className='flex flex-wrap gap-1'>
                            <StatusBadge status={p.status} note={p.note} />
                            {p.releaseWatch && (
                              <span
                                className='chip'
                                style={{
                                  color: "#ffbf6b",
                                  borderColor: "rgba(255,191,107,.3)",
                                }}
                                title={`Release watch: ${p.releaseWatch}`}>
                                ⚠ Watch
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {retiredList.map((p) => (
                    <tr
                      key={p.id}
                      className='border-t border-white/5 opacity-60'>
                      <td className='px-4 py-2'>
                        <div className='flex items-center gap-2.5'>
                          <PlayerPhoto
                            player={p}
                            c1={team.c1}
                            c2={team.c2}
                            ink={team.ink}
                            size={30}
                          />
                          <span
                            className='font-semibold'
                            style={{ fontFamily: "var(--font-cond)" }}>
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className='px-3 py-2'>
                        <RoleBadge role={p.role} />
                      </td>
                      <td className='px-3 py-2'>{p.country}</td>
                      <td className='px-3 py-2'>{fmtPrice(p.price)}</td>
                      <td className='px-3 py-2'>
                        <StatusBadge status='retired' note={p.note} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className='plate p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='plate-head text-sm text-white/80'>
                Release watch — purse freed simulator
              </div>
              <div
                className='chip'
                style={{
                  color: "#8fd694",
                  borderColor: "rgba(143,214,148,.4)",
                }}>
                Freed: {fmtPrice(freedTotal)} → Goa purse
              </div>
            </div>
            <p className='mt-1 text-xs text-white/45'>
              Tick contracts the franchise may cut by the 17 Nov deadline — 100%
              of each fee returns to the ₹130 Cr purse.
            </p>
            <div className='mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3'>
              {watched.map((p) => (
                <label
                  key={p.id}
                  className='flex cursor-pointer items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/[0.06]'>
                  <input
                    type='checkbox'
                    checked={!!freed[p.id]}
                    onChange={(e) =>
                      setFreed((f) => ({ ...f, [p.id]: e.target.checked }))
                    }
                    className='h-4 w-4'
                    style={{ accentColor: team.c2 }}
                  />
                  <span
                    className='min-w-0 flex-1 truncate'
                    style={{ fontFamily: "var(--font-cond)" }}>
                    {p.name}
                  </span>
                  <span className='text-xs text-white/50'>
                    {fmtPrice(p.price)}
                  </span>
                  <span
                    className='chip hidden lg:inline-flex'
                    style={{
                      color: "#ffbf6b",
                      borderColor: "rgba(255,191,107,.25)",
                    }}>
                    {p.releaseWatch}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TRADES & CAPTAINS ================= */}
      {tab === "trades" && (
        <div className='mt-4 space-y-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='plate p-4'>
              <div className='plate-head text-sm text-white/80'>Captaincy</div>
              <div
                className='mt-2 text-2xl font-bold uppercase'
                style={{ fontFamily: "var(--font-display)", color: team.c2 }}>
                {team.captain ?? "To Be Announced"}
              </div>
              {team.captainSince && (
                <div className='text-xs uppercase tracking-widest text-white/45'>
                  Captain since {team.captainSince}
                </div>
              )}
              <p className='mt-2 text-sm text-white/60'>{team.captainNote}</p>
              <div className='mt-3 text-xs uppercase tracking-widest text-white/40'>
                Head coach: <span className='text-white/70'>{team.coach}</span>
              </div>
            </div>
            <div className='plate p-4'>
              <div className='plate-head text-sm text-white/80'>
                Season status
              </div>
              <p className='mt-2 text-sm text-white/60'>{team.statusLine}</p>
              <div className='mt-3 flex flex-wrap gap-1.5'>
                <span className='chip' style={{ color: "#ffc75a" }}>
                  Trades closed for retentions: 17 Nov
                </span>
                <span className='chip' style={{ color: "#9cc3ff" }}>
                  Mini auction: 16 Dec 2026 · Goa
                </span>
              </div>
            </div>
          </div>

          <div className='plate p-4'>
            <div className='plate-head text-sm text-white/80'>
              This franchise in the 2027 trade window
            </div>
            {teamTrades.length === 0 ? (
              <p className='mt-2 text-sm text-white/50'>
                No completed trades — GT, KKR, RR and RCB stayed out of the
                window.
              </p>
            ) : (
              <div className='mt-2 space-y-3'>
                {teamTrades.map((t) => (
                  <div
                    key={t.date + t.title}
                    className='rounded-lg bg-white/[0.03] p-3'>
                    <div className='text-xs uppercase tracking-widest text-white/40'>
                      {new Date(t.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {t.title}
                    </div>
                    <div className='mt-1.5 flex flex-wrap gap-2'>
                      {t.moves.map((m) => (
                        <span
                          key={m.name}
                          className='chip'
                          style={{
                            color: m.to === team.id ? "#8fd694" : "#ff9b8a",
                            borderColor:
                              m.to === team.id
                                ? "rgba(143,214,148,.35)"
                                : "rgba(255,155,138,.35)",
                          }}>
                          {m.name} {m.from === team.id ? "→ out" : "→ in"} ·{" "}
                          {fmtPrice(m.fee)}
                        </span>
                      ))}
                    </div>
                    <p className='mt-1.5 text-sm text-white/55'>{t.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='plate p-4'>
            <div className='plate-head text-sm text-white/80'>
              League trade timeline
            </div>
            <div className='mt-3 space-y-3'>
              {trades.map((t) => (
                <div key={t.date + t.title} className='flex gap-3'>
                  <div
                    className='w-20 shrink-0 pt-1 text-xs font-bold uppercase text-white/40'
                    style={{ fontFamily: "var(--font-cond)" }}>
                    {new Date(t.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div
                    className='min-w-0 flex-1 border-l-2 pl-3'
                    style={{ borderColor: `${team.c2}55` }}>
                    <div
                      className='text-sm font-bold uppercase tracking-wide'
                      style={{ fontFamily: "var(--font-cond)" }}>
                      {t.title}
                    </div>
                    <div className='mt-1 flex flex-wrap gap-1.5'>
                      {t.moves.map((m) => (
                        <span key={m.name} className='chip'>
                          {m.name}: {m.from} → {m.to} ({fmtPrice(m.fee)})
                        </span>
                      ))}
                    </div>
                    <p className='mt-1 text-xs text-white/50'>{t.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {onAir && (
        <BroadcastOverlay
          team={team}
          ordered={ordered}
          captainId={captainId}
          subs={subs}
          shareHref={revealHref}
          onClose={() => setOnAir(false)}
        />
      )}
    </div>
  );
}
