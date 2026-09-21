import { serve } from 'https://deno.land/std/http/server.ts'
import bcrypt from 'npm:bcryptjs'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'georp-dev-secret-change-in-production'
const REST_URL = `${SUPABASE_URL}/rest/v1`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function restHeaders() {
  return {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
    'Content-Type': 'application/json',
  }
}

async function getKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function createToken(payload: { sub: string; username: string }): Promise<string> {
  const key = await getKey()
  return await create({ alg: 'HS256', typ: 'JWT' },
    { ...payload, iat: getNumericDate(0), exp: getNumericDate(604800) }, key)
}

serve(async (req) => {
  try {
    const cors = handleCors(req)
    if (cors) return cors

    const url = new URL(req.url)
    const method = req.method

    if (url.pathname === '/health') return json({ ok: true })
    if (method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    // ── POST /auth/register ──
    if (url.pathname === '/auth/register') {
      const { username, password } = await req.json()
      if (!username || !password) return json({ error: 'Username and password required' }, 400)
      if (username.length < 2) return json({ error: 'Username must be at least 2 characters' }, 400)
      if (password.length < 4) return json({ error: 'Password must be at least 4 characters' }, 400)

      const existRes = await fetch(`${REST_URL}/users?username=eq.${username}&select=id`, {
        headers: restHeaders(),
      })
      const existing = await existRes.json()
      if (existing.length > 0) return json({ error: 'Username already taken' }, 409)

      const password_hash = bcrypt.hashSync(password, 10)
      const insRes = await fetch(`${REST_URL}/users`, {
        method: 'POST',
        headers: { ...restHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ username, password_hash }),
      })
      if (!insRes.ok) return json({ error: 'Failed to create user' }, 500)

      const users = await insRes.json()
      const user = Array.isArray(users) ? users[0] : users
      const token = await createToken({ sub: user.id, username: user.username })
      return json({ token, user: { id: user.id, username: user.username } })
    }

    // ── POST /auth/login ──
    if (url.pathname === '/auth/login') {
      const { username, password } = await req.json()
      if (!username || !password) return json({ error: 'Username and password required' }, 400)

      const selRes = await fetch(`${REST_URL}/users?username=eq.${encodeURIComponent(username)}&select=*`, {
        headers: restHeaders(),
      })
      const users = await selRes.json()
      if (!users || users.length === 0) return json({ error: 'Invalid username or password' }, 401)

      const user = users[0]
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return json({ error: 'Invalid username or password' }, 401)

      const token = await createToken({ sub: user.id, username: user.username })
      return json({ token, user: { id: user.id, username: user.username } })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
