import { serve } from 'https://deno.land/std/http/server.ts'
import { db, json } from '../_shared/db.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const method = req.method
  const path = url.pathname

  // Verify admin via custom JWT
  const user = await getUserFromRequest(req)
  if (!user || user.username !== 'admin') {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Dashboard ──
  if (method === 'GET' && path === '/dashboard') {
    const [{ count: totalNations }, { count: totalPlayers }, { count: totalCompanies }] = await Promise.all([
      db.from('nations').select('*', { head: true, count: 'exact' }),
      db.from('nations').select('*', { head: true, count: 'exact' }).not('player_id', 'is', null),
      db.from('companies').select('*', { head: true, count: 'exact' }),
    ])

    const { data: activeTurn } = await db.from('turns')
      .select('*').eq('status', 'open').order('number', { ascending: false }).limit(1).single()

    const { data: turnHistory } = await db.from('turns')
      .select('*').order('number', { ascending: false }).limit(20)

    const { data: nations } = await db.from('nations')
      .select('id, name, player_id')

    const { data: orders } = await db.from('orders')
      .select('nation_id').eq('turn_id', activeTurn?.id || '')

    const submittedSet = new Set((orders || []).map((o: any) => o.nation_id))

    const players = (nations || []).map((n: any) => ({
      id: n.player_id || n.id,
      username: n.name,
      nation_name: n.name,
      nation_id: n.id,
      has_submitted: n.player_id && submittedSet.has(n.id) ? 1 : 0,
    }))

    return json({
      activeTurn, totalNations, totalPlayers, totalCompanies,
      turnHistory: turnHistory || [],
      deadlinesPast: (turnHistory || []).filter((t: any) => t.status === 'open' && new Date(t.deadline) < new Date()).length,
      players,
    })
  }

  // ── GET /nations ──
  if (method === 'GET' && path === '/nations') {
    const { data: nations } = await db.from('nations').select('*').order('name')
    return json({ nations: nations || [] })
  }

  // ── PUT /nations/:id ──
  const nationUpdateMatch = path.match(/^\/nations\/([^\/]+)$/)
  if (method === 'PUT' && nationUpdateMatch) {
    const body = await req.json()
    const { error } = await db.from('nations').update(body).eq('id', nationUpdateMatch[1])
    if (error) return json({ error: error.message }, 500)
    const { data: nation } = await db.from('nations').select('*').eq('id', nationUpdateMatch[1]).single()
    return json({ nation })
  }

  // ── DELETE /nations/:id ──
  if (method === 'DELETE' && nationUpdateMatch) {
    await db.from('nations').delete().eq('id', nationUpdateMatch[1])
    return json({ ok: true })
  }

  // ── GET /players ──
  if (method === 'GET' && path === '/players') {
    const { data: nations } = await db.from('nations').select('id, name, player_id').order('name')
    return json({ players: nations || [] })
  }

  // ── PUT /players/:id ──
  const playerMatch = path.match(/^\/players\/([^\/]+)$/)
  if (method === 'PUT' && playerMatch) {
    const body = await req.json()
    // Only allow updating player_id (which links to auth.users)
    if (body.player_id !== undefined) {
      await db.from('nations').update({ player_id: body.player_id || null }).eq('id', playerMatch[1])
    }
    return json({ ok: true })
  }

  // ── DELETE /players/:id ──
  if (method === 'DELETE' && playerMatch) {
    await db.from('nations').update({ player_id: null }).eq('id', playerMatch[1])
    return json({ ok: true })
  }

  // ── GET /companies ──
  if (method === 'GET' && path === '/companies') {
    const nationId = url.searchParams.get('nation_id')
    let query = db.from('companies').select('*, nation:nations(name)').order('name')
    if (nationId) query = query.eq('nation_id', nationId)
    const { data: companies } = await query
    return json({ companies: (companies || []).map((c: any) => ({ ...c, nation_name: c.nation?.name, nation: undefined })) })
  }

  // ── PUT /companies/:id ──
  const companyMatch = path.match(/^\/companies\/([^\/]+)$/)
  if (method === 'PUT' && companyMatch) {
    const body = await req.json()
    const { error } = await db.from('companies').update(body).eq('id', companyMatch[1])
    if (error) return json({ error: error.message }, 500)
    const { data: company } = await db.from('companies').select('*').eq('id', companyMatch[1]).single()
    return json({ company })
  }

  // ── POST /companies ──
  if (method === 'POST' && path === '/companies') {
    const body = await req.json()
    const { data: company, error } = await db.from('companies').insert(body).select().single()
    if (error) return json({ error: error.message }, 500)
    return json({ company })
  }

  // ── DELETE /companies/:id ──
  if (method === 'DELETE' && companyMatch) {
    await db.from('companies').delete().eq('id', companyMatch[1])
    return json({ ok: true })
  }

  // ── GET /turns ──
  if (method === 'GET' && path === '/turns') {
    const { data: turns } = await db.from('turns').select('*').order('number', { ascending: false })
    return json({ turns: turns || [] })
  }

  // ── POST /turns (force close) ──
  if (method === 'POST' && path === '/turns/force-close') {
    const { data: openTurn } = await db.from('turns')
      .select('*').eq('status', 'open').order('number', { ascending: false }).limit(1).single()
    if (openTurn) {
      await db.from('turns').update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', openTurn.id)
    }
    return json({ ok: true })
  }

  // ── POST /turns/process ──
  if (method === 'POST' && path === '/turns/process') {
    // Invoke the process-turn function
    const funcUrl = `${supabaseUrl}/functions/v1/process-turn`
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const res = await fetch(funcUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}` },
    })
    const data = await res.json()
    return json(data, res.status)
  }

  // ── POST /turns (create new turn with optional duration) ──
  if (method === 'POST' && path === '/turns') {
    const duration = parseInt(url.searchParams.get('duration') || '48', 10)
    const { data: lastTurn } = await db.from('turns').select('number').order('number', { ascending: false }).limit(1).single()
    const nextNum = (lastTurn?.number || 0) + 1
    const deadline = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString()
    const { data: turn, error } = await db.from('turns').insert({
      number: nextNum, status: 'open', deadline, processed_at: null,
    }).select().single()
    if (error) return json({ error: error.message }, 500)
    return json({ turn })
  }

  // ── GET /sector-modifiers/:nationId ──
  const secModMatch = path.match(/^\/sector-modifiers\/([^\/]+)$/)
  if (method === 'GET' && secModMatch) {
    const { data: modifiers } = await db.from('sector_modifiers')
      .select('*').eq('nation_id', secModMatch[1])
    return json({ modifiers: modifiers || [] })
  }

  // ── PUT /sector-modifiers/:nationId ──
  if (method === 'PUT' && secModMatch) {
    const body = await req.json()
    const { modifiers } = body
    if (modifiers && Array.isArray(modifiers)) {
      for (const m of modifiers) {
        await db.from('sector_modifiers').upsert({
          nation_id: secModMatch[1], sector: m.sector, mod_mult: m.mod_mult,
        }, { onConflict: 'nation_id, sector' })
      }
    }
    const { data: result } = await db.from('sector_modifiers')
      .select('*').eq('nation_id', secModMatch[1])
    return json({ modifiers: result || [] })
  }

  // ── GET /orders ──
  if (method === 'GET' && path === '/orders') {
    const turnId = url.searchParams.get('turn_id')
    const nationId = url.searchParams.get('nation_id')
    let query = db.from('orders').select('*, nation:nations(name)').order('created_at', { ascending: false })
    if (turnId) query = query.eq('turn_id', turnId)
    if (nationId) query = query.eq('nation_id', nationId)
    const { data: orders } = await query
    return json({ orders: (orders || []).map((o: any) => ({ ...o, nation_name: o.nation?.name, nation: undefined })) })
  }

  // ── GET /settings ──
  if (method === 'GET' && path === '/settings') {
    const { data: settings } = await db.from('game_settings').select('*').single()
    return json({ settings })
  }

  // ── PUT /settings ──
  if (method === 'PUT' && path === '/settings') {
    const body = await req.json()
    const { error } = await db.from('game_settings').update(body).eq('id', 'default')
    if (error) return json({ error: error.message }, 500)
    const { data: settings } = await db.from('game_settings').select('*').single()
    return json({ settings })
  }

  // ── GET /pins ──
  if (method === 'GET' && path === '/pins') {
    const { data: pins } = await db.from('pins').select('*, nation:nations(name), creator:players!created_by(username)')
      .order('created_at', { ascending: false })
    return json({
      pins: (pins || []).map((p: any) => ({
        ...p, nation_name: p.nation?.name, creator_name: p.creator?.username,
        nation: undefined, creator: undefined,
      })),
    })
  }

  // ── POST /pins (admin pin) ──
  if (method === 'POST' && path === '/pins') {
    const body = await req.json()
    const { x, y, label, description, nation_id } = body
    const { data: pin, error } = await db.from('pins').insert({
      x, y, label, description: description || '', type: 'admin', visibility: 'private',
      nation_id: nation_id || null, created_by: user.sub,
    }).select().single()
    if (error) return json({ error: error.message }, 500)
    return json({ pin })
  }

  // ── PUT /pins/:id (admin) ──
  const pinMatch = path.match(/^\/pins\/([^\/]+)$/)
  if (method === 'PUT' && pinMatch) {
    const body = await req.json()
    const { error } = await db.from('pins').update(body).eq('id', pinMatch[1])
    if (error) return json({ error: error.message }, 500)
    const { data: pin } = await db.from('pins').select('*').eq('id', pinMatch[1]).single()
    return json({ pin })
  }

  // ── DELETE /pins/:id (admin) ──
  if (method === 'DELETE' && pinMatch) {
    await db.from('pins').delete().eq('id', pinMatch[1])
    return json({ ok: true })
  }

  // ── GET /fronts ──
  if (method === 'GET' && path === '/fronts') {
    const { data: fronts } = await db.from('fronts')
      .select('*, attacker:nations!attacker_nation_id(name), defender:nations!defender_nation_id(name)')
      .order('created_at', { ascending: false })
    return json({
      fronts: (fronts || []).map((f: any) => ({
        ...f, attacker_name: f.attacker?.name, defender_name: f.defender?.name,
        attacker: undefined, defender: undefined,
      })),
    })
  }

  // ── PUT /fronts/:id (edit) ──
  const frontMatch = path.match(/^\/fronts\/([^\/]+)$/)
  if (method === 'PUT' && frontMatch) {
    const body = await req.json()
    const { front_width, max_progress, attacker_nation_ids, defender_nation_ids } = body

    // Update front params
    if (front_width !== undefined || max_progress !== undefined) {
      const updates: Record<string, any> = {}
      if (front_width !== undefined) updates.front_width = front_width
      if (max_progress !== undefined) updates.max_progress = max_progress
      await db.from('fronts').update(updates).eq('id', frontMatch[1])
    }

    // Update participants
    if (attacker_nation_ids) {
      await db.from('front_participants').delete().eq('front_id', frontMatch[1]).eq('side', 'attacker')
      for (const nid of attacker_nation_ids) {
        await db.from('front_participants').insert({ front_id: frontMatch[1], nation_id: nid, side: 'attacker' })
      }
    }
    if (defender_nation_ids) {
      await db.from('front_participants').delete().eq('front_id', frontMatch[1]).eq('side', 'defender')
      for (const nid of defender_nation_ids) {
        await db.from('front_participants').insert({ front_id: frontMatch[1], nation_id: nid, side: 'defender' })
      }
    }

    const { data: front } = await db.from('fronts').select('*').eq('id', frontMatch[1]).single()
    return json({ front })
  }

  // ── DELETE /fronts/:id ──
  if (method === 'DELETE' && frontMatch) {
    await db.from('fronts').delete().eq('id', frontMatch[1])
    return json({ ok: true })
  }

  // ── POST /fronts/:id/approve (multi-nation) ──
  const frontApproveMatch = path.match(/^\/fronts\/([^\/]+)\/approve$/)
  if (method === 'POST' && frontApproveMatch) {
    const body = await req.json()
    const { attacker_nation_ids, defender_nation_ids, max_progress, front_width } = body

    await db.from('fronts').update({
      status: 'active',
      max_progress: max_progress || 10,
      front_width: front_width || 1,
    }).eq('id', frontApproveMatch[1])

    // Set participants
    if (attacker_nation_ids) {
      for (const nid of attacker_nation_ids) {
        await db.from('front_participants').upsert({
          front_id: frontApproveMatch[1], nation_id: nid, side: 'attacker',
        }, { onConflict: 'front_id, nation_id' })
      }
    }
    if (defender_nation_ids) {
      for (const nid of defender_nation_ids) {
        await db.from('front_participants').upsert({
          front_id: frontApproveMatch[1], nation_id: nid, side: 'defender',
        }, { onConflict: 'front_id, nation_id' })
      }
    }

    // If first attacker, set as attacker_nation_id
    if (attacker_nation_ids && attacker_nation_ids.length > 0) {
      await db.from('fronts').update({ attacker_nation_id: attacker_nation_ids[0] })
        .eq('id', frontApproveMatch[1])
    }

    const { data: front } = await db.from('fronts').select('*').eq('id', frontApproveMatch[1]).single()
    return json({ front })
  }

  // ── POST /fronts/:id/reject ──
  const frontRejectMatch = path.match(/^\/fronts\/([^\/]+)\/reject$/)
  if (method === 'POST' && frontRejectMatch) {
    await db.from('fronts').update({ status: 'resolved' }).eq('id', frontRejectMatch[1])
    return json({ ok: true })
  }

  // ── POST /seed-military ──
  if (method === 'POST' && path === '/seed-military') {
    // Run the full military seed (templates, formations, units for all nations)
    // This replicates the logic from server/src/index.ts
    return json({ error: 'Not implemented yet — use Supabase SQL or admin dashboard for now' }, 501)
  }

  return json({ error: 'Not found' }, 404)
})
