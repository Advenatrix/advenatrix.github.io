import { getToken } from '../game/store/authStore'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/admin${path}`, {
    method,
    headers: authHeaders(),
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
export function getNations() {
  return adminRequest<{ nations: any[] }>('GET', '/nations')
}

export function updateNation(id: string, data: Record<string, any>) {
  return adminRequest('PUT', `/nations/${id}`, data)
}

export function deleteNation(id: string) {
  return adminRequest('DELETE', `/nations/${id}`)
}

// Players
export function getPlayers() {
  return adminRequest<{ players: any[] }>('GET', '/players')
}

export function assignPlayerToNation(nationId: string, playerId: string | null) {
  return adminRequest('PUT', `/players/${nationId}`, { player_id: playerId })
}

export function unassignPlayerFromNation(nationId: string) {
  return adminRequest('DELETE', `/players/${nationId}`)
}

// Companies
export function getCompanies(nationId?: string) {
  const path = nationId ? `/companies?nation_id=${nationId}` : '/companies'
  return adminRequest<{ companies: any[] }>('GET', path)
}

export function updateCompany(id: string, data: Record<string, any>) {
  return adminRequest('PUT', `/companies/${id}`, data)
}

export function createCompany(data: Record<string, any>) {
  return adminRequest('POST', '/companies', data)
}

export function deleteCompany(id: string) {
  return adminRequest('DELETE', `/companies/${id}`)
}

// Turns
export function getTurns() {
  return adminRequest<{ turns: any[] }>('GET', '/turns')
}

export function createTurn(durationHours?: number) {
  const params = durationHours ? `?duration=${durationHours}` : ''
  return adminRequest('POST', `/turns${params}`)
}

export function forceCloseTurn() {
  return adminRequest('POST', '/turns/force-close')
}

export function processTurn() {
  return adminRequest('POST', '/turns/process')
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
  return adminRequest('POST', '/pins', data)
}

export function updateAdminPin(id: string, data: Record<string, any>) {
  return adminRequest('PUT', `/pins/${id}`, data)
}

export function deleteAdminPin(id: string) {
  return adminRequest('DELETE', `/pins/${id}`)
}

// Orders
export function getOrders(turnId?: string, nationId?: string) {
  const params = new URLSearchParams()
  if (turnId) params.set('turn_id', turnId)
  if (nationId) params.set('nation_id', nationId)
  const qs = params.toString()
  return adminRequest<{ orders: any[] }>('GET', `/orders${qs ? `?${qs}` : ''}`)
}

// Sector Modifiers
export function getSectorModifiers(nationId: string) {
  return adminRequest<{ modifiers: any[] }>('GET', `/sector-modifiers/${nationId}`)
}

export function updateSectorModifiers(nationId: string, modifiers: { sector: string; mod_mult: number }[]) {
  return adminRequest('PUT', `/sector-modifiers/${nationId}`, { modifiers })
}

// Fronts
export function getAdminFronts() {
  return adminRequest<{ fronts: any[] }>('GET', '/fronts')
}

export function approveFront(frontId: string, data: {
  attacker_nation_ids: string[]
  defender_nation_ids: string[]
  max_progress: number
  front_width: number
}) {
  return adminRequest('POST', `/fronts/${frontId}/approve`, data)
}

export function rejectFront(frontId: string) {
  return adminRequest('POST', `/fronts/${frontId}/reject`)
}

export function updateFront(frontId: string, data: Record<string, any>) {
  return adminRequest('PUT', `/fronts/${frontId}`, data)
}

export function deletePlayer(id: string) {
  return unassignPlayerFromNation(id)
}

export function deleteFront(frontId: string) {
  return adminRequest('DELETE', `/fronts/${frontId}`)
}

// ── Backward-compatible aliases ──
export const getAdminCompanies = getCompanies
export const getAdminNations = getNations
export const getAdminPlayers = getPlayers
export const getAdminOrders = getOrders
export const getAdminTurns = getTurns

export function approveFrontMulti(
  frontId: string, attackerNationIds: string[], defenderNationIds: string[],
  maxProgress: number, frontWidth: number,
) {
  return approveFront(frontId, {
    attacker_nation_ids: attackerNationIds,
    defender_nation_ids: defenderNationIds,
    max_progress: maxProgress, front_width: frontWidth,
  })
}

export function updatePlayer(id: string, data: Record<string, any>) {
  return assignPlayerToNation(id, data.player_id ?? null)
}
