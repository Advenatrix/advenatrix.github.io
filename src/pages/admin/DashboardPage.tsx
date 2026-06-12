import { useEffect, useState, useCallback } from 'react'
import { getDashboard, processTurn } from '../../services/adminApi'
import { Panel, Button, FlexCol, FlexRow, Badge } from '../../components/ui'

interface DashboardData {
  activeTurn: any | null
  totalNations: number
  totalPlayers: number
  totalCompanies: number
  turnHistory: any[]
  players: { id: string; username: string; nation_name: string | null; nation_id: string | null; has_submitted: number }[]
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')

  const [error, setError] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    setError('')
    getDashboard().then(setData).catch((e: any) => {
      setError(e.message || 'Failed to load dashboard data')
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function handleProcess() {
    if (!data?.activeTurn) return
    if (!window.confirm(`Process Turn #${data.activeTurn.number}? This runs the economy and advances to the next turn.`)) return
    setProcessing(true)
    setMessage('')
    try {
      await processTurn()
      setMessage(`Turn #${data.activeTurn.number} processed. Turn #${data.activeTurn.number + 1} is now open.`)
      fetch()
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading dashboard...</div>
  if (error) return (
    <FlexCol gap={12} style={{ alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--red-bright)', fontFamily: 'var(--mono)', fontSize: 14 }}>Failed to load dashboard.</div>
      <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 12 }}>{error}</div>
      <Button variant="secondary" onClick={fetch}>Retry</Button>
    </FlexCol>
  )
  if (!data) return (
    <FlexCol gap={12} style={{ alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--red-bright)', fontFamily: 'var(--mono)', fontSize: 14 }}>Failed to load dashboard.</div>
      <Button variant="secondary" onClick={fetch}>Retry</Button>
    </FlexCol>
  )

  const cards = [
    { label: 'Active Turn', value: data.activeTurn ? `#${data.activeTurn.number}` : 'None', color: data.activeTurn ? 'var(--green-bright)' : 'var(--text-dim)' },
    { label: 'Nations', value: data.totalNations, color: 'var(--cyan-bright)' },
    { label: 'Players', value: data.totalPlayers, color: 'var(--text-bright)' },
    { label: 'Companies', value: data.totalCompanies, color: 'var(--text-bright)' },
  ]

  return (
    <FlexCol gap={20}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
        Dashboard Overview
      </div>

      {message && (
        <div style={{
          padding: '8px 12px', background: '#000', border: '1px solid var(--amber-bright)',
          color: 'var(--amber-bright)', fontFamily: 'var(--mono)', fontSize: 13,
        }}>{message}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {cards.map(card => (
          <div key={card.label} style={{
            background: '#000', border: '1px solid var(--border)', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 12, textTransform: 'uppercase',
              letterSpacing: 1, color: 'var(--text-dim)',
            }}>{card.label}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 30, color: card.color,
            }}>{card.value}</div>
          </div>
        ))}
      </div>

      {data.activeTurn && (
        <Panel title={`Active Turn #${data.activeTurn.number}`}>
          <FlexRow gap={16} style={{ alignItems: 'center' }}>
            <FlexCol gap={4} style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text)' }}>
                Deadline: {new Date(data.activeTurn.deadline).toLocaleString()}
              </div>
            </FlexCol>
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? 'Processing...' : 'Process Turn & Advance'}
            </Button>
          </FlexRow>
        </Panel>
      )}

      {data.turnHistory.length > 0 && (
        <Panel title="Recent Turns">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
            {data.turnHistory.map((t: any) => (
              <FlexRow key={t.id} gap={16} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--cyan-bright)', minWidth: 60 }}>Turn {t.number}</span>
                <Badge variant={t.status === 'open' ? 'success' : 'default'}>{t.status}</Badge>
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  {t.processed_at ? new Date(t.processed_at).toLocaleString() : '—'}
                </span>
              </FlexRow>
            ))}
          </div>
        </Panel>
      )}

      {data.activeTurn && (
        <Panel title="Player Order Submission">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
            <FlexRow gap={12} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <span style={{ flex: 1 }}>Player</span>
              <span style={{ flex: 1 }}>Nation</span>
              <span style={{ width: 80, textAlign: 'center' }}>Orders</span>
            </FlexRow>
            {data.players.map((p: any) => (
              <FlexRow key={p.id} gap={12} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                <span style={{ flex: 1, color: 'var(--text-bright)' }}>{p.username}</span>
                <span style={{ flex: 1, color: p.nation_name ? 'var(--cyan-bright)' : 'var(--text-dim)' }}>
                  {p.nation_name || '—'}
                </span>
                <Badge variant={p.has_submitted ? 'success' : 'danger'}>{p.has_submitted ? 'Submitted' : 'Pending'}</Badge>
              </FlexRow>
            ))}
            {data.players.length === 0 && (
              <div style={{ color: 'var(--text-dim)', padding: '8px 0' }}>No players found.</div>
            )}
          </div>
        </Panel>
      )}
    </FlexCol>
  )
}
