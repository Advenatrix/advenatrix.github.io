import { useEffect, useState } from 'react'
import { Panel, Button, Modal, FlexCol, FlexRow, SpaceBetween, Badge } from '../../components/ui'
import { inputStyle, selectStyle, btnStyle } from '../../components/ui/FormStyles'
import { getPendingFronts, rejectFront } from '../../services/api'
import { getAdminNations, getAdminFronts, approveFrontMulti, updateFront, deleteFront as adminDeleteFront } from '../../services/adminApi'

const multiSelectStyle: React.CSSProperties = {
  ...selectStyle, minWidth: 180, height: 120, cursor: 'pointer',
}

function ParticipantList({ nationIds, allNations, onAdd, onRemove }: {
  nationIds: string[]; allNations: any[]; onAdd: (nationId: string) => void; onRemove: (nationId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [sel, setSel] = useState('')
  const avail = allNations.filter(n => !nationIds.includes(n.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {nationIds.map(id => {
        const n = allNations.find((n: any) => n.id === id)
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text)' }}>{n?.name || id}</span>
            <button onClick={() => onRemove(id)} style={{
              fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 5px',
              border: '1px solid var(--red-bright)', background: '#000',
              color: 'var(--red-bright)', cursor: 'pointer',
            }}>Remove</button>
          </div>
        )
      })}
      {adding ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...selectStyle, fontSize: 12, minWidth: 140 }}>
            <option value="">— Select —</option>
            {avail.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <button onClick={() => { if (sel) { onAdd(sel); setSel(''); setAdding(false) } }} style={{
            fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px',
            border: '1px solid var(--green)', background: '#000', color: 'var(--green-bright)', cursor: 'pointer',
          }}>Add</button>
          <button onClick={() => setAdding(false)} style={{
            fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px',
            border: '1px solid var(--border)', background: '#000', color: 'var(--text-dim)', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px', cursor: 'pointer',
          border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-dim)',
          textAlign: 'left', width: 'fit-content',
        }}>+ Add nation</button>
      )}
    </div>
  )
}

export function FrontsPage() {
  const [pending, setPending] = useState<any[]>([])
  const [allFronts, setAllFronts] = useState<any[]>([])
  const [nations, setNations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [attackerIds, setAttackerIds] = useState<Record<string, string[]>>({})
  const [defenderIds, setDefenderIds] = useState<Record<string, string[]>>({})
  const [maxProgress, setMaxProgress] = useState<Record<string, number>>({})
  const [frontWidth, setFrontWidth] = useState<Record<string, number>>({})
  const [actionId, setActionId] = useState<string | null>(null)

  // Edit modal state
  const [editFront, setEditFront] = useState<any | null>(null)
  const [editWidth, setEditWidth] = useState(1)
  const [editMaxProg, setEditMaxProg] = useState(10)
  const [editAtkIds, setEditAtkIds] = useState<string[]>([])
  const [editDefIds, setEditDefIds] = useState<string[]>([])

  function load() {
    setLoading(true)
    Promise.all([getPendingFronts(), getAdminFronts(), getAdminNations()])
      .then(([p, a, n]) => {
        setPending(p.fronts)
        setAllFronts(a.fronts)
        setNations(n.nations)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleApprove(frontId: string) {
    const aIds = attackerIds[frontId] || []
    const dIds = defenderIds[frontId] || []
    if (aIds.length === 0 || dIds.length === 0) { alert('Select at least one attacker and one defender.'); return }
    const overlap = aIds.some((id: string) => dIds.includes(id))
    if (overlap) { alert('Attacker and defender sets must not overlap.'); return }
    const mp = maxProgress[frontId] || 10
    const fw = frontWidth[frontId] || 1
    setActionId(frontId)
    try {
      await approveFrontMulti(frontId, aIds, dIds, mp, fw)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(frontId: string) {
    if (!confirm('Reject this front application?')) return
    setActionId(frontId)
    try {
      await rejectFront(frontId)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionId(null)
    }
  }

  async function handleDeleteFront(frontId: string) {
    if (!confirm('Permanently delete this front and all its battles?')) return
    setActionId(frontId)
    try {
      await adminDeleteFront(frontId)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionId(null)
    }
  }

  function openEdit(front: any) {
    setEditFront(front)
    setEditWidth(front.front_width || 1)
    setEditMaxProg(front.max_progress || 10)
    const atkParts = (front.participants || []).filter((p: any) => p.side === 'attacker').map((p: any) => p.nation_id)
    const defParts = (front.participants || []).filter((p: any) => p.side === 'defender').map((p: any) => p.nation_id)
    setEditAtkIds(atkParts)
    setEditDefIds(defParts)
  }

  async function handleEditSave() {
    if (!editFront) return
    setActionId(editFront.id)
    try {
      await updateFront(editFront.id, {
        front_width: editWidth,
        max_progress: editMaxProg,
        attacker_nation_ids: editAtkIds,
        defender_nation_ids: editDefIds,
      })
      setEditFront(null)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionId(null)
    }
  }

  if (loading) return <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-dim)' }}>Loading fronts...</div>

  return (
    <FlexCol gap={16}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--text-bright)', fontWeight: 600 }}>
        Front Management
      </div>

      {pending.length === 0 ? (
        <Panel title="Pending Applications">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', padding: 16, textAlign: 'center' }}>
            No pending front applications.
          </div>
        </Panel>
      ) : (
        pending.map((front: any) => (
          <Panel key={front.id} title={`${front.name} — ${front.attacker_name || '?'}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)' }}>War:</span>
                <span>{front.war_name || '—'}</span>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Attackers (Ctrl+click):</span>
                  <select
                    multiple
                    value={attackerIds[front.id] || []}
                    onChange={e => {
                      const ids = Array.from(e.target.selectedOptions, o => o.value)
                      setAttackerIds(a => ({ ...a, [front.id]: ids }))
                    }}
                    style={multiSelectStyle}
                  >
                    {nations
                      .filter((n: any) => !(defenderIds[front.id] || []).includes(n.id))
                      .map((n: any) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Defenders (Ctrl+click):</span>
                  <select
                    multiple
                    value={defenderIds[front.id] || []}
                    onChange={e => {
                      const ids = Array.from(e.target.selectedOptions, o => o.value)
                      setDefenderIds(d => ({ ...d, [front.id]: ids }))
                    }}
                    style={multiSelectStyle}
                  >
                    {nations
                      .filter((n: any) => !(attackerIds[front.id] || []).includes(n.id))
                      .map((n: any) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-dim)' }}>Max Progress:</span>
                <input
                  type="number" min={1} max={100}
                  value={maxProgress[front.id] ?? 10}
                  onChange={e => setMaxProgress(p => ({ ...p, [front.id]: Number(e.target.value) }))}
                  style={inputStyle}
                />
                <span style={{ color: 'var(--text-dim)' }}>Front Width:</span>
                <input
                  type="number" min={1} max={20}
                  value={frontWidth[front.id] ?? 1}
                  onChange={e => setFrontWidth(p => ({ ...p, [front.id]: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="secondary" onClick={() => handleReject(front.id)} disabled={actionId === front.id}>Reject</Button>
                <Button onClick={() => handleApprove(front.id)} disabled={actionId === front.id}>Approve</Button>
              </div>
            </div>
          </Panel>
        ))
      )}

      {allFronts.length > 0 && (
        <Panel title="All Fronts">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {allFronts.map((f: any) => {
              const atkNames = (f.participants || [])
                .filter((p: any) => p.side === 'attacker').map((p: any) => p.nation_name).join(', ')
              const defNames = (f.participants || [])
                .filter((p: any) => p.side === 'defender').map((p: any) => p.nation_name).join(', ')
              return (
                <div key={f.id} style={{
                  display: 'flex', gap: 8, padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center',
                }}>
                  <Badge variant={f.status === 'active' ? 'success' : f.status === 'pending' ? 'warning' : 'default'}>{f.status}</Badge>
                  <span style={{ color: 'var(--cyan-bright)' }}>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    A:{atkNames || f.attacker_name}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    D:{defNames || f.defender_name || '?'}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>{f.progress || 0}/{f.max_progress || '-'}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>W:{f.front_width || 1}</span>
                  {f.retreating_by && (
                    <span style={{ color: 'var(--amber-bright)', fontSize: 10 }}>RETREATING</span>
                  )}
                  <div style={{ flex: 1 }} />
                  {f.status === 'active' && (
                    <button onClick={() => openEdit(f)} style={{ ...btnStyle, color: 'var(--cyan-bright)', borderColor: 'var(--cyan)' }}>Edit</button>
                  )}
                  <button onClick={() => handleDeleteFront(f.id)} disabled={actionId === f.id}
                    style={{ ...btnStyle, color: 'var(--red-bright)', borderColor: 'var(--red-bright)' }}>{actionId === f.id ? '...' : 'Delete'}</button>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Edit Front Modal */}
      <Modal open={!!editFront} onClose={() => setEditFront(null)} title={`Edit: ${editFront?.name || ''}`} wide>
        {editFront && (
          <FlexCol gap={12} style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
            <FlexRow gap={16} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-dim)' }}>Front Width:</span>
              <input
                type="number" min={1} max={20}
                value={editWidth} onChange={e => setEditWidth(Number(e.target.value))}
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-dim)' }}>Max Progress (Battle Length):</span>
              <input
                type="number" min={1} max={100}
                value={editMaxProg} onChange={e => setEditMaxProg(Number(e.target.value))}
                style={inputStyle}
              />
            </FlexRow>

            <div>
              <div style={{ color: 'var(--red-bright)', marginBottom: 4, fontWeight: 600 }}>Attackers</div>
              <ParticipantList
                nationIds={editAtkIds}
                allNations={nations}
                onAdd={id => setEditAtkIds(prev => [...prev, id])}
                onRemove={id => setEditAtkIds(prev => prev.filter(i => i !== id))}
              />
            </div>

            <div>
              <div style={{ color: 'var(--cyan-bright)', marginBottom: 4, fontWeight: 600 }}>Defenders</div>
              <ParticipantList
                nationIds={editDefIds}
                allNations={nations}
                onAdd={id => setEditDefIds(prev => [...prev, id])}
                onRemove={id => setEditDefIds(prev => prev.filter(i => i !== id))}
              />
            </div>

            <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>
              <Button variant="secondary" onClick={() => setEditFront(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={actionId === editFront.id}>
                {actionId === editFront.id ? 'Saving...' : 'Save'}
              </Button>
            </FlexRow>
          </FlexCol>
        )}
      </Modal>
    </FlexCol>
  )
}