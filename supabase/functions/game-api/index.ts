import { serve } from 'https://deno.land/std/http/server.ts'
import { db, createUserClient, json } from '../_shared/db.ts'
import { handleCors } from '../_shared/cors.ts'

// ── Helpers ──────────────────────────────────────────────────────

function getUnitDefaults(unitType: string) {
  const map: Record<string, { build_cost: number; build_time: number; upkeep: number }> = {
    'Infantry Battalion':   { build_cost: 200000,    build_time: 2,  upkeep: 3000000 },
    'Mechanized Battalion': { build_cost: 400000,    build_time: 3,  upkeep: 4000000 },
    'Light Tank Battalion': { build_cost: 450000,    build_time: 4,  upkeep: 6000000 },
    'Medium Tank Battalion':{ build_cost: 600000,    build_time: 4,  upkeep: 8000000 },
    'Heavy Tank Battalion': { build_cost: 1000000,   build_time: 5,  upkeep: 12000000 },
    'Artillery Battalion':  { build_cost: 500000,    build_time: 2,  upkeep: 5000000 },
    'Destroyer':            { build_cost: 15000000,  build_time: 2,  upkeep: 6000000 },
    'Light Cruiser':        { build_cost: 60000000,  build_time: 4,  upkeep: 20000000 },
    'Battlecruiser':        { build_cost: 190000000, build_time: 11, upkeep: 90000000 },
    'Battleship':           { build_cost: 270000000, build_time: 12, upkeep: 120000000 },
    'Aircraft Carrier':     { build_cost: 250000000, build_time: 12, upkeep: 135000000 },
    'Attack Submarine':     { build_cost: 5000000,   build_time: 3,  upkeep: 3000000 },
    'Fighter Squadron':     { build_cost: 1000000,   build_time: 2,  upkeep: 8000000 },
    'Heavy Fighter Squadron':{ build_cost: 1500000,  build_time: 2,  upkeep: 10000000 },
    'Light Bomber':         { build_cost: 2000000,   build_time: 3,  upkeep: 10000000 },
    'Bomber Squadron':      { build_cost: 4000000,   build_time: 4,  upkeep: 20000000 },
    'Flying Boat Squadron': { build_cost: 1000000,   build_time: 3,  upkeep: 6000000 },
  }
  const aliases: Record<string, string> = {
    'Cruiser': 'Light Cruiser', 'Carrier': 'Aircraft Carrier',
    'Submarine': 'Attack Submarine', 'Artillery Battalion': 'Siege Battalion',
    'Light Bomber Squadron': 'Light Bomber', 'Bomber': 'Bomber Squadron',
    'Flying Boat': 'Flying Boat Squadron',
  }
  const key = aliases[unitType] || unitType
  return map[key] || map['Infantry Battalion']
}

function statMult(s: string) { return s === 'High' ? 4 : s === 'Medium' ? 2 : 1 }

function computeCosts(baseCost: number, baseUpkeep: number, a: string, fp: string, sp: string) {
  const m = statMult(a) * statMult(fp) * statMult(sp)
  return { build_cost: Math.round(baseCost * m), upkeep: baseUpkeep }
}

// ── Auth: get player's nation from the user-authenticated client ─

async function getMyNation(userClient: ReturnType<typeof createUserClient>) {
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const { data } = await userClient.from('nations').select('id, name').eq('player_id', user.id).single()
  return data
}

// ── Handler ─────────────────────────────────────────────────────

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const method = req.method

  // ---- Route: GET /nations ----
  if (method === 'GET' && url.pathname === '/nations') {
    const { data: nations } = await db.from('nations').select('*')
    return json({ nations: nations || [] })
  }

  // ---- Route: GET /nations/:id ----
  const nationMatch = url.pathname.match(/^\/nations\/([^\/]+)$/)
  if (method === 'GET' && nationMatch) {
    const nationId = nationMatch[1]
    const { data: nation } = await db.from('nations').select('*').eq('id', nationId).single()
    if (!nation) return json({ error: 'Nation not found' }, 404)

    const { data: companies } = await db.from('companies').select('*').eq('nation_id', nationId)

    // Compute GDP from companies
    const totalProfit = (companies || []).reduce((s: number, c: any) => s + Number(c.profit), 0)
    const pop = Number(nation.population) || 40000000
    const qol = Number(nation.qol) || 50
    const qolTax = Math.round(1200000000 * (pop / 40000000) * (qol / 50) * 0.80)
    const computedGdp = totalProfit + qolTax
    const treasury = Number(nation.gdp)

    // Compute sector caps
    const { data: mods } = await db.from('sector_modifiers').select('*').eq('nation_id', nationId)
    const modMap: Record<string, number> = {}
    for (const m of mods || []) modMap[m.sector] = m.mod_mult

    const SECTORS = ['Agriculture', 'Heavy Industry', 'Energy', 'Consumer Goods',
      'Military & Aerospace', 'Pharmaceuticals', 'Transport & Trade']
    const sectorCaps: Record<string, { cap: number; total_profit: number; mod_mult: number }> = {}
    for (const sec of SECTORS) {
      const mult = modMap[sec] || 1
      const cap = Math.round((pop / 40000000) * (qol / 50) * 1000000000 * mult)
      const total = (companies || [])
        .filter((c: any) => c.sector === sec)
        .reduce((s: number, c: any) => s + Number(c.profit), 0)
      sectorCaps[sec] = { cap, total_profit: total, mod_mult: mult }
    }

    return json({
      ...nation, gdp: computedGdp, treasury,
      flow: [], usage: [], stockpiles: [],
      companies: companies || [], provinces: [], techs: [],
      sector_caps: sectorCaps,
    })
  }

  // ---- Route: PUT /nations/:id/policies ----
  const policiesMatch = url.pathname.match(/^\/nations\/([^\/]+)\/policies$/)
  if (method === 'PUT' && policiesMatch) {
    const nationId = policiesMatch[1]
    const body = await req.json()
    const { tax_level = 2, corporate_tax_level = 2, civil_level = 2, army_level = 1, airforce_level = 1, naval_level = 1 } = body

    const { error } = await db.from('nations').update({
      tax_level, corporate_tax_level, civil_level, army_level, airforce_level, naval_level,
    }).eq('id', nationId)

    if (error) return json({ error: error.message }, 500)
    const { data: nation } = await db.from('nations').select('*').eq('id', nationId).single()
    return json({ nation })
  }

  // ---- Route: GET /eco-history/:nationId ----
  const ecoMatch = url.pathname.match(/^\/eco-history\/([^\/]+)$/)
  if (method === 'GET' && ecoMatch) {
    const { data: history } = await db.from('eco_history')
      .select('*').eq('nation_id', ecoMatch[1]).order('turn_number', { ascending: true })
    return json({ history: history || [] })
  }

  // ---- Route: GET /provinces ----
  if (method === 'GET' && url.pathname === '/provinces') {
    return json({ provinces: [] })
  }

  // ---- Route: GET /buildings ----
  if (method === 'GET' && url.pathname === '/buildings') {
    return json({ buildings: [] })
  }

  // ---- Route: GET /pins ----
  if (method === 'GET' && url.pathname === '/pins') {
    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    const myNationId = myNation?.id || null

    const { data: { user } } = await userClient.auth.getUser()
    const isAdmin = user?.email === 'admin@georp.game'

    let pins
    if (isAdmin) {
      const { data } = await db.from('pins').select('*').order('created_at', { ascending: false })
      pins = data
    } else {
      const { data } = await db.from('pins').select('*')
        .or(`type.eq.admin,and(type.eq.player,created_by.eq.${user?.id}),and(type.eq.player,visibility.eq.shared)`)
        .order('created_at', { ascending: false })
      pins = data
    }
    return json({ pins: pins || [] })
  }

  // ---- Route: POST /pins ----
  if (method === 'POST' && url.pathname === '/pins') {
    const body = await req.json()
    const { x, y, label, description, visibility } = body
    if (x == null || y == null || !label) return json({ error: 'x, y, and label are required' }, 400)

    const userClient = createUserClient(req)
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const myNation = await getMyNation(userClient)

    const { data: pin, error } = await db.from('pins').insert({
      nation_id: myNation?.id || null,
      x, y, label,
      description: description || '',
      type: 'player',
      visibility: visibility || 'private',
      created_by: user.id,
    }).select().single()

    if (error) return json({ error: error.message }, 500)
    return json({ pin })
  }

  // ---- Route: PUT /pins/:id ----
  const pinPutMatch = url.pathname.match(/^\/pins\/([^\/]+)$/)
  if (method === 'PUT' && pinPutMatch) {
    const userClient = createUserClient(req)
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: existing } = await db.from('pins').select('*').eq('id', pinPutMatch[1]).eq('created_by', user.id).single()
    if (!existing) return json({ error: 'Pin not found or not yours' }, 404)

    const body = await req.json()
    const { x, y, label, description, visibility } = body

    const { data: pin, error } = await db.from('pins').update({
      x: x ?? existing.x, y: y ?? existing.y,
      label: label ?? existing.label,
      description: description ?? existing.description,
      visibility: visibility ?? existing.visibility,
    }).eq('id', pinPutMatch[1]).select().single()

    if (error) return json({ error: error.message }, 500)
    return json({ pin })
  }

  // ---- Route: DELETE /pins/:id ----
  if (method === 'DELETE' && pinPutMatch) {
    const userClient = createUserClient(req)
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: existing } = await db.from('pins').select('id').eq('id', pinPutMatch[1]).eq('created_by', user.id).single()
    if (!existing) return json({ error: 'Pin not found or not yours' }, 404)

    await db.from('pins').delete().eq('id', pinPutMatch[1])
    return json({ ok: true })
  }

  // ---- Route: GET /intel-shares ----
  if (method === 'GET' && url.pathname === '/intel-shares') {
    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ shares: [] })

    const { data: shares } = await db.from('intel_shares')
      .select('*, target_nation:nations!target_nation_id(name), sharer_nation:nations!sharer_nation_id(name)')
      .eq('sharer_nation_id', myNation.id)
      .order('target_nation(name)')

    return json({
      shares: (shares || []).map((s: any) => ({
        ...s, target_nation_name: s.target_nation?.name,
        sharer_nation_name: s.sharer_nation?.name,
        target_nation: undefined, sharer_nation: undefined,
      })),
    })
  }

  // ---- Route: POST /intel-shares ----
  if (method === 'POST' && url.pathname === '/intel-shares') {
    const body = await req.json()
    const { target_nation_id } = body
    if (!target_nation_id) return json({ error: 'target_nation_id required' }, 400)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'You must control a nation to share intel' }, 400)

    if (target_nation_id === myNation.id) return json({ error: 'Cannot share intel with yourself' }, 400)

    const { data: existing } = await db.from('intel_shares').select('id')
      .eq('sharer_nation_id', myNation.id).eq('target_nation_id', target_nation_id).single()
    if (existing) return json({ error: 'Already sharing intel with this nation' }, 400)

    const { data: share, error } = await db.from('intel_shares').insert({
      sharer_nation_id: myNation.id, target_nation_id,
    }).select('*, target:nations!target_nation_id(name)').single()

    if (error) return json({ error: error.message }, 500)
    return json({ share })
  }

  // ---- Route: DELETE /intel-shares/:id ----
  const intelMatch = url.pathname.match(/^\/intel-shares\/([^\/]+)$/)
  if (method === 'DELETE' && intelMatch) {
    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'You must control a nation' }, 400)

    const { data: share } = await db.from('intel_shares').select('id')
      .eq('id', intelMatch[1]).eq('sharer_nation_id', myNation.id).single()
    if (!share) return json({ error: 'Intel share not found' }, 404)

    await db.from('intel_shares').delete().eq('id', intelMatch[1])
    return json({ ok: true })
  }

  // ---- Route: GET /military/:nationId ----
  const milMatch = url.pathname.match(/^\/military\/([^\/]+)$/)
  if (method === 'GET' && milMatch) {
    const nid = milMatch[1]
    const [templates, formations, units] = await Promise.all([
      db.from('unit_templates').select('*').eq('nation_id', nid),
      db.from('formations').select('*').eq('nation_id', nid).order('type').order('name'),
      db.from('units').select('*, template:unit_templates!template_id(name)').eq('nation_id', nid).order('formation_id').order('created_at'),
    ])
    return json({
      templates: templates.data || [],
      formations: formations.data || [],
      units: (units.data || []).map((u: any) => ({
        ...u, template_name: u.template?.name || null, template: undefined,
      })),
    })
  }

  // ---- Route: GET /upkeep-breakdown/:nationId ----
  const upkeepMatch = url.pathname.match(/^\/upkeep-breakdown\/([^\/]+)$/)
  if (method === 'GET' && upkeepMatch) {
    const { data: units } = await db.from('units').select(`
      id, unit_type, upkeep, formation_id, nation_id,
      formation:formations!formation_id(name, branch)
    `).eq('nation_id', upkeepMatch[1]).in('status', ['active', 'damaged']).order('formation_id')

    const result: Record<string, any> = {
      army: { total: 0, byFormation: [], unassigned: 0 },
      navy: { total: 0, byFormation: [], unassigned: 0 },
      airforce: { total: 0, byFormation: [], unassigned: 0 },
    }
    const formationUpkeep: Record<string, any> = {}
    for (const u of units || []) {
      const branch = u.formation?.branch || 'army'
      if (u.formation_id && u.formation?.name) {
        if (!formationUpkeep[u.formation_id]) {
          formationUpkeep[u.formation_id] = { id: u.formation_id, name: u.formation.name, upkeep: 0, count: 0, branch }
        }
        formationUpkeep[u.formation_id].upkeep += Number(u.upkeep)
        formationUpkeep[u.formation_id].count += 1
        result[branch].total += Number(u.upkeep)
      } else {
        result[branch].unassigned += Number(u.upkeep)
        result[branch].total += Number(u.upkeep)
      }
    }
    for (const f of Object.values(formationUpkeep) as any[]) {
      result[f.branch].byFormation.push({ id: f.id, name: f.name, upkeep: f.upkeep, count: f.count })
    }
    return json(result)
  }

  // ---- Route: POST /companies ----
  if (method === 'POST' && url.pathname === '/companies') {
    const body = await req.json()
    const { name, nation_id, sector } = body
    if (!name || !nation_id) return json({ error: 'Name and nation_id required' }, 400)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation || myNation.id !== nation_id) return json({ error: 'Not your nation' }, 403)

    const STARTUP_COST = 1_000_000_000
    const START_PROFIT = 100_000_000

    // Transaction: deduct treasury + insert company
    const { error: deductErr } = await db.rpc('deduct_treasury', {
      p_nation_id: nation_id, p_amount: STARTUP_COST,
    })
    if (deductErr) return json({ error: deductErr.message }, 500)

    const { data: company, error: insErr } = await db.from('companies').insert({
      name, nation_id, profit: START_PROFIT, subsidies: 0, sector: sector || '',
    }).select().single()

    if (insErr) return json({ error: insErr.message }, 500)
    return json({ company })
  }

  // ---- Route: PUT /companies/:id/subsidies ----
  const subMatch = url.pathname.match(/^\/companies\/([^\/]+)\/subsidies$/)
  if (method === 'PUT' && subMatch) {
    const body = await req.json()
    const { subsidies } = body
    if (subsidies == null) return json({ error: 'subsidies required' }, 400)

    const { data: existing } = await db.from('companies').select('id, nation_id').eq('id', subMatch[1]).single()
    if (!existing) return json({ error: 'Company not found' }, 404)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation || myNation.id !== existing.nation_id) return json({ error: 'Not your company' }, 403)

    const { data: company, error } = await db.from('companies').update({ subsidies })
      .eq('id', subMatch[1]).select().single()
    if (error) return json({ error: error.message }, 500)
    return json({ company })
  }

  // ---- Route: POST /unit-templates ----
  if (method === 'POST' && url.pathname === '/unit-templates') {
    const body = await req.json()
    const { nation_id, name, branch, unit_type, armor, firepower, speed } = body
    if (!nation_id || !name || !branch || !armor || !firepower || !speed)
      return json({ error: 'All fields required' }, 400)

    const ut = unit_type || 'Infantry Battalion'
    const defs = getUnitDefaults(ut)

    const { data: template, error } = await db.from('unit_templates').insert({
      nation_id, name, branch, unit_type: ut, armor, firepower, speed,
      build_cost: defs.build_cost, build_time: defs.build_time, upkeep: defs.upkeep,
    }).select().single()

    if (error) return json({ error: error.message }, 500)
    return json({ template })
  }

  // ---- Route: PUT /unit-templates/:id ----
  const tmplMatch = url.pathname.match(/^\/unit-templates\/([^\/]+)$/)
  if (method === 'PUT' && tmplMatch) {
    const body = await req.json()
    const { name, armor, firepower, speed } = body

    const { data: existing } = await db.from('unit_templates').select('id').eq('id', tmplMatch[1]).single()
    if (!existing) return json({ error: 'Not found' }, 404)

    const { data: template, error } = await db.from('unit_templates').update({ name, armor, firepower, speed })
      .eq('id', tmplMatch[1]).select().single()
    if (error) return json({ error: error.message }, 500)
    return json({ template })
  }

  // ---- Route: DELETE /unit-templates/:id ----
  if (method === 'DELETE' && tmplMatch) {
    await db.from('unit_templates').delete().eq('id', tmplMatch[1])
    return json({ ok: true })
  }

  // ---- Route: POST /formations ----
  if (method === 'POST' && url.pathname === '/formations') {
    const body = await req.json()
    const { nation_id, name, type, branch } = body
    if (!nation_id || !name || !type || !branch)
      return json({ error: 'All fields required' }, 400)

    const { data: formation, error } = await db.from('formations').insert({
      nation_id, name, type, branch,
    }).select().single()

    if (error) return json({ error: error.message }, 500)
    return json({ formation })
  }

  // ---- Route: POST /units ----
  if (method === 'POST' && url.pathname === '/units') {
    const body = await req.json()
    const { template_id, formation_id, nation_id, name, unit_type, armor, firepower, speed, strength } = body
    if (!nation_id || !name) return json({ error: 'nation_id and name required' }, 400)

    let ut = unit_type || 'Infantry Battalion'
    let baseDefs = getUnitDefaults(ut)
    if (template_id) {
      const { data: tmpl } = await db.from('unit_templates').select('unit_type, build_cost, build_time, upkeep').eq('id', template_id).single()
      if (tmpl) {
        ut = tmpl.unit_type
        baseDefs = { build_cost: tmpl.build_cost, build_time: tmpl.build_time, upkeep: tmpl.upkeep }
      }
    }
    const a = armor || 'Medium'
    const fp = firepower || 'Medium'
    const sp = speed || 'Medium'
    const { build_cost, upkeep } = computeCosts(baseDefs.build_cost, baseDefs.upkeep, a, fp, sp)

    const { data: turn } = await db.from('turns').select('number').eq('status', 'open').order('number', { ascending: false }).limit(1).single()
    const currentTurn = turn?.number || 1
    const readyTurn = currentTurn + baseDefs.build_time

    // Deduct build cost from treasury
    await db.rpc('deduct_treasury', { p_nation_id: nation_id, p_amount: build_cost })

    const { data: unit, error } = await db.from('units').insert({
      template_id: template_id || null, formation_id: formation_id || null,
      nation_id, name, unit_type: ut, armor: a, firepower: fp, speed: sp,
      strength: strength || 100, status: 'building',
      build_cost, build_time: baseDefs.build_time, upkeep, ready_turn: readyTurn,
    }).select('*, template:unit_templates!template_id(name)').single()

    if (error) return json({ error: error.message }, 500)
    return json({ unit: { ...unit, template_name: unit?.template?.name || null, template: undefined } })
  }

  // ---- Route: PUT /units/:id/assign ----
  const unitAssignMatch = url.pathname.match(/^\/units\/([^\/]+)\/assign$/)
  if (method === 'PUT' && unitAssignMatch) {
    const body = await req.json()
    const { formation_id } = body

    const { data: unit, error } = await db.from('units').update({ formation_id: formation_id || null })
      .eq('id', unitAssignMatch[1])
      .select('*, template:unit_templates!template_id(name)').single()

    if (error) return json({ error: error.message }, 500)
    return json({ unit: { ...unit, template_name: unit?.template?.name || null, template: undefined } })
  }

  // ---- Route: DELETE /units/:id ----
  const unitMatch = url.pathname.match(/^\/units\/([^\/]+)$/)
  if (method === 'DELETE' && unitMatch) {
    await db.from('units').delete().eq('id', unitMatch[1])
    return json({ ok: true })
  }

  // ---- Route: GET /turn/current ----
  if (method === 'GET' && url.pathname === '/turn/current') {
    const { data: turn } = await db.from('turns').select('*').eq('status', 'open').order('number', { ascending: false }).limit(1).single()
    if (!turn) return json({ turn: null })

    const { data: orders } = await db.from('orders').select('*').eq('turn_id', turn.id)
    return json({ turn, orders: orders || [] })
  }

  // ---- Route: POST /turn/submit-order ----
  if (method === 'POST' && url.pathname === '/turn/submit-order') {
    const body = await req.json()
    const { type, targetId, payload } = body
    if (!type) return json({ error: 'Order type required' }, 400)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'No nation controlled' }, 400)

    const { data: turn } = await db.from('turns').select('id, number').eq('status', 'open').order('number', { ascending: false }).limit(1).single()
    if (!turn) return json({ error: 'No active turn' }, 400)

    const { data: order, error } = await db.from('orders').insert({
      turn_id: turn.id, nation_id: myNation.id, type,
      target_id: targetId || null, payload: payload || null,
    }).select().single()

    if (error) return json({ error: error.message }, 500)

    // Early turn-end check: if all nations have submitted, trigger process-turn
    const { count: totalNations } = await db.from('nations').select('*', { head: true, count: 'exact' })
    const { count: submittedOrders } = await db.from('orders')
      .select('*', { head: true, count: 'exact' })
      .eq('turn_id', turn.id)
    // Only count distinct nations that submitted
    const { data: distinctSubmitters } = await db.from('orders')
      .select('nation_id').eq('turn_id', turn.id)
    const uniqueNations = new Set((distinctSubmitters || []).map((o: any) => o.nation_id))

    if (uniqueNations.size >= (totalNations || 8)) {
      // All nations have submitted — trigger process-turn
      const funcUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/process-turn'
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      fetch(funcUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => {})
    }

    return json({ order })
  }

  // ---- Route: POST /tap-resource ----
  if (method === 'POST' && url.pathname === '/tap-resource') {
    const body = await req.json()
    const { provinceId, resource, amount } = body
    if (!provinceId || !resource || amount == null) return json({ error: 'Missing fields' }, 400)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'No nation controlled' }, 400)

    const { data: turn } = await db.from('turns').select('id').eq('status', 'open').order('number', { ascending: false }).limit(1).single()
    if (!turn) return json({ error: 'No active turn' }, 400)

    // Delete existing tap for same province+resource
    await db.from('orders').delete()
      .eq('turn_id', turn.id).eq('nation_id', myNation.id).eq('type', 'tap_resource')
      .eq('target_id', provinceId)
      .filter('payload->>resource', 'eq', resource)

    const { data: order, error } = await db.from('orders').insert({
      turn_id: turn.id, nation_id: myNation.id, type: 'tap_resource',
      target_id: provinceId,
      payload: JSON.stringify({ resource, amount }),
    }).select().single()

    if (error) return json({ error: error.message }, 500)
    return json({ order: { id: order.id, provinceId, resource, amount } })
  }

  // ── FRONT ROUTES ──────────────────────────────────────────────

  // ---- Route: GET /fronts ----
  if (method === 'GET' && url.pathname === '/fronts') {
    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ fronts: [], assignments: [] })

    const { data: participantRows } = await db.from('front_participants')
      .select('front_id').eq('nation_id', myNation.id)
    const frontIds = (participantRows || []).map((r: any) => r.front_id)

    if (frontIds.length === 0) return json({ fronts: [], assignments: [] })

    const { data: fronts } = await db.from('fronts')
      .select('*, attacker:nations!attacker_nation_id(name), defender:nations!defender_nation_id(name)')
      .in('id', frontIds)
      .order('created_at', { ascending: false })

    // Get participants for each front
    const { data: allParticipants } = await db.from('front_participants')
      .select('*, nation:nations(name)').in('front_id', frontIds)
    const participantMap: Record<string, any[]> = {}
    for (const p of allParticipants || []) {
      if (!participantMap[p.front_id]) participantMap[p.front_id] = []
      participantMap[p.front_id].push({ ...p, nation_name: p.nation?.name })
    }

    const { data: assignments } = await db.from('front_assignments')
      .select('*, formation:formations(name, type)').in('front_id', frontIds)

    const resultFronts = (fronts || []).map((f: any) => ({
      ...f,
      attacker_name: f.attacker?.name,
      defender_name: f.defender?.name,
      attacker: undefined, defender: undefined,
      participants: participantMap[f.id] || [],
    }))

    const resultAssignments = (assignments || []).map((a: any) => ({
      ...a,
      formation_name: a.formation?.name,
      formation_type: a.formation?.type,
      formation: undefined,
    }))

    return json({ fronts: resultFronts, assignments: resultAssignments })
  }

  // ---- Route: POST /fronts ----
  if (method === 'POST' && url.pathname === '/fronts') {
    const body = await req.json()
    const { name, war_name } = body
    if (!name) return json({ error: 'name required' }, 400)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'You must control a nation' }, 400)

    const { data: front, error } = await db.from('fronts').insert({
      name, attacker_nation_id: myNation.id, status: 'pending', war_name: war_name || '',
    }).select('*, attacker:nations!attacker_nation_id(name)').single()

    if (error) return json({ error: error.message }, 500)

    // Add creator as participant
    await db.from('front_participants').insert({
      front_id: front.id, nation_id: myNation.id, side: 'attacker',
    })

    return json({
      front: { ...front, attacker_name: front.attacker?.name, attacker: undefined },
    })
  }

  // ---- Route: POST /fronts/:id/assign ----
  const frontAssignMatch = url.pathname.match(/^\/fronts\/([^\/]+)\/assign$/)
  if (method === 'POST' && frontAssignMatch) {
    const body = await req.json()
    const { formation_id } = body
    if (!formation_id) return json({ error: 'formation_id required' }, 400)

    const { data: front } = await db.from('fronts').select('*').eq('id', frontAssignMatch[1]).eq('status', 'active').single()
    if (!front) return json({ error: 'Active front not found' }, 404)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'No nation' }, 401)

    const { data: participant } = await db.from('front_participants')
      .select('id').eq('front_id', front.id).eq('nation_id', myNation.id).single()
    if (!participant) return json({ error: 'Not your front' }, 403)

    const { data: formation } = await db.from('formations')
      .select('id').eq('id', formation_id).eq('nation_id', myNation.id).single()
    if (!formation) return json({ error: 'Formation not yours' }, 404)

    const { data: existing } = await db.from('front_assignments')
      .select('id').eq('front_id', front.id).eq('formation_id', formation_id).single()
    if (existing) return json({ error: 'Already assigned' }, 400)

    const { data: assignment, error } = await db.from('front_assignments').insert({
      front_id: front.id, formation_id,
    }).select('*, formation:formations(name, type)').single()

    if (error) return json({ error: error.message }, 500)
    return json({
      assignment: {
        ...assignment, formation_name: assignment.formation?.name,
        formation_type: assignment.formation?.type, formation: undefined,
      },
    })
  }

  // ---- Route: DELETE /fronts/:id/assign/:formationId ----
  const frontUnassignMatch = url.pathname.match(/^\/fronts\/([^\/]+)\/assign\/([^\/]+)$/)
  if (method === 'DELETE' && frontUnassignMatch) {
    const { data: front } = await db.from('fronts').select('*').eq('id', frontUnassignMatch[1]).eq('status', 'active').single()
    if (!front) return json({ error: 'Active front not found' }, 404)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'No nation' }, 401)

    const { data: participant } = await db.from('front_participants')
      .select('id').eq('front_id', front.id).eq('nation_id', myNation.id).single()
    if (!participant) return json({ error: 'Not your front' }, 403)

    await db.from('front_assignments').delete()
      .eq('front_id', front.id).eq('formation_id', frontUnassignMatch[2])
    return json({ ok: true })
  }

  // ---- Route: POST /fronts/:id/retreat ----
  const frontRetreatMatch = url.pathname.match(/^\/fronts\/([^\/]+)\/retreat$/)
  if (method === 'POST' && frontRetreatMatch) {
    const { data: front } = await db.from('fronts').select('*').eq('id', frontRetreatMatch[1]).eq('status', 'active').single()
    if (!front) return json({ error: 'Active front not found' }, 404)

    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ error: 'No nation controlled' }, 400)

    const { data: myParticipant } = await db.from('front_participants')
      .select('id').eq('front_id', front.id).eq('nation_id', myNation.id).single()
    if (!myParticipant) return json({ error: 'Not your front' }, 403)

    // Remove this nation from the front
    await db.from('front_participants').delete()
      .eq('front_id', front.id).eq('nation_id', myNation.id)

    // Check if either side is now empty
    const { count: attackersLeft } = await db.from('front_participants')
      .select('*', { head: true, count: 'exact' })
      .eq('front_id', front.id).eq('side', 'attacker')
    const { count: defendersLeft } = await db.from('front_participants')
      .select('*', { head: true, count: 'exact' })
      .eq('front_id', front.id).eq('side', 'defender')

    if (attackersLeft === 0 || defendersLeft === 0) {
      await db.from('fronts').update({ status: 'resolved', retreating_by: myNation.id })
        .eq('id', front.id)
    }

    return json({ ok: true, message: `${myNation.name} retreated from ${front.name}` })
  }

  // ── BATTLE ROUTES ─────────────────────────────────────────────

  // ---- Route: POST /battles/launch/:frontId ----
  const battleLaunchMatch = url.pathname.match(/^\/battles\/launch\/([^\/]+)$/)
  if (method === 'POST' && battleLaunchMatch) {
    // For now, redirect to process-turn function
    return json({ error: 'Battles are resolved during turn processing. Use the turn system.' }, 400)
  }

  // ---- Route: GET /battles ----
  if (method === 'GET' && url.pathname === '/battles') {
    const userClient = createUserClient(req)
    const myNation = await getMyNation(userClient)
    if (!myNation) return json({ battles: [] })

    const { data: battles } = await db.from('battles')
      .select('*, attacker:nations!attacker_nation_id(name), defender:nations!defender_nation_id(name), front:fronts(name)')
      .or(`attacker_nation_id.eq.${myNation.id},defender_nation_id.eq.${myNation.id}`)
      .order('created_at', { ascending: false }).limit(50)

    return json({
      battles: (battles || []).map((b: any) => ({
        ...b, attacker_name: b.attacker?.name, defender_name: b.defender?.name,
        front_name: b.front?.name, attacker: undefined, defender: undefined, front: undefined,
      })),
    })
  }

  // ---- 404 ----
  return json({ error: 'Not found' }, 404)
})
