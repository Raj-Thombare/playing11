"use client";

import { useState } from "react";
import type { Team } from "@/data/teams";
import { shareText, shareUrl, type ShareEntry } from "@/lib/share";
import { renderXIImage } from "@/lib/xiImage";
import { validateXI } from "@/lib/xi";

/**
 * Share bar for a built XI.
 *   ↗ Share…   — native OS share sheet with the PNG card attached
 *                (WhatsApp, Instagram DM, X, …) on supporting devices;
 *                falls back to sharing the link text
 *   WhatsApp   — wa.me deep link with text + link
 *   𝕏 Post     — twitter.com intent with text + link
 *   🔗 Copy    — clipboard
 *   ⬇ PNG      — broadcast-style XI card download (Instagram-ready;
 *                Instagram has no web share intent, so the image is
 *                posted manually)
 */
export function ShareXI({
  team,
  slots,
  ordered,
  captainId,
  compact = false,
}: {
  team: Team;
  /** sparse slot array (for URL encoding) */
  slots: (string | null)[];
  ordered: ShareEntry[];
  captainId?: string | null;
  /** icon-only row for the broadcast overlay */
  compact?: boolean;
}) {
  const [status, setStatus] = useState("");
  const hasPicks = ordered.length > 0;
  const st = validateXI(ordered.map((e) => e.p));
  const disabled = !hasPicks;
  const hint = disabled ? "Pick at least one player to share" : "Share this XI";

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 2600);
  };

  const url = () => shareUrl(team.id, slots, captainId);
  const text = () => shareText(team, ordered, captainId, st.score);

  const btnStyle = (accent?: string): React.CSSProperties => ({
    fontFamily: "var(--font-cond)",
    background: accent ?? "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.12)",
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url());
      flash("Link copied ✓");
    } catch {
      flash("Copy failed — copy the address-bar URL");
    }
  };

  const openWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text()}\n${url()}`)}`,
      "_blank",
      "noopener"
    );
  };

  const openX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text())}&url=${encodeURIComponent(url())}`,
      "_blank",
      "noopener"
    );
  };

  const download = async () => {
    try {
      flash("Rendering XI card…");
      const blob = await renderXIImage(team, ordered, captainId);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${team.id.toLowerCase()}-playing-xi.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash("XI card downloaded — post it to Instagram ✓");
    } catch {
      flash("Could not render the XI card");
    }
  };

  const native = async () => {
    try {
      const blob = await renderXIImage(team, ordered, captainId);
      const file = new File([blob], `${team.id.toLowerCase()}-playing-xi.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${team.name} Playing XI`, text: text() });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: `${team.name} Playing XI`, text: `${text()}\n${url()}` });
        return;
      }
      await copyLink();
    } catch {
      /* user closed the share sheet — nothing to do */
    }
  };

  if (compact) {
    const cls =
      "flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors hover:bg-white/10";
    return (
      <div className="flex items-center gap-1.5" title={hint}>
        <button aria-label="Share via device (WhatsApp, Instagram, X…)" disabled={disabled} onClick={native} className={cls + (disabled ? " opacity-40" : "")} style={{ background: "rgba(0,0,0,.5)", borderColor: "rgba(255,255,255,.25)" }} title="Share… (WhatsApp, Instagram, X)">
          ↗
        </button>
        <button aria-label="Share on WhatsApp" disabled={disabled} onClick={openWhatsApp} className={cls + (disabled ? " opacity-40" : "")} style={{ background: "rgba(0,0,0,.5)", borderColor: "rgba(37,211,102,.5)", color: "#25d366" }} title="WhatsApp">
          WA
        </button>
        <button aria-label="Post on X (Twitter)" disabled={disabled} onClick={openX} className={cls + (disabled ? " opacity-40" : "")} style={{ background: "rgba(0,0,0,.5)", borderColor: "rgba(255,255,255,.25)" }} title="Post on X">
          𝕏
        </button>
        <button aria-label="Copy share link" disabled={disabled} onClick={copyLink} className={cls + (disabled ? " opacity-40" : "")} style={{ background: "rgba(0,0,0,.5)", borderColor: "rgba(255,255,255,.25)" }} title="Copy link">
          🔗
        </button>
        <button aria-label="Download XI card as PNG (for Instagram)" disabled={disabled} onClick={download} className={cls + (disabled ? " opacity-40" : "")} style={{ background: "rgba(0,0,0,.5)", borderColor: "rgba(255,255,255,.25)" }} title="Download XI card PNG (Instagram-ready)">
          ⬇
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className="mb-2 flex items-center justify-between px-1"
        style={{ fontFamily: "var(--font-cond)" }}
      >
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Share this XI</span>
        <span className="text-[11px] text-white/40" role="status">
          {status || (st.valid ? "XI complete — ready to share" : "Shareable with 1+ picks · complete it for the reveal")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={native}
          disabled={disabled}
          className="rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-widest text-white transition-transform enabled:hover:scale-[1.02] disabled:opacity-40"
          style={btnStyle("linear-gradient(100deg, #2563eb, #38bdf8)")}
          title="Opens your device's share sheet — WhatsApp, Instagram DM, X and any installed app, with the XI card image attached on phones"
        >
          ↗ Share…
        </button>
        <button
          onClick={openWhatsApp}
          disabled={disabled}
          className="rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-widest transition-transform enabled:hover:scale-[1.02] disabled:opacity-40"
          style={btnStyle("linear-gradient(100deg, #128c4b, #25d366)")}
          title="Opens WhatsApp with the XI text + link"
        >
          WhatsApp
        </button>
        <button
          onClick={openX}
          disabled={disabled}
          className="rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-widest text-white transition-transform enabled:hover:scale-[1.02] disabled:opacity-40"
          style={btnStyle("linear-gradient(100deg, #1d1d1d, #3a3a3a)")}
          title="Opens X (Twitter) with the XI pre-filled as a post"
        >
          𝕏 Post
        </button>
        <button
          onClick={copyLink}
          disabled={disabled}
          className="rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
          style={btnStyle()}
          title="Copies the shareable link — the XI opens exactly as you built it"
        >
          🔗 Copy Link
        </button>
        <button
          onClick={download}
          disabled={disabled}
          className="col-span-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
          style={btnStyle()}
          title="Renders a broadcast-style XI card as a PNG — post it to Instagram stories/feed or WhatsApp status"
        >
          ⬇ Download XI Card (PNG · Instagram-ready)
        </button>
      </div>
    </div>
  );
}
