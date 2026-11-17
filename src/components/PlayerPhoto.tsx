"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { Player } from "@/data/teams";
import { initials } from "@/lib/xi";

/* eslint-disable @next/next/no-img-element */

/* ------------------------------------------------------------------ *
 * Photo policy — strictly from the player's respective IPL team.
 *   mode "ipl" (default): ONLY official IPLT20.com headshots. Resolution
 *     tries the CURRENT club's squad page first; recently traded players
 *     who aren't on the new club's page yet fall back to their PREVIOUS
 *     franchise's page (player.prevTeam). No photo → team-colour avatar.
 *   mode "wiki" (opt-in): official first, then Wikipedia.
 * The data can also pin a specific image per player via `player.photo`.
 * ------------------------------------------------------------------ */

export type PhotoMode = "ipl" | "wiki";

const MODE_KEY = "iplxi:photoMode";
export const PREF_EVENT = "iplxi:photopref";

let photoMode: PhotoMode = "ipl";

if (typeof window !== "undefined") {
  try {
    const m = window.sessionStorage.getItem(MODE_KEY);
    if (m === "wiki" || m === "ipl") photoMode = m;
  } catch {
    /* private mode etc. */
  }
}

export function getPhotoMode(): PhotoMode {
  return photoMode;
}

export function setPhotoMode(m: PhotoMode): void {
  photoMode = m;
  try {
    window.sessionStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PREF_EVENT));
}

/* ------------------------------------------------------------------ *
 * Module-level resolution cache — shared by EVERY PlayerPhoto.
 * Stops the "avatar refresh" flicker when a player is added to the XI:
 * each (team, mode, name) resolves exactly once per session, parallel
 * lookups are deduped, and sessionStorage carries it across reloads.
 * ------------------------------------------------------------------ */

const resolved = new Map<string, string | null>(); // key -> src (null = no photo, use avatar)
const inflight = new Map<string, Promise<string | null>>();
// v3: key now carries the previous franchise (trade-in photo fallback) and
// invalidates stale "no photo" negatives from before the fallback existed
const SS_KEY = "iplxi:photos:v3";

if (typeof window !== "undefined") {
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(obj)) {
        if (!resolved.has(k)) resolved.set(k, v === "0" ? null : v);
      }
    }
  } catch {
    /* cache simply stays empty */
  }
}

function persist(key: string, src: string | null): void {
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    const obj: Record<string, string> = raw ? JSON.parse(raw) : {};
    obj[key] = src ?? "0";
    const keys = Object.keys(obj);
    if (keys.length > 600) {
      for (const k of keys.slice(0, keys.length - 600)) delete obj[k];
    }
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function cacheKeyOf(player: Player, mode: PhotoMode): string {
  return `${player.team}|${player.prevTeam ?? ""}|${mode}|${player.name}`;
}

function resolvePhoto(player: Player, mode: PhotoMode): Promise<string | null> {
  const key = cacheKeyOf(player, mode);
  const cached = resolved.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = fetch(
    `/api/photo?name=${encodeURIComponent(player.name)}&team=${encodeURIComponent(player.team)}` +
      (player.prevTeam ? `&prev=${encodeURIComponent(player.prevTeam)}` : "") +
      `&mode=${mode}`
  )
    .then((r) => r.json())
    .then((d: { src: string | null }) => {
      const src = d.src ?? null;
      resolved.set(key, src);
      persist(key, src);
      inflight.delete(key);
      return src;
    })
    .catch(() => {
      resolved.set(key, null);
      inflight.delete(key);
      return null;
    });
  inflight.set(key, task);
  return task;
}

function peekPhoto(player: Player, mode: PhotoMode): string | null | undefined {
  return resolved.get(cacheKeyOf(player, mode));
}

/** club-colour avatar with the team short-code watermarked at the base */
function avatarDataUri(name: string, c1: string, c2: string, ink: string, badge: string): string {
  const text = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/>
  </linearGradient></defs>
  <rect width="128" height="128" fill="url(#g)"/>
  <circle cx="64" cy="50" r="20" fill="rgba(0,0,0,.18)"/>
  <path d="M20 128c4-26 22-38 44-38s40 12 44 38z" fill="rgba(0,0,0,.18)"/>
  <text x="64" y="72" font-family="Arial Narrow, Arial, sans-serif" font-size="34" font-weight="700"
    fill="${ink}" text-anchor="middle">${text}</text>
  <text x="64" y="118" font-family="Arial Narrow, Arial, sans-serif" font-size="20" font-weight="700"
    fill="${ink}" opacity="0.72" text-anchor="middle" letter-spacing="2">${badge}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* layout effect before paint on the client, plain effect (no-op) on the server */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Uniform player headshot.
 *   1. `player.photo` data override (documented escape hatch)
 *   2. Official IPLT20.com team photo — current club, then previous club
 *      for traded players (mode "ipl" AND "wiki")
 *   3. Wikipedia (mode "wiki" only)
 *   4. Uniform club-colour avatar — always present as the underlay
 *
 * Flicker guarantees:
 *   - the avatar is an always-present underlay, so a missing or
 *     still-loading headshot never blanks the frame or shifts layout
 *   - resolution state lives at module level, so re-mounting a photo
 *     (same player in pool + XI slot) reuses the resolved source
 */
export function PlayerPhoto({
  player,
  c1,
  c2,
  ink,
  size = 40,
  ring = true,
  className = "",
  shape = "circle",
  fill = false,
}: {
  player: Player;
  c1: string;
  c2: string;
  ink: string;
  size?: number;
  ring?: boolean;
  className?: string;
  /** "circle" (default) or "card" — rectangular bust for broadcast cards */
  shape?: "circle" | "card";
  /** grow to the caller's box (className must supply width/height) */
  fill?: boolean;
}) {
  const [mode, setModeState] = useState<PhotoMode>(photoMode);
  const [src, setSrc] = useState<string | null | undefined>(() => peekPhoto(player, photoMode));
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  // keep every mounted photo in sync with the global photo-mode toggle
  useEffect(() => {
    const onPref = () => setModeState(getPhotoMode());
    window.addEventListener(PREF_EVENT, onPref);
    return () => window.removeEventListener(PREF_EVENT, onPref);
  }, []);

  const cacheKey = cacheKeyOf(player, mode);
  useBeforePaint(() => {
    let alive = true;
    const override = player.photo;
    if (override) {
      setSrc(override);
      return () => {
        alive = false;
      };
    }
    const cached = peekPhoto(player, mode);
    if (cached !== undefined) {
      setSrc(cached);
    } else {
      setSrc(undefined);
      resolvePhoto(player, mode).then((s) => {
        if (alive) setSrc(s);
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, player.photo]);

  const avatar = avatarDataUri(player.name, c1, c2, ink, player.team.toUpperCase());
  const showSrc = player.photo ?? src ?? null;

  return (
    <span
      className={"relative inline-block overflow-hidden bg-white/5 " + className}
      style={{
        ...(fill ? {} : { width: size, height: size }),
        borderRadius: shape === "card" ? "0.6rem" : "50%",
        boxShadow: ring ? `0 0 0 2px ${c2}, 0 0 12px -2px ${c1}` : undefined,
      }}
      title={`${player.name} — photo: ${player.photo ? "data override" : showSrc ? "IPLT20.com" : "club avatar"}`}
    >
      {/* uniform club-colour avatar underlay — always rendered */}
      <img
        src={avatar}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {showSrc && (
        <img
          key={showSrc}
          src={showSrc}
          alt={player.name}
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={
            "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 " +
            (loadedSrc === showSrc ? "opacity-100" : "opacity-0")
          }
          onLoad={() => setLoadedSrc(showSrc)}
          onError={() => {
            // dead link → settle on the avatar permanently for this session
            if (!player.photo) {
              resolved.set(cacheKey, null);
              persist(cacheKey, null);
            }
            setSrc(null);
            setLoadedSrc(null);
          }}
        />
      )}
    </span>
  );
}
