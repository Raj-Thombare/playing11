import { NextRequest, NextResponse } from "next/server";
import { officialPhoto } from "@/lib/iplPhotos";

/**
 * Player photo resolution.
 *
 *   GET /api/photo?name=…&team=MI&prev=PBKS&mode=ipl → { src, source } (JSON)
 *   GET /api/photo?img=player/8903/1854/1.png        → image bytes (proxy)
 *
 * Photo policy (strict IPL):
 *   - mode "ipl" (default): ONLY official IPLT20.com headshots, served from
 *     the player's own team page (team-specific CDN paths). If the current
 *     team's squad page doesn't list the player yet (recently traded players,
 *     e.g. Arshdeep Singh PBKS→MI in Nov 2026), the previous franchise's
 *     squad page (`prev=`) is tried next. If neither has a real headshot,
 *     src is null and the UI shows the team avatar.
 *   - mode "wiki": opt-in fallback — official photo first (current team,
 *     then previous team), Wikipedia next.
 */

const cache = new Map<string, { src: string | null; source: string; at: number }>();
const RESOLVE_TTL = 12 * 60 * 60 * 1000;

const UPSTREAM_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.iplt20.com/",
};

export const dynamic = "force-dynamic";

function upgradeThumb(url: string): string {
  // bump Wikipedia thumbnail to a crisper 480px render
  return url.replace(/\/\d+px-/, "/480px-");
}

async function tryWiki(title: string): Promise<string | null> {
  const t = title.replace(/ /g, "_");
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, {
      headers: { "User-Agent": "IPLTeamBuilder/1.0 (fan project)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      type?: string;
      description?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    const src = data.thumbnail?.source || data.originalimage?.source;
    if (!src || data.type === "disambiguation") return null;
    // guard against wrong-person matches (e.g. a shared surname page):
    // accept only pages described as cricket-related (or explicit "(cricketer)" titles)
    const desc = (data.description || "").toLowerCase();
    if (!desc.includes("cricket") && !title.includes("(cricketer)")) return null;
    return upgradeThumb(src);
  } catch {
    return null;
  }
}

/* ------------------------- image proxy branch ------------------------- */

async function proxyImage(pathname: string): Promise<NextResponse> {
  if (!/^player\/\d+\/\d+\/\d+\.png$/.test(pathname)) {
    return new NextResponse(null, { status: 400 });
  }
  const upstream = `https://www.iplt20.com/api/team-assets?pathname=${encodeURIComponent(pathname)}&brand=ipl`;
  try {
    const res = await fetch(upstream, {
      headers: UPSTREAM_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const type = (res.headers.get("content-type") || "").split(";")[0];
    // SVG = official "no headshot yet" placeholder → 404 so the UI keeps the avatar
    if (!res.ok || type === "image/svg+xml" || !type.startsWith("image/")) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

/* --------------------------- resolve branch --------------------------- */

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const imgParam = params.get("img");
  if (imgParam) return proxyImage(imgParam.trim());

  const name = params.get("name")?.trim() || "";
  const team = (params.get("team") || "").toUpperCase();
  const prev = (params.get("prev") || "").toUpperCase();
  const mode = params.get("mode") === "wiki" ? "wiki" : "ipl";
  if (!name || !team) return NextResponse.json({ src: null, source: "none" });

  const key = `${team}:${prev}:${mode}:${name}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < RESOLVE_TTL) {
    return NextResponse.json({ src: hit.src, source: hit.source });
  }

  let result = { src: null as string | null, source: "none" };

  // 1) official IPLT20.com headshot from the player's own team (strict mode always uses this)
  let pathname = await officialPhoto(team, name);
  // 2) recently traded players may not be on the new club's squad page yet —
  //    fall back to the previous franchise's page (photo is branded for that
  //    club, which is still the official headshot)
  if (!pathname && prev && prev !== team) {
    pathname = await officialPhoto(prev, name);
  }
  if (pathname) {
    result = { src: `/api/photo?img=${encodeURIComponent(pathname)}`, source: "IPLT20.com" };
  } else if (mode === "wiki") {
    // 3) opt-in Wikipedia fallback
    const variants: string[] = [name];
    if (!name.includes("(")) variants.push(`${name} (cricketer)`);
    const parts = name.split(" ");
    if (parts.length >= 2) variants.push(`${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`);
    for (const v of variants) {
      const wiki = await tryWiki(v);
      if (wiki) {
        result = { src: wiki, source: "Wikipedia" };
        break;
      }
    }
  }

  cache.set(key, { ...result, at: Date.now() });
  return NextResponse.json(result);
}
