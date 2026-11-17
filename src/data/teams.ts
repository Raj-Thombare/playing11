export type TeamId = "MI" | "CSK" | "RCB" | "KKR" | "DC" | "PBKS" | "RR" | "SRH" | "GT" | "LSG";

export type Role = "BAT" | "WK" | "AR" | "PACE" | "SPIN";

export type Status = "retained" | "trade-in" | "auction" | "replacement" | "injured" | "retired" | "released";

export interface Stats {
  m: number;      // IPL matches
  runs: number;   // career IPL runs
  wkts: number;   // career IPL wickets
  avg: number;    // batting average
  sr: number;     // batting strike rate
  econ: number;   // bowling economy
}

export interface Player {
  id: string;
  name: string;
  team: TeamId;
  role: Role;
  country: string;
  overseas: boolean;
  price: number; // crore
  status: Status;
  note?: string;
  releaseWatch?: string;
  retired?: boolean;
  /** optional per-player photo override (absolute URL or /api path) — wins over the scraped official photo */
  photo?: string;
  stats: Stats;
}

export interface TradePlayerMove {
  name: string;
  from: TeamId;
  to: TeamId;
  fee: number;       // crore, 2027 league fee
  feeNote?: string;
}

export interface Trade {
  date: string;      // ISO
  title: string;
  moves: TradePlayerMove[];
  summary: string;
}

export interface Team {
  id: TeamId;
  name: string;
  /** Devanagari display name for the broadcast reveal graphic */
  nameHi?: string;
  short: string;
  city: string;
  venue: string;
  c1: string;   // primary color
  c2: string;   // secondary color
  ink: string;  // text color on primary
  titles: number;
  titleYears: number[];
  captain?: string;
  captainSince?: string;
  captainNote: string;   // captaincy status as of 17 Nov 2026
  coach: string;
  payroll: number;       // crore — known contracted payroll for 2027
  purse: 130;
  rosterSize: number;    // current roster (post-trades)
  overseasCount: number;
  statusLine: string;
}

export const OVERSEAS_CAP = 4;
export const PURSE = 130;

export const TEAMS: Team[] = [
  {
    id: "MI", name: "Mumbai Indians", nameHi: "मुंबई इंडियंस", short: "MI", city: "Mumbai", venue: "Wankhede Stadium",
    c1: "#0a3b8f", c2: "#1f74d6", ink: "#ffd769",
    titles: 5, titleYears: [2013, 2015, 2017, 2019, 2020],
    captainNote: "Hardik Pandya (captain 2024-26) traded to PBKS on Nov 11. New captain not yet announced — Rohit Sharma linked.",
    coach: "Kieron Pollard",
    payroll: 124.35, purse: 130, rosterSize: 25, overseasCount: 7,
    statusLine: "Traded Hardik Pandya to PBKS; signed Arshdeep Singh. De Kock, Santner & Bawa back fit after missing 2026. Captaincy pending.",
  },
  {
    id: "CSK", name: "Chennai Super Kings", nameHi: "चेन्नई सुपर किंग्स", short: "CSK", city: "Chennai", venue: "M. A. Chidambaram Stadium",
    c1: "#d8a400", c2: "#f6cc1b", ink: "#123458",
    titles: 5, titleYears: [2010, 2011, 2018, 2021, 2023],
    captain: "Ruturaj Gaikwad", captainSince: "2024",
    captainNote: "Gaikwad retained as captain with Sanju Samson now keeping alongside MS Dhoni. Continuity confirmed.",
    coach: "Stephen Fleming",
    payroll: 123.85, purse: 130, rosterSize: 27, overseasCount: 10,
    statusLine: "Roster 27/25 & 10/8 overseas — mandatory cuts due at the Nov 17 deadline after the SRH four-player swap.",
  },
  {
    id: "RCB", name: "Royal Challengers Bengaluru", nameHi: "रॉयल चैलेंजर्स बेंगलुरु", short: "RCB", city: "Bengaluru", venue: "M. Chinnaswamy Stadium",
    c1: "#8f1129", c2: "#d51a35", ink: "#ffd7d7",
    titles: 2, titleYears: [2025, 2026],
    captain: "Rajat Patidar", captainSince: "2025",
    captainNote: "Defending champion captain after lifting back-to-back titles (beat GT by 5 wickets in the 2026 final).",
    coach: "Andy Flower",
    payroll: 117.15, purse: 130, rosterSize: 23, overseasCount: 7,
    statusLine: "Champions of 2025 and 2026. Settled core; ₹12.85 Cr+ purse room for the Goa mini auction.",
  },
  {
    id: "KKR", name: "Kolkata Knight Riders", nameHi: "कोलकाता नाइट राइडर्स", short: "KKR", city: "Kolkata", venue: "Eden Gardens",
    c1: "#2c1750", c2: "#55308f", ink: "#f2c233",
    titles: 3, titleYears: [2012, 2014, 2024],
    captainNote: "Ajinkya Rahane captained 2026, then retired from IPL cricket in July 2026. New captain to be named.",
    coach: "Chandrakant Pandit",
    payroll: 86.95, purse: 130, rosterSize: 24, overseasCount: 7,
    statusLine: "Rahane retired post-2026. Biggest war chest in the league — ₹43 Cr+ available for Goa.",
  },
  {
    id: "DC", name: "Delhi Capitals", nameHi: "दिल्ली कैपिटल्स", short: "DC", city: "Delhi", venue: "Arun Jaitley Stadium",
    c1: "#123a8f", c2: "#2f63d0", ink: "#ff5a5a",
    titles: 0, titleYears: [],
    captain: "Axar Patel", captainSince: "2025",
    captainNote: "Axar retained as captain. Rishabh Pant returned home via trade but no captaincy change announced.",
    coach: "Hemang Badani",
    payroll: 111.55, purse: 130, rosterSize: 25, overseasCount: 8,
    statusLine: "Pant & Ansari in; Kuldeep & Natarajan out across two trades. Overseas slots maxed at 8/8.",
  },
  {
    id: "PBKS", name: "Punjab Kings", nameHi: "पंजाब किंग्स", short: "PBKS", city: "Chandigarh", venue: "Maharaja Yadavindra Singh Stadium, New Chandigarh",
    c1: "#a5121f", c2: "#dd2b3b", ink: "#f4f4f4",
    titles: 0, titleYears: [],
    captain: "Shreyas Iyer", captainSince: "2025",
    captainNote: "Iyer stays captain. 2025 finalists; 2026 runners-up again under Ricky Ponting.",
    coach: "Ricky Ponting",
    payroll: 121.5, purse: 130, rosterSize: 25, overseasCount: 8,
    statusLine: "Landed Hardik Pandya (₹18 Cr) for Arshdeep Singh on Nov 11. Iyer remains established captain.",
  },
  {
    id: "RR", name: "Rajasthan Royals", nameHi: "राजस्थान रॉयल्स", short: "RR", city: "Jaipur", venue: "Sawai Mansingh Stadium",
    c1: "#b02c7d", c2: "#e4409a", ink: "#ffe3f2",
    titles: 1, titleYears: [2008],
    captain: "Riyan Parag", captainSince: "2026",
    captainNote: "Parag's first full season as captain in 2026 after Sanju Samson's trade to CSK. Continues into 2027.",
    coach: "Rahul Dravid",
    payroll: 117.3, purse: 130, rosterSize: 25, overseasCount: 8,
    statusLine: "No 2027 trades. Samson-era rebuild continued with Jadeja backing new skipper Parag.",
  },
  {
    id: "SRH", name: "Sunrisers Hyderabad", nameHi: "सनराइजर्स हैदराबाद", short: "SRH", city: "Hyderabad", venue: "Rajiv Gandhi International Stadium",
    c1: "#c14a0c", c2: "#f26522", ink: "#ffe9d2",
    titles: 1, titleYears: [2016],
    captain: "Pat Cummins", captainSince: "2024",
    captainNote: "Cummins retained as captain; busy trade window rebuilt the pace attack around him.",
    coach: "Daniel Vettori",
    payroll: 115.95, purse: 130, rosterSize: 26, overseasCount: 8,
    statusLine: "Traded in Natarajan, Khaleel & Ellis; sent out Livingstone, Edwards & Ansari. Roster 26/25 — one cut required.",
  },
  {
    id: "GT", name: "Gujarat Titans", nameHi: "गुजरात टाइटन्स", short: "GT", city: "Ahmedabad", venue: "Narendra Modi Stadium",
    c1: "#12315e", c2: "#1f4d8f", ink: "#e8c766",
    titles: 1, titleYears: [2022],
    captain: "Shubman Gill", captainSince: "2024",
    captainNote: "Gill continues. GT lost the 2026 final to RCB by five wickets.",
    coach: "Ashish Nehra",
    payroll: 121.8, purse: 130, rosterSize: 25, overseasCount: 7,
    statusLine: "No trades. 2026 runners-up core intact around Gill, Rashid and Siraj.",
  },
  {
    id: "LSG", name: "Lucknow Super Giants", nameHi: "लखनऊ सुपर जायंट्स", short: "LSG", city: "Lucknow", venue: "Ekana Cricket Stadium",
    c1: "#005b96", c2: "#00a7e1", ink: "#ffffff",
    titles: 0, titleYears: [],
    captainNote: "Pant captained LSG in 2025-26, then was traded to DC. Next captain not yet announced — Pooran the natural pick.",
    coach: "Justin Langer",
    payroll: 102.55, purse: 130, rosterSize: 24, overseasCount: 6,
    statusLine: "Traded Pant to DC, brought in Kuldeep Yadav. Marsh & Hasaranga back fit after missing 2026. ₹27 Cr+ purse left for Goa.",
  },
];

export const TRADES: Trade[] = [
  {
    date: "2026-11-11",
    title: "Blockbuster swap: Hardik ↔ Arshdeep",
    moves: [
      { name: "Hardik Pandya", from: "MI", to: "PBKS", fee: 18, feeNote: "revised from ₹16.35 Cr" },
      { name: "Arshdeep Singh", from: "PBKS", to: "MI", fee: 18, feeNote: "unchanged" },
    ],
    summary: "MI's captain crossed to Punjab while India's left-arm new-ball spearhead joined Bumrah at Mumbai. Confirmed Nov 11, 2026.",
  },
  {
    date: "2026-11-05",
    title: "CSK ↔ SRH four-player exchange",
    moves: [
      { name: "Liam Livingstone", from: "SRH", to: "CSK", fee: 6, feeNote: "revised from ₹13 Cr" },
      { name: "Jack Edwards", from: "SRH", to: "CSK", fee: 3 },
      { name: "Khaleel Ahmed", from: "CSK", to: "SRH", fee: 4.8 },
      { name: "Nathan Ellis", from: "CSK", to: "SRH", fee: 2 },
    ],
    summary: "Chennai grabbed two overseas all-round options; Hyderabad stacked Indian pace depth around Cummins.",
  },
  {
    date: "2026-10-14",
    title: "Natarajan returns to SRH",
    moves: [
      { name: "T. Natarajan", from: "DC", to: "SRH", fee: 5, feeNote: "revised from ₹10.75 Cr" },
      { name: "Zeeshan Ansari", from: "SRH", to: "DC", fee: 0.4 },
    ],
    summary: "Yorker specialist rejoined Hyderabad at half his fee; Delhi added a domestic leg-spin option.",
  },
  {
    date: "2026-06-23",
    title: "Pant homecoming, Kuldeep to Lucknow",
    moves: [
      { name: "Rishabh Pant", from: "LSG", to: "DC", fee: 15, feeNote: "revised from ₹27 Cr (-44%)" },
      { name: "Kuldeep Yadav", from: "DC", to: "LSG", fee: 13.5 },
    ],
    summary: "The first mega-move of the window: Pant returned to the franchise he represented 2016-2024; Kuldeep became LSG's wrist-spin leader.",
  },
];

export const SEASON_CONTEXT = {
  today: "2026-11-17",
  retentionDeadline: "17 Nov 2026",
  auctionDate: "16 Dec 2026",
  auctionVenue: "Goa",
  registrationClose: "23 Nov 2026",
  prunedList: "3 Dec 2026",
  lastChampion: "Royal Challengers Bengaluru (2026, defended 2025 title; beat GT by 5 wkts in final)",
  note:
    "Mini-auction cycle: unlimited retentions inside the ₹130 Cr purse, exact contract fees deducted, no RTM cards. Squads cap at 25 players, 8 overseas. Injured core players (de Kock, Marsh, Pathirana and others) keep their contracts — teams are not required to release them; only voluntary cuts free purse.",
};

export function teamById(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
