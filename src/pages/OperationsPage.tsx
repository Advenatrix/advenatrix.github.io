import { useEffect, useState } from 'react'
import { Panel, Button, Modal } from '../components/ui'
import { inputStyle, selectStyle } from '../components/ui/FormStyles'
import { getMilitary } from '../services/api'
import { getFronts, createFront, assignFormationToFront, unassignFormationFromFront, retreatFromFront, launchBattle, getBattles } from '../services/api'

interface OperationsPageProps {
  nationId: string
}

const RESULT_COLORS: Record<string, string> = {
  attacker_win: 'var(--green-bright)',
  defender_win: 'var(--red-bright)',
  stalemate: 'var(--amber-bright)',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--amber-bright)',
  active: 'var(--green-bright)',
  resolved: 'var(--text-dim)',
}

function ProgressBar({ current, max }: { current: number; max: number }) {
  const pips = Array.from({ length: max }, (_, i) => {
    const filled = i < current
    return filled ? '■' : '□'
  }).join('')

  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: 2 }}>
      <span style={{ color: 'var(--cyan-bright)' }}>{pips}</span>
      <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 6 }}>
        {current}/{max}
      </span>
    </div>
  )
}

export function OperationsPage({ nationId }: OperationsPageProps) {
  const [fronts, setFronts] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [formations, setFormations] = useState<any[]>([])
  const [battles, setBattles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showFrontModal, setShowFrontModal] = useState(false)
  const [frontName, setFrontName] = useState('')
  const [warName, setWarName] = useState('')
  const [assigningFrontId, setAssigningFrontId] = useState<string | null>(null)
  const [launching, setLaunching] = useState<string | null>(null)
  const [retreating, setRetreating] = useState<string | null>(null)
  const [battleResult, setBattleResult] = useState<any>(null)

  function loadData() {
    setLoading(true)
    Promise.all([
      getFronts(),
      getMilitary(nationId),
      getBattles(),
    ]).then(([frontsData, milData, battlesData]) => {
      setFronts(frontsData.fronts)
      setAssignments(frontsData.assignments)
      setFormations(milData.formations)
      setBattles(battlesData.battles)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [nationId])

  async function handleCreateFront() {
    if (!frontName.trim()) return
    await createFront(frontName, warName)
    setShowFrontModal(false)
    setFrontName('')
    setWarName('')
    const { fronts: fd, assignments: ad } = await getFronts()
    setFronts(fd)
    setAssignments(ad)
  }

  async function handleAssign(frontId: string, formationId: string) {
    await assignFormationToFront(frontId, formationId)
    setAssigningFrontId(null)
    const { assignments: ad } = await getFronts()
    setAssignments(ad)
  }

  async function handleUnassign(frontId: string, formationId: string) {
    await unassignFormationFromFront(frontId, formationId)
    const { assignments: ad } = await getFronts()
    setAssignments(ad)
  }

  async function handleRetreat(frontId: string) {
    if (!confirm('Are you sure you want to retreat from this front?')) return
    setRetreating(frontId)
    try {
      await retreatFromFront(frontId)
      loadData()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setRetreating(null)
    }
  }

  async function handleLaunch(frontId: string) {
    setLaunching(frontId)
    try {
      const result = await launchBattle(frontId)
      setBattleResult(result)
      loadData()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLaunching(null)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading operations...</div>

  function myRole(f: any): 'attacker' | 'defender' | null {
    const p = (f.participants || []).find((p: any) => p.nation_id === nationId)
    return p ? p.side : null
  }

  const myActiveFronts = fronts.filter((f: any) => myRole(f) && f.status === 'active')
  const myPendingFronts = fronts.filter((f: any) => f.attacker_nation_id === nationId && f.status === 'pending')
  const otherFronts = fronts.filter((f: any) => !myRole(f) || f.status === 'resolved')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--text-bright)', fontWeight: 600 }}>Operations</span>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setShowFrontModal(true)}>+ New Front</Button>
      </div>

      {/* Active Fronts */}
      {myActiveFronts.length === 0 ? (
        <Panel title="Active Fronts">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', padding: 16, textAlign: 'center' }}>
            No active fronts. Apply for a new front to begin operations.
          </div>
        </Panel>
      ) : (
        myActiveFronts.map((front: any) => {
          const frontAssignments = assignments.filter((a: any) => a.front_id === front.id)
          const assignedFormationIds = frontAssignments.map((a: any) => a.formation_id)
          const availableFormations = formations.filter((f2: any) => !assignedFormationIds.includes(f2.id))
          return (
            <Panel key={front.id} title={`${front.name} — ${myRole(front) === 'attacker' ? 'You are Attacking' : 'You are Defending'}`}>
              {/* Participants */}
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>Attackers: {(front.participants || []).filter((p: any) => p.side === 'attacker').map((p: any) => p.nation_name).join(', ') || front.attacker_name}</span>
                <span>Defenders: {(front.participants || []).filter((p: any) => p.side === 'defender').map((p: any) => p.nation_name).join(', ') || front.defender_name || '?'}</span>
              </div>

              {/* Status + Progress */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: 1,
                  color: STATUS_COLORS[front.status] || 'var(--text-dim)',
                  border: `1px solid ${STATUS_COLORS[front.status] || 'var(--border)'}`,
                  padding: '1px 6px', borderRadius: 2,
                }}>{front.status}</span>
                <ProgressBar current={front.progress || 0} max={front.max_progress || 10} />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Width: {front.front_width || 1}
                </span>
              </div>

              {/* Assigned formations */}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 6 }}>
                {frontAssignments.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', padding: '4px 0' }}>No formations assigned</div>
                ) : (
                  frontAssignments.map((a: any) => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <span style={{ color: 'var(--cyan-bright)' }}>{a.formation_name}</span>
                      <span style={{
                        fontSize: 10, color: 'var(--text-dim)',
                        border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 2,
                      }}>{a.formation_type}</span>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => handleUnassign(front.id, a.formation_id)} style={{
                        fontFamily: 'var(--sans)', fontSize: 10, padding: '1px 5px',
                        border: '1px solid var(--red-bright)', background: '#000',
                        color: 'var(--red-bright)', cursor: 'pointer',
                      }}>Remove</button>
                    </div>
                  ))
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                {assigningFrontId === front.id ? (
                  <>
                    <select value="" onChange={e => { if (e.target.value) handleAssign(front.id, e.target.value) }} style={{ ...selectStyle, fontSize: 12, padding: '2px 6px' }}>
                      <option value="">— Select formation —</option>
                      {availableFormations.map((f2: any) => (
                        <option key={f2.id} value={f2.id}>{f2.name} ({f2.type})</option>
                      ))}
                    </select>
                    <button onClick={() => setAssigningFrontId(null)} style={{
                      fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 6px',
                      border: '1px solid var(--border)', background: '#000', color: 'var(--text-dim)', cursor: 'pointer',
                    }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setAssigningFrontId(front.id)} style={{
                    fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 8px',
                    border: '1px solid var(--cyan)', background: 'rgba(0,255,255,0.05)',
                    color: 'var(--cyan-bright)', cursor: 'pointer',
                  }}>+ Assign Formation</button>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => handleRetreat(front.id)} disabled={retreating === front.id} style={{
                  fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 8px',
                  border: '1px solid var(--amber)', background: 'rgba(255,255,0,0.05)',
                  color: 'var(--amber-bright)', cursor: 'pointer',
                }}>{retreating === front.id ? 'Retreating...' : 'Retreat'}</button>
                <button onClick={() => handleLaunch(front.id)} disabled={launching === front.id} style={{
                  fontFamily: 'var(--sans)', fontSize: 11, padding: '4px 12px',
                  border: '1px solid var(--red-bright)', background: 'rgba(255,0,0,0.1)',
                  color: 'var(--red-bright)', cursor: 'pointer', textTransform: 'uppercase',
                }}>{launching === front.id ? 'Launching...' : '⚔ Test Battle'}</button>
              </div>
            </Panel>
          )
        })
      )}

      {/* Pending Fronts */}
      {myPendingFronts.length > 0 && (
        <Panel title="Pending Approval">
          {myPendingFronts.map((front: any) => {
            const atkNames = (front.participants || [])
              .filter((p: any) => p.side === 'attacker').map((p: any) => p.nation_name).join(', ')
            return (
              <div key={front.id} style={{
                display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--mono)', fontSize: 12,
              }}>
                <span style={{ color: STATUS_COLORS.pending, fontSize: 10, textTransform: 'uppercase', border: '1px solid var(--amber)', padding: '1px 6px', borderRadius: 2 }}>
                  {front.status}
                </span>
                <span style={{ color: 'var(--text-bright)' }}>{front.name}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  {atkNames || front.attacker_name}
                </span>
              </div>
            )
          })}
        </Panel>
      )}

      {/* Battle Result Modal */}
      <Modal open={!!battleResult} onClose={() => setBattleResult(null)} title="Battle Result" wide>
        {battleResult && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              padding: '8px 12px', border: '1px solid var(--border)',
              background: battleResult.battle.result === 'attacker_win' ? 'rgba(0,255,0,0.05)' :
                          battleResult.battle.result === 'defender_win' ? 'rgba(255,0,0,0.05)' : 'rgba(255,255,0,0.05)',
              color: RESULT_COLORS[battleResult.battle.result] || 'var(--text)',
              fontSize: 16, textTransform: 'uppercase', textAlign: 'center',
            }}>
              {battleResult.battle.result === 'attacker_win' ? 'Victory' :
               battleResult.battle.result === 'defender_win' ? 'Defeat' : 'Stalemate'}
            </div>
            {battleResult.log.map((line: string, i: number) => (
              <div key={i} style={{ color: 'var(--text-dim)' }}>{line}</div>
            ))}
            <div style={{ marginTop: 8 }}>
              <Button onClick={() => setBattleResult(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Incoming / Resolved Fronts */}
      {otherFronts.length > 0 && (
        <Panel title="Other Fronts">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {otherFronts.map((f: any) => {
              const atkNames = (f.participants || [])
                .filter((p: any) => p.side === 'attacker').map((p: any) => p.nation_name).join(', ')
              const defNames = (f.participants || [])
                .filter((p: any) => p.side === 'defender').map((p: any) => p.nation_name).join(', ')
              return (
                <div key={f.id} style={{
                  display: 'flex', gap: 8, padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center',
                }}>
                  <span style={{
                    fontSize: 10, textTransform: 'uppercase', color: STATUS_COLORS[f.status],
                    border: `1px solid ${STATUS_COLORS[f.status] || 'var(--border)'}`,
                    padding: '1px 6px', borderRadius: 2,
                  }}>{f.status}</span>
                  <span style={{ color: 'var(--cyan-bright)' }}>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    A:{atkNames || f.attacker_name || '?'}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    D:{defNames || f.defender_name || '?'}
                  </span>
                  {f.retreating_by && (
                    <span style={{ color: 'var(--amber-bright)', fontSize: 11 }}>(retreated)</span>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Battle History */}
      {battles.length > 0 && (
        <Panel title="Battle History">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {battles.map((b: any) => (
              <div key={b.id} style={{
                display: 'flex', gap: 8, padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', flexWrap: 'wrap',
              }}>
                <span style={{ color: 'var(--text-dim)', width: 80 }}>Turn {b.turn_number}</span>
                <span style={{ color: 'var(--cyan-bright)' }}>{b.front_name}</span>
                <span style={{ color: 'var(--text-dim)' }}>{b.defender_name ? `vs ${b.defender_name}` : ''}</span>
                <span style={{
                  color: RESULT_COLORS[b.result] || 'var(--text-dim)',
                  textTransform: 'uppercase', fontSize: 11,
                }}>
                  {b.result === 'attacker_win' ? 'Victory' : b.result === 'defender_win' ? 'Defeat' : 'Stalemate'}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  L:{b.attacker_losses} / D:{b.defender_losses}
                </span>
                {b.progress_before !== null && (
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    [{b.progress_before}→{b.progress_after}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Create Front Modal */}
      <Modal open={showFrontModal} onClose={() => setShowFrontModal(false)} title="Apply for New Front" wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Operation Name *</label>
            <input value={frontName} onChange={e => setFrontName(e.target.value)} style={inputStyle} placeholder="e.g. Operation Barbarossa" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>War / Campaign (optional)</label>
            <input value={warName} onChange={e => setWarName(e.target.value)} style={inputStyle} placeholder="e.g. Pacific Campaign" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowFrontModal(false)}>Cancel</Button>
            <Button onClick={handleCreateFront} disabled={!frontName.trim()}>Apply</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}