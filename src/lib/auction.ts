import type { Player, TeamId } from "@/data/teams";

/** Auction picks live in localStorage so they survive reloads without a server.
 *  Shape: { [playerId]: { team: TeamId, price: number } } */
export interface AuctionPick {
  team: TeamId;
  price: number;
}
export type AuctionPicks = Record<string, AuctionPick>;

export const AUCTION_KEY = "iplxi:auction:v1";

export function readAuction(): AuctionPicks {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AUCTION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AuctionPicks) : {};
  } catch {
    return {};
  }
}

export function writeAuction(picks: AuctionPicks): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUCTION_KEY, JSON.stringify(picks));
  } catch {
    /* private mode / storage full — picks still work for this session */
  }
}

/** Indian internationals in the released pool. Overseas players are all
 *  treated as capped (they hold international caps by definition). */
const INDIAN_CAPPED = new Set([
  "Deepak Chahar",
  "Navdeep Saini",
  "Umran Malik",
  "Akash Deep",
  "Karun Nair",
  "Jaydev Unadkat",
  "Ishant Sharma",
  "Avesh Khan",
]);

export function isCapped(p: Player): boolean {
  return p.overseas || INDIAN_CAPPED.has(p.name);
}

/** a released player bought by a franchise becomes an auction-buy squad member
 *  in that team's builder; prevTeam keeps his old club photo as a fallback */
export function auctionPlayer(p: Player, pick: AuctionPick): Player {
  return {
    ...p,
    team: pick.team,
    price: pick.price,
    status: "auction",
    prevTeam: p.team,
  };
}
