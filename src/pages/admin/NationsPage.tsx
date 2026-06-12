import { useEffect, useState, useCallback } from 'react'
import { getAdminNations, updateNation, deleteNation } from '../../services/adminApi'
import { DataTable, Modal, Panel, Button, FlexCol, FlexRow, SpaceBetween, InputField } from '../../components/ui'
import { inputStyle, btnStyle } from '../../components/ui/FormStyles'
import { fmtMoney } from '../../utils/format'

export function NationsPage() {
  const [nations, setNations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})

  const fetch = useCallback(() => {
    setLoading(true)
    getAdminNations().then(({ nations }) => setNations(nations)).catch((e: any) => console.error(e)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openEdit(nation: any) {
    setEditTarget(nation)
    setEditForm({ ...nation })
  }

  async function handleSave() {
    if (!editTarget) return
    await updateNation(editTarget.id, editForm)
    setEditTarget(null)
    fetch()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this nation? This cannot be undone.')) return
    await deleteNation(id)
    fetch()
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'leader_name', label: 'Leader' },
    { key: 'population', label: 'Population', render: (row: any) => (row.population / 1000000).toFixed(0) + 'M' },
    { key: 'qol', label: 'QoL' },
    { key: 'gdp', label: 'Treasury', render: (row: any) => fmtMoney(row.gdp) },
    { key: 'production_units', label: 'Prod Units' },
    { key: 'player_username', label: 'Player' },
    { key: 'actions', label: 'Actions', sortable: false, render: (row: any) => (
      <FlexRow gap={4}>
        <button onClick={e => { e.stopPropagation(); openEdit(row) }}
          style={btnStyle}>Edit</button>
        <button onClick={e => { e.stopPropagation(); handleDelete(row.id) }}
          style={{ ...btnStyle, color: 'var(--red-bright)', borderColor: 'var(--red-bright)' }}>Del</button>
      </FlexRow>
    )},
  ]

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading nations...</div>

  return (
    <FlexCol gap={16}>
      <SpaceBetween>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
          Nations
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)' }}>{nations.length} total</span>
      </SpaceBetween>
      <Panel>
        <DataTable columns={columns} data={nations} keyField="id" />
      </Panel>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Nation" wide>
        {editTarget && (
          <FlexCol gap={10} style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
            {['name', 'leader_name', 'population', 'qol', 'gdp', 'production_units', 'flag_url', 'leader_picture'].map(field => (
              <InputField key={field} label={field === 'gdp' ? 'Treasury' : field} value={editForm[field] ?? ''} onChange={v => setEditForm(f => ({ ...f, [field]: v }))} />
            ))}
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
