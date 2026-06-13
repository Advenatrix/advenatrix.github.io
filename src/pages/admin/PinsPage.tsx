import { useEffect, useState, useCallback, useRef } from 'react'
import { getAdminPins, createAdminPin, updateAdminPin, deleteAdminPin } from '../../services/adminApi'
import { getAdminNations } from '../../services/adminApi'
import { Panel, Modal, Button, FlexCol, FlexRow, SpaceBetween, InputField, SelectField, MapPinIcon } from '../../components/ui'
import { btnStyle } from '../../components/ui/FormStyles'
import worldMap from '../../assets/world_map.png'

type Pin = {
  id: string
  nation_id: string | null
  x: number
  y: number
  label: string
  description: string
  type: 'admin' | 'player'
  visibility: 'private' | 'shared'
  created_by: string
  creator_name: string
  nation_name: string
  created_at: string
}

export function PinsPage() {
  const [pins, setPins] = useState<Pin[]>([])
  const [nations, setNations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<Pin | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ nation_id: '', x: 50, y: 50, label: '', description: '' })
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      getAdminPins(),
      getAdminNations(),
    ]).then(([pinsRes, nationsRes]) => {
      setPins(pinsRes.pins)
      setNations(nationsRes.nations)
    }).catch((e: any) => console.error(e)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openEdit(pin: Pin) {
    setEditTarget(pin)
    setForm({
      nation_id: pin.nation_id || '',
      x: pin.x,
      y: pin.y,
      label: pin.label,
      description: pin.description,
    })
    setCreating(false)
  }

  function openCreate() {
    setEditTarget(null)
    setForm({ nation_id: '', x: 50, y: 50, label: '', description: '' })
    setCreating(true)
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    if (creating || editTarget) {
      setForm(f => ({ ...f, x, y }))
    }
  }

  async function handleSave() {
    if (!form.label.trim()) return
    const data = {
      nation_id: form.nation_id || undefined,
      x: form.x,
      y: form.y,
      label: form.label,
      description: form.description,
    }
    if (creating) {
      await createAdminPin(data)
    } else if (editTarget) {
      await updateAdminPin(editTarget.id, data)
    }
    setCreating(false)
    setEditTarget(null)
    fetch()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this pin?')) return
    await deleteAdminPin(id)
    fetch()
  }

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading pins...</div>

  return (
    <FlexCol gap={16}>
      <SpaceBetween>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
          Map Pins
        </div>
        <FlexRow gap={8} style={{ alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)' }}>{pins.length} total</span>
          <Button onClick={openCreate}>+ New Pin</Button>
        </FlexRow>
      </SpaceBetween>

      <Panel title="Map Preview (click to set position)">
        <div
          ref={mapRef}
          onClick={handleMapClick}
          style={{
            position: 'relative', width: '100%', height: 400, overflow: 'hidden',
            background: '#000', cursor: (creating || editTarget) ? 'crosshair' : 'default',
          }}
        >
          <img src={worldMap} alt="World Map" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }} />
          {pins.map(pin => {
            return (
              <div
                key={pin.id}
                onClick={e => { e.stopPropagation(); openEdit(pin) }}
                onMouseEnter={() => setHoveredPin(pin.id)}
                onMouseLeave={() => setHoveredPin(null)}
                style={{
                  position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`,
                  transform: 'translate(-50%, -100%)', cursor: 'pointer', zIndex: hoveredPin === pin.id ? 10 : 1,
                }}
              >
                <MapPinIcon color={pin.type === 'admin' ? 'var(--cyan-bright)' : 'var(--green-bright)'} />
                {hoveredPin === pin.id && (
                  <div style={{
                    position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)',
                    marginBottom: 4, background: '#000', border: '1px solid var(--border)',
                    padding: '4px 8px', fontFamily: 'var(--sans)', fontSize: 11,
                    color: 'var(--text-bright)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
                  }}>
                    {pin.label} <span style={{ color: 'var(--text-dim)' }}>({pin.type})</span>
                  </div>
                )}
              </div>
            )
          })}
          {(creating || editTarget) && (
            <div style={{
              position: 'absolute', left: `${form.x}%`, top: `${form.y}%`,
              transform: 'translate(-50%, -100%)', zIndex: 5, pointerEvents: 'none',
            }}>
              <MapPinIcon color="var(--amber-bright)" size={24} />
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Label', 'Type', 'X', 'Y', 'Nation', 'Creator', 'Visibility', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)',
                      color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 12,
                      letterSpacing: 0.5, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pins.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
                      No pins yet
                    </td>
                  </tr>
                ) : (
                  pins.map(pin => (
                    <tr key={pin.id}
                      onDoubleClick={() => openEdit(pin)}
                      style={{ transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,255,0.05)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '' }}
                    >
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{pin.label}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: pin.type === 'admin' ? 'var(--cyan-bright)' : 'var(--green-bright)' }}>{pin.type}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{pin.x.toFixed(1)}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{pin.y.toFixed(1)}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{pin.nation_name || '—'}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{pin.creator_name}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{pin.type === 'admin' ? '—' : pin.visibility}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(pin)} style={btnStyle}>Edit</button>
                          <button onClick={() => handleDelete(pin.id)} style={{ ...btnStyle, color: 'var(--red-bright)', borderColor: 'var(--red-bright)' }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      <Modal open={creating || !!editTarget} onClose={() => { setCreating(false); setEditTarget(null) }} title={creating ? 'Create Admin Pin' : 'Edit Pin'} wide>
        <FlexCol gap={10} style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 11, margin: 0 }}>
            Position: ({form.x.toFixed(1)}, {form.y.toFixed(1)}) — click on the map above to set
          </p>
          <InputField label="Label *" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} />
          <InputField label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline />
          <FlexRow gap={8}>
            <InputField label="X (%)" type="number" min={0} max={100} step={0.1} value={String(form.x)} onChange={v => setForm(f => ({ ...f, x: parseFloat(v) || 0 }))} />
            <InputField label="Y (%)" type="number" min={0} max={100} step={0.1} value={String(form.y)} onChange={v => setForm(f => ({ ...f, y: parseFloat(v) || 0 }))} />
          </FlexRow>
          <SelectField label="Nation (optional)" value={form.nation_id} onChange={v => setForm(f => ({ ...f, nation_id: v }))}>
            <option value="">— None —</option>
            {nations.map((n: any) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </SelectField>
          <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>
            <Button variant="secondary" onClick={() => { setCreating(false); setEditTarget(null) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.label.trim()}>{creating ? 'Create' : 'Save'}</Button>
          </FlexRow>
        </FlexCol>
      </Modal>
    </FlexCol>
  )
}
