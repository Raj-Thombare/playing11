# IPL Team & XI Builder — 2027 Season Console

A Next.js app for building every IPL franchise's **Playing XI** under official playing conditions, with an **AI auto-pick engine** driven by career IPL records, a **broadcast-TV XI reveal**, and squad/trade/retention/captaincy data verified as of **17 Nov 2026** (retention deadline day).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npx next start -p 3100   # port 3000 is often taken by another app
```

## What's inside

- **XI Builder** (`/team/[MI|CSK|RCB|KKR|DC|PBKS|RR|SRH|GT|LSG]`) — 11 slots with **drag & drop**: grab any squad player
  and drop him into **any slot 1–11** (even as the only pick), drop on a filled slot to swap, drop on the squad list to
  remove; arrows swap/move too. Captain ★, live rule chips: exactly 11 players · max 4 overseas · ≥1 wicketkeeper ·
  ≥4 specialist bowlers · ≥5 batting options, plus a balance score.
- **AI Auto-Pick** — scores every player from past IPL records (runs/match, average, strike rate, wickets/match, economy,
  contract weight), builds a legal XI around the captain, and explains each pick.
- **Reveal on Air** — full-screen IPL-broadcast graphic: glowing masthead with the club crest and Devanagari team name,
  the captain featured large on the left, all 11 players as numbered headshot cards (gold **AT** batting-position badge,
  ✈ overseas, role glyphs, cream name plaques), a gold **SUBSTITUTES** rail (top contracts off the XI) and the trade-desk ticker.
- **Squad & Retention tab** — contracts vs fit counts, released pool,
  full squad table and a release-watch purse simulator.
- **Trades & Captains tab** — only the confirmed **2027-window** trades (after the 2026 IPL season):
  Hardik↔Arshdeep Nov 11 2026, Pant↔Kuldeep Jun 23 2026, Natarajan↔Ansari Oct 14 2026, CSK↔SRH four-player Nov 5 2026 —
  plus captaincy status for all 10 teams. Earlier windows (e.g. Samson↔Jadeja, 2025) are roster history, not listed trades.
- XIs auto-save per team in `localStorage` as a **sparse slot array** (`iplxi:sel:{team}` = 11 entries with `null`s for
  empty slots, so a single pick can live in slot 7) plus `iplxi:cap:{team}` for the captain.

## Data model (`src/data/teams.ts` → `Status`)

| Status | Meaning |
| --- | --- |
| `retained` | contract carried into 2027 |
| `trade-in` | arrived via a confirmed trade (fee = trade fee) |
| `auction` | signed at the Dec 2025 mini auction |
| `replacement` | 2026 mid-season replacement cover |
| `injured` | **mid-2027 injury** — contract held, blocked from the XI (nobody currently: all 15 who missed IPL 2026 recovered and are pickable) |
| `released` | cut before the deadline — 100% fee returns to the purse |
| `retired` | retired from IPL cricket (e.g. Rahane) — excluded from squad counts |

### Keeping data current (trades / releases / injuries)

All players live in `src/data/players.ts` using the `P(name, team, role, country, price, status, stats, extra)` helper.

- **Mark a player released** (e.g. a replacement is cut before 17 Nov): change his status to `"released"` and add a note —
  he automatically leaves the XI pool and the AI engine, disappears from squad counts, and appears in the team's
  "Released — free agents in the Goa pool" section.
- **Mark a player injured**: set `status: "injured"` and a note. He stays on the roster (contract held), shows the
  🩹 INJURED badge, and can't be picked manually or by the AI. Injuries from a *finished* season should be cleared
  instead — flip the status back to `"retained"` and reword the note (2026 injuries were cleared for 2027).
- **Add a trade**: append to `TRADES` in `src/data/teams.ts`, and flip the two players' `team`/`status` in `players.ts`.
  Only trades from the current (2027) window belong in `TRADES` — older windows stay as roster history on the player.

Verify counts any time:

```bash
node scripts/count-players.cjs
```

## Player photos — strictly from the player's respective IPL team

Photos are scraped live from **IPLT20.com** and are official team headshots only:

- Pipeline (`src/lib/iplPhotos.ts`): each team's squad page → first player-profile link → the profile page
  server-renders the **entire squad rail** (~25–28 players with name, role and official headshot URL). The CDN path is
  **team-specific** (`player/{const}/{teamId}/{imageId}.png`), so a traded player's photo is branded for his **current**
  club — de Kock on MI carries MI's headshot. One roster is cached **12 h**, so future retentions/releases/replacements
  are picked up automatically.
- Photos are proxied through the app (upstream checks Referer/UA):
  - `GET /api/photo?name=…&team=MI&mode=ipl` → `{ src, source }` JSON (in-memory cache, 12 h)
  - `GET /api/photo?img=player/8903/1854/16096.png` → the image bytes (immutable cache, 7 d)
- Players without a real headshot get an SVG placeholder from the CDN — those are **rejected** (verdict cached) so the
  UI falls back to the club-colour avatar instead of a silhouette.
- **Photo modes** (toggle chip in the builder header, per session):
  - 🛡️ **IPL only** (default): official IPL team headshots or nothing — no third-party photos.
  - 🌐 **IPL + Wiki** (opt-in): official first, Wikipedia fallback for players without an official headshot.
- Data escape hatch: `photo?: string` on a `Player` in `src/data/teams.ts` pins a specific image and wins over the
  scraped one.

Anti-flicker design (`src/components/PlayerPhoto.tsx`):
- resolution cache lives at **module level** (plus `sessionStorage`, `iplxi:photos:v2`), so the same player appearing in
  the pool *and* the XI board reuses one resolution — adding a player to the XI never re-resolves anyone's photo;
- the club avatar (with the team short-code watermarked at the base) is an **always-present underlay** and the headshot
  fades in on load — no blank frames, no layout shift;
- sub-components in `TeamWorkspace.tsx` are hoisted/memoized so selecting a player doesn't remount the squad list;
- pointer cursors everywhere interactive (buttons/links/labels), `grab`/`grabbing` on draggable players.

## Sources

Squads fact-checked 14 Nov 2026 from public IPL 2026 squad listings (247 players) with the four confirmed 2027-window trades
(Hardik↔Arshdeep, Pant↔Kuldeep, Natarajan↔Ansari, CSK↔SRH), the July 2026 Rahane retirement, the 2026 injury list
(recovered — all 15 injured cores restored as fully fit for 2027), and captaincy reporting applied. Earlier trade windows
(Samson↔Jadeja 2025, Buttler 2024) are roster history only. Unofficial fan project — not affiliated with the BCCI, IPL or any franchise.
