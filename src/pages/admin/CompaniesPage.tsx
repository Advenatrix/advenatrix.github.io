import { useEffect, useState, useCallback } from 'react'
import { getAdminCompanies, updateCompany, createCompany, deleteCompany, getAdminNations } from '../../services/adminApi'
import { DataTable, Modal, Panel, Button, FlexCol, FlexRow, SpaceBetween, InputField, SelectField } from '../../components/ui'
import { btnStyle } from '../../components/ui/FormStyles'

export function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [nations, setNations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [createForm, setCreateForm] = useState<Record<string, any>>({})

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      getAdminCompanies().then(({ companies }) => setCompanies(companies)),
      getAdminNations().then(({ nations }) => setNations(nations)),
    ]).catch((e: any) => console.error(e)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openEdit(company: any) {
    setEditTarget(company)
    setEditForm({ ...company })
  }

  async function handleSave() {
    if (!editTarget) return
    await updateCompany(editTarget.id, {
      name: editForm.name,
      profit: parseInt(editForm.profit),
      subsidies: parseInt(editForm.subsidies),
    })
    setEditTarget(null)
    fetch()
  }

  async function handleCreate() {
    await createCompany({
      name: createForm.name,
      nation_id: createForm.nation_id,
      profit: parseInt(createForm.profit) || 0,
      subsidies: parseInt(createForm.subsidies) || 0,
    })
    setCreateOpen(false)
    setCreateForm({})
    fetch()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this company?')) return
    await deleteCompany(id)
    fetch()
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'nation_name', label: 'Nation' },
    { key: 'profit', label: 'Profit', render: (row: any) => '$' + row.profit.toLocaleString() },
    { key: 'subsidies', label: 'Subsidies', render: (row: any) => '$' + row.subsidies.toLocaleString() },
    { key: 'actions', label: 'Actions', sortable: false, render: (row: any) => (
      <FlexRow gap={4}>
        <button onClick={e => { e.stopPropagation(); openEdit(row) }} style={btnStyle}>Edit</button>
        <button onClick={e => { e.stopPropagation(); handleDelete(row.id) }}
          style={{ ...btnStyle, color: 'var(--red-bright)', borderColor: 'var(--red-bright)' }}>Del</button>
      </FlexRow>
    )},
  ]

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading companies...</div>

  return (
    <FlexCol gap={16}>
      <SpaceBetween>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
          Companies
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Company</Button>
      </SpaceBetween>
      <Panel>
        <DataTable columns={columns} data={companies} keyField="id" />
      </Panel>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Company">
        {editTarget && (
          <FlexCol gap={10} style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
            <InputField label="Name" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
            <InputField label="Profit" value={editForm.profit} onChange={v => setEditForm(f => ({ ...f, profit: v }))} />
            <InputField label="Subsidies" value={editForm.subsidies} onChange={v => setEditForm(f => ({ ...f, subsidies: v }))} />
            <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </FlexRow>
          </FlexCol>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Company">
        <FlexCol gap={10} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
          <SelectField label="Nation" value={createForm.nation_id || ''} onChange={v => setCreateForm(f => ({ ...f, nation_id: v }))}>
            <option value="">Select nation</option>
            {nations.map((n: any) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </SelectField>
          <InputField label="Name" value={createForm.name || ''} onChange={v => setCreateForm(f => ({ ...f, name: v }))} />
          <InputField label="Profit" value={createForm.profit ?? 0} onChange={v => setCreateForm(f => ({ ...f, profit: v }))} />
          <InputField label="Subsidies" value={createForm.subsidies ?? 0} onChange={v => setCreateForm(f => ({ ...f, subsidies: v }))} />
          <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </FlexRow>
        </FlexCol>
      </Modal>
    </FlexCol>
  )
}
