import { useEffect, useState, useCallback } from 'react'
import { getAdminOrders, getAdminNations, getAdminTurns } from '../../services/adminApi'
import { DataTable, Panel, FlexCol, FlexRow } from '../../components/ui'
import { inputStyle, selectStyle } from '../../components/ui/FormStyles'

export function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [nations, setNations] = useState<any[]>([])
  const [turns, setTurns] = useState<any[]>([])
  const [filterNation, setFilterNation] = useState('')
  const [filterTurn, setFilterTurn] = useState('')

  const fetch = useCallback(() => {
    Promise.all([
      getAdminOrders(filterTurn || undefined, filterNation || undefined).then(({ orders }) => setOrders(orders)),
      getAdminNations().then(({ nations }) => setNations(nations)),
      getAdminTurns().then(({ turns }) => setTurns(turns)),
    ]).catch((e: any) => console.error(e))
  }, [filterNation, filterTurn])

  useEffect(() => { fetch() }, [fetch])

  const columns = [
    { key: 'turn_number', label: 'Turn' },
    { key: 'nation_name', label: 'Nation' },
    { key: 'type', label: 'Type' },
    { key: 'target_id', label: 'Target ID', render: (row: any) => row.target_id || <span style={{ color: 'var(--text-dim)' }}>—</span> },
    { key: 'payload', label: 'Payload', render: (row: any) => row.payload ? (
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', wordBreak: 'break-all' }}>
        {row.payload.length > 80 ? row.payload.slice(0, 80) + '...' : row.payload}
      </span>
    ) : <span style={{ color: 'var(--text-dim)' }}>—</span> },
  ]

  return (
    <FlexCol gap={16}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
        Orders Viewer
      </div>

      <FlexRow gap={12} style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
        <FlexRow gap={6} style={{ alignItems: 'center' }}>
          <label style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 }}>Turn:</label>
          <select value={filterTurn} onChange={e => setFilterTurn(e.target.value)} style={selectStyle}>
            <option value="">All</option>
            {turns.map((t: any) => (
              <option key={t.id} value={t.id}>Turn {t.number}</option>
            ))}
          </select>
        </FlexRow>
        <FlexRow gap={6} style={{ alignItems: 'center' }}>
          <label style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 }}>Nation:</label>
          <select value={filterNation} onChange={e => setFilterNation(e.target.value)} style={selectStyle}>
            <option value="">All</option>
            {nations.map((n: any) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </FlexRow>
      </FlexRow>

      <Panel>
        <DataTable columns={columns} data={orders} keyField="id" emptyMessage="No orders found." />
      </Panel>
    </FlexCol>
  )
}
