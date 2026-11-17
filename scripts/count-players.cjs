const fs = require("fs");
const s = fs.readFileSync("src/data/players.ts", "utf8");
const re =
  /P\(\s*"([^"]+)",\s*"(MI|CSK|RCB|KKR|DC|PBKS|RR|SRH|GT|LSG)",\s*"(BAT|WK|AR|PACE|SPIN)",\s*"([^"]+)",\s*([0-9.]+),\s*"([^"]+)"/g;
const m = {};
let x;
while ((x = re.exec(s))) {
  const team = x[2];
  const country = x[4];
  const status = x[6];
  if (status === "retired") continue; // retired players leave the squad list
  m[team] = m[team] || { contracts: 0, ov: 0, injured: 0, released: 0 };
  const t = m[team];
  t.contracts++;
  if (country !== "India") t.ov++;
  if (status === "injured") t.injured++;
  if (status === "released") t.released++;
}
console.log(JSON.stringify(m, null, 0));
const total = Object.values(m).reduce((a, t) => a + t.contracts, 0);
const inj = Object.values(m).reduce((a, t) => a + t.injured, 0);
const rel = Object.values(m).reduce((a, t) => a + t.released, 0);
console.log(`grand total: ${total} contracted · ${inj} injured · ${rel} released`);
