import { useEffect, useState, useCallback } from 'react'
import { getAdminPlayers, updatePlayer, deletePlayer, getAdminNations } from '../../services/adminApi'
import { DataTable, Modal, Panel, Button, FlexCol, FlexRow, InputField, SelectField } from '../../components/ui'
import { inputStyle, btnStyle } from '../../components/ui/FormStyles'

export function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [nations, setNations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [selectedNation, setSelectedNation] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      getAdminPlayers().then(({ players }) => setPlayers(players)),
      getAdminNations().then(({ nations }) => setNations(nations)),
    ]).catch((e: any) => console.error(e)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openEdit(player: any) {
    setEditTarget(player)
    setNewPassword('')
    setSelectedNation(player.nation_id || '')
  }

  async function handleSave() {
    if (!editTarget) return
    const data: Record<string, any> = {}
    if (newPassword) data.password = newPassword
    data.nation_id = selectedNation || null
    await updatePlayer(editTarget.id, data)
    setEditTarget(null)
    fetch()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this player?')) return
    await deletePlayer(id)
    fetch()
  }

  const columns = [
    { key: 'username', label: 'Username' },
    { key: 'nation_name', label: 'Nation', render: (row: any) => row.nation_name || <span style={{ color: 'var(--text-dim)' }}>—</span> },
    { key: 'created_at', label: 'Created', render: (row: any) => new Date(row.created_at).toLocaleDateString() },
    { key: 'actions', label: 'Actions', sortable: false, render: (row: any) => (
      <FlexRow gap={4}>
        <button onClick={e => { e.stopPropagation(); openEdit(row) }} style={btnStyle}>Edit</button>
        <button onClick={e => { e.stopPropagation(); handleDelete(row.id) }}
          style={{ ...btnStyle, color: 'var(--red-bright)', borderColor: 'var(--red-bright)' }}>Del</button>
      </FlexRow>
    )},
  ]

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading players...</div>

  return (
    <FlexCol gap={16}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
        Players
      </div>
      <Panel>
        <DataTable columns={columns} data={players} keyField="id" />
      </Panel>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Player">
        {editTarget && (
          <FlexCol gap={10} style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
            <div style={{ color: 'var(--text)', padding: '4px 0' }}>
              Username: <strong>{editTarget.username}</strong>
            </div>
            <InputField label="New Password (leave blank to keep)" type="password" value={newPassword} onChange={setNewPassword} placeholder="Enter new password" />
            <SelectField label="Assigned Nation" value={selectedNation} onChange={setSelectedNation}>
              <option value="">— None —</option>
              {nations.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </SelectField>
            <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </FlexRow>
          </FlexCol>
        )}
      </Modal>
    </FlexCol>
  )
}
