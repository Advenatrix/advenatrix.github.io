import { Router } from 'express'
import crypto from 'crypto'
import db from '../db'
import { generateToken, authMiddleware } from '../auth'

const router = Router()

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

router.post('/register', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' })
    return
  }

  const id = crypto.randomUUID()
  const hashed = hashPassword(password)

  try {
    db.prepare('insert into players (id, username, password) values (?, ?, ?)').run(id, username, hashed)
    const token = generateToken(id)
    res.json({ player: { id, username }, token })
  } catch {
    res.status(400).json({ error: 'Username already taken' })
  }
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' })
    return
  }

  const player = db.prepare('select * from players where username = ?').get(username) as any
  if (!player || player.password !== hashPassword(password)) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = generateToken(player.id)
  res.json({ player: { id: player.id, username: player.username }, token })
})

router.get('/me', authMiddleware, (req, res) => {
  const player = db.prepare('select id, username from players where id = ?').get((req as any).playerId) as any
  if (!player) {
    res.status(404).json({ error: 'Player not found' })
    return
  }
  res.json({ player })
})

export default router
