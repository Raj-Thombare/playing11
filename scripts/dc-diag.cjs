/* diag: DC roster + specific players (node scripts/dc-diag.cjs) */
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "*/*",
  Referer: "https://www.iplt20.com/",
};

const RE_PLAYER_NAME = /\\"playerName\\":\\"([^"\\]+?)\\"/g;
const RE_PLAYER_IMAGE = /\\"playerImage\\":\\"((?:\\u[0-9a-fA-F]{4}|[^"\\])*)\\"/g;

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

(async () => {
  const teamSlug = process.argv[2] || "delhi-capitals";
  const names = process.argv.slice(3);
  const squad = await (await fetch(`https://www.iplt20.com/teams/${teamSlug}/squad`, { headers: HEADERS })).text();
  const href = squad.match(/href="(\/players\/[a-f0-9-]{30,45}\/[a-z0-9-]+)"/)?.[1];
  console.log("profileHref:", href);
  const prof = await (await fetch("https://www.iplt20.com" + href, { headers: HEADERS })).text();
  const chunks = prof.split("},{").filter((c) => c.includes("playerName"));
  console.log("rail entries:", chunks.length);
  const entries = [];
  for (const chunk of chunks) {
    RE_PLAYER_NAME.lastIndex = 0;
    const name = RE_PLAYER_NAME.exec(chunk)?.[1];
    RE_PLAYER_IMAGE.lastIndex = 0;
    const raw = RE_PLAYER_IMAGE.exec(chunk)?.[1] ?? "";
    entries.push({ name, pathname: pathnameFromUrl(raw) });
  }
  console.log("with photo:", entries.filter((e) => e.pathname).length, "/", entries.length);
  for (const want of names) {
    const hit = entries.find((e) => e.name.toLowerCase() === want.toLowerCase());
    console.log(want, "->", hit ? hit.pathname : "NOT ON RAIL", hit ? "| all names like it: " + entries.filter((e) => e.name.toLowerCase().includes(want.toLowerCase().split(" ")[0])).map((e) => e.name).join(" / ") : "");
  }
})();
