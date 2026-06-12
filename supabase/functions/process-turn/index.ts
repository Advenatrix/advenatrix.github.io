import { serve } from 'https://deno.land/std/http/server.ts'
import { db, json } from '../_shared/db.ts'
import { handleCors } from '../_shared/cors.ts'

const SECTORS = [
  'Agriculture', 'Heavy Industry', 'Energy', 'Consumer Goods',
  'Military & Aerospace', 'Pharmaceuticals', 'Transport & Trade',
] as const

const QOL_TAX_RATES = [0.10, 0.25, 0.40, 0.60, 0.80]
const CORP_TAX_RATES = [0.01, 0.04, 0.08, 0.13, 0.17]
const CIVIL_MULTS = [0, 1, 2, 3, 4]
const BASE_FACTOR = 500_000

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    // ── Get current open turn ──
    const { data: turn } = await db.from('turns')
      .select('*').eq('status', 'open').order('number', { ascending: false }).limit(1).single()

    if (!turn) return json({ error: 'No open turn' }, 400)

    const turnNumber = turn.number

    // ── Get all nations ──
    const { data: nations } = await db.from('nations').select('*')

    if (!nations || nations.length === 0) return json({ error: 'No nations' }, 400)

    for (const nation of nations) {
      const nid = nation.id
      const pop = Number(nation.population) || 40000000
      const qol = Number(nation.qol) || 50

      // ── 1. Get companies ──
      const { data: companies } = await db.from('companies')
        .select('*').eq('nation_id', nid)

      let totalCompanyTax = 0

      for (const company of companies || []) {
        const profit = Number(company.profit) || 0
        const subsidies = Number(company.subsidies) || 0

        // Growth: random 4-16% (avg 10%)
        const growth = 0.04 + (Math.random() * 0.12)
        let newProfit = Math.round((profit + subsidies) * (1 + growth))

        // ── Sector cap clamping ──
        const { data: mod } = await db.from('sector_modifiers')
          .select('mod_mult').eq('nation_id', nid).eq('sector', company.sector).single()
        const mult = mod?.mod_mult || 1
        const cap = Math.round((pop / 40000000) * (qol / 50) * 1000000000 * mult)

        // Clamp growth by sector cap
        const sectorTotal = (companies || [])
          .filter((c: any) => c.sector === company.sector)
          .reduce((s: number, c: any) => s + Number(c.profit), 0)
        const sectorTotalAfter = sectorTotal - profit + newProfit
        if (sectorTotalAfter > cap) {
          newProfit = Math.max(0, profit + Math.round((cap - sectorTotal) * (profit / (sectorTotal || 1))))
        }

        // ── Corporate tax ──
        const corpTaxIdx = clamp(Number(nation.corporate_tax_level) || 2, 0, 4)
        const corpRate = CORP_TAX_RATES[corpTaxIdx]
        const corpTax = Math.round(newProfit * corpRate)
        totalCompanyTax += corpTax
        newProfit -= corpTax

        await db.from('companies').update({ profit: newProfit }).eq('id', company.id)
      }

      // ── 2. QoL tax income ──
      const qolTaxIdx = clamp(Number(nation.tax_level) || 2, 0, 4)
      const qolRate = QOL_TAX_RATES[qolTaxIdx]
      const qolTaxIncome = Math.round(BASE_FACTOR * (pop / 40000000) * (qol / 50) * qolRate)

      // ── 3. Civil spending ──
      const civilIdx = clamp(Number(nation.civil_level) || 2, 0, 4)
      const civilCost = Math.round(pop * (qol / 10) * CIVIL_MULTS[civilIdx] / 1000)

      // ── 4. Unit upkeep ──
      const { data: upkeepUnits } = await db.from('units')
        .select('upkeep').eq('nation_id', nid).in('status', ['active', 'damaged'])
      const totalUpkeep = (upkeepUnits || []).reduce((s: number, u: any) => s + Number(u.upkeep), 0)

      // ── 5. Compute income ──
      const income = qolTaxIncome + totalCompanyTax
      const totalCosts = civilCost + totalUpkeep
      let treasury = Number(nation.gdp) + income - totalCosts

      // Treasury can go negative (debt is allowed)
      // No more max(0, ...) clamp

      // ── 6. QoL drift ──
      const qolDriftMap = [2, 1, 0, -2, -4]
      const civilDriftMap = [-1, 0, 1, 2, 3]
      const newQol = clamp(qol + (qolDriftMap[qolTaxIdx] || 0) + (civilDriftMap[civilIdx] || 0), 0, 100)

      // ── 7. Advance building units ──
      const { data: buildingUnits } = await db.from('units')
        .select('id, ready_turn').eq('nation_id', nid).eq('status', 'building')
      for (const bu of buildingUnits || []) {
        if (bu.ready_turn && bu.ready_turn <= turnNumber) {
          await db.from('units').update({ status: 'active' }).eq('id', bu.id)
        }
      }

      // ── 8. Update nation ──
      await db.from('nations').update({
        gdp: treasury,
        qol: newQol,
      }).eq('id', nid)

      // ── 9. Record eco_history ──
      await db.from('eco_history').insert({
        nation_id: nid,
        turn_number: turnNumber,
        gdp: treasury,
        treasury: treasury,
        qol: newQol,
      })
    }

    // ── FRONT / BATTLE PROCESSING ──
    const { data: activeFronts } = await db.from('fronts')
      .select('*, assignments:front_assignments(formation:formations(*, units:units(*)))')
      .eq('status', 'active')

    for (const front of activeFronts || []) {
      const assignments = front.assignments || []
      if (assignments.length === 0) continue

      // Get all units assigned to this front
      const allUnits: any[] = []
      for (const fa of assignments) {
        const formation = fa.formation
        if (formation?.units) {
          allUnits.push(...formation.units.filter((u: any) =>
            u.status === 'active' || u.status === 'damaged'
          ))
        }
      }

      if (allUnits.length === 0) continue

      // Split into attacker/defender based on the front's participants
      const { data: participants } = await db.from('front_participants')
        .select('nation_id, side').eq('front_id', front.id)

      const attackerNationIds = new Set(
        (participants || []).filter((p: any) => p.side === 'attacker').map((p: any) => p.nation_id)
      )
      const defenderNationIds = new Set(
        (participants || []).filter((p: any) => p.side === 'defender').map((p: any) => p.nation_id)
      )

      const attackerUnits = allUnits.filter((u: any) => attackerNationIds.has(u.nation_id))
      const defenderUnits = allUnits.filter((u: any) => defenderNationIds.has(u.nation_id))

      if (attackerUnits.length === 0 || defenderUnits.length === 0) continue

      // Resolve battle
      for (let i = 0; i < (front.front_width || 1); i++) {
        const aPower = attackerUnits.reduce((s: number, u: any) => {
          const av = u.armor === 'High' ? 3 : u.armor === 'Medium' ? 2 : 1
          const fv = u.firepower === 'High' ? 3 : u.firepower === 'Medium' ? 2 : 1
          const sv = u.speed === 'High' ? 3 : u.speed === 'Medium' ? 2 : 1
          return s + (av + fv + sv) * (Number(u.strength) / 100)
        }, 0)
        const dPower = defenderUnits.reduce((s: number, u: any) => {
          const av = u.armor === 'High' ? 3 : u.armor === 'Medium' ? 2 : 1
          const fv = u.firepower === 'High' ? 3 : u.firepower === 'Medium' ? 2 : 1
          const sv = u.speed === 'High' ? 3 : u.speed === 'Medium' ? 2 : 1
          return s + (av + fv + sv) * (Number(u.strength) / 100)
        }, 0)

        const aRoll = aPower * (0.8 + Math.random() * 0.4)
        const dRoll = dPower * (0.8 + Math.random() * 0.4)
        const ratio = aRoll / dRoll

        let result: string, aLosses: number, dLosses: number
        if (ratio > 1.3) {
          result = 'attacker_win'
          aLosses = Math.floor(attackerUnits.length * (0.10 + Math.random() * 0.15))
          dLosses = Math.floor(defenderUnits.length * (0.30 + Math.random() * 0.25))
        } else if (ratio < 0.7) {
          result = 'defender_win'
          aLosses = Math.floor(attackerUnits.length * (0.30 + Math.random() * 0.25))
          dLosses = Math.floor(defenderUnits.length * (0.10 + Math.random() * 0.15))
        } else {
          result = 'stalemate'
          aLosses = Math.floor(attackerUnits.length * (0.10 + Math.random() * 0.15))
          dLosses = Math.floor(defenderUnits.length * (0.10 + Math.random() * 0.15))
        }

        // Apply damage
        const shuffle = (arr: any[]) => {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
          }
          return arr
        }

        const applyDamage = (units: any[], losses: number) => {
          const shuffled = shuffle([...units])
          for (let k = 0; k < Math.min(losses, shuffled.length); k++) {
            const u = shuffled[k]
            const newStr = Math.max(0, Number(u.strength) - 20 - Math.floor(Math.random() * 31))
            const newStatus = newStr <= 0 ? 'destroyed' : newStr < 50 ? 'damaged' : 'active'
            db.from('units').update({ strength: newStr, status: newStatus }).eq('id', u.id).then()
          }
        }

        applyDamage(attackerUnits, aLosses)
        applyDamage(defenderUnits, dLosses)

        // Update front progress
        const progressBefore = front.progress || 0
        let progressAfter = progressBefore
        if (result === 'attacker_win') {
          progressAfter = Math.min(front.max_progress || 10, progressBefore + 1)
        } else if (result === 'defender_win') {
          progressAfter = Math.max(0, progressBefore - 1)
        }

        await db.from('fronts').update({ progress: progressAfter }).eq('id', front.id)

        // Record battle
        await db.from('battles').insert({
          front_id: front.id,
          attacker_nation_id: front.attacker_nation_id,
          defender_nation_id: front.defender_nation_id,
          turn_number: turnNumber,
          result,
          attacker_losses: aLosses,
          defender_losses: dLosses,
          battle_type: 'frontline',
          progress_before: progressBefore,
          progress_after: progressAfter,
          log: JSON.stringify([
            `Battle ${i + 1}: ${attackerUnits.length} vs ${defenderUnits.length} units`,
            `Power: ${aPower.toFixed(0)} vs ${dPower.toFixed(0)}`,
            `Roll: ${aRoll.toFixed(2)} vs ${dRoll.toFixed(2)} (ratio ${ratio.toFixed(2)})`,
            `Result: ${result}, Attacker losses: ${aLosses}, Defender losses: ${dLosses}`,
            `Front progress: ${progressBefore} → ${progressAfter}`,
          ]),
        })

        // Check front resolution
        if (progressAfter >= (front.max_progress || 10) || progressAfter <= 0) {
          await db.from('fronts').update({ status: 'resolved' }).eq('id', front.id)
        }
      }
    }

    // ── Close turn and create next ──
    await db.from('turns').update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('id', turn.id)

    const nextTurnNumber = turn.number + 1
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    await db.from('turns').insert({
      number: nextTurnNumber, status: 'open', deadline, processed_at: null,
    })

    return json({ ok: true, turn_processed: turn.number, next_turn: nextTurnNumber })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: msg }, 500)
  }
})
