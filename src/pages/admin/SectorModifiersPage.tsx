import { useEffect, useState } from 'react'
import { getAdminNations, getSectorModifiers, updateSectorModifiers } from '../../services/adminApi'
import { Panel, Button, FlexCol, FlexRow, SpaceBetween } from '../../components/ui'
import { selectStyle, inputStyle } from '../../components/ui/FormStyles'
import { SECTORS } from '../../game/types'

export function SectorModifiersPage() {
  const [nations, setNations] = useState<any[]>([])
  const [selectedNation, setSelectedNation] = useState<string>('')
  const [modifiers, setModifiers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAdminNations().then(({ nations }) => {
      setNations(nations)
      if (nations.length > 0) setSelectedNation(nations[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedNation) return
    setLoading(true)
    getSectorModifiers(selectedNation).then(({ modifiers }) => {
      const map: Record<string, number> = {}
      for (const m of modifiers) map[m.sector] = m.mod_mult
      for (const s of SECTORS) if (map[s] == null) map[s] = 1.0
      setModifiers(map)
    }).catch((e: any) => console.error(e)).finally(() => setLoading(false))
  }, [selectedNation])

  async function handleSave() {
    setSaving(true)
    try {
      await updateSectorModifiers(selectedNation, SECTORS.map(s => ({ sector: s, mod_mult: modifiers[s] ?? 1.0 })))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <FlexCol gap={16}>
      <SpaceBetween>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
          Sector Modifiers
        </div>
      </SpaceBetween>

      <FlexRow gap={12} style={{ alignItems: 'center' }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)' }}>Nation:</label>
        <select value={selectedNation} onChange={e => setSelectedNation(e.target.value)} style={{ ...selectStyle, minWidth: 200 }}>
          {nations.map(n => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </Button>
      </FlexRow>

      <Panel>
        {loading ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {SECTORS.map(sector => (
              <div key={sector} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', border: '1px solid var(--border)', background: '#000',
              }}>
                <label style={{
                  fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)',
                  flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{sector}</label>
                <input
                  type="number" step="0.1" min="0"
                  value={modifiers[sector] ?? 1.0}
                  onChange={e => setModifiers(m => ({ ...m, [sector]: parseFloat(e.target.value) || 0 }))}
                  style={{ ...inputStyle, width: 80, textAlign: 'right' }}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </FlexCol>
  )
}
