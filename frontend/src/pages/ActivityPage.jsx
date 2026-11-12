import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getLedger } from '../api/client'
import { SkeletonTable } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { formatINR, relativeTime, formatDateTime } from '../utils/format'
import { Download, Search, Activity } from 'lucide-react'

export default function ActivityPage() {
  const { auth } = useAuth()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => getLedger(auth.token),
  })

  const entryTypes = useMemo(() => {
    if (!data) return []
    return ['ALL', ...new Set(data.map(e => e.entry_type).filter(Boolean))]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter(e => {
      const type = e.entry_type ?? ''
      if (typeFilter !== 'ALL' && type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          String(e.id).includes(s) ||
          String(e.account_number ?? '').toLowerCase().includes(s) ||
          type.toLowerCase().includes(s) ||
          String(e.amount).includes(s)
        )
      }
      return true
    })
  }, [data, search, typeFilter])

  function exportCSV() {
    const cols = ['id', 'account_number', 'entry_type', 'amount', 'created_at']
    const rows = filtered.map(e => cols.map(c => {
      const v = e[c] ?? ''
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(','))
    const csv = [cols.join(','), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'ledger.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Activity</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
          A complete record of every transaction movement on your accounts. Each entry is permanently recorded and cannot be changed or deleted.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search entries…"
            style={{ paddingLeft: '30px' }}
          />
        </div>
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 'auto', flex: '0 0 auto' }}>
          {entryTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={exportCSV} disabled={!filtered.length}>
          <Download size={14} /> CSV
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table-root" style={{ position: 'relative', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th>ID</th>
                <th>Account</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={Activity} title="No entries" message={search ? 'Try a different search' : 'No ledger entries yet'} /></td></tr>
              ) : filtered.map(e => {
                const amount = e.amount ?? 0
                const acct = e.account_number ?? ''
                const type = e.entry_type ?? 'ENTRY'
                const ts = e.created_at
                return (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-muted)' }}>{e.id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: '#79C0FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct}</td>
                    <td style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: type === 'DEBIT' ? 'var(--danger)' : 'var(--accent)' }}>
                      {type === 'DEBIT' ? '-' : '+'}{formatINR(Math.abs(amount))}
                    </td>
                    <td title={formatDateTime(ts)} style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'default', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {relativeTime(ts)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && (
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {data && filtered.length !== data.length && ` (filtered from ${data.length})`}
        </div>
      )}
    </div>
  )
}
