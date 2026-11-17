/* Standalone diagnostic for the iplt20 photo scraper (node scripts/photo-debug.cjs) */
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "*/*",
  Referer: "https://www.iplt20.com/",
};

function getPage(url) {
  return fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) }).then(async (res) => {
    if (!res.ok) return null;
    return res.text();
  }).catch(() => null);
}

function firstProfileHref(html) {
  const m = html.match(/href="(\/players\/[a-f0-9-]{30,45}\/[a-z0-9-]+)"/);
  return m ? m[1] : null;
}

/* mirrors src/lib/iplPhotos.ts */
const RE_PLAYER_NAME = /\\"playerName\\":\\"([^"\\]+?)\\"/g;
const RE_PLAYER_IMAGE = /\\"playerImage\\":\\"((?:\\u[0-9a-fA-F]{4}|[^"\\])*)\\"/g;
const RE_IMAGE_URL = /\\"imageUrl\\":\\"((?:\\u[0-9a-fA-F]{4}|[^"\\])*)\\"/g;

function pathnameFromUrl(raw) {
  if (!raw.includes("pathname")) return null;
  let m = raw.match(/pathname=([^&"\\]+)/);
  let val = m ? m[1] : null;
  if (!val) {
    m = raw.match(/pathname%3D([^&"\\]+)/);
    val = m ? m[1] : null;
  }
  if (!val) return null;
  try {
    val = val.split("%26")[0].replace(/%252F/g, "%2F");
    const d = decodeURIComponent(val);
    return d.startsWith("player/") ? d : null;
  } catch {
    return null;
  }
}

function extractRoster(html) {
  const entries = [];
  const seen = new Set();
  for (const chunk of html.split("},{")) {
    if (!chunk.includes("playerName")) continue;
    RE_PLAYER_NAME.lastIndex = 0;
    const name = RE_PLAYER_NAME.exec(chunk)?.[1];
    if (!name) continue;
    RE_PLAYER_IMAGE.lastIndex = 0;
    RE_IMAGE_URL.lastIndex = 0;
    const imgRaw = RE_PLAYER_IMAGE.exec(chunk)?.[1] ?? RE_IMAGE_URL.exec(chunk)?.[1] ?? "";
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ name, pathname: pathnameFromUrl(imgRaw) });
  }
  return entries;
}

(async () => {
  const squad = await getPage("https://www.iplt20.com/teams/mumbai-indians/squad");
  console.log("squad:", squad ? "ok len=" + squad.length : "FAIL");
  if (!squad) return;
  const href = firstProfileHref(squad);
  console.log("profileHref:", href);
  if (!href) return;
  const prof = await getPage("https://www.iplt20.com" + href);
  console.log("profile:", prof ? "ok len=" + prof.length : "FAIL");
  if (!prof) return;
  const entries = extractRoster(prof);
  console.log("roster entries:", entries.length);
  console.log("with photo:", entries.filter((e) => e.pathname).length);
  for (const who of ["Jasprit Bumrah", "Quinton de Kock", "Rohit Sharma", "Trent Boult", "Raj Angad Bawa"]) {
    const hit = entries.find((e) => e.name.toLowerCase() === who.toLowerCase());
    console.log(who, "->", hit ? hit.pathname : "MISSING");
  }
})();
