import { getSupabase } from './supabase'

const supabase = getSupabase()
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${FUNCTIONS_URL}/admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Admin request failed: ${res.status}`)
  }
  return res.json()
}

// Dashboard
export function getDashboard() {
  return adminRequest<{
    activeTurn: any | null; totalNations: number; pendingOrders: number
    totalPlayers: number; totalCompanies: number; turnHistory: any[]
    deadlinesPast: number; players: { id: string; username: string; nation_name: string | null; nation_id: string | null; has_submitted: number }[]
  }>('GET', '/dashboard')
}

// Nations
export function getAdminNations() {
  return adminRequest<{ nations: any[] }>('GET', '/nations')
}

export function updateNation(id: string, data: Record<string, any>) {
  return adminRequest<{ nation: any }>('PUT', `/nations/${id}`, data)
}

export function deleteNation(id: string) {
  return adminRequest<{ ok: boolean }>('DELETE', `/nations/${id}`)
}

// Players
export function getAdminPlayers() {
  return adminRequest<{ players: any[] }>('GET', '/players')
}

export function updatePlayer(id: string, data: Record<string, any>) {
  return adminRequest<{ ok: boolean }>('PUT', `/players/${id}`, data)
}

export function deletePlayer(id: string) {
  return adminRequest<{ ok: boolean }>('DELETE', `/players/${id}`)
}

// Companies
export function getAdminCompanies(nationId?: string) {
  const qs = nationId ? `?nation_id=${nationId}` : ''
  return adminRequest<{ companies: any[] }>('GET', `/companies${qs}`)
}

export function updateCompany(id: string, data: Record<string, any>) {
  return adminRequest<{ company: any }>('PUT', `/companies/${id}`, data)
}

export function createCompany(data: Record<string, any>) {
  return adminRequest<{ company: any }>('POST', '/companies', data)
}

export function deleteCompany(id: string) {
  return adminRequest<{ ok: boolean }>('DELETE', `/companies/${id}`)
}

// Turns
export function getAdminTurns() {
  return adminRequest<{ turns: any[] }>('GET', '/turns')
}

export function forceCloseTurn() {
  return adminRequest<{ ok: boolean }>('POST', '/turns/force-close')
}

export function processTurn() {
  return adminRequest<{ ok: boolean }>('POST', '/turns/process')
}

export function createTurn(duration?: number) {
  const qs = duration ? `?duration=${duration}` : ''
  return adminRequest<{ turn: any }>('POST', `/turns${qs}`)
}

// Sector Modifiers
export function getSectorModifiers(nationId: string) {
  return adminRequest<{ modifiers: any[] }>('GET', `/sector-modifiers/${nationId}`)
}

export function updateSectorModifiers(nationId: string, modifiers: { sector: string; mod_mult: number }[]) {
  return adminRequest<{ modifiers: any[] }>('PUT', `/sector-modifiers/${nationId}`, { modifiers })
}

// Orders
export function getAdminOrders(turnId?: string, nationId?: string) {
  const params = new URLSearchParams()
  if (turnId) params.set('turn_id', turnId)
  if (nationId) params.set('nation_id', nationId)
  const qs = params.toString()
  return adminRequest<{ orders: any[] }>('GET', `/orders${qs ? '?' + qs : ''}`)
}

// Settings
export function getSettings() {
  return adminRequest<{ settings: any }>('GET', '/settings')
}

export function updateSettings(data: Record<string, any>) {
  return adminRequest<{ settings: any }>('PUT', '/settings', data)
}

// Pins
export function getAdminPins() {
  return adminRequest<{ pins: any[] }>('GET', '/pins')
}

export function createAdminPin(data: { x: number; y: number; label: string; description?: string; nation_id?: string }) {
  return adminRequest<{ pin: any }>('POST', '/pins', data)
}

export function updateAdminPin(id: string, data: Record<string, any>) {
  return adminRequest<{ pin: any }>('PUT', `/pins/${id}`, data)
}

export function deleteAdminPin(id: string) {
  return adminRequest<{ ok: boolean }>('DELETE', `/pins/${id}`)
}

// Fronts
export function getAdminFronts() {
  return adminRequest<{ fronts: any[] }>('GET', '/fronts')
}

export function approveFrontMulti(frontId: string, attackerNationIds: string[], defenderNationIds: string[], maxProgress: number, frontWidth: number) {
  return adminRequest<{ front: any }>('POST', `/fronts/${frontId}/approve`, {
    attacker_nation_ids: attackerNationIds,
    defender_nation_ids: defenderNationIds,
    max_progress: maxProgress,
    front_width: frontWidth,
  })
}

export function updateFront(frontId: string, data: {
  front_width?: number
  max_progress?: number
  attacker_nation_ids?: string[]
  defender_nation_ids?: string[]
}) {
  return adminRequest<{ front: any }>('PUT', `/fronts/${frontId}`, data)
}

export function deleteFront(frontId: string) {
  return adminRequest<{ ok: boolean }>('DELETE', `/fronts/${frontId}`)
}
