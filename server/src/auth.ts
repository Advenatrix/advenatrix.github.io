import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import db from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'georp-dev-secret-change-in-production'
const ADMIN_USERNAME = 'admin'

export interface AuthRequest extends Request {
  playerId?: string
}

export function isAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.playerId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  const player = db.prepare('select username from players where id = ?').get(req.playerId) as any
  if (!player || player.username !== ADMIN_USERNAME) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

export function generateToken(playerId: string): string {
  return jwt.sign({ playerId }, JWT_SECRET, { expiresIn: '7d' })
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  try {
    const token = header.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { playerId: string }
    req.playerId = decoded.playerId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
