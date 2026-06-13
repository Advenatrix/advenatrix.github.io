import { useEffect, useState, useCallback } from 'react'
import { Panel, Button, Modal } from '../components/ui'
import { inputStyle, selectStyle } from '../components/ui/FormStyles'
import { getMilitary, createUnitTemplate, deleteUnitTemplate, createFormation, createUnit, assignUnit, deleteUnit } from '../services/api'
import { UNIT_TYPES } from '../game/unitTypes'
import { fmtMoney } from '../utils/format'

type Branch = 'army' | 'navy' | 'airforce'

const BRANCH_TABS: { id: Branch; label: string }[] = [
  { id: 'army', label: 'Army' },
  { id: 'navy', label: 'Navy' },
  { id: 'airforce', label: 'Air Force' },
]

const STAT_COLORS: Record<string, string> = {
  Low: 'var(--red-bright)',
  Medium: 'var(--amber-bright)',
  High: 'var(--green-bright)',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--green-bright)',
  damaged: 'var(--amber-bright)',
  destroyed: 'var(--red-bright)',
  building: 'var(--cyan-bright)',
}

const FORMATION_LABELS: Record<string, string> = {
  division: 'Div',
  fleet: 'Fleet',
  airgroup: 'Air Gp',
}

interface MilitaryPageProps {
  nationId: string
}

type Unit = { id: string; template_id: string | null; formation_id: string | null; nation_id: string; name: string; unit_type: string; armor: string; firepower: string; speed: string; strength: number; status: string; build_cost: number; build_time: number; upkeep: number; ready_turn: number | null; template_name: string | null }
type Template = { id: string; nation_id: string; name: string; branch: string; unit_type: string; armor: string; firepower: string; speed: string; build_cost: number; build_time: number; upkeep: number }
type Formation = { id: string; nation_id: string; name: string; type: string; branch: string }

const STAT_OPTIONS = ['Low', 'Medium', 'High']

export function MilitaryPage({ nationId }: MilitaryPageProps) {
  const [branch, setBranch] = useState<Branch>('army')
  const [templates, setTemplates] = useState<Template[]>([])
  const [formations, setFormations] = useState<Formation[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)

  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showFormationModal, setShowFormationModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [unitFormationId, setUnitFormationId] = useState<string | null>(null)

  const [tf, setTf] = useState({ name: '', unit_type: 'Infantry Battalion', armor: 'Medium', firepower: 'Medium', speed: 'Medium' })
  const [ff, setFf] = useState({ name: '' })
  const [uf, setUf] = useState({ name: '', template_id: '', unit_type: 'Infantry Battalion', armor: 'Medium', firepower: 'Medium', speed: 'Medium' })

  // Drag state
  const [dragUnitId, setDragUnitId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null) // formation id or '__unassign' or '__trash'

  const fetch = useCallback(() => {
    setLoading(true)
    getMilitary(nationId).then(d => {
      setTemplates(d.templates)
      setFormations(d.formations)
      setUnits(d.units)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [nationId])

  useEffect(() => { fetch() }, [fetch])

  async function handleCreateTemplate() {
    if (!tf.name.trim()) return
    await createUnitTemplate({ nation_id: nationId, name: tf.name, branch, unit_type: tf.unit_type, armor: tf.armor, firepower: tf.firepower, speed: tf.speed })
    setShowTemplateModal(false)
    setTf({ name: '', unit_type: 'Infantry Battalion', armor: 'Medium', firepower: 'Medium', speed: 'Medium' })
    fetch()
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm('Delete this template?')) return
    await deleteUnitTemplate(id)
    fetch()
  }

  async function handleCreateFormation() {
    if (!ff.name.trim()) return
    const type = branch === 'army' ? 'division' : branch === 'navy' ? 'fleet' : 'airgroup'
    await createFormation({ nation_id: nationId, name: ff.name, type, branch })
    setShowFormationModal(false)
    setFf({ name: '' })
    fetch()
  }

  async function handleCreateUnit(formationId?: string | null) {
    if (!uf.name.trim()) return
    await createUnit({
      nation_id: nationId, name: uf.name, unit_type: uf.unit_type,
      template_id: uf.template_id || undefined,
      formation_id: formationId || undefined,
      armor: uf.armor, firepower: uf.firepower, speed: uf.speed,
    })
    setShowUnitModal(false)
    setUf({ name: '', template_id: '', unit_type: 'Infantry Battalion', armor: 'Medium', firepower: 'Medium', speed: 'Medium' })
    fetch()
  }

  async function handleDeleteUnit(id: string) {
    if (!window.confirm('Delete this unit?')) return
    await deleteUnit(id)
    fetch()
  }

  // ── Drag & Drop handlers ──
  const handleDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.setData('text/plain', unitId)
    e.dataTransfer.effectAllowed = 'move'
    setDragUnitId(unitId)
  }

  const handleDragEnd = () => {
    setDragUnitId(null)
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, target: string | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(prev => (prev !== target ? target : prev))
  }

  const handleDrop = async (e: React.DragEvent, targetFormationId: string | null) => {
    e.preventDefault()
    const uid = e.dataTransfer.getData('text/plain')
    if (!uid) return

    setDragUnitId(null)
    setDropTarget(null)

    if (targetFormationId === '__trash') {
      if (!window.confirm('Delete this unit?')) return
      setUnits(prev => prev.filter(u => u.id !== uid))
      try { await deleteUnit(uid) } catch { fetch() }
    } else {
      const newFid: string | null = targetFormationId === '__unassign' ? null : targetFormationId
      setUnits(prev => prev.map(u => u.id === uid ? { ...u, formation_id: newFid } : u))
      try { await assignUnit(uid, newFid) } catch { fetch() }
    }
  }

  const branchFormations = formations.filter(f => f.branch === branch)
  const branchTemplates = templates.filter(t => t.branch === branch)
  const unassigned = units.filter(u => !u.formation_id)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function unitRow(u: Unit, inFormation: boolean) {
    const isDragging = dragUnitId === u.id
    return (
      <div
        key={u.id}
        draggable
        onDragStart={e => handleDragStart(e, u.id)}
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px', fontFamily: 'var(--mono)', fontSize: 13,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          opacity: isDragging ? 0.3 : 1,
          cursor: 'grab', userSelect: 'none',
          background: isDragging ? 'rgba(0,255,255,0.05)' : 'transparent',
        }}
      >
        <span style={{ color: 'var(--text-dim)', fontSize: 10, width: 14, flexShrink: 0 }}>⠿</span>
        <span style={{ color: 'var(--text-bright)', flexShrink: 0 }}>{u.name}</span>
        <span style={{ color: 'var(--cyan)', fontSize: 11, flexShrink: 0 }}>{u.unit_type}</span>
        <span style={{ color: STAT_COLORS[u.armor], fontSize: 11 }}>{u.armor}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>/</span>
        <span style={{ color: STAT_COLORS[u.firepower], fontSize: 11 }}>{u.firepower}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>/</span>
        <span style={{ color: STAT_COLORS[u.speed], fontSize: 11 }}>{u.speed}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>| {u.strength}%</span>
        <span style={{ color: STATUS_COLORS[u.status] || 'var(--text-dim)', fontSize: 11 }}>{u.status}</span>
        {u.status === 'building' && u.ready_turn && <span style={{ color: 'var(--amber-bright)', fontSize: 10 }}>T{u.ready_turn}</span>}
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{fmtMoney(u.upkeep)}/t</span>
        {u.template_name && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>({u.template_name})</span>}
        <div style={{ flex: 1 }} />
        {inFormation && (
          <span style={{ color: 'var(--text-dim)', fontSize: 9, fontStyle: 'italic' }}>drag to move</span>
        )}
        <button onClick={() => handleDeleteUnit(u.id)} style={{
          fontFamily: 'var(--sans)', fontSize: 10, padding: '1px 5px',
          border: '1px solid var(--red-bright)', background: '#000',
          color: 'var(--red-bright)', cursor: 'pointer', lineHeight: '14px',
          opacity: 0.6,
        }}>✕</button>
      </div>
    )
  }

  function dropOverlay(formationId: string | null, label: string) {
    if (dropTarget !== formationId) return null
    return (
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 4,
        border: '2px dashed var(--cyan-bright)',
        background: 'rgba(0,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--cyan-bright)',
        fontFamily: 'var(--mono)', fontSize: 11, pointerEvents: 'none', zIndex: 10,
      }}>
        Drop here → {label}
      </div>
    )
  }

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading military...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Branch tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {BRANCH_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setBranch(t.id)}
            style={{
              fontFamily: 'var(--sans)', fontSize: 12, padding: '6px 18px',
              border: `1px solid ${branch === t.id ? 'var(--cyan)' : 'var(--border)'}`,
              background: branch === t.id ? 'rgba(0,255,255,0.1)' : '#000',
              color: branch === t.id ? 'var(--cyan-bright)' : 'var(--text-dim)',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button onClick={() => setShowFormationModal(true)}>+ {FORMATION_LABELS[branch === 'army' ? 'division' : branch === 'navy' ? 'fleet' : 'airgroup']}</Button>
      </div>

      {/* Formations (collapsible lists) — always a drop target */}
      {branchFormations.length === 0 ? (
        <div
          onDragOver={e => handleDragOver(e, '__unassign')}
          onDrop={e => handleDrop(e, '__unassign')}
        >
          <Panel title={`${branch === 'army' ? 'Divisions' : branch === 'navy' ? 'Fleets' : 'Air Groups'}`}>
            <div style={{ position: 'relative' }}>
              {dropOverlay('__unassign', 'Unassigned')}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>
                {dragUnitId ? 'Drag here to demobilize' : 'No ' + branch + ' formations yet'}
              </div>
            </div>
          </Panel>
        </div>
      ) : (
        branchFormations.map(f => {
          const formationUnits = units.filter(u => u.formation_id === f.id)
          const isCollapsed = collapsed[f.id] ?? false
          return (
            <Panel key={f.id}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(c => ({ ...c, [f.id]: !isCollapsed }))}
              >
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{isCollapsed ? '▶' : '▼'}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-bright)', fontWeight: 600 }}>{f.name}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)',
                  border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 2,
                }}>{FORMATION_LABELS[f.type]}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  {formationUnits.length} unit{formationUnits.length !== 1 ? 's' : ''}
                </span>
              </div>
              {!isCollapsed && (
                <div
                  onDragOver={e => handleDragOver(e, f.id)}
                  onDrop={e => handleDrop(e, f.id)}
                  style={{
                    marginTop: 4, borderTop: '1px solid var(--border)',
                    minHeight: 32, position: 'relative',
                  }}
                >
                  {dropOverlay(f.id, f.name)}
                  {formationUnits.length === 0 ? (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', padding: '8px 8px' }}>
                      Drag units here
                    </div>
                  ) : (
                    formationUnits.map(u => unitRow(u, true))
                  )}
                  <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => { setUnitFormationId(f.id); setShowUnitModal(true) }} style={{
                      fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 10px',
                      border: '1px solid var(--cyan)', background: 'rgba(0,255,255,0.05)',
                      color: 'var(--cyan-bright)', cursor: 'pointer',
                    }}>+ Add Unit</button>
                  </div>
                </div>
              )}
              {isCollapsed && (
                <div
                  onDragOver={e => handleDragOver(e, f.id)}
                  onDrop={e => handleDrop(e, f.id)}
                  style={{ minHeight: 16, position: 'relative' }}
                >
                  {dropOverlay(f.id, f.name)}
                </div>
              )}
            </Panel>
          )
        })
      )}

      {/* Demobilized pool — always visible as drop target */}
      <Panel title="Demobilized">
        <div
          onDragOver={e => handleDragOver(e, '__unassign')}
          onDrop={e => handleDrop(e, '__unassign')}
          style={{
            borderTop: '1px solid var(--border)', minHeight: 32, position: 'relative',
          }}
        >
          {dropOverlay('__unassign', 'Demobilized')}
          {unassigned.filter(u => {
            const t = branchTemplates.find(t => t.id === u.template_id)
            return t ? t.branch === branch : true
          }).length === 0 && !dragUnitId ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', padding: '8px 8px' }}>
              Drag units here to demobilize
            </div>
          ) : (
            unassigned.filter(u => {
              const t = branchTemplates.find(t => t.id === u.template_id)
              return t ? t.branch === branch : true
            }).map(u => unitRow(u, false))
          )}
        </div>
        <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => { setUnitFormationId(null); setShowUnitModal(true) }} style={{
            fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 10px',
            border: '1px solid var(--cyan)', background: 'rgba(0,255,255,0.05)',
            color: 'var(--cyan-bright)', cursor: 'pointer',
          }}>+ Add Unit</button>
        </div>
      </Panel>

      {/* Trash drop zone for deletion */}
      <div
        onDragOver={e => handleDragOver(e, '__trash')}
        onDrop={e => handleDrop(e, '__trash')}
        style={{
          border: `2px dashed ${dropTarget === '__trash' ? 'var(--red-bright)' : 'transparent'}`,
          borderRadius: 4, padding: '12px 0',
          textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13,
          color: dropTarget === '__trash' ? 'var(--red-bright)' : 'var(--text-dim)',
          transition: 'all 0.15s',
          background: dropTarget === '__trash' ? 'rgba(255,0,0,0.06)' : 'transparent',
        }}
      >
        {dropTarget === '__trash' ? 'Drop to delete unit' : '🗑 Drag units here to delete'}
      </div>

      {/* Templates (collapsed by default) */}
      <Panel title={`${branch === 'army' ? 'Army' : branch === 'navy' ? 'Naval' : 'Air'} Unit Templates`}>
        <details>
          <summary style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)',
            cursor: 'pointer', userSelect: 'none', marginBottom: 6,
          }}>
            Templates ({branchTemplates.length})
          </summary>
          <div style={{ marginBottom: 8 }}>
            <Button onClick={() => setShowTemplateModal(true)}>+ New Template</Button>
          </div>
          {branchTemplates.length === 0 ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>No templates</div>
          ) : (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Name', 'Type', 'Armor', 'Firepower', 'Speed', 'Cost', 'Time', 'Upkeep', ''].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)',
                        color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10,
                        letterSpacing: 0.5,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branchTemplates.map(t => (
                    <tr key={t.id}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-bright)', whiteSpace: 'nowrap' }}>{t.name}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12 }}>{t.unit_type}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: STAT_COLORS[t.armor] }}>{t.armor}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: STAT_COLORS[t.firepower] }}>{t.firepower}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: STAT_COLORS[t.speed] }}>{t.speed}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12 }}>{fmtMoney(t.build_cost)}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12 }}>{t.build_time}t</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12 }}>{fmtMoney(t.upkeep)}/t</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                        <button onClick={() => handleDeleteTemplate(t.id)} style={{
                          fontFamily: 'var(--sans)', fontSize: 10, padding: '1px 6px',
                          border: '1px solid var(--red-bright)', background: '#000',
                          color: 'var(--red-bright)', cursor: 'pointer',
                        }}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </Panel>

      {/* Create Template Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="New Unit Template" wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Template Name *</label>
            <input value={tf.name} onChange={e => setTf(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit Type</label>
            <select value={tf.unit_type} onChange={e => setTf(f => ({ ...f, unit_type: e.target.value }))} style={selectStyle}>
              {(UNIT_TYPES[branch] || []).map(ut => <option key={ut} value={ut}>{ut}</option>)}
            </select>
          </div>
          {(['armor', 'firepower', 'speed'] as const).map(stat => (
            <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text)', minWidth: 100, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {STAT_OPTIONS.map(s => (
                  <button key={s}
                    onClick={() => setTf(f => ({ ...f, [stat]: s }))}
                    style={{
                      fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)',
                      background: tf[stat] === s ? STAT_COLORS[s] : '#000',
                      color: tf[stat] === s ? '#000' : STAT_COLORS[s],
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={!tf.name.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Create Formation Modal */}
      <Modal open={showFormationModal} onClose={() => setShowFormationModal(false)} title={`New ${FORMATION_LABELS[branch === 'army' ? 'division' : branch === 'navy' ? 'fleet' : 'airgroup']}`} wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Name *</label>
            <input value={ff.name} onChange={e => setFf(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowFormationModal(false)}>Cancel</Button>
            <Button onClick={handleCreateFormation} disabled={!ff.name.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Create Unit Modal */}
      <Modal open={showUnitModal} onClose={() => setShowUnitModal(false)} title="New Unit" wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit Name *</label>
            <input value={uf.name} onChange={e => setUf(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit Type</label>
            <select value={uf.unit_type} onChange={e => setUf(f => ({ ...f, unit_type: e.target.value }))} style={selectStyle}>
              {(UNIT_TYPES[branch] || []).map(ut => <option key={ut} value={ut}>{ut}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Template (optional)</label>
            <select value={uf.template_id} onChange={e => setUf(f => ({ ...f, template_id: e.target.value }))} style={selectStyle}>
              <option value="">— None (custom stats) —</option>
              {branchTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {(['armor', 'firepower', 'speed'] as const).map(stat => (
            <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text)', minWidth: 100, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {STAT_OPTIONS.map(s => (
                  <button key={s}
                    onClick={() => setUf(f => ({ ...f, [stat]: s }))}
                    style={{
                      fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)',
                      background: uf[stat] === s ? STAT_COLORS[s] : '#000',
                      color: uf[stat] === s ? '#000' : STAT_COLORS[s],
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowUnitModal(false)}>Cancel</Button>
            <Button onClick={() => handleCreateUnit(unitFormationId)} disabled={!uf.name.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
