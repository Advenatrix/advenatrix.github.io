import { useEffect, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { Button } from '../components/ui/Button'
import { getNations, getIntelShares, createIntelShare, deleteIntelShare } from '../services/api'

interface DiplomacyPageProps {
  nationId: string
}

export function DiplomacyPage({ nationId }: DiplomacyPageProps) {
  const [nations, setNations] = useState<any[]>([])
  const [shares, setShares] = useState<any[]>([])
  const [selectedTarget, setSelectedTarget] = useState('')
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    try {
      const [nationsRes, sharesRes] = await Promise.all([
        getNations(),
        getIntelShares(),
      ])
      setNations(nationsRes.nations.filter((n: any) => n.id !== nationId))
      setShares(sharesRes.shares)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleShare() {
    if (!selectedTarget) return
    try {
      await createIntelShare(selectedTarget)
      setSelectedTarget('')
      fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleRevoke(id: string) {
    await deleteIntelShare(id)
    fetchData()
  }

  const sharedIds = shares.map((s: any) => s.target_nation_id)
  const available = nations.filter((n: any) => !sharedIds.includes(n.id))

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Share Intel">
        <p style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Share your intel (pins marked as "shared") with another nation. They will be able to see your shared pins on the map.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--mono)' }}>Target Nation</label>
            <select
              value={selectedTarget}
              onChange={e => setSelectedTarget(e.target.value)}
              style={{
                padding: '8px 10px', background: '#000', border: '1px solid var(--border)',
                color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">— Select —</option>
              {available.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleShare} disabled={!selectedTarget}>Share Intel</Button>
        </div>
      </Panel>

      <Panel title="Active Intel Shares">
        {shares.length === 0 ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: 12 }}>
            No active intel shares
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {shares.map((s: any) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: '#000', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-bright)' }}>
                    {s.target_nation_name}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                    Sharing your shared pins
                  </span>
                </div>
                <button
                  onClick={() => handleRevoke(s.id)}
                  style={{
                    fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 10px',
                    border: '1px solid var(--red-bright)', background: '#000',
                    color: 'var(--red-bright)', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: 0.3,
                  }}
                >Revoke</button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
