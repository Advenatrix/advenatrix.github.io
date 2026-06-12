import { Router } from 'express'
import crypto from 'crypto'
import db from '../db'
import type { AuthRequest } from '../auth'
import { getUnitDefaults, computeUnitCosts } from '../game/unitDefaults.js'
import { computeGDP, computeAllSectorCaps } from '../game/economy.js'

const router = Router()

// ── Pins ──────────────────────────────────────────────────
router.get('/pins', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const player = db.prepare('select id from players where id = ?').get(playerId) as any
  if (!player) { res.status(401).json({ error: 'Invalid player' }); return }

  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  const myNationId = myNation?.id || null

  const isAdminPlayer = (db.prepare('select username from players where id = ?').get(playerId) as any)?.username === 'admin'

  let pins
  if (isAdminPlayer) {
    pins = db.prepare('select * from pins order by created_at desc').all()
  } else {
    pins = db.prepare(`
      select p.* from pins p
      where p.type = 'admin'
      or (p.type = 'player' and p.created_by = ?)
      or (
        p.type = 'player' and p.visibility = 'shared'
        and exists (
          select 1 from intel_shares is_
          join nations n on n.id = is_.sharer_nation_id
          where n.player_id = p.created_by
          and is_.target_nation_id = ?
        )
      )
    `).all(playerId, myNationId)
  }

  res.json({ pins })
})

router.post('/pins', (req: AuthRequest, res) => {
  const { x, y, label, description, visibility } = req.body
  if (x == null || y == null || !label) {
    res.status(400).json({ error: 'x, y, and label are required' })
    return
  }

  const playerId = req.playerId!
  const nation = db.prepare('select id from nations where player_id = ?').get(playerId) as any

  const id = crypto.randomUUID()
  db.prepare(`
    insert into pins (id, nation_id, x, y, label, description, type, visibility, created_by)
    values (?, ?, ?, ?, ?, ?, 'player', ?, ?)
  `).run(id, nation?.id || null, x, y, label, description || '', visibility || 'private', playerId)

  const pin = db.prepare('select * from pins where id = ?').get(id)
  res.json({ pin })
})

router.put('/pins/:id', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const existing = db.prepare('select * from pins where id = ? and created_by = ?').get(req.params.id, playerId) as any
  if (!existing) { res.status(404).json({ error: 'Pin not found or not yours' }); return }

  const { x, y, label, description, visibility } = req.body
  db.prepare(`
    update pins set x = ?, y = ?, label = ?, description = ?, visibility = ?
    where id = ?
  `).run(
    x ?? existing.x, y ?? existing.y,
    label ?? existing.label, description ?? existing.description,
    visibility ?? existing.visibility, req.params.id
  )

  const pin = db.prepare('select * from pins where id = ?').get(req.params.id)
  res.json({ pin })
})

router.delete('/pins/:id', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const existing = db.prepare('select * from pins where id = ? and created_by = ?').get(req.params.id, playerId)
  if (!existing) { res.status(404).json({ error: 'Pin not found or not yours' }); return }

  db.prepare('delete from pins where id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.get('/nations', (req: AuthRequest, res) => {
  const nations = db.prepare('select * from nations').all()
  res.json({ nations })
})

router.get('/nations/:id', (req: AuthRequest, res) => {
  const nation = db.prepare('select * from nations where id = ?').get(req.params.id) as any
  if (!nation) { res.status(404).json({ error: 'Nation not found' }); return }

  const companies = db.prepare('select * from companies where nation_id = ?').all(nation.id)

  // GDP is now computed from companies, not stored.
  // The DB gdp column is repurposed as treasury (cash on hand).
  // We override nation.gdp with the computed value for backward-compatible API shape.
  const computedGdp = computeGDP(nation.id)
  const treasury = nation.gdp

  const sectorCaps = computeAllSectorCaps(nation.id)

  res.json({
    ...nation,
    gdp: computedGdp,
    treasury,
    flow: [], usage: [], stockpiles: [], companies, provinces: [], techs: [],
    sector_caps: sectorCaps,
  })
})

router.put('/nations/:id/policies', (req: AuthRequest, res) => {
  const { tax_level = 2, corporate_tax_level = 2, civil_level = 2, army_level = 1, airforce_level = 1, naval_level = 1 } = req.body
  const existing = db.prepare('select id from nations where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Nation not found' }); return }

  db.prepare(`
    update nations set tax_level = ?, corporate_tax_level = ?, civil_level = ?,
    army_level = ?, airforce_level = ?, naval_level = ? where id = ?
  `).run(tax_level, corporate_tax_level, civil_level, army_level, airforce_level, naval_level, req.params.id)

  const nation = db.prepare('select * from nations where id = ?').get(req.params.id)
  res.json({ nation })
})

router.get('/provinces', (req: AuthRequest, res) => {
  res.json({ provinces: [] })
})

router.get('/eco-history/:nationId', (req: AuthRequest, res) => {
  const history = db.prepare(
    'select * from eco_history where nation_id = ? order by turn_number asc'
  ).all(req.params.nationId)
  res.json({ history })
})

router.get('/buildings', (req: AuthRequest, res) => {
  res.json({ buildings: [] })
})

// ── Intel Shares ──────────────────────────────────────────
router.get('/intel-shares', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.json({ shares: [] }); return }

  const shares = db.prepare(`
    select is_.*, tn.name as target_nation_name, sn.name as sharer_nation_name
    from intel_shares is_
    join nations tn on is_.target_nation_id = tn.id
    join nations sn on is_.sharer_nation_id = sn.id
    where is_.sharer_nation_id = ?
    order by tn.name
  `).all(myNation.id)

  res.json({ shares })
})

router.post('/intel-shares', (req: AuthRequest, res) => {
  const { target_nation_id } = req.body
  if (!target_nation_id) { res.status(400).json({ error: 'target_nation_id required' }); return }

  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(400).json({ error: 'You must control a nation to share intel' }); return }

  const targetExists = db.prepare('select id from nations where id = ?').get(target_nation_id)
  if (!targetExists) { res.status(404).json({ error: 'Target nation not found' }); return }

  if (target_nation_id === myNation.id) {
    res.status(400).json({ error: 'Cannot share intel with yourself' }); return
  }

  const existing = db.prepare(
    'select id from intel_shares where sharer_nation_id = ? and target_nation_id = ?'
  ).get(myNation.id, target_nation_id)
  if (existing) { res.status(400).json({ error: 'Already sharing intel with this nation' }); return }

  const id = crypto.randomUUID()
  db.prepare(
    'insert into intel_shares (id, sharer_nation_id, target_nation_id) values (?, ?, ?)'
  ).run(id, myNation.id, target_nation_id)

  const share = db.prepare(`
    select is_.*, tn.name as target_nation_name
    from intel_shares is_
    join nations tn on is_.target_nation_id = tn.id
    where is_.id = ?
  `).get(id)

  res.json({ share })
})

router.delete('/intel-shares/:id', (req: AuthRequest, res) => {
  const playerId = req.playerId!
  const myNation = db.prepare('select id from nations where player_id = ?').get(playerId) as any
  if (!myNation) { res.status(400).json({ error: 'You must control a nation' }); return }

  const share = db.prepare(
    'select id from intel_shares where id = ? and sharer_nation_id = ?'
  ).get(req.params.id, myNation.id)

  if (!share) { res.status(404).json({ error: 'Intel share not found' }); return }

  db.prepare('delete from intel_shares where id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Military ──────────────────────────────────────────────
router.get('/military/:nationId', (req: AuthRequest, res) => {
  const { nationId } = req.params
  const templates = db.prepare('select * from unit_templates where nation_id = ?').all(nationId)
  const formations = db.prepare('select * from formations where nation_id = ? order by type, name').all(nationId)
  const units = db.prepare(`
    select u.*, ut.name as template_name
    from units u
    left join unit_templates ut on u.template_id = ut.id
    where u.nation_id = ?
    order by u.formation_id, u.created_at
  `).all(nationId)

      res.json({ templates, formations, units })
})

router.post('/companies', (req: AuthRequest, res) => {
  const { name, nation_id, sector } = req.body
  if (!name || !nation_id) { res.status(400).json({ error: 'Name and nation_id required' }); return }

  const myNation = db.prepare('select id, gdp from nations where player_id = ?').get(req.playerId) as any
  if (!myNation || myNation.id !== nation_id) { res.status(403).json({ error: 'Not your nation' }); return }

  const STARTUP_COST = 1_000_000_000
  const START_PROFIT = 100_000_000
  const id = crypto.randomUUID()
  db.transaction(() => {
    db.prepare('update nations set gdp = ifnull(gdp, 0) - ? where id = ?').run(STARTUP_COST, nation_id)
    db.prepare(
      'insert into companies (id, name, nation_id, profit, subsidies, sector) values (?, ?, ?, ?, ?, ?)'
    ).run(id, name, nation_id, START_PROFIT, 0, sector || '')
  })()

  const company = db.prepare('select * from companies where id = ?').get(id)
  res.json({ company })
})

router.get('/upkeep-breakdown/:nationId', (req: AuthRequest, res) => {
  const { nationId } = req.params
  const units = db.prepare(`
    select u.id, u.unit_type, u.upkeep, u.formation_id, u.nation_id,
           f.name as formation_name, f.branch
    from units u
    left join formations f on u.formation_id = f.id
    where u.nation_id = ? and u.status in ('active', 'damaged')
    order by f.branch, f.name
  `).all(nationId) as any[]

  const result: Record<string, { total: number; byFormation: { id: string; name: string; upkeep: number; count: number }[]; unassigned: number }> = {
    army: { total: 0, byFormation: [], unassigned: 0 },
    navy: { total: 0, byFormation: [], unassigned: 0 },
    airforce: { total: 0, byFormation: [], unassigned: 0 },
  }

  const formationUpkeep: Record<string, { id: string; name: string; upkeep: number; count: number; branch: string }> = {}

  for (const u of units) {
    const branch = (u.branch || 'army') as 'army' | 'navy' | 'airforce'
    if (u.formation_id && u.formation_name) {
      if (!formationUpkeep[u.formation_id]) {
        formationUpkeep[u.formation_id] = { id: u.formation_id, name: u.formation_name, upkeep: 0, count: 0, branch }
      }
      formationUpkeep[u.formation_id].upkeep += u.upkeep
      formationUpkeep[u.formation_id].count += 1
      result[branch].total += u.upkeep
    } else {
      result[branch].unassigned += u.upkeep
      result[branch].total += u.upkeep
    }
  }

  for (const f of Object.values(formationUpkeep)) {
    const branch = f.branch as 'army' | 'navy' | 'airforce'
    result[branch].byFormation.push({ id: f.id, name: f.name, upkeep: f.upkeep, count: f.count })
  }

  res.json(result)
})

router.put('/companies/:id/subsidies', (req: AuthRequest, res) => {
  const { subsidies } = req.body
  if (subsidies == null) { res.status(400).json({ error: 'subsidies required' }); return }

  const existing = db.prepare('select id, nation_id from companies where id = ?').get(req.params.id) as any
  if (!existing) { res.status(404).json({ error: 'Company not found' }); return }

  const myNation = db.prepare('select id from nations where player_id = ?').get(req.playerId) as any
  if (!myNation || myNation.id !== existing.nation_id) { res.status(403).json({ error: 'Not your company' }); return }

  db.prepare('update companies set subsidies = ? where id = ?').run(subsidies, req.params.id)
  const company = db.prepare('select * from companies where id = ?').get(req.params.id)
  res.json({ company })
})

router.post('/tap-resource', (req: AuthRequest, res) => {
  const { provinceId, resource, amount } = req.body
  if (!provinceId || !resource || amount == null) { res.status(400).json({ error: 'Missing fields' }); return }

  const nation = db.prepare('select id from nations where player_id = ?').get(req.playerId) as any
  if (!nation) { res.status(400).json({ error: 'No nation controlled' }); return }

  const turn = db.prepare("select id from turns where status = 'open' order by number desc limit 1").get() as any
  if (!turn) { res.status(400).json({ error: 'No active turn' }); return }

  // Upsert: delete existing tap for same province+resource, then insert
  db.prepare("delete from orders where turn_id = ? and nation_id = ? and type = 'tap_resource' and target_id = ? and json_extract(payload, '$.resource') = ?")
    .run(turn.id, nation.id, provinceId, resource)

  const id = crypto.randomUUID()
  db.prepare('insert into orders (id, turn_id, nation_id, type, target_id, payload) values (?, ?, ?, ?, ?, ?)')
    .run(id, turn.id, nation.id, 'tap_resource', provinceId, JSON.stringify({ resource, amount }))

  res.json({ order: { id, provinceId, resource, amount } })
})

router.post('/unit-templates', (req: AuthRequest, res) => {
  const { nation_id, name, branch, unit_type, armor, firepower, speed } = req.body
  if (!nation_id || !name || !branch || !armor || !firepower || !speed) {
    res.status(400).json({ error: 'All fields required' }); return
  }
  const ut = unit_type || 'Infantry Battalion'
  const defs = getUnitDefaults(ut)
  const id = crypto.randomUUID()
  db.prepare('insert into unit_templates (id, nation_id, name, branch, unit_type, armor, firepower, speed, build_cost, build_time, upkeep, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, nation_id, name, branch, ut, armor, firepower, speed, defs.build_cost, defs.build_time, defs.upkeep, new Date().toISOString()
  )
  const template = db.prepare('select * from unit_templates where id = ?').get(id)
  res.json({ template })
})

router.put('/unit-templates/:id', (req: AuthRequest, res) => {
  const { name, armor, firepower, speed } = req.body
  const existing = db.prepare('select id from unit_templates where id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  db.prepare('update unit_templates set name=?, armor=?, firepower=?, speed=? where id=?')
    .run(name, armor, firepower, speed, req.params.id)
  const template = db.prepare('select * from unit_templates where id = ?').get(req.params.id)
  res.json({ template })
})

router.delete('/unit-templates/:id', (req: AuthRequest, res) => {
  db.prepare('delete from unit_templates where id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.post('/formations', (req: AuthRequest, res) => {
  const { nation_id, name, type, branch } = req.body
  if (!nation_id || !name || !type || !branch) {
    res.status(400).json({ error: 'All fields required' }); return
  }
  const id = crypto.randomUUID()
  db.prepare('insert into formations (id, nation_id, name, type, branch, created_at) values (?, ?, ?, ?, ?, ?)').run(
    id, nation_id, name, type, branch, new Date().toISOString()
  )
  const formation = db.prepare('select * from formations where id = ?').get(id)
  res.json({ formation })
})

router.post('/units', (req: AuthRequest, res) => {
  const { template_id, formation_id, nation_id, name, unit_type, armor, firepower, speed, strength } = req.body
  if (!nation_id || !name) {
    res.status(400).json({ error: 'nation_id and name required' }); return
  }
  const id = crypto.randomUUID()
  let ut = unit_type || 'Infantry Battalion'
  let baseDefs = getUnitDefaults(ut)
  if (template_id) {
    const tmpl = db.prepare('select unit_type, build_cost, build_time, upkeep from unit_templates where id = ?').get(template_id) as any
    if (tmpl) {
      ut = tmpl.unit_type
      baseDefs = { build_cost: tmpl.build_cost, build_time: tmpl.build_time, upkeep: tmpl.upkeep }
    }
  }
  const a = armor || 'Medium'
  const fp = firepower || 'Medium'
  const sp = speed || 'Medium'
  const { build_cost, upkeep } = computeUnitCosts(baseDefs.build_cost, baseDefs.upkeep, a, fp, sp)

  const turn = db.prepare("select max(number) as n from turns where status = 'open'").get() as any
  const currentTurn = turn?.n || 1
  const readyTurn = currentTurn + baseDefs.build_time

  // Deduct build cost from nation's GDP
  db.prepare('update nations set gdp = ifnull(gdp, 0) - ? where id = ?').run(build_cost, nation_id)

  db.prepare(`
    insert into units (id, template_id, formation_id, nation_id, name, unit_type, armor, firepower, speed, strength, status, build_cost, build_time, upkeep, ready_turn, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'building', ?, ?, ?, ?, ?)
  `).run(id, template_id || null, formation_id || null, nation_id, name, ut,
    a, fp, sp, strength || 100,
    build_cost, baseDefs.build_time, upkeep, readyTurn,
    new Date().toISOString())
  const unit = db.prepare(`
    select u.*, ut.name as template_name from units u
    left join unit_templates ut on u.template_id = ut.id where u.id = ?
  `).get(id)
  res.json({ unit })
})

router.put('/units/:id/assign', (req: AuthRequest, res) => {
  const { formation_id } = req.body
  db.prepare('update units set formation_id = ? where id = ?').run(formation_id || null, req.params.id)
  const unit = db.prepare(`
    select u.*, ut.name as template_name from units u
    left join unit_templates ut on u.template_id = ut.id where u.id = ?
  `).get(req.params.id)
  res.json({ unit })
})

router.delete('/units/:id', (req: AuthRequest, res) => {
  db.prepare('delete from units where id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
