import { serve } from 'https://deno.land/std/http/server.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { db, json } from '../_shared/db.ts'
import { handleCors } from '../_shared/cors.ts'
import { createToken } from '../_shared/jwt.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const method = req.method

  if (method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── POST /auth/register ──
  if (url.pathname === '/auth/register') {
    const { username, password } = await req.json()
    if (!username || !password) return json({ error: 'Username and password required' }, 400)
    if (username.length < 2) return json({ error: 'Username must be at least 2 characters' }, 400)
    if (password.length < 4) return json({ error: 'Password must be at least 4 characters' }, 400)

    const { data: existing } = await db.from('users').select('id').eq('username', username).single()
    if (existing) return json({ error: 'Username already taken' }, 409)

    const password_hash = await bcrypt.hash(password)
    const { data: user, error } = await db.from('users').insert({
      username, password_hash,
    }).select('id, username').single()

    if (error) return json({ error: error.message }, 500)

    const token = await createToken({ sub: user.id, username: user.username })
    return json({ token, user: { id: user.id, username: user.username } })
  }

  // ── POST /auth/login ──
  if (url.pathname === '/auth/login') {
    const { username, password } = await req.json()
    if (!username || !password) return json({ error: 'Username and password required' }, 400)

    const { data: user } = await db.from('users').select('*').eq('username', username).single()
    if (!user) return json({ error: 'Invalid username or password' }, 401)

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return json({ error: 'Invalid username or password' }, 401)

    const token = await createToken({ sub: user.id, username: user.username })
    return json({ token, user: { id: user.id, username: user.username } })
  }

  return json({ error: 'Not found' }, 404)
})
