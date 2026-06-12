import { useState, useMemo } from 'react'

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  pageSize?: number
}

export function DataTable<T extends Record<string, any>>({
  columns, data, keyField, onRowClick, emptyMessage = 'No data', pageSize = 50,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter) return data
    const lower = filter.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(lower)
      })
    )
  }, [data, filter, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="Filter..."
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(0) }}
          style={{
            flex: 1, padding: '4px 8px', background: '#000', border: '1px solid var(--border)',
            color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none',
          }}
        />
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          {sorted.length} result{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                  style={{
                    textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)',
                    color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 12,
                    letterSpacing: 0.5, cursor: col.sortable !== false ? 'pointer' : 'default',
                    whiteSpace: 'nowrap', width: col.width,
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map(row => (
                <tr
                  key={row[keyField]}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = 'rgba(0,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                      {col.render ? col.render(row) : row[col.key] ?? <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '2px 10px', background: '#000', border: '1px solid var(--border)',
              color: page === 0 ? 'var(--text-dim)' : 'var(--text)', cursor: page === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--mono)', fontSize: 13,
            }}
          >Prev</button>
          <span style={{ color: 'var(--text-dim)', fontSize: 13, padding: '3px 8px' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '2px 10px', background: '#000', border: '1px solid var(--border)',
              color: page >= totalPages - 1 ? 'var(--text-dim)' : 'var(--text)', cursor: page >= totalPages - 1 ? 'default' : 'pointer',
              fontFamily: 'var(--mono)', fontSize: 13,
            }}
          >Next</button>
        </div>
      )}
    </div>
  )
}
