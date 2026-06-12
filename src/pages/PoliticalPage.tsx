import { useMemo, useState } from 'react'
import { Panel } from '../components/ui/Panel'
import { getRandomModifiers } from '../game/modifiers'
import type { Modifier } from '../game/modifiers'

function ModifierCard({ modifier }: { modifier: Modifier }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = modifier.description.length > 200
  const displayText = expanded || !isLong ? modifier.description : modifier.description.slice(0, 200) + '...'

  return (
    <div style={{
      background: '#000', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--cyan)',
    }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 600,
          color: 'var(--text-bright)', textTransform: 'uppercase',
          letterSpacing: 0.5, marginBottom: 6,
        }}>{modifier.name}</div>

        <div style={{
          fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--text)',
          lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: 8,
        }}>
          {displayText}
          {isLong && (
            <span
              onClick={() => setExpanded(!expanded)}
              style={{
                color: 'var(--cyan-bright)', cursor: 'pointer',
                fontFamily: 'var(--sans)', fontSize: 13, marginLeft: 4,
                textTransform: 'uppercase',
              }}
            >[{expanded ? 'less' : 'more'}]</span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {modifier.effects.map((effect, i) => (
            <span key={i} style={{
              fontFamily: 'var(--mono)', fontSize: 13, padding: '2px 8px',
              background: 'rgba(0,255,255,0.08)', border: '1px solid rgba(0,255,255,0.2)',
              color: 'var(--cyan-bright)',
            }}>{effect}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PoliticalPageProps {
  nationId: string
}

export function PoliticalPage({ nationId }: PoliticalPageProps) {
  const modifiers = useMemo(() => getRandomModifiers(nationId, 3), [nationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="National Modifiers">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modifiers.map(m => (
            <ModifierCard key={m.id} modifier={m} />
          ))}
        </div>
      </Panel>
    </div>
  )
}
