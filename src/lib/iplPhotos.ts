/**
 * Official player photos, scraped live from IPLT20.com.
 *
 * How it works (verified against the live site, Nov 2026):
 *   1. Every team squad page (/teams/{slug}/squad) server-renders a rail of
 *      squad cards whose links point at player profile pages:
 *      /players/{gid}/{slug}
 *   2. Every player profile page server-renders the FULL squad rail —
 *      all ~25 teammates, each with `playerName`, `role` and an official
 *      headshot URL served from iplt20.com's own image proxy:
 *        https://www.iplt20.com/api/team-assets?pathname=player/{const}/{teamId}/{imageId}.png
 *      The photo paths are team-specific, so a traded player's photo is
 *      branded for his CURRENT club — photos are strictly from the
 *      player's respective IPL team.
 *   3. We scrape one profile page per team (2 requests) and cache the
 *      name → photo map for 12 hours, so future retentions/releases/
 *      replacements are picked up automatically.
 *
 * Photos are proxied through /api/photo?img=… (the upstream checks the
 * Referer/UA), and placeholder art (players without a real headshot,
 * served as image/svg+xml) is detected and rejected so the UI falls
 * back to the team-colour avatar instead of a silhouette.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "*/*",
  Referer: "https://www.iplt20.com/",
};

/** our team ids → iplt20.com page slugs (all 10 verified from the live CMS) */
const SLUGS: Record<string, string> = {
  MI: "mumbai-indians",
  CSK: "chennai-super-kings",
  RCB: "royal-challengers-bengaluru",
  KKR: "kolkata-knight-riders",
  DC: "delhi-capitals",
  PBKS: "punjab-kings",
  RR: "rajasthan-royals",
  SRH: "sunrisers-hyderabad",
  GT: "gujarat-titans",
  LSG: "lucknow-super-giants",
};

const ROSTER_TTL = 12 * 60 * 60 * 1000; // 12h
const FETCH_TIMEOUT = 15_000;

export interface RosterEntry {
  /** decoded pathname, e.g. "player/8903/1854/16096.png" */
  pathname: string | null;
  href?: string;
  role?: string;
  /** display name (rail objects carry playerName; the profiled player comes from og:title) */
  name?: string;
}

interface Roster {
  at: number;
  entries: RosterEntry[];
  byName: Map<string, RosterEntry>;
}

const rosters = new Map<string, Roster>();
const rosterInflight = new Map<string, Promise<Roster | null>>();

/* ------------------------------------------------------------------ */
/* extraction helpers                                                  */
/* ------------------------------------------------------------------ */

async function getPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** first /players/{gid}/{slug} href on a squad page */
function firstProfileHref(html: string): string | null {
  const m = html.match(/href="(\/players\/[a-f0-9-]{30,45}\/[a-z0-9-]+)"/);
  return m ? m[1] : null;
}

/**
 * Player objects on a profile page are serialized flight JSON, i.e. every
 * quote is escaped once: \"playerName\":\"Jasprit Bumrah\". These patterns
 * match that escaped form directly (each \\" in the source is a literal
 * backslash followed by a quote).
 */
const RE_PLAYER_NAME = /\\"playerName\\":\\"([^"\\]+?)\\"/g;
const RE_PLAYER_IMAGE = /\\"playerImage\\":\\"((?:\\u[0-9a-fA-F]{4}|[^"\\])*)\\"/g;
const RE_IMAGE_URL = /\\"imageUrl\\":\\"((?:\\u[0-9a-fA-F]{4}|[^"\\])*)\\"/g;
const RE_HREF = /\\"href\\":\\"([^"\\]+?)\\"/g;

/** pull the pathname out of any official photo URL shape */
function pathnameFromUrl(raw: string): string | null {
  if (!raw.includes("pathname")) return null;
  // direct: ?pathname=player%2F8903%2F1854%2F16096.png
  let m = raw.match(/pathname=([^&"\\]+)/);
  let val = m ? m[1] : null;
  if (!val) {
    // inside _next/image: pathname%3Dplayer%252F8903%2...
    m = raw.match(/pathname%3D([^&"\\]+)/);
    val = m ? m[1] : null;
  }
  if (!val) return null;
  try {
    // _next/image forms carry an encoded "&brand=ipl" (%26brand%3Dipl) suffix
    val = val.split("%26")[0].replace(/%252F/g, "%2F");
    const decoded = decodeURIComponent(val);
    return decoded.startsWith("player/") ? decoded : null;
  } catch {
    return null;
  }
}

/** scrape every squad-member object out of a profile page */
function extractRoster(html: string): RosterEntry[] {
  const entries: RosterEntry[] = [];
  const seen = new Set<string>();
  // object boundaries (},{) are not escaped — split the whole page and
  // keep only chunks that carry a playerName
  for (const chunk of html.split("},{")) {
    if (!chunk.includes("playerName")) continue;
    const name = RE_PLAYER_NAME.exec(chunk)?.[1];
    RE_PLAYER_NAME.lastIndex = 0;
    if (!name) continue;
    const imgRaw = RE_PLAYER_IMAGE.exec(chunk)?.[1] ?? RE_IMAGE_URL.exec(chunk)?.[1] ?? "";
    RE_PLAYER_IMAGE.lastIndex = 0;
    RE_IMAGE_URL.lastIndex = 0;
    const href = RE_HREF.exec(chunk)?.[1];
    RE_HREF.lastIndex = 0;
    const roleM = chunk.match(/\\"role\\":\\"([^"\\]+?)\\"/);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      pathname: pathnameFromUrl(imgRaw),
      href: href || undefined,
      role: roleM ? roleM[1] : undefined,
      name,
    });
  }
  return entries;
}

/** the profiled player's own card (og: meta) so he isn't missing from his own roster */
function extractSelf(html: string): RosterEntry | null {
  const title = html.match(/<title[^>]*>([^<|]+)/)?.[1]?.trim();
  const og = html.match(/property="og:image"[^>]*content="([^"]+)"/)?.[1]
    ?? html.match(/content="([^"]+)"[^>]*property="og:image"/)?.[1];
  const pathname = og ? pathnameFromUrl(og) : null;
  if (!title) return null;
  return { pathname, href: undefined, role: undefined, name: title };
}

/* ------------------------------------------------------------------ */
/* name matching                                                       */
/* ------------------------------------------------------------------ */

/** strip diacritics so "Lhuan-dré" matches "Lhuan-dre" */
function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokens(name: string): string[] {
  return deaccent(name.toLowerCase())
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** is `a` a token-subsequence of `b` (e.g. "Raj Bawa" ⊆ "Raj Angad Bawa") */
function isSubsequence(a: string[], b: string[]): boolean {
  if (a.length > b.length) return false;
  let i = 0;
  for (const t of b) {
    if (t === a[i]) i += 1;
    if (i === a.length) return true;
  }
  return i === a.length;
}

function normKey(name: string): string {
  return tokens(name).join(" ");
}

/** levenshtein distance ≤ 1 (one substitution, insert or delete) */
function editDist1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
    return diff === 1;
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) {
      i++;
      j++;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    j++; // delete one char from the longer string
  }
  return true;
}

/** token-level match: 0 = strong (same/abbrev name), 1 = weak (fuzzy), -1 = no */
function tokMatch(t: string, h: string): number {
  if (t === h) return 0;
  // nickname / abbreviation: mitch~mitchell, matt~matthew, ms~mahendra, allah~am
  if (t.length >= 3 && h.length >= 3 && (h.startsWith(t) || t.startsWith(h))) return 0;
  // one-letter spelling drift: mohammad~mohammed, abhishek~abishek
  if (editDist1(t, h)) return 1;
  // initials-style short tokens ("MS", "AM") vs the full name they abbreviate
  if ((t.length <= 3 || h.length <= 3) && t[0] === h[0]) return 1;
  return -1;
}

/**
 * Surname-anchored fuzzy match for roster entries whose site name drifted
 * from ours (nicknames "Mitch"~"Mitchell", initials "MS"~"Mahendra Singh",
 * spelling variants, or swapped token order — the caller also tries the
 * reversed token list). Returns 0 (strong), 1 (usable) or -1 (no match).
 * Requires the surname to match; a weak overall verdict is only useful
 * when the surname is unambiguous (checked by the caller).
 */
function fuzzyScore(want: string[], have: string[]): number {
  const wn = want.filter((t) => t.length > 1);
  const hn = have.filter((t) => t.length > 1);
  if (wn.length === 0 || hn.length === 0) return -1;
  const surname = tokMatch(wn[wn.length - 1], hn[hn.length - 1]);
  if (surname === -1) return -1;
  let weakest = surname;
  const used = new Set<number>([hn.length - 1]);
  for (let i = 0; i < wn.length - 1; i++) {
    let best = -1;
    let bestJ = -1;
    for (let j = 0; j < hn.length - 1; j++) {
      if (used.has(j)) continue;
      const q = tokMatch(wn[i], hn[j]);
      if (q !== -1 && (best === -1 || q < best)) {
        best = q;
        bestJ = j;
      }
    }
    if (best === -1) return -1; // a first-name token matches nothing → different player
    used.add(bestJ);
    weakest = Math.max(weakest, best);
  }
  return weakest;
}

/* ------------------------------------------------------------------ */
/* placeholder detection                                               */
/* ------------------------------------------------------------------ */

const verdictCache = new Map<string, boolean>(); // pathname → is a real photo
const verdictInflight = new Map<string, Promise<boolean>>();

/** players without a real headshot get an SVG placeholder from the CDN */
async function isRealPhoto(pathname: string): Promise<boolean> {
  const cached = verdictCache.get(pathname);
  if (cached !== undefined) return cached;
  const pending = verdictInflight.get(pathname);
  if (pending) return pending;
  const task = (async () => {
    try {
      const url = `https://www.iplt20.com/api/team-assets?pathname=${encodeURIComponent(pathname)}&brand=ipl`;
      const res = await fetch(url, {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      const type = (res.headers.get("content-type") || "").split(";")[0];
      const real = res.ok && (type === "image/png" || type === "image/jpeg" || type === "image/webp");
      verdictCache.set(pathname, real);
      verdictInflight.delete(pathname);
      return real;
    } catch {
      verdictInflight.delete(pathname);
      return false; // treat network hiccups as "no official photo"
    }
  })();
  verdictInflight.set(pathname, task);
  return task;
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

async function loadRoster(teamId: string): Promise<Roster | null> {
  const slug = SLUGS[teamId];
  if (!slug) return null;

  const squadHtml = await getPage(`https://www.iplt20.com/teams/${slug}/squad`);
  const href = squadHtml ? firstProfileHref(squadHtml) : null;
  if (!href) return null;

  const profileHtml = await getPage(`https://www.iplt20.com${href}`);
  if (!profileHtml) return null;

  const entries = extractRoster(profileHtml);
  const self = extractSelf(profileHtml);
  if (self?.pathname && !entries.some((e) => e.pathname === self.pathname)) {
    entries.push(self as RosterEntry);
  }

  const byName = new Map<string, RosterEntry>();
  for (const e of entries) {
    if (e.name) byName.set(normKey(e.name), e);
  }
  return { at: Date.now(), entries, byName };
}

async function ensureRoster(teamId: string): Promise<Roster | null> {
  const cached = rosters.get(teamId);
  if (cached && Date.now() - cached.at < ROSTER_TTL) return cached;
  const pending = rosterInflight.get(teamId);
  if (pending) return pending;
  const task = loadRoster(teamId)
    .then((r) => {
      rosterInflight.delete(teamId);
      if (r) rosters.set(teamId, r);
      return r;
    })
    .catch(() => {
      rosterInflight.delete(teamId);
      return null;
    });
  rosterInflight.set(teamId, task);
  return task;
}

function findEntry(roster: Roster, name: string): RosterEntry | null {
  const key = normKey(name);
  const exact = roster.byName.get(key);
  if (exact) return exact;

  const want = tokens(name);
  const wantSurname = want.length ? want[want.length - 1] : null;
  const entries = [...roster.byName.values()];

  // 1) token-subsequence ("Raj Bawa" ⊆ "Raj Angad Bawa", "Aman Hakim Khan" ⊇ "Aman Khan")
  let best: RosterEntry | null = null;
  let bestExtra = Infinity;
  for (const e of entries) {
    const have = tokens(e.name ?? "");
    if (isSubsequence(want, have) || isSubsequence(have, want)) {
      const extra = Math.abs(have.length - want.length);
      if (extra < bestExtra) {
        best = e;
        bestExtra = extra;
      }
    }
  }
  if (best) return best;

  // 2) surname-anchored fuzzy pass: nicknames ("Mitchell Santner" → "Mitch
  //    Santner"), initials ("MS Dhoni" → "Mahendra Singh Dhoni"), spelling
  //    drift ("Abhishek Porel" → "Abishek Porel"), single-letter forenames
  //    ("T. Natarajan" → "Thangarasu Natarajan") and swapped token order
  //    ("Smaran Ravichandran" → "Ravichandran Smaran"). A weak verdict is
  //    only accepted when the surname is unambiguous in the roster, so
  //    "Arshad Khan" never grabs Rashid Khan's photo.
  const surnameCount = wantSurname
    ? entries.filter((e) => {
        const hv = tokens(e.name ?? "").filter((t) => t.length > 1);
        return hv.length > 0 && tokMatch(wantSurname, hv[hv.length - 1]) === 0;
      }).length
    : 0;
  let fuzzy: { e: RosterEntry; q: number } | null = null;
  let tied = false;
  for (const e of entries) {
    const have = tokens(e.name ?? "");
    for (const hv of [have, [...have].reverse()]) {
      const q = fuzzyScore(want, hv);
      if (q === -1) continue;
      if (q > 0 && surnameCount !== 1) continue; // weak match needs a unique surname
      if (!fuzzy || q < fuzzy.q) {
        fuzzy = { e, q };
        tied = false;
      } else if (q === fuzzy.q && fuzzy.e !== e) {
        tied = true; // two equally-good candidates → refuse to guess
      }
    }
  }
  if (fuzzy && !tied) return fuzzy.e;

  // 3) strong-forename pass: the club renamed a player but kept his first
  //    name ("Rasikh Salam" → "Rasikh Dar", "Tejasvi Singh" → "Tejasvi Dahiya")
  if (want.length >= 2 && want[0].length >= 4) {
    const cands = entries.filter((e) => {
      const hv = tokens(e.name ?? "");
      return hv.length >= 2 && hv[0] === want[0];
    });
    if (cands.length === 1) return cands[0];
  }

  return null;
}

/**
 * Official team photo pathname for a player, or null.
 * Verifies the CDN serves a real raster (not the SVG placeholder).
 */
export async function officialPhoto(teamId: string, name: string): Promise<string | null> {
  const roster = await ensureRoster(teamId);
  if (!roster) return null;
  const entry = findEntry(roster, name);
  if (!entry?.pathname) return null;
  const real = await isRealPhoto(entry.pathname);
  return real ? entry.pathname : null;
}

/** for diagnostics/tests */
export function rosterInfo(teamId: string): { entries: number; withPhoto: number; ageMin: number } | null {
  const r = rosters.get(teamId);
  if (!r) return null;
  return {
    entries: r.entries.length,
    withPhoto: r.entries.filter((e) => e.pathname).length,
    ageMin: Math.round((Date.now() - r.at) / 60000),
  };
}
