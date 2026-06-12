const Database = require('better-sqlite3');
const db = new Database('data/georp.db');

const nation = db.prepare("select id from nations limit 1").get();
if (!nation) { console.log('No nation'); process.exit(1); }

const hasData = db.prepare("select count(*) as c from eco_history where nation_id = ?").get(nation.id);
if (hasData.c > 0) {
  // Add deficit column if missing
  try { db.prepare("alter table eco_history add column deficit integer not null default 0").run(); } catch(e) {}
  process.exit(0);
}

// Add deficit column if missing
try { db.prepare("alter table eco_history add column deficit integer not null default 0").run(); } catch(e) {}

const history = [
  { turn: 1,  gdp: 480000, debt: 0,     inflation: 2.0, dgdp: 0.0,  deficit: 0 },
  { turn: 2,  gdp: 485000, debt: 5000,  inflation: 2.1, dgdp: 1.0,  deficit: 5000 },
  { turn: 3,  gdp: 492000, debt: 12000, inflation: 2.2, dgdp: 2.4,  deficit: 7000 },
  { turn: 4,  gdp: 498000, debt: 18000, inflation: 2.3, dgdp: 3.6,  deficit: 6000 },
  { turn: 5,  gdp: 505000, debt: 25000, inflation: 2.5, dgdp: 5.0,  deficit: 7000 },
  { turn: 6,  gdp: 510000, debt: 30000, inflation: 2.6, dgdp: 5.9,  deficit: 5000 },
  { turn: 7,  gdp: 518000, debt: 38000, inflation: 2.8, dgdp: 7.3,  deficit: 8000 },
  { turn: 8,  gdp: 525000, debt: 42000, inflation: 2.9, dgdp: 8.0,  deficit: 4000 },
  { turn: 9,  gdp: 530000, debt: 48000, inflation: 3.0, dgdp: 9.1,  deficit: 6000 },
  { turn: 10, gdp: 538000, debt: 52000, inflation: 3.1, dgdp: 9.7,  deficit: 4000 },
  { turn: 11, gdp: 542000, debt: 58000, inflation: 3.2, dgdp: 10.7, deficit: 6000 },
  { turn: 12, gdp: 550000, debt: 62000, inflation: 3.3, dgdp: 11.3, deficit: 4000 },
];

const stmt = db.prepare('insert into eco_history (nation_id, turn_number, gdp, debt, inflation, debt_to_gdp, deficit) values (?, ?, ?, ?, ?, ?, ?)');
for (const h of history) {
  stmt.run(nation.id, h.turn, h.gdp, h.debt, h.inflation, h.dgdp, h.deficit);
}
console.log('Seeded 12 turns of eco history');
