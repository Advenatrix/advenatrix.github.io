import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import db, { initDb } from './db.js'
import authRoutes from './routes/auth.js'
import gameRoutes from './routes/game.js'
import turnRoutes from './routes/turn.js'
import operationsRoutes from './routes/operations.js'
import adminRoutes from './routes/admin.js'
import { authMiddleware, isAdmin } from './auth.js'
import { getUnitDefaults, computeUnitCosts } from './game/unitDefaults.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

app.use(cors())
app.use(express.json())

initDb()

// Public routes
app.use('/api/auth', authRoutes)

// Protected routes
app.use('/api/game', authMiddleware, gameRoutes)
app.use('/api/turn', authMiddleware, turnRoutes)
app.use('/api/game', authMiddleware, operationsRoutes)
app.use('/api/admin', authMiddleware, isAdmin, adminRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Seed initial game data if empty
const nationCount = db.prepare('select count(*) as count from nations').get() as any
if (nationCount.count === 0) {
  console.log('Seeding initial game data...')

  const adminId = crypto.randomUUID()
  db.prepare('insert into players (id, username, password) values (?, ?, ?)').run(
    adminId, 'admin', crypto.createHash('sha256').update('admin').digest('hex')
  )

  const NATIONS = [
    { name: 'Letheia', pop: 42_000_000, qol: 52, gdp: 1_200_000_000, leader: 'Ragnar Hommelson', player: null, flag_url: 'https://placehold.co/156x72/1a1a2e/0ff?text=Letheia&font=aldrich', leader_picture: 'https://placehold.co/400x225/1a1a2e/fff?text=Ragnar+Hommelson&font=aldrich' },
    { name: 'Valoria', pop: 55_000_000, qol: 42, gdp: 1_500_000_000, leader: 'Marcus Valerius', player: null },
    { name: 'Nordmark', pop: 35_000_000, qol: 56, gdp: 900_000_000, leader: 'Astrid Bjornsson', player: null },
    { name: 'Ostland', pop: 70_000_000, qol: 30, gdp: 1_000_000_000, leader: 'Vladimir Ostrov', player: null },
    { name: 'Sutheria', pop: 25_000_000, qol: 62, gdp: 700_000_000, leader: 'Isabella Cruz', player: null },
    { name: 'Maridia', pop: 48_000_000, qol: 46, gdp: 1_100_000_000, leader: 'Hassan Al-Marid', player: null },
    { name: 'Krovia', pop: 38_000_000, qol: 36, gdp: 800_000_000, leader: 'Stefan Krovic', player: null },
    { name: 'Aetheria', pop: 30_000_000, qol: 66, gdp: 1_400_000_000, leader: 'Elara Voss', player: null },
  ]

  // Create dummy player accounts for unowned nations
  const dummyPlayerIds: Record<string, string> = {}
  for (const n of NATIONS) {
    if (!n.player) {
      const dummyId = crypto.randomUUID()
      const lowerName = n.name.toLowerCase()
      db.prepare('insert into players (id, username, password) values (?, ?, ?)').run(
        dummyId, lowerName, crypto.createHash('sha256').update(lowerName).digest('hex')
      )
      dummyPlayerIds[n.name] = dummyId
      ;(n as any).player = dummyId
    }
  }

  const insNation = db.prepare(
    'insert into nations (id, name, player_id, gdp, production_units, flag_url, leader_name, leader_picture, population, qol, tax_level, corporate_tax_level, civil_level, army_level, airforce_level, naval_level) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insCompany = db.prepare(
    'insert into companies (id, name, nation_id, profit, subsidies, sector) values (?, ?, ?, ?, ?, ?)'
  )
  const insEco = db.prepare(
    'insert into eco_history (nation_id, turn_number, gdp, treasury, qol) values (?, ?, ?, ?, ?)'
  )
  const insMod = db.prepare(
    'insert into sector_modifiers (nation_id, sector, mod_mult) values (?, ?, ?)'
  )

  // GDP = total company profits + QoL tax at max rate (80%)
  // Company profits don't need to be huge — QoL tax adds a big baseline.
  const COMPANY_POOLS: Record<string, [string, string][]> = {
    Letheia: [
      ['Letheia Agricultural Co', 'Agriculture'],
      ['Green Valley Farms', 'Agriculture'],
      ['Letheia Grain Corp', 'Agriculture'],
      ['Letheia Heavy Industries', 'Heavy Industry'],
      ['Letheia Steel Works', 'Heavy Industry'],
      ['Iron Mountain Mining', 'Heavy Industry'],
      ['Letheia PetroChemical', 'Energy'],
      ['Letheia Solar Grid', 'Energy'],
      ['Northern Wind Energy', 'Energy'],
      ['Royal Letheian Consumer Goods', 'Consumer Goods'],
      ['Letheia Retail Corp', 'Consumer Goods'],
      ['Luxor Brands', 'Consumer Goods'],
      ['Letheia Defense Systems', 'Military & Aerospace'],
      ['Skyforge Aerospace', 'Military & Aerospace'],
      ['Letheia Advanced Weapons', 'Military & Aerospace'],
      ['Letheia Pharm Labs', 'Pharmaceuticals'],
      ['Aurora Medical', 'Pharmaceuticals'],
      ['Letheia BioGen', 'Pharmaceuticals'],
      ['Royal Letheian Shipping', 'Transport & Trade'],
      ['Letheia Rail Corp', 'Transport & Trade'],
      ['Air Letheia', 'Transport & Trade'],
    ],
    Valoria: [
      ['Valorian Farms', 'Agriculture'],
      ['Valorian Steel Works', 'Heavy Industry'],
      ['Valorian Energy Corp', 'Energy'],
      ['Valorian Textiles', 'Consumer Goods'],
      ['Valorian Armaments', 'Military & Aerospace'],
      ['Valorian Medicinals', 'Pharmaceuticals'],
      ['Valorian Shipping Co', 'Transport & Trade'],
    ],
    Nordmark: [
      ['Nordmark Forestry Corp', 'Agriculture'],
      ['Nordmark Engineering', 'Heavy Industry'],
      ['Nordmark Hydro Electric', 'Energy'],
      ['Nordmark Fisheries', 'Consumer Goods'],
      ['Nordmark Defense', 'Military & Aerospace'],
      ['Nordmark Pharma', 'Pharmaceuticals'],
      ['Nordmark Merchant Fleet', 'Transport & Trade'],
    ],
    Ostland: [
      ['Ostland Grain Co', 'Agriculture'],
      ['Ostland Coal & Steel', 'Heavy Industry'],
      ['Ostland Petroleum', 'Energy'],
      ['Ostland Manufacturing', 'Consumer Goods'],
      ['Ostland Munitions', 'Military & Aerospace'],
      ['Ostland Chemical Works', 'Pharmaceuticals'],
      ['Ostland Railways', 'Transport & Trade'],
    ],
    Sutheria: [
      ['Sutheria Agricultural', 'Agriculture'],
      ['Sutheria Heavy Machinery', 'Heavy Industry'],
      ['Sutheria Power Grid', 'Energy'],
      ['Sutheria Textiles', 'Consumer Goods'],
      ['Sutheria Defense Corp', 'Military & Aerospace'],
      ['Sutheria BioTech', 'Pharmaceuticals'],
      ['Sutheria Trade Co', 'Transport & Trade'],
    ],
    Maridia: [
      ['Maridian Plantations', 'Agriculture'],
      ['Maridian Shipyards', 'Heavy Industry'],
      ['Maridian Oil Corp', 'Energy'],
      ['Maridian Consumer Electronics', 'Consumer Goods'],
      ['Maridian Naval Systems', 'Military & Aerospace'],
      ['Maridian Pharm Inc', 'Pharmaceuticals'],
      ['Maridian Shipping Lines', 'Transport & Trade'],
    ],
    Krovia: [
      ['Krovia Agricultural Co', 'Agriculture'],
      ['Krovian Metallurgical', 'Heavy Industry'],
      ['Krovian Coal Energy', 'Energy'],
      ['Krovian Consumer Goods', 'Consumer Goods'],
      ['Krovian Armory', 'Military & Aerospace'],
      ['Krovian Chemical Works', 'Pharmaceuticals'],
      ['Krovian Transport Co', 'Transport & Trade'],
    ],
    Aetheria: [
      ['Aetherian Organic Farms', 'Agriculture'],
      ['Aetherian Precision Tools', 'Heavy Industry'],
      ['Aetherian Solar Corp', 'Energy'],
      ['Aetherian Consumer Products', 'Consumer Goods'],
      ['Aetherian Aerospace', 'Military & Aerospace'],
      ['Aetherian Pharmaceuticals', 'Pharmaceuticals'],
      ['Aetherian Trade Fleet', 'Transport & Trade'],
    ],
  }

  const nationIds: string[] = []

  const BASE_MOD_MULTS: Record<string, number> = {
    'Agriculture': 1.0,
    'Heavy Industry': 1.5,
    'Energy': 1.0,
    'Consumer Goods': 1.5,
    'Military & Aerospace': 1.0,
    'Pharmaceuticals': 0.5,
    'Transport & Trade': 2.5,
  }

  for (const n of NATIONS) {
    const id = crypto.randomUUID()
    const prodUnits = Math.round(n.gdp / 1000)
    nationIds.push(id)

    // Treasury = starting cash on hand (40% of starting GDP stated in NATIONS array)
    const startingTreasury = Math.round(n.gdp * 0.4)
    insNation.run(id, n.name, n.player, startingTreasury, prodUnits, (n as any).flag_url || '', n.leader, (n as any).leader_picture || '', n.pop, n.qol, 2, 2, 2, 1, 1, 1)

    // Seed sector modifiers for all 11 sectors
    for (const [sector, mult] of Object.entries(BASE_MOD_MULTS)) {
      insMod.run(id, sector, mult)
    }

    // Companies per nation — each starts at 100M profit
    const companies = COMPANY_POOLS[n.name]
    const COMPANY_START_PROFIT = 100_000_000
    let totalSeededProfit = 0
    for (const c of companies) {
      insCompany.run(crypto.randomUUID(), c[0], id, COMPANY_START_PROFIT, 0, c[1])
      totalSeededProfit += COMPANY_START_PROFIT
    }

    // Initial eco_history snapshot (turn 0) — compute GDP with the new formula
    // GDP = total_company_profits + qol_tax_at_max_rate
    const qolTaxAtMax = Math.round(1_200_000_000 * (n.pop / 40_000_000) * (n.qol / 50) * 0.80)
    const computedGdp = totalSeededProfit + qolTaxAtMax
    insEco.run(id, 0, computedGdp, startingTreasury, n.qol)
  }

  // Create turn 1 (open, current)
  const insTurn = db.prepare('insert into turns (id, number, status, deadline, processed_at) values (?, ?, ?, ?, ?)')

  const currentTurnId = crypto.randomUUID()
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  insTurn.run(currentTurnId, 1, 'open', deadline, null)

  console.log('Seed complete.')
}

// Ensure extra dummy test accounts exist
const DUMMY_ACCOUNTS = [
  { username: 'test1', password: 'test1' },
  { username: 'test2', password: 'test2' },
  { username: 'demo', password: 'demo' },
]
for (const acct of DUMMY_ACCOUNTS) {
  const existing = db.prepare('select id from players where username = ?').get(acct.username)
  if (!existing) {
    db.prepare('insert into players (id, username, password) values (?, ?, ?)').run(
      crypto.randomUUID(), acct.username, crypto.createHash('sha256').update(acct.password).digest('hex')
    )
    console.log(`Created dummy account: ${acct.username}`)
  }
}

// Seed military data if missing
const unitCount = db.prepare('select count(*) as count from units').get() as any
if (unitCount.count === 0) {
  console.log('Seeding military data...')

  const nations = db.prepare('select id, name from nations').all() as any[]
  db.exec('delete from units; delete from formations; delete from unit_templates')

  const insTemplate = db.prepare('insert into unit_templates (id, nation_id, name, branch, unit_type, armor, firepower, speed, build_cost, build_time, upkeep, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insFormation = db.prepare('insert into formations (id, nation_id, name, type, branch, created_at) values (?, ?, ?, ?, ?, ?)')
  const insUnit = db.prepare('insert into units (id, template_id, formation_id, nation_id, name, unit_type, armor, firepower, speed, strength, status, build_cost, build_time, upkeep, ready_turn, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')

  const ARMY_TYPES = ['Infantry Battalion', 'Mechanized Battalion', 'Light Tank Battalion', 'Medium Tank Battalion', 'Heavy Tank Battalion', 'Artillery Battalion']
  const NAVY_TYPES = ['Destroyer', 'Light Cruiser', 'Battlecruiser', 'Battleship', 'Aircraft Carrier', 'Attack Submarine']
  const AIR_TYPES = ['Fighter Squadron', 'Heavy Fighter Squadron', 'Light Bomber', 'Bomber Squadron', 'Flying Boat Squadron']

  // Division tier definitions — each division gets homogeneous stats
  // Low = line holder (cheap), Medium = reserve, High = elite
  type StatTier = [string, string, string] // [armor, firepower, speed]
  const TIER_LOW: StatTier = ['Low', 'Low', 'Low']
  const TIER_MED: StatTier = ['Medium', 'Medium', 'Medium']
  const TIER_HIGH: StatTier = ['High', 'High', 'High']

  interface UnitDef { name: string; type: string }
  interface FormationDef {
    name: string; type: 'division' | 'fleet' | 'airgroup'; branch: 'army' | 'navy' | 'airforce'
    tier: StatTier; units: UnitDef[]
  }

  const NUMERALS = ['1st', '2nd', '3rd', '4th', '5th', '6th']

  // Nation-specific division plans — each entry: [name, tier, unitCount]
  const DIV_PLANS: Record<string, [string, StatTier, number][]> = {
    Letheia: [
      ['1st Infantry Division', TIER_LOW, 4],
      ['2nd Infantry Division', TIER_LOW, 4],
      ['1st Mechanized Division', TIER_LOW, 3],
      ['1st Armored Division', TIER_MED, 4],
      ['2nd Armored Division', TIER_MED, 3],
      ['Royal Guard Division', TIER_HIGH, 3],
    ],
    Valoria: [
      ['1st Legion Division', TIER_LOW, 5],
      ['2nd Legion Division', TIER_LOW, 4],
      ['Valorian Guard Division', TIER_MED, 3],
    ],
    Nordmark: [
      ['1st Ranger Division', TIER_LOW, 4],
      ['2nd Ranger Division', TIER_LOW, 3],
    ],
    Ostland: [
      ['1st Shock Division', TIER_LOW, 5],
      ['2nd Shock Division', TIER_LOW, 4],
      ['3rd Shock Division', TIER_MED, 3],
    ],
    Sutheria: [
      ['1st Cavalry Division', TIER_LOW, 4],
    ],
    Maridia: [
      ['1st Marine Division', TIER_LOW, 4],
      ['2nd Marine Division', TIER_LOW, 3],
    ],
    Krovia: [
      ['1st Guard Division', TIER_LOW, 4],
    ],
    Aetheria: [
      ['1st Strike Division', TIER_LOW, 4],
      ['2nd Strike Division', TIER_MED, 3],
    ],
  }

  // Nation-specific fleets — [name, ships: [name, type][], tier]
  const FLEET_PLANS: Record<string, [string, [string, string][], StatTier][]> = {
    Letheia: [
      ['1st Strike Fleet', [['LNS Vanguard', 'Battleship'], ['LNS Invincible', 'Battlecruiser'], ['LNS Dauntless', 'Destroyer'], ['LNS Victorious', 'Aircraft Carrier']], TIER_MED],
      ['2nd Patrol Fleet', [['LNS Valiant', 'Light Cruiser'], ['LNS Resolute', 'Destroyer'], ['LNS Avenger', 'Attack Submarine']], TIER_LOW],
    ],
    Valoria: [['1st Fleet', [['VNS Glory', 'Battleship'], ['VNS Triumph', 'Light Cruiser'], ['VNS Valiant', 'Destroyer']], TIER_MED]],
    Nordmark: [['1st Fleet', [['NNS Watchman', 'Destroyer'], ['NNS Sentinel', 'Destroyer']], TIER_LOW]],
    Ostland: [['1st Fleet', [['ONS Ironclad', 'Battlecruiser'], ['ONS Fortress', 'Destroyer']], TIER_LOW]],
    Sutheria: [['1st Fleet', [['SNS Merchant Prince', 'Light Cruiser'], ['SNS Sea King', 'Attack Submarine']], TIER_LOW]],
    Maridia: [['1st Fleet', [['MNS Leviathan', 'Battleship'], ['MNS Kraken', 'Attack Submarine']], TIER_MED]],
    Krovia: [['1st Fleet', [['KNS Defender', 'Destroyer'], ['KNS Guardian', 'Light Cruiser']], TIER_LOW]],
    Aetheria: [['1st Fleet', [['ANS Sentinel', 'Battlecruiser'], ['ANS Vanguard', 'Battlecruiser']], TIER_MED]],
  }

  // Nation-specific air groups — [name, squadrons: [name, type][], tier]
  const AIR_PLANS: Record<string, [string, [string, string][], StatTier][]> = {
    Letheia: [
      ['1st Air Group', [['Royal Guard Squadron', 'Fighter Squadron'], ['Iron Wing', 'Fighter Squadron'], ['Hammer Squadron', 'Bomber Squadron']], TIER_MED],
      ['2nd Air Group', [['Shadow Squadron', 'Heavy Fighter Squadron'], ['Phoenix Squadron', 'Light Bomber']], TIER_LOW],
    ],
    Valoria: [['1st Air Group', [['Valorian Wing', 'Fighter Squadron'], ['Valorian Bomber Group', 'Light Bomber']], TIER_LOW]],
    Nordmark: [['1st Air Group', [['Nordmark Squadron', 'Fighter Squadron'], ['Nordmark Patrol', 'Flying Boat Squadron']], TIER_LOW]],
    Ostland: [['1st Air Group', [['Ostland Squadron', 'Fighter Squadron'], ['Ostland Bomber Wing', 'Bomber Squadron']], TIER_LOW]],
    Sutheria: [['1st Air Group', [['Sutherian Squadron', 'Fighter Squadron'], ['Sutherian Bombers', 'Light Bomber']], TIER_LOW]],
    Maridia: [['1st Air Group', [['Maridian Patrol', 'Flying Boat Squadron'], ['Maridian Attack Wing', 'Fighter Squadron']], TIER_LOW]],
    Krovia: [['1st Air Group', [['Krovian Squadron', 'Fighter Squadron'], ['Krovian Bomber Command', 'Bomber Squadron']], TIER_LOW]],
    Aetheria: [['1st Air Group', [['Aetherian Wing', 'Heavy Fighter Squadron'], ['Aetherian Strike Force', 'Bomber Squadron']], TIER_LOW]],
  }

  // Build per-nation formation data
  const NATION_DATA: Record<string, FormationDef[]> = {}
  for (const nation of nations) {
    const form: FormationDef[] = []

    // Divisions
    const divs = DIV_PLANS[nation.name] || []
    for (const [divName, tier, count] of divs) {
      const units: UnitDef[] = []
      for (let i = 0; i < count; i++) {
        const t = ARMY_TYPES[i % ARMY_TYPES.length]
        const ord = NUMERALS[Math.min(i, NUMERALS.length - 1)]
        units.push({ name: `${ord} ${t}, ${divName.split(' ').slice(1).join(' ')}`, type: t })
      }
      form.push({ name: divName, type: 'division', branch: 'army', tier, units })
    }

    // Fleets
    const fleets = FLEET_PLANS[nation.name] || []
    for (const [flName, ships, tier] of fleets) {
      form.push({ name: flName, type: 'fleet', branch: 'navy', tier, units: ships.map(([name, type]) => ({ name, type })) })
    }

    // Air groups
    const airs = AIR_PLANS[nation.name] || []
    for (const [agName, squadrons, tier] of airs) {
      form.push({ name: agName, type: 'airgroup', branch: 'airforce', tier, units: squadrons.map(([name, type]) => ({ name, type })) })
    }

    NATION_DATA[nation.name] = form
  }

  // ── Execute seeding ──────────────────────────────────
  for (const nation of nations) {
    const nid = nation.id
    const formations = NATION_DATA[nation.name]
    if (!formations) continue

    // Create templates for all unit types
    const templateMap = new Map<string, string>()
    const allTypes = new Set<string>()
    for (const f of formations) {
      for (const u of f.units) allTypes.add(u.type)
    }
    for (const ut of allTypes) {
      const tid = crypto.randomUUID()
      const br = ARMY_TYPES.includes(ut) ? 'army' : NAVY_TYPES.includes(ut) ? 'navy' : 'airforce'
      const defs = getUnitDefaults(ut)
      // Templates use Low/Low/Low as reference (stats come from unit-level tier)
      insTemplate.run(tid, nid, `Standard ${ut}`, br, ut, 'Low', 'Low', 'Low', defs.build_cost, defs.build_time, defs.upkeep, new Date().toISOString())
      templateMap.set(ut, tid)
    }

    // Create formations and units
    for (const f of formations) {
      const fid = crypto.randomUUID()
      insFormation.run(fid, nid, f.name, f.type, f.branch, new Date().toISOString())

      const [a, fp, sp] = f.tier
      for (const u of f.units) {
        const uid = crypto.randomUUID()
        const tid = templateMap.get(u.type) || null
        const strength = 60 + Math.floor(Math.random() * 30)
        const status = strength > 60 ? 'active' : 'damaged'
        const defs = getUnitDefaults(u.type)
        const { build_cost, upkeep } = computeUnitCosts(defs.build_cost, defs.upkeep, a, fp, sp)
        insUnit.run(uid, tid, fid, nid, u.name, u.type,
          a, fp, sp,
          strength, status, build_cost, defs.build_time, upkeep, null, new Date().toISOString())
      }
    }
  }

  const seeded = (db.prepare('select count(*) as c from units').get() as any).c
  console.log(`Military seed complete: ${seeded} units created`)
}

app.listen(PORT, () => {
  console.log(`GeoRP server running on http://localhost:${PORT}`)
})
