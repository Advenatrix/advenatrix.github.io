import { getSupabase } from './supabase'
import { getToken, getTokenUser } from '../game/store/authStore'

const supabase = getSupabase()
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function invokeGameApi(method: string, path: string, body?: unknown) {
  const res = await fetch(`${FUNCTIONS_URL}/game-api${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

async function invokeAdmin(method: string, path: string, body?: unknown) {
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

// Game — reads through supabase-js, writes through Edge Function
export async function getNations() {
  const { data: nations, error } = await supabase.from('nations').select('*')
  if (error) throw new Error(error.message)
  return { nations }
}

export async function getNation(id: string) {
  return invokeGameApi('GET', `/nations/${id}`)
}

export async function getProvinces() {
  return { provinces: [] }
}

export async function getBuildings() {
  return { buildings: [] }
}

export async function getEcoHistory(nationId: string) {
  const { data: history, error } = await supabase
    .from('eco_history')
    .select('*')
    .eq('nation_id', nationId)
    .order('turn_number', { ascending: true })
  if (error) throw new Error(error.message)
  return { history: history || [] }
}

// Turn
export async function getCurrentTurn() {
  const { data: turn, error } = await supabase
    .from('turns')
    .select('*')
    .eq('status', 'open')
    .order('number', { ascending: false })
    .limit(1)
    .single()
  if (error || !turn) return { turn: null, orders: [] }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('turn_id', turn.id)
  return { turn, orders: orders || [] }
}

export async function submitOrder(type: string, targetId?: string, payload?: string) {
  return invokeGameApi('POST', '/turn/submit-order', { type, targetId, payload })
}

// Pins
export async function getPins() {
  const tokenUser = getTokenUser()
  const userId = tokenUser?.sub || 'none'
  const { data: pins, error } = await supabase
    .from('pins')
    .select('*')
    .or(`type.eq.admin,and(type.eq.player,created_by.eq.${userId}),and(type.eq.player,visibility.eq.shared)`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return { pins: pins || [] }
}

export async function createPin(data: { x: number; y: number; label: string; description?: string; visibility?: string }) {
  return invokeGameApi('POST', '/pins', data)
}

export async function updatePin(id: string, data: Record<string, any>) {
  return invokeGameApi('PUT', `/pins/${id}`, data)
}

export async function deletePin(id: string) {
  return invokeGameApi('DELETE', `/pins/${id}`)
}

// Intel Shares
export async function getIntelShares() {
  const tokenUser = getTokenUser()
  if (!tokenUser) return { shares: [] }

  const { data } = await supabase
    .from('nations')
    .select('id')
    .eq('player_id', tokenUser.sub)
    .single()
  if (!data) return { shares: [] }

  const { data: shares, error } = await supabase
    .from('intel_shares')
    .select('*, target_nation:nations!target_nation_id(name)')
    .eq('sharer_nation_id', data.id)
    .order('target_nation(name)')

  if (error) throw new Error(error.message)
  return {
    shares: (shares || []).map((s: any) => ({
      ...s, target_nation_name: s.target_nation?.name, target_nation: undefined,
    })),
  }
}

export async function createIntelShare(targetNationId: string) {
  return invokeGameApi('POST', '/intel-shares', { target_nation_id: targetNationId })
}

export async function deleteIntelShare(id: string) {
  return invokeGameApi('DELETE', `/intel-shares/${id}`)
}

// Military
export async function getMilitary(nationId: string) {
  return invokeGameApi('GET', `/military/${nationId}`)
}

export async function createUnitTemplate(data: { nation_id: string; name: string; branch: string; unit_type?: string; armor: string; firepower: string; speed: string }) {
  return invokeGameApi('POST', '/unit-templates', data)
}

export async function updateUnitTemplate(id: string, data: Record<string, any>) {
  return invokeGameApi('PUT', `/unit-templates/${id}`, data)
}

export async function deleteUnitTemplate(id: string) {
  return invokeGameApi('DELETE', `/unit-templates/${id}`)
}

export async function createFormation(data: { nation_id: string; name: string; type: string; branch: string }) {
  return invokeGameApi('POST', '/formations', data)
}

export async function createUnit(data: { template_id?: string; formation_id?: string; nation_id: string; name: string; unit_type?: string; armor?: string; firepower?: string; speed?: string; strength?: number }) {
  return invokeGameApi('POST', '/units', data)
}

export async function assignUnit(unitId: string, formationId: string | null) {
  return invokeGameApi('PUT', `/units/${unitId}/assign`, { formation_id: formationId })
}

export async function deleteUnit(unitId: string) {
  return invokeGameApi('DELETE', `/units/${unitId}`)
}

// Nation Policies
export async function updatePolicies(nationId: string, data: { tax_level: number; corporate_tax_level: number; civil_level: number; army_level: number; airforce_level: number; naval_level: number }) {
  return invokeGameApi('PUT', `/nations/${nationId}/policies`, data)
}

// Company
export async function updateSubsidies(companyId: string, subsidies: number) {
  return invokeGameApi('PUT', `/companies/${companyId}/subsidies`, { subsidies })
}

export async function createCompany(data: { name: string; nation_id: string; sector: string; profit?: number; subsidies?: number }) {
  return invokeGameApi('POST', '/companies', data)
}

// Upkeep Breakdown
export async function getUpkeepBreakdown(nationId: string) {
  return invokeGameApi('GET', `/upkeep-breakdown/${nationId}`)
}

// Tap Resource
export async function submitTapResource(provinceId: string, resource: string, amount: number) {
  return invokeGameApi('POST', '/tap-resource', { provinceId, resource, amount })
}

// Fronts / Operations
export async function getFronts() {
  return invokeGameApi('GET', '/fronts')
}

export async function createFront(name: string, warName?: string) {
  return invokeGameApi('POST', '/fronts', { name, war_name: warName || '' })
}

export async function assignFormationToFront(frontId: string, formationId: string) {
  return invokeGameApi('POST', `/fronts/${frontId}/assign`, { formation_id: formationId })
}

export async function unassignFormationFromFront(frontId: string, formationId: string) {
  return invokeGameApi('DELETE', `/fronts/${frontId}/assign/${formationId}`)
}

export async function retreatFromFront(frontId: string) {
  return invokeGameApi('POST', `/fronts/${frontId}/retreat`)
}

export async function launchBattle(frontId: string) {
  return invokeGameApi('POST', `/battles/launch/${frontId}`)
}

export async function getBattles() {
  return invokeGameApi('GET', '/battles')
}

// Admin: Fronts
export async function getPendingFronts() {
  return invokeAdmin('GET', '/fronts')
}

export async function approveFront(frontId: string, attackerNationId: string, defenderNationId: string, maxProgress: number, frontWidth: number) {
  return invokeAdmin('POST', `/fronts/${frontId}/approve`, {
    attacker_nation_ids: [attackerNationId],
    defender_nation_ids: [defenderNationId],
    max_progress: maxProgress, front_width: frontWidth,
  })
}

export async function rejectFront(frontId: string) {
  return invokeAdmin('POST', `/fronts/${frontId}/reject`)
}
