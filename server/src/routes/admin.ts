import { Router } from 'express'
import crypto from 'crypto'
import db from '../db'
import type { AuthRequest } from '../auth'
import { processTurn } from '../game/economy.js'

const router = Router()

// ── Dashboard ──────────────────────────────────────────────
router.get('/dashboard', (req: AuthRequest, res) => {
  const activeTurn = db.prepare("select * from turns where status = 'open' order by number desc limit 1").get()
  const totalNations = (db.prepare('select count(*) as c from nations').get() as any).c
  const pendingOrders = (db.prepare('select count(*) as c from orders o join turns t on o.turn_id = t.id where t.status = ?').get('open') as any).c
  const totalPlayers = (db.prepare('select count(*) as c from players').get() as any).c
  const totalCompanies = (db.prepare('select count(*) as c from companies').get() as any).c
  const turnHistory = db.prepare('select * from turns order by number desc limit 10').all()

  const deadlinesPast = db.prepare("select count(*) as c from turns where status = 'open' and deadline < datetime('now')").get() as any

  const activeTurnId = activeTurn ? (activeTurn as any).id : null
  const players = db.prepare(`
    select p.id, p.username, n.name as nation_name, n.id as nation_id,
      case when o.id is not null then 1 else 0 end as has_submitted
    from players p
    left join nations n on n.player_id = p.id
    left join orders o on o.nation_id = n.id and o.turn_id = ?
    order by p.username
  `).all(activeTurnId)

  res.json({
    activeTurn: activeTurn || null,
    totalNations,
    pendingOrders,
    totalPlayers,
    totalCompanies,
    turnHistory,
    deadlinesPast: deadlinesPast.c,
    players,
  })
})

// ── Nations CRUD ───────────────────────────────────────────
router.get('/nations', (req: AuthRequest, res) => {
  const nations = db.prepare(`
    select n.*, p.username as player_username
    from nations n left join players p on n.player_id = p.id
    order by n.name
  `).all()
  res.json({ nations })
})

router.put('/nations/:id', (req: AuthRequest, res) => {
  const { name, population, qol, gdp, leader_name, flag_url, leader_picture, production_units } = req.body
  const existing = db.prepare('select id from nations where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Nation not found' }); return }

  db.prepare(`
    update nations set name = ?, population = ?, qol = ?, gdp = ?,
    leader_name = ?, flag_url = ?, leader_picture = ?, production_units = ?
    where id = ?
  `).run(name, population, qol, gdp, leader_name, flag_url, leader_picture, production_units, req.params.id)

  const nation = db.prepare('select * from nations where id = ?').get(req.params.id)
  res.json({ nation })
})

router.delete('/nations/:id', (req: AuthRequest, res) => {
  const existing = db.prepare('select id from nations where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Nation not found' }); return }
  db.prepare('delete from nations where id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Players CRUD ──────────────────────────────────────────
router.get('/players', (req: AuthRequest, res) => {
  const players = db.prepare(`
    select p.id, p.username, p.created_at, n.name as nation_name, n.id as nation_id
    from players p left join nations n on p.id = n.player_id
    order by p.username
  `).all()
  res.json({ players })
})

router.put('/players/:id', (req: AuthRequest, res) => {
  const { password, nation_id } = req.body
  const existing = db.prepare('select id from players where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Player not found' }); return }

  if (password) {
    const hashed = crypto.createHash('sha256').update(password).digest('hex')
    db.prepare('update players set password = ? where id = ?').run(hashed, req.params.id)
  }

  if (nation_id !== undefined) {
    db.prepare('update nations set player_id = null where player_id = ?').run(req.params.id)
    if (nation_id) {
      db.prepare('update nations set player_id = ? where id = ?').run(req.params.id, nation_id)
    }
  }

  res.json({ ok: true })
})

router.delete('/players/:id', (req: AuthRequest, res) => {
  const existing = db.prepare('select id from players where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Player not found' }); return }
  db.prepare('update nations set player_id = null where player_id = ?').run(req.params.id)
  db.prepare('delete from players where id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Companies CRUD ─────────────────────────────────────────
router.get('/companies', (req: AuthRequest, res) => {
  const nationId = req.query.nation_id as string | undefined
  let companies
  if (nationId) {
    companies = db.prepare(`
      select c.*, n.name as nation_name from companies c
      join nations n on c.nation_id = n.id
      where c.nation_id = ? order by n.name, c.name
    `).all(nationId)
  } else {
    companies = db.prepare(`
      select c.*, n.name as nation_name from companies c
      join nations n on c.nation_id = n.id
      order by n.name, c.name
    `).all()
  }
  res.json({ companies })
})

router.put('/companies/:id', (req: AuthRequest, res) => {
  const { profit, subsidies, name } = req.body
  const existing = db.prepare('select id from companies where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Company not found' }); return }

  const updates: string[] = []
  const params: any[] = []
  if (name !== undefined) { updates.push('name = ?'); params.push(name) }
  if (profit !== undefined) { updates.push('profit = ?'); params.push(profit) }
  if (subsidies !== undefined) { updates.push('subsidies = ?'); params.push(subsidies) }

  if (updates.length > 0) {
    params.push(req.params.id)
    db.prepare(`update companies set ${updates.join(', ')} where id = ?`).run(...params)
  }

  const company = db.prepare('select * from companies where id = ?').get(req.params.id)
  res.json({ company })
})

router.post('/companies', (req: AuthRequest, res) => {
  const { name, nation_id, profit, subsidies, sector } = req.body
  if (!name || !nation_id) { res.status(400).json({ error: 'Name and nation_id required' }); return }

  const id = crypto.randomUUID()
  db.prepare(
    'insert into companies (id, name, nation_id, profit, subsidies, sector) values (?, ?, ?, ?, ?, ?)'
  ).run(id, name, nation_id, profit || 0, subsidies || 0, sector || '')

  const company = db.prepare('select * from companies where id = ?').get(id)
  res.json({ company })
})

router.delete('/companies/:id', (req: AuthRequest, res) => {
  const existing = db.prepare('select id from companies where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Company not found' }); return }
  db.prepare('delete from companies where id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Sector Modifiers ───────────────────────────────────────
router.get('/sector-modifiers/:nationId', (req: AuthRequest, res) => {
  const modifiers = db.prepare(
    'select * from sector_modifiers where nation_id = ? order by sector'
  ).all(req.params.nationId)
  res.json({ modifiers })
})

router.put('/sector-modifiers/:nationId', (req: AuthRequest, res) => {
  const { modifiers } = req.body
  if (!Array.isArray(modifiers)) { res.status(400).json({ error: 'modifiers array required' }); return }

  const upsert = db.prepare(`
    insert into sector_modifiers (nation_id, sector, mod_mult) values (?, ?, ?)
    on conflict (nation_id, sector) do update set mod_mult = excluded.mod_mult
  `)

  const tx = db.transaction(() => {
    for (const m of modifiers) {
      if (!m.sector || m.mod_mult == null) continue
      upsert.run(req.params.nationId, m.sector, m.mod_mult)
    }
  })
  tx()

  const updated = db.prepare(
    'select * from sector_modifiers where nation_id = ? order by sector'
  ).all(req.params.nationId)
  res.json({ modifiers: updated })
})

// ── Turn Management ────────────────────────────────────────
router.get('/turns', (req: AuthRequest, res) => {
  const turns = db.prepare('select * from turns order by number desc').all()
  res.json({ turns })
})

router.post('/turns/force-close', (req: AuthRequest, res) => {
  const turn = db.prepare("select * from turns where status = 'open' order by number desc limit 1").get() as any
  if (!turn) { res.status(400).json({ error: 'No open turn' }); return }

  db.prepare("update turns set status = 'done', processed_at = datetime('now') where id = ?").run(turn.id)
  res.json({ ok: true })
})

router.post('/turns/process', (req: AuthRequest, res) => {
  const turn = db.prepare("select * from turns where status = 'open' order by number desc limit 1").get() as any
  if (!turn) { res.status(400).json({ error: 'No open turn' }); return }

  processTurn()
  res.json({ ok: true })
})

router.post('/turns', (req: AuthRequest, res) => {
  const lastTurn = db.prepare('select * from turns order by number desc limit 1').get() as any
  const nextNumber = lastTurn ? lastTurn.number + 1 : 1
  const turnDuration = parseInt(req.query.duration as string) || 48
  const deadline = new Date(Date.now() + turnDuration * 60 * 60 * 1000).toISOString()
  const id = crypto.randomUUID()

  db.prepare('insert into turns (id, number, status, deadline) values (?, ?, ?, ?)').run(id, nextNumber, 'open', deadline)
  const turn = db.prepare('select * from turns where id = ?').get(id)
  res.json({ turn })
})

// ── Orders Viewer ──────────────────────────────────────────
router.get('/orders', (req: AuthRequest, res) => {
  const turnId = req.query.turn_id as string | undefined
  const nationId = req.query.nation_id as string | undefined

  let query = `
    select o.*, n.name as nation_name, t.number as turn_number
    from orders o
    join nations n on o.nation_id = n.id
    join turns t on o.turn_id = t.id
    where 1=1
  `
  const params: any[] = []

  if (turnId) { query += ' and o.turn_id = ?'; params.push(turnId) }
  if (nationId) { query += ' and o.nation_id = ?'; params.push(nationId) }

  query += ' order by n.name, o.type'

  const orders = db.prepare(query).all(...params)
  res.json({ orders })
})

// ── Game Settings ──────────────────────────────────────────
router.get('/settings', (req: AuthRequest, res) => {
  let settings = db.prepare('select * from game_settings limit 1').get() as any
  if (!settings) {
    settings = {
      turn_duration_hours: 48,
      starting_gdp: 500000,
      starting_population: 100000000,
      starting_qol: 50,
      base_income_multiplier: 1.0,
    }
  }
  res.json({ settings })
})

router.put('/settings', (req: AuthRequest, res) => {
  const { turn_duration_hours, starting_gdp, starting_population, starting_qol, base_income_multiplier } = req.body

  let settings = db.prepare('select * from game_settings limit 1').get()
  if (settings) {
    db.prepare(`
      update game_settings set
        turn_duration_hours = ?, starting_gdp = ?, starting_population = ?,
        starting_qol = ?, base_income_multiplier = ?
      where id = (select id from game_settings limit 1)
    `).run(turn_duration_hours, starting_gdp, starting_population, starting_qol, base_income_multiplier)
  } else {
    const id = crypto.randomUUID()
    db.prepare(`
      insert into game_settings (id, turn_duration_hours, starting_gdp, starting_population, starting_qol, base_income_multiplier)
      values (?, ?, ?, ?, ?, ?)
    `).run(id, turn_duration_hours, starting_gdp, starting_population, starting_qol, base_income_multiplier)
  }

  settings = db.prepare('select * from game_settings limit 1').get()
  res.json({ settings })
})

// ── Pins CRUD ────────────────────────────────────────────
router.get('/pins', (req: AuthRequest, res) => {
  const pins = db.prepare(`
    select p.*, n.name as nation_name, pl.username as creator_name
    from pins p
    left join nations n on p.nation_id = n.id
    left join players pl on p.created_by = pl.id
    order by p.created_at desc
  `).all()
  res.json({ pins })
})

router.post('/pins', (req: AuthRequest, res) => {
  const { nation_id, x, y, label, description } = req.body
  if (x == null || y == null || !label) {
    res.status(400).json({ error: 'x, y, and label are required' })
    return
  }

  const id = crypto.randomUUID()
  db.prepare(`
    insert into pins (id, nation_id, x, y, label, description, type, visibility, created_by)
    values (?, ?, ?, ?, ?, ?, 'admin', 'private', ?)
  `).run(id, nation_id || null, x, y, label, description || '', req.playerId!)

  const pin = db.prepare('select * from pins where id = ?').get(id)
  res.json({ pin })
})

router.put('/pins/:id', (req: AuthRequest, res) => {
  const existing = db.prepare('select id from pins where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Pin not found' }); return }

  const { nation_id, x, y, label, description } = req.body
  db.prepare(`
    update pins set nation_id = ?, x = ?, y = ?, label = ?, description = ?
    where id = ?
  `).run(
    nation_id ?? null, x, y, label, description, req.params.id
  )

  const pin = db.prepare('select * from pins where id = ?').get(req.params.id)
  res.json({ pin })
})

router.delete('/pins/:id', (req: AuthRequest, res) => {
  const existing = db.prepare('select id from pins where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Pin not found' }); return }
  db.prepare('delete from pins where id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Front Management ────────────────────────────────────
function attachParticipants(fronts: any[]) {
  for (const front of fronts) {
    front.participants = db.prepare(`
      select fp.*, n.name as nation_name
      from front_participants fp
      join nations n on fp.nation_id = n.id
      where fp.front_id = ?
    `).all(front.id)
  }
  return fronts
}

router.get('/fronts', (req: AuthRequest, res) => {
  const fronts = db.prepare(`
    select f.*, an.name as attacker_name, dn.name as defender_name
    from fronts f
    join nations an on f.attacker_nation_id = an.id
    left join nations dn on f.defender_nation_id = dn.id
    order by f.created_at desc
  `).all() as any[]
  attachParticipants(fronts)
  res.json({ fronts })
})

router.get('/fronts/pending', (req: AuthRequest, res) => {
  const fronts = db.prepare(`
    select f.*, an.name as attacker_name, dn.name as defender_name
    from fronts f
    join nations an on f.attacker_nation_id = an.id
    left join nations dn on f.defender_nation_id = dn.id
    where f.status = 'pending'
    order by f.created_at desc
  `).all() as any[]
  attachParticipants(fronts)
  res.json({ fronts })
})

router.post('/fronts/:id/approve', (req: AuthRequest, res) => {
  const { max_progress, front_width, attacker_nation_ids, defender_nation_ids } = req.body

  const front = db.prepare("select * from fronts where id = ? and status = 'pending'").get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Pending front not found' }); return }

  const aIds: string[] = attacker_nation_ids || []
  const dIds: string[] = defender_nation_ids || []

  if (aIds.length === 0 || dIds.length === 0) {
    res.status(400).json({ error: 'At least one attacker and one defender required' }); return
  }

  // Validate all nations exist
  for (const id of [...aIds, ...dIds]) {
    const n = db.prepare('select id from nations where id = ?').get(id)
    if (!n) { res.status(404).json({ error: `Nation ${id} not found` }); return }
  }

  // Check no overlap
  const overlap = aIds.some((id: string) => dIds.includes(id))
  if (overlap) { res.status(400).json({ error: 'Attacker and defender sets must not overlap' }); return }

  const mp = max_progress || 10
  const startProgress = Math.ceil(mp / 2)

  db.transaction(() => {
    // Remove existing participants (the applicant was inserted at creation)
    db.prepare('delete from front_participants where front_id = ?').run(req.params.id)

    // Insert all attackers
    const insPart = db.prepare('insert into front_participants (id, front_id, nation_id, side) values (?, ?, ?, ?)')
    for (const id of aIds) {
      insPart.run(crypto.randomUUID(), req.params.id, id, 'attacker')
    }
    for (const id of dIds) {
      insPart.run(crypto.randomUUID(), req.params.id, id, 'defender')
    }

    // Update front: store first attacker/defender as primary
    db.prepare(`
      update fronts set status = 'active', attacker_nation_id = ?, defender_nation_id = ?,
      progress = ?, max_progress = ?, front_width = ? where id = ?
    `).run(aIds[0], dIds[0], startProgress, mp, front_width || 1, req.params.id)
  })()

  const updated = db.prepare(`
    select f.*, an.name as attacker_name, dn.name as defender_name
    from fronts f
    join nations an on f.attacker_nation_id = an.id
    join nations dn on f.defender_nation_id = dn.id
    where f.id = ?
  `).get(req.params.id) as any
  updated.participants = db.prepare(`
    select fp.*, n.name as nation_name
    from front_participants fp
    join nations n on fp.nation_id = n.id
    where fp.front_id = ?
  `).all(req.params.id)

  res.json({ front: updated })
})

router.post('/fronts/:id/reject', (req: AuthRequest, res) => {
  const front = db.prepare("select * from fronts where id = ? and status = 'pending'").get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Pending front not found' }); return }

  db.prepare("update fronts set status = 'resolved' where id = ?").run(req.params.id)
  res.json({ ok: true, message: `Rejected front: ${front.name}` })
})

// ── Edit Front (mid-war) ───────────────────────────────
router.put('/fronts/:id', (req: AuthRequest, res) => {
  const front = db.prepare("select * from fronts where id = ? and status = 'active'").get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Active front not found' }); return }

  const { front_width, max_progress, attacker_nation_ids, defender_nation_ids } = req.body

  db.transaction(() => {
    // Update simple fields
    if (front_width !== undefined || max_progress !== undefined) {
      const updates: string[] = []
      const params: any[] = []
      if (front_width !== undefined) { updates.push('front_width = ?'); params.push(front_width) }
      if (max_progress !== undefined) { updates.push('max_progress = ?'); params.push(max_progress) }
      params.push(req.params.id)
      db.prepare(`update fronts set ${updates.join(', ')} where id = ?`).run(...params)
    }

    // Update participants if provided
    if (attacker_nation_ids !== undefined || defender_nation_ids !== undefined) {
      if (attacker_nation_ids !== undefined) {
        db.prepare("delete from front_participants where front_id = ? and side = 'attacker'").run(req.params.id)
        const ins = db.prepare('insert into front_participants (id, front_id, nation_id, side) values (?, ?, ?, ?)')
        for (const id of attacker_nation_ids) {
          ins.run(crypto.randomUUID(), req.params.id, id, 'attacker')
        }
        if (attacker_nation_ids.length > 0) {
          db.prepare('update fronts set attacker_nation_id = ? where id = ?').run(attacker_nation_ids[0], req.params.id)
        }
      }
      if (defender_nation_ids !== undefined) {
        db.prepare("delete from front_participants where front_id = ? and side = 'defender'").run(req.params.id)
        const ins = db.prepare('insert into front_participants (id, front_id, nation_id, side) values (?, ?, ?, ?)')
        for (const id of defender_nation_ids) {
          ins.run(crypto.randomUUID(), req.params.id, id, 'defender')
        }
        if (defender_nation_ids.length > 0) {
          db.prepare('update fronts set defender_nation_id = ? where id = ?').run(defender_nation_ids[0], req.params.id)
        }
      }
    }
  })()

  const updated = db.prepare(`
    select f.*, an.name as attacker_name, dn.name as defender_name
    from fronts f
    join nations an on f.attacker_nation_id = an.id
    left join nations dn on f.defender_nation_id = dn.id
    where f.id = ?
  `).get(req.params.id) as any
  updated.participants = db.prepare(`
    select fp.*, n.name as nation_name
    from front_participants fp
    join nations n on fp.nation_id = n.id
    where fp.front_id = ?
  `).all(req.params.id)

  res.json({ front: updated })
})

// ── Delete Front ────────────────────────────────────────
router.delete('/fronts/:id', (req: AuthRequest, res) => {
  const front = db.prepare('select * from fronts where id = ?').get(req.params.id) as any
  if (!front) { res.status(404).json({ error: 'Front not found' }); return }

  db.prepare('delete from fronts where id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
