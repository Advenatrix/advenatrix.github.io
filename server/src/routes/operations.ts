import { Router } from 'express'
import crypto from 'crypto'
import db from '../db'
import type { AuthRequest } from '../auth'
import { resolveBattle } from '../game/combat.js'

const router = Router()

// ── Fronts ──────────────────────────────────────────────
router.get('/fronts', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const myNation = db.prepare('select id, name from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.json({ fronts: [] }); return }

  const fronts = db.prepare(`
    select f.*, an.name as attacker_name, dn.name as defender_name
    from fronts f
    join nations an on f.attacker_nation_id = an.id
    left join nations dn on f.defender_nation_id = dn.id
    where f.id in (
      select fp.front_id from front_participants fp where fp.nation_id = ?
    )
    or f.attacker_nation_id = ?
    or f.defender_nation_id = ?
    order by f.created_at desc
  `).all(myNation.id, myNation.id, myNation.id) as any[]

  for (const front of fronts) {
    front.participants = db.prepare(`
      select fp.*, n.name as nation_name
      from front_participants fp
      join nations n on fp.nation_id = n.id
      where fp.front_id = ?
    `).all(front.id)
  }

  const assignments = fronts.length === 0 ? [] : db.prepare(`
    select fa.*, f2.name as formation_name, f2.type as formation_type
    from front_assignments fa
    join formations f2 on fa.formation_id = f2.id
    where fa.front_id in (${fronts.map(() => '?').join(',')})
  `).all(...fronts.map((f: any) => f.id))

  res.json({ fronts, assignments })
})

router.post('/fronts', (req: AuthRequest, res) => {
  const { name, war_name } = req.body
  if (!name) {
    res.status(400).json({ error: 'name required' }); return
  }

  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(400).json({ error: 'You must control a nation' }); return }

  const id = crypto.randomUUID()
  db.prepare(`
    insert into fronts (id, name, attacker_nation_id, status, war_name)
    values (?, ?, ?, 'pending', ?)
  `).run(id, name, myNation.id, war_name || '')

  db.prepare('insert into front_participants (id, front_id, nation_id, side) values (?, ?, ?, ?)')
    .run(crypto.randomUUID(), id, myNation.id, 'attacker')

  const front = db.prepare(`
    select f.*, an.name as attacker_name
    from fronts f
    join nations an on f.attacker_nation_id = an.id
    where f.id = ?
  `).get(id)

  res.json({ front })
})

router.post('/fronts/:id/assign', (req: AuthRequest, res) => {
  const { formation_id } = req.body
  if (!formation_id) { res.status(400).json({ error: 'formation_id required' }); return }

  const front = db.prepare("select * from fronts where id = ? and status = 'active'").get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Active front not found' }); return }

  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(401).json({ error: 'No nation' }); return }

  const isParticipant = db.prepare(
    'select id from front_participants where front_id = ? and nation_id = ?'
  ).get(front.id, myNation.id)
  if (!isParticipant) {
    res.status(403).json({ error: 'Not your front' }); return
  }

  const formation = db.prepare('select id from formations where id = ? and nation_id = ?').get(formation_id, myNation.id)
  if (!formation) { res.status(404).json({ error: 'Formation not yours' }); return }

  const existing = db.prepare('select id from front_assignments where front_id = ? and formation_id = ?').get(req.params.id, formation_id)
  if (existing) { res.status(400).json({ error: 'Already assigned' }); return }

  const id = crypto.randomUUID()
  db.prepare('insert into front_assignments (id, front_id, formation_id) values (?, ?, ?)').run(id, req.params.id, formation_id)

  const assignment = db.prepare(`
    select fa.*, f2.name as formation_name, f2.type as formation_type
    from front_assignments fa
    join formations f2 on fa.formation_id = f2.id
    where fa.id = ?
  `).get(id)

  res.json({ assignment })
})

router.delete('/fronts/:id/assign/:formationId', (req: AuthRequest, res) => {
  const front = db.prepare("select * from fronts where id = ? and status = 'active'").get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Active front not found' }); return }

  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(401).json({ error: 'No nation' }); return }

  const isParticipant = db.prepare(
    'select id from front_participants where front_id = ? and nation_id = ?'
  ).get(front.id, myNation.id)
  if (!isParticipant) {
    res.status(403).json({ error: 'Not your front' }); return
  }

  db.prepare('delete from front_assignments where front_id = ? and formation_id = ?').run(req.params.id, req.params.formationId)
  res.json({ ok: true })
})

router.post('/fronts/:id/retreat', (req: AuthRequest, res) => {
  const front = db.prepare("select * from fronts where id = ? and status = 'active'").get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Active front not found' }); return }

  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(400).json({ error: 'No nation controlled' }); return }

  const myParticipant = db.prepare(
    'select id from front_participants where front_id = ? and nation_id = ?'
  ).get(front.id, myNation.id) as any
  if (!myParticipant) { res.status(403).json({ error: 'Not your front' }); return }

  // Remove this nation from the front
  db.prepare('delete from front_participants where front_id = ? and nation_id = ?')
    .run(front.id, myNation.id)

  // Check if either side is now empty — if so, resolve the front
  const attackersLeft = (db.prepare(
    "select count(*) as c from front_participants where front_id = ? and side = 'attacker'"
  ).get(front.id) as any).c

  const defendersLeft = (db.prepare(
    "select count(*) as c from front_participants where front_id = ? and side = 'defender'"
  ).get(front.id) as any).c

  if (attackersLeft === 0 || defendersLeft === 0) {
    db.prepare("update fronts set status = 'resolved', retreating_by = ? where id = ?")
      .run(myNation.id, front.id)
  }

  res.json({ ok: true, message: `${myNation.name} retreated from ${front.name}` })
})

// ── Battles ─────────────────────────────────────────────
router.post('/battles/launch/:frontId', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const myNation = db.prepare('select id, name from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(400).json({ error: 'You must control a nation' }); return }

  const myParticipant = db.prepare(
    'select side from front_participants where front_id = ? and nation_id = ?'
  ).get(req.params.frontId, myNation.id) as any
  if (!myParticipant) { res.status(403).json({ error: 'Not your front' }); return }

  const front = db.prepare("select * from fronts where id = ? and status = 'active'").get(req.params.frontId) as any
  if (!front) { res.status(404).json({ error: 'Active front not found' }); return }

  const turn = db.prepare('select max(number) as n from turns').get() as any
  const currentTurn = turn?.n || 1

  const { battle, log } = resolveBattle(front, currentTurn)
  if (!battle) { res.status(400).json({ error: 'No units assigned to this front' }); return }

  const progressBefore = front.progress || 0
  let progressAfter = progressBefore

  if (battle.result === 'attacker_win') {
    progressAfter = Math.min(front.max_progress || 10, progressBefore + 1)
  } else if (battle.result === 'defender_win') {
    progressAfter = Math.max(0, progressBefore - 1)
  }

  db.prepare('update battles set progress_before = ?, progress_after = ? where id = ?')
    .run(progressBefore, progressAfter, battle.id)

  db.prepare('update fronts set progress = ? where id = ?').run(progressAfter, front.id)

  if (progressAfter >= (front.max_progress || 10)) {
    db.prepare("update fronts set status = 'resolved' where id = ?").run(front.id)
  } else if (progressAfter <= 0) {
    db.prepare("update fronts set status = 'resolved' where id = ?").run(front.id)
  }

  res.json({ battle, log })
})

router.get('/battles', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.json({ battles: [] }); return }

  const battles = db.prepare(`
    select b.*, an.name as attacker_name, dn.name as defender_name, f.name as front_name
    from battles b
    join nations an on b.attacker_nation_id = an.id
    left join nations dn on b.defender_nation_id = dn.id
    join fronts f on b.front_id = f.id
    where b.attacker_nation_id = ? or b.defender_nation_id = ?
    order by b.created_at desc
    limit 50
  `).all(myNation.id, myNation.id)

  res.json({ battles })
})

export default router
