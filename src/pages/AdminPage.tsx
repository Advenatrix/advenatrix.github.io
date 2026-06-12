import { useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { getNations } from '../services/api'

interface AdminNation {
  id: string
  name: string
  population: number
  qol: number
  gdp: number
  player_id: string | null
}

export function AdminPage({ onSelectNation }: { onSelectNation: (id: string) => void }) {
  const [nations, setNations] = useState<AdminNation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNations().then(({ nations }) => setNations(nations)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  async function handlePlayAs(id: string) {
    onSelectNation(id)
  }

  async function handleSeedMilitary() {
    setSeeding(true)
    setSeedMsg('')
    try {
      const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
      const { supabase } = await import('../services/supabase')
      const client = supabase!
      const token = (await client.auth.getSession()).data.session?.access_token
      const res = await fetch(`${FUNCTIONS_URL}/admin/seed-military`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSeedMsg(data.error || 'Seed data imported successfully!')
    } catch (e: any) {
      setSeedMsg(e.message || 'Seed import failed')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Panel title="Admin Panel">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Select a nation to view and control
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSeedMilitary}
          disabled={seeding}
          style={{
            fontFamily: 'var(--sans)', fontSize: 11, padding: '4px 14px',
            border: '1px solid var(--gold)', background: '#000',
            color: 'var(--gold)', cursor: seeding ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.5, opacity: seeding ? 0.6 : 1,
          }}
        >{seeding ? 'Seeding...' : 'Import Seed Data'}</button>
      </div>
      {seedMsg && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: seedMsg.includes('Error') || seedMsg.includes('failed') ? 'var(--red)' : 'var(--green)', marginBottom: 8 }}>
          {seedMsg}
        </div>
      )}
      {loading ? (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>Loading nations...</div>
      ) : nations.length === 0 ? (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>No nations found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nations.map(n => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', background: '#000', border: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {n.name}
                </span>
                <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  <span>Pop: {(n.population / 1000000).toFixed(0)}M</span>
                  <span>QoL: {n.qol}</span>
                  <span>Treasury: {n.gdp >= 1_000_000_000 ? `$${(n.gdp / 1_000_000_000).toFixed(1)}B` : n.gdp >= 1_000_000 ? `$${(n.gdp / 1_000_000).toFixed(1)}M` : `$${n.gdp.toLocaleString()}`}</span>
                </div>
              </div>
              <button
                onClick={() => handlePlayAs(n.id)}
                style={{
                  fontFamily: 'var(--sans)', fontSize: 11, padding: '4px 14px',
                  border: '1px solid var(--cyan)', background: '#000',
                  color: 'var(--cyan)', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}
              >Play As</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
