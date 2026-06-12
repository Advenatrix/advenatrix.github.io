import { Router } from 'express'
import crypto from 'crypto'
import db from '../db'
import type { AuthRequest } from '../auth'

const router = Router()

router.get('/current', (req: AuthRequest, res) => {
  const turn = db.prepare("select * from turns where status = 'open' order by number desc limit 1").get() as any
  if (!turn) {
    res.json({ turn: null })
    return
  }
  const orders = db.prepare('select * from orders where turn_id = ?').all(turn.id)
  res.json({ turn, orders })
})

router.post('/submit-order', (req: AuthRequest, res) => {
  if (!req.playerId) { res.status(401).json({ error: 'Not authenticated' }); return }

  const { type, targetId, payload } = req.body
  if (!type) { res.status(400).json({ error: 'Order type required' }); return }

  const nation = db.prepare('select id from nations where player_id = ?').get(req.playerId) as any
  if (!nation) { res.status(400).json({ error: 'No nation controlled' }); return }

  const turn = db.prepare("select id from turns where status = 'open' order by number desc limit 1").get() as any
  if (!turn) { res.status(400).json({ error: 'No active turn' }); return }

  const id = crypto.randomUUID()
  db.prepare(
    'insert into orders (id, turn_id, nation_id, type, target_id, payload) values (?, ?, ?, ?, ?, ?)'
  ).run(id, turn.id, nation.id, type, targetId || null, payload || null)

  res.json({ order: { id, type, targetId, payload } })
})

export default router
