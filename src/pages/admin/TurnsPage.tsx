import { useEffect, useState, useCallback } from 'react'
import { getAdminTurns } from '../../services/adminApi'
import { DataTable, Panel, FlexCol, Badge } from '../../components/ui'

export function TurnsPage() {
  const [turns, setTurns] = useState<any[]>([])

  const fetch = useCallback(() => {
    getAdminTurns().then(({ turns }) => setTurns(turns)).catch((e: any) => console.error(e))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const columns = [
    { key: 'number', label: 'Turn #' },
    { key: 'status', label: 'Status', render: (row: any) => (
      <Badge label={row.status} variant={row.status === 'open' ? 'success' : 'default'} />
    )},
    { key: 'deadline', label: 'Deadline', render: (row: any) => new Date(row.deadline).toLocaleString() },
    { key: 'processed_at', label: 'Processed', render: (row: any) =>
      row.processed_at ? new Date(row.processed_at).toLocaleString() : <span style={{ color: 'var(--text-dim)' }}>—</span>
    },
  ]

  return (
    <FlexCol gap={16}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
        Turn History
      </div>

      <Panel title="All Turns">
        <DataTable columns={columns} data={turns} keyField="id" />
      </Panel>
    </FlexCol>
  )
}
