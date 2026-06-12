import crypto from 'crypto'
import db from '../db'

const STAT_VALUES: Record<string, number> = { Low: 1, Medium: 2, High: 3 }

interface BattleResult {
  battle: any
  log: string[]
}

function calcPower(units: any[]): number {
  let total = 0
  for (const u of units) {
    total += (STAT_VALUES[u.armor] + STAT_VALUES[u.firepower] + STAT_VALUES[u.speed]) * (u.strength / 100)
  }
  return total
}

function applyLosses(units: any[], losses: number) {
  const shuffled = [...units].sort(() => Math.random() - 0.5)
  for (let i = 0; i < Math.min(losses, shuffled.length); i++) {
    const u = shuffled[i]
    const newStr = Math.max(0, u.strength - 20 - Math.floor(Math.random() * 30))
    const newStatus = newStr <= 0 ? 'destroyed' : newStr < 50 ? 'damaged' : u.status
    db.prepare('update units set strength = ?, status = ? where id = ?').run(newStr, newStatus, u.id)
  }
}

export function resolveBattle(front: any, turnNumber: number): BattleResult {
  const attackerUnits = db.prepare(`
    select u.* from units u
    join front_assignments fa on u.formation_id = fa.formation_id
    where fa.front_id = ? and u.status != 'destroyed'
  `).all(front.id) as any[]

  let defenderUnits: any[]
  try {
    defenderUnits = db.prepare(`
      select u.* from units u
      join front_participants fp on u.nation_id = fp.nation_id
      where fp.front_id = ? and fp.side = 'defender' and u.status != 'destroyed'
    `).all(front.id) as any[]
  } catch {
    defenderUnits = []
  }
  if (defenderUnits.length === 0 && front.defender_nation_id) {
    defenderUnits = db.prepare(`
      select u.* from units u
      where u.nation_id = ? and u.status != 'destroyed'
    `).all(front.defender_nation_id) as any[]
  }

  if (attackerUnits.length === 0) {
    return { battle: null, log: ['No attacker units assigned — skipping battle'] }
  }

  const attackerPower = calcPower(attackerUnits)
  const defenderPower = calcPower(defenderUnits)

  const attackerRoll = attackerPower * (0.8 + Math.random() * 0.4)
  const defenderRoll = defenderPower * (0.8 + Math.random() * 0.4)

  const ratio = attackerRoll / Math.max(defenderRoll, 1)

  let result: string
  let attackerLosses: number
  let defenderLosses: number

  if (ratio > 1.3) {
    result = 'attacker_win'
    attackerLosses = Math.floor(attackerUnits.length * (0.1 + Math.random() * 0.15))
    defenderLosses = Math.floor(defenderUnits.length * (0.3 + Math.random() * 0.25))
  } else if (ratio < 0.7) {
    result = 'defender_win'
    attackerLosses = Math.floor(attackerUnits.length * (0.3 + Math.random() * 0.25))
    defenderLosses = Math.floor(defenderUnits.length * (0.1 + Math.random() * 0.15))
  } else {
    result = 'stalemate'
    attackerLosses = Math.floor(attackerUnits.length * (0.1 + Math.random() * 0.15))
    defenderLosses = Math.floor(defenderUnits.length * (0.1 + Math.random() * 0.15))
  }

  applyLosses(attackerUnits, attackerLosses)
  applyLosses(defenderUnits, defenderLosses)

  const log = [
    `Attacker units: ${attackerUnits.length}, Defender units: ${defenderUnits.length}`,
    `Attacker power: ${attackerPower.toFixed(1)} (rolled ${attackerRoll.toFixed(1)})`,
    `Defender power: ${defenderPower.toFixed(1)} (rolled ${defenderRoll.toFixed(1)})`,
    `Result: ${result}, Attacker losses: ${attackerLosses}, Defender losses: ${defenderLosses}`,
  ]

  const battleId = crypto.randomUUID()
  db.prepare(`
    insert into battles (id, front_id, battle_type, attacker_nation_id, defender_nation_id, turn_number, result, attacker_losses, defender_losses, log)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(battleId, front.id, 'frontline', front.attacker_nation_id, front.defender_nation_id, turnNumber, result, attackerLosses, defenderLosses, JSON.stringify(log))

  const battle = db.prepare('select * from battles where id = ?').get(battleId)

  return { battle, log }
}

export function processFronts(turnNumber: number) {
  let fronts: any[]
  try {
    fronts = db.prepare("select * from fronts where status = 'active'").all() as any[]
  } catch {
    return
  }
  const turn = db.prepare('select max(number) as n from turns').get() as any
  const currentTurn = turnNumber || turn?.n || 1

  for (const front of fronts) {
    try {
      const width = front.front_width || 1

      for (let i = 0; i < width; i++) {
        const progressBefore = front.progress

        const { battle, log } = resolveBattle(front, currentTurn)
        if (!battle) continue

        let progressAfter = progressBefore
        if (battle.result === 'attacker_win') {
          progressAfter = Math.min(front.max_progress, progressBefore + 1)
        } else if (battle.result === 'defender_win') {
          progressAfter = Math.max(0, progressBefore - 1)
        }

        db.prepare('update battles set progress_before = ?, progress_after = ? where id = ?')
          .run(progressBefore, progressAfter, battle.id)

        db.prepare('update fronts set progress = ? where id = ?')
          .run(progressAfter, front.id)

        front.progress = progressAfter

        if (progressAfter >= front.max_progress) {
          db.prepare("update fronts set status = 'resolved' where id = ?").run(front.id)
        } else if (progressAfter <= 0) {
          db.prepare("update fronts set status = 'resolved' where id = ?").run(front.id)
        }
      }
    } catch (e) {
      console.error(`processFronts[${front.id}]:`, e)
    }
  }
}
