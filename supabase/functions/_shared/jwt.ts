import { create, verify, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts'

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'georp-dev-secret-change-in-production'
const JWT_EXPIRY_HOURS = 168 // 7 days

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(JWT_SECRET)
  return await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  )
}

export async function createToken(payload: { sub: string; username: string }): Promise<string> {
  const key = await getKey()
  return await create(
    { alg: 'HS256', typ: 'JWT' },
    { ...payload, iat: getNumericDate(0), exp: getNumericDate(JWT_EXPIRY_HOURS * 3600) },
    key,
  )
}

export async function verifyToken(token: string): Promise<{ sub: string; username: string } | null> {
  try {
    const key = await getKey()
    const payload = await verify(token, key)
    if (typeof payload === 'object' && payload && 'sub' in payload && 'username' in payload) {
      return { sub: payload.sub as string, username: payload.username as string }
    }
    return null
  } catch {
    return null
  }
}

export async function getUserFromRequest(req: Request): Promise<{ sub: string; username: string } | null> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null
  return await verifyToken(token)
}
