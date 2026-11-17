import type { Player, Team } from "@/data/teams";
import { getPhotoMode } from "@/components/PlayerPhoto";
import { initials, ROLE_LABEL } from "./xi";
import type { ShareEntry } from "./share";

/**
 * Renders the built XI as a broadcast-style PNG card (1080px wide) using
 * <canvas> — no dependencies, no DOM snapshots. The blob is used for:
 *   - "Download PNG" (manual upload to Instagram / status / stories)
 *   - navigator.share with files (opens the OS share sheet: WhatsApp,
 *     Instagram DM, X, …) on supporting devices
 *
 * Player photos are the same official headshots the UI shows (via the
 * same-origin /api/photo proxy, so the canvas is never tainted); players
 * without one fall back to their club-colour initials avatar, drawn locally.
 */

const GOLD = "#f3cf6f";

const W = 1080;
const HEADER_H = 250;
const ROW_H = 92;
const ROW_GAP = 10;
const FOOTER_H = 118;
const PAD = 40;

function font(px: number, weight = 700, family = '"Arial Narrow", Arial, sans-serif'): string {
  return `${weight} ${px}px ${family}`;
}

function displayFont(px: number, weight = 800): string {
  return `${weight} ${px}px "Arial Black", "Arial Narrow", Arial, sans-serif`;
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** shrink then ellipsis-truncate so a name always fits `maxWidth` */
function fitText(ctx: CanvasRenderingContext2D, raw: string, maxWidth: number, px: number, f: (p: number) => string): string {
  let text = raw;
  let size = px;
  ctx.font = f(size);
  while (ctx.measureText(text).width > maxWidth && size > 18) {
    size -= 2;
    ctx.font = f(size);
  }
  if (ctx.measureText(text).width > maxWidth) {
    while (text.length > 1 && ctx.measureText(text + "…").width > maxWidth) text = text.slice(0, -1);
    text += "…";
    ctx.font = f(px);
  }
  return text;
}

function loadImg(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

/** official headshot via the same-origin proxy (or the player.photo override) */
async function photoFor(p: Player, team: Team): Promise<HTMLImageElement | null> {
  const direct = p.photo;
  try {
    if (direct) return await loadImg(direct, !direct.startsWith("/"));
    const qs = new URLSearchParams({ name: p.name, team: team.id, mode: getPhotoMode() });
    if (p.prevTeam) qs.set("prev", p.prevTeam);
    const res = await fetch(`/api/photo?${qs.toString()}`);
    const data = (await res.json()) as { src: string | null };
    if (!data.src) return null;
    // proxied IPL paths are same-origin; Wikipedia thumbnails need CORS
    return await loadImg(data.src, !data.src.startsWith("/"));
  } catch {
    return null;
  }
}

/** cover-fit an image inside a circle */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, d: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.clip();
  const s = Math.max(d / img.width, d / img.height);
  ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}

/** club-colour initials avatar, same look as the UI underlay */
function drawAvatar(ctx: CanvasRenderingContext2D, p: Player, team: Team, cx: number, cy: number, d: number): void {
  const g = ctx.createLinearGradient(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2);
  g.addColorStop(0, team.c2);
  g.addColorStop(1, team.c1);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = team.ink;
  ctx.font = font(d * 0.42, 700, '"Arial Narrow", Arial, sans-serif');
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials(p.name), cx, cy);
}

export async function renderXIImage(
  team: Team,
  ordered: ShareEntry[],
  captainId?: string | null
): Promise<Blob> {
  const H = HEADER_H + ordered.length * (ROW_H + ROW_GAP) + FOOTER_H;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  /* ---------- background: night gradient with club tint ---------- */
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d1526");
  bg.addColorStop(0.5, "#0b0e16");
  bg.addColorStop(1, "#050914");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const tint = ctx.createLinearGradient(0, 0, W, HEADER_H + 200);
  tint.addColorStop(0, `${team.c1}55`);
  tint.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, HEADER_H + 200);

  /* ---------- header ---------- */
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = font(20, 600);
  ctx.fillText("TATA IPL 2027  ·  OFFICIAL PLAYING XI  ·  FAN XI", PAD, 64);

  ctx.fillStyle = "#ffffff";
  ctx.font = displayFont(52);
  const teamName = (team.nameHi ?? team.name).toUpperCase();
  ctx.fillText(fitText(ctx, teamName, W - PAD * 2 - 170, 52, displayFont), PAD, 128);

  ctx.fillStyle = GOLD;
  ctx.font = font(22, 700);
  ctx.textAlign = "right";
  ctx.fillText(`${team.short}`, W - PAD, 64);

  // club gradient accent line
  const line = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  line.addColorStop(0, team.c1);
  line.addColorStop(1, team.c2);
  ctx.fillStyle = line;
  rr(ctx, PAD, 158, W - PAD * 2, 6, 3);
  ctx.fill();
  ctx.textAlign = "left";

  /* ---------- load photos in parallel, fall back to avatars ---------- */
  const photos = await Promise.all(ordered.map((e) => photoFor(e.p, team)));

  /* ---------- player rows ---------- */
  const rowX = PAD;
  const rowW = W - PAD * 2;
  ordered.forEach((e, i) => {
    const y = HEADER_H + i * (ROW_H + ROW_GAP);

    rr(ctx, rowX, y, rowW, ROW_H, 12);
    ctx.fillStyle = "rgba(255,255,255,.05)";
    ctx.fill();
    ctx.strokeStyle = `${team.c2}55`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // slot number
    ctx.fillStyle = GOLD;
    ctx.font = displayFont(36, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(e.slot), rowX + 40, y + ROW_H / 2 + 2);

    // headshot (photo or initials avatar)
    const cx = rowX + 112;
    const cy = y + ROW_H / 2;
    const img = photos[i];
    if (img) drawCover(ctx, img, cx, cy, 66);
    else drawAvatar(ctx, e.p, team, cx, cy, 66);
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 33.5, 0, Math.PI * 2);
    ctx.stroke();

    // name + role
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = font(30, 700);
    const nameMax = rowW - (cx + 40) - 150;
    ctx.fillText(fitText(ctx, e.p.name.toUpperCase(), nameMax, 30, (p) => font(p, 700)), cx + 40, y + 42);

    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = font(20, 600);
    ctx.fillText(
      `${ROLE_LABEL[e.p.role]} · ₹${e.p.price % 1 === 0 ? e.p.price.toFixed(0) : e.p.price.toFixed(2)} Cr`,
      cx + 40,
      y + 72
    );

    // right meta: captain ★ / overseas ✈
    ctx.textAlign = "right";
    ctx.fillStyle = GOLD;
    ctx.font = font(26, 700);
    if (e.p.id === captainId) ctx.fillText("★ C", rowX + rowW - 22, y + 42);
    if (e.p.overseas) {
      ctx.fillStyle = "#7cc4ff";
      ctx.fillText("✈", rowX + rowW - (e.p.id === captainId ? 78 : 22), y + 42);
    }
  });

  /* ---------- footer ---------- */
  const fy = H - FOOTER_H + 26;
  ctx.textAlign = "left";
  ctx.font = font(20, 600);
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.fillText("IPL Team & XI Builder · fan project", PAD, fy);

  ctx.textAlign = "right";
  const xi = ordered.map((e) => e.p);
  const ov = xi.filter((p) => p.overseas).length;
  const value = xi.reduce((a, p) => a + p.price, 0);
  ctx.fillStyle = GOLD;
  ctx.font = font(20, 700);
  ctx.fillText(`OVERSEAS ${ov}/4  ·  XI VALUE ₹${value.toFixed(2).replace(/\.00$/, "")} Cr`, W - PAD, fy);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}
