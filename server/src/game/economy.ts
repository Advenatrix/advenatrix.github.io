import crypto from 'crypto'
import db from '../db'
import { processFronts } from './combat.js'

const BASE_FACTOR = 1_200_000_000
// 100M pop / 50 QoL → 125B total market cap across 7 sectors
// 125B / (2.5 × 9.0) = 5.56B; 2.5=pop/40M × qol/50, 9.0=sum of multipliers
const BASE_CAP = 5_555_555_556

export const SECTORS = [
  'Agriculture',
  'Heavy Industry',
  'Energy',
  'Consumer Goods',
  'Military & Aerospace',
  'Pharmaceuticals',
  'Transport & Trade',
] as const

export type Sector = typeof SECTORS[number]

const TAX_RATES = [0.10, 0.25, 0.40, 0.60, 0.80]
const TAX_QOL = [2, 1, 0, -2, -4]

const CIVIL_COST_MULT = [0, 1, 2, 3, 4]
const CIVIL_QOL = [-1, 0, 1, 2, 3]

const COMPANY_TAX_RATES = [0.01, 0.04, 0.08, 0.13, 0.17]

// Military upkeep multipliers — each funding level adjusts the
// effective upkeep cost of that branch's units.
// Very Low (0): 0.25x — underfunded, 25% of base upkeep
// Low    (1): 0.50x
// Normal (2): 1.00x — standard funding
// High   (3): 1.50x
// Very High (4): 2.50x — overfunded
const ARMY_UPKEEP_MULT = [0.25, 0.5, 1.0, 1.5, 2.5]
const AIRFORCE_UPKEEP_MULT = [0.25, 0.5, 1.0, 1.5, 2.5]
const NAVAL_UPKEEP_MULT = [0.25, 0.5, 1.0, 1.5, 2.5]

// Military base budget multipliers — the overhead cost of maintaining
// a military establishment at each funding level (like civil slider cost).
// Applied regardless of how many units exist.
const ARMY_BUDGET_MULT = [0, 0.25, 0.5, 1.0, 1.5]
const AIRFORCE_BUDGET_MULT = [0, 0.25, 0.5, 1.0, 1.5]
const NAVAL_BUDGET_MULT = [0, 0.25, 0.5, 1.0, 1.5]

// GDP is computed from two things:
//   1. total company profits (economic output of private industry)
//   2. QoL tax income at the MAXIMUM tax level (Very High = 80%)
// The slider position doesn't matter — GDP always uses the max rate as reference.
// Formula: GDP = sum(company.profit) + qol_tax_at_max_level
const MAX_GDP_TAX_RATE = 0.80

export function getSectorModifier(nationId: string, sector: string): number {
  const row = db.prepare('select mod_mult from sector_modifiers where nation_id = ? and sector = ?').get(nationId, sector) as any
  return row?.mod_mult ?? 1.0
}

export function computeSectorCap(nationId: string, sector: string): number {
  const nation = db.prepare('select population, qol from nations where id = ?').get(nationId) as any
  if (!nation) return 0
  const pop = nation.population ?? 40_000_000
  const qol = nation.qol ?? 50
  const mod = getSectorModifier(nationId, sector)
  return Math.round((pop / 40_000_000) * (qol / 50) * BASE_CAP * mod)
}

export function computeAllSectorCaps(nationId: string): Record<string, { cap: number; total_profit: number; mod_mult: number }> {
  const result: Record<string, { cap: number; total_profit: number; mod_mult: number }> = {}
  const companies = db.prepare('select sector, profit from companies where nation_id = ?').all(nationId) as any[]
  const profitBySector: Record<string, number> = {}
  for (const c of companies) {
    if (c.sector) profitBySector[c.sector] = (profitBySector[c.sector] || 0) + c.profit
  }
  for (const sector of SECTORS) {
    const cap = computeSectorCap(nationId, sector)
    const mod = getSectorModifier(nationId, sector)
    result[sector] = { cap, total_profit: profitBySector[sector] || 0, mod_mult: mod }
  }
  return result
}

export function computeGDP(nationId: string): number {
  const nation = db.prepare('select population, qol from nations where id = ?').get(nationId) as any
  if (!nation) return 0

  // Company component: total profits from all companies
  const companies = db.prepare('select profit from companies where nation_id = ?').all(nationId) as any[]
  const totalCompanyProfit = companies.reduce((sum, c) => sum + c.profit, 0)

  // QoL tax component: what the tax would be at max rate (Very High = 80%)
  const pop = nation.population ?? 40_000_000
  const qol = nation.qol ?? 50
  const qolTaxAtMax = Math.round(BASE_FACTOR * (pop / 40_000_000) * (qol / 50) * MAX_GDP_TAX_RATE)

  return totalCompanyProfit + qolTaxAtMax
}

export function processTurn() {
  const turn = db.prepare("select * from turns where status = 'open' order by number desc limit 1").get() as any
  if (!turn) return

  const nations = db.prepare('select * from nations').all() as any[]

  for (const nation of nations) {
    const qolTaxIdx = nation.tax_level ?? 2
    const corpTaxIdx = nation.corporate_tax_level ?? 2
    const civilIdx = nation.civil_level ?? 2
    const armyIdx = nation.army_level ?? 1
    const airforceIdx = nation.airforce_level ?? 1
    const navalIdx = nation.naval_level ?? 1

    // ── Company growth + company wealth tax ──
    const companies = db.prepare('select * from companies where nation_id = ?').all(nation.id) as any[]
    let companyTaxIncome = 0

    // Stage 1: Grow + tax each company
    for (const company of companies) {
      const growthRate = 0.04 + Math.random() * 0.12
      const effectiveBase = company.profit + company.subsidies
      const newProfit = Math.round((company.profit + growthRate * Math.max(0, effectiveBase)))
      const corpTaxRate = COMPANY_TAX_RATES[corpTaxIdx] ?? 0.02
      const tax = Math.round(newProfit * corpTaxRate)
      companyTaxIncome += tax
      const postTax = Math.max(0, newProfit - tax)
      db.prepare('update companies set profit = ? where id = ?').run(postTax, company.id)
    }

    // Stage 2: Sector cap enforcement
    const updatedCompanies = db.prepare('select * from companies where nation_id = ?').all(nation.id) as any[]
    const sectorMap: Record<string, any[]> = {}
    for (const c of updatedCompanies) {
      if (!c.sector) continue
      if (!sectorMap[c.sector]) sectorMap[c.sector] = []
      sectorMap[c.sector].push(c)
    }
    for (const sector of SECTORS) {
      const sc = sectorMap[sector]
      if (!sc || sc.length === 0) continue
      const total = sc.reduce((s: number, c: any) => s + c.profit, 0)
      const cap = computeSectorCap(nation.id, sector)
      if (total <= cap) continue
      const ratio = cap / total
      for (const c of sc) {
        const adjusted = Math.round(c.profit * ratio)
        db.prepare('update companies set profit = ? where id = ?').run(Math.max(0, adjusted), c.id)
      }
    }

    // ── QoL tax income ──
    const pop = nation.population ?? 40_000_000
    const qol = nation.qol ?? 50
    const qolRate = TAX_RATES[qolTaxIdx] ?? 0.40
    const qolTaxIncome = Math.round(BASE_FACTOR * (pop / 40_000_000) * (qol / 50) * qolRate)

    const computedGdp = computeGDP(nation.id)

    // ── Civil spending cost ──
    const civilMult = CIVIL_COST_MULT[civilIdx] ?? 2
    const civilCost = Math.round((pop / 100_000) * (qol / 60) * civilMult * 1_500_000)
    const armyBudget = Math.round((pop / 100_000) * (qol / 60) * ARMY_BUDGET_MULT[armyIdx] * 1_000_000)
    const airforceBudget = Math.round((pop / 100_000) * (qol / 60) * AIRFORCE_BUDGET_MULT[airforceIdx] * 1_000_000)
    const navalBudget = Math.round((pop / 100_000) * (qol / 60) * NAVAL_BUDGET_MULT[navalIdx] * 1_000_000)

    // ── Inflation multiplier (scales costs when nation is in debt) ──
    const inflationMult = nation.gdp < 0
      ? 1 + (-nation.gdp) / Math.max(1, computedGdp)
      : 1

    // ── Apply income/expenses to treasury (nations.gdp column is now cash on hand) ──
    // Income is computed client-side as a forecast preview; only direct values
    // (tax income, civil cost, military budgets, subsidies) are applied here.
    const totalSubsidies = companies.reduce((s: number, c: any) => s + c.subsidies, 0)
    const netChange = qolTaxIncome + companyTaxIncome
      - Math.round(civilCost * inflationMult)
      - Math.round(armyBudget * inflationMult)
      - Math.round(airforceBudget * inflationMult)
      - Math.round(navalBudget * inflationMult)
      - Math.round(totalSubsidies * inflationMult)
    db.prepare('update nations set gdp = ifnull(gdp, 0) + ? where id = ?').run(netChange, nation.id)

    // ── Unit upkeep (multiplied by military slider funding levels) ──
    const baseArmyUpkeep = (db.prepare(`
      select coalesce(sum(u.upkeep), 0) as total from units u
      join formations f on u.formation_id = f.id
      where u.nation_id = ? and f.branch = 'army' and u.status in ('active', 'damaged')
    `).get(nation.id) as any).total
    const baseAirforceUpkeep = (db.prepare(`
      select coalesce(sum(u.upkeep), 0) as total from units u
      join formations f on u.formation_id = f.id
      where u.nation_id = ? and f.branch = 'airforce' and u.status in ('active', 'damaged')
    `).get(nation.id) as any).total
    const baseNavalUpkeep = (db.prepare(`
      select coalesce(sum(u.upkeep), 0) as total from units u
      join formations f on u.formation_id = f.id
      where u.nation_id = ? and f.branch = 'navy' and u.status in ('active', 'damaged')
    `).get(nation.id) as any).total

    const armyUpkeep = Math.round(baseArmyUpkeep * ARMY_UPKEEP_MULT[armyIdx])
    const airforceUpkeep = Math.round(baseAirforceUpkeep * AIRFORCE_UPKEEP_MULT[airforceIdx])
    const navalUpkeep = Math.round(baseNavalUpkeep * NAVAL_UPKEEP_MULT[navalIdx])
    const totalUpkeep = armyUpkeep + airforceUpkeep + navalUpkeep

    const inflatedUpkeep = Math.round(totalUpkeep * inflationMult)
    if (inflatedUpkeep > 0) {
      db.prepare('update nations set gdp = ifnull(gdp, 0) - ? where id = ?').run(inflatedUpkeep, nation.id)
    }

    // ── Advance building units ──
    db.prepare(`
      update units set status = 'active'
      where nation_id = ? and status = 'building' and ready_turn is not null and ready_turn <= ?
    `).run(nation.id, turn.number)

    // ── QoL drift — uses QoL tax slider, corporate tax slider has no effect on QoL ──
    const taxQolDrift = TAX_QOL[qolTaxIdx] ?? 0
    const civilQolDrift = CIVIL_QOL[civilIdx] ?? 1
    const newQol = Math.max(0, Math.min(100, qol + taxQolDrift + civilQolDrift))
    db.prepare('update nations set qol = ? where id = ?').run(newQol, nation.id)

    // ── Record eco_history snapshot (gdp = computed GDP, treasury = cash on hand) ──
    const updated = db.prepare('select gdp from nations where id = ?').get(nation.id) as any
    const treasury = updated.gdp
    db.prepare('delete from eco_history where nation_id = ? and turn_number = ?').run(nation.id, turn.number)
    db.prepare('insert into eco_history (nation_id, turn_number, gdp, treasury, qol) values (?, ?, ?, ?, ?)')
      .run(nation.id, turn.number, computedGdp, treasury, newQol)
  }

  // ── Military phase ──
  processFronts(turn.number)

  const newTurnNumber = turn.number + 1
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const newId = crypto.randomUUID()

  db.prepare("update turns set status = 'done', processed_at = datetime('now') where id = ?").run(turn.id)
  db.prepare('insert into turns (id, number, status, deadline) values (?, ?, ?, ?)').run(newId, newTurnNumber, 'open', deadline)
}
  