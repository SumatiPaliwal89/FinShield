import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getAccounts, getLedger } from '../api/client'
import { SkeletonTable } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import Badge from '../components/Badge'
import Drawer from '../components/Drawer'
import { formatINR, relativeTime, formatDateTime } from '../utils/format'
import { Building2 } from 'lucide-react'

function AccountDrawer({ account, onClose }) {
  const { auth } = useAuth()
  const ledger = useQuery({
    queryKey: ['ledger', auth?.claims?.sub, account?.account_number],
    queryFn: () => getLedger(auth.token),
    enabled: !!account,
  })

  const entries = (ledger.data ?? []).filter(
    e => e.account_number === account?.account_number
  )

  return (
    <Drawer isOpen={!!account} onClose={onClose} title={`Account ${account?.account_number ?? ''}`}>
      {account && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card-flat" style={{ padding: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                ['Balance', formatINR(account.balance)],
                ['Currency', account.currency ?? 'INR'],
                ['Status', account.status ?? 'Active'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ledger ({entries.length})</div>
            {ledger.isLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
            ) : entries.length === 0 ? (
              <EmptyState title="No ledger entries" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {entries.slice(0, 20).map((e, i) => (
                  <div key={e.id ?? i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'var(--surface)',
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{e.entryType ?? e.entry_type ?? ''}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{relativeTime(e.createdAt ?? e.created_at)}</div>
                    </div>
                    <div className="tabular" style={{
                      fontSize: '13px', fontWeight: 500,
                      color: (e.entryType ?? e.entry_type) === 'DEBIT' ? 'var(--danger)' : 'var(--accent)',
                    }}>
                      {(e.entryType ?? e.entry_type) === 'DEBIT' ? '-' : '+'}{formatINR(Math.abs(e.amount ?? 0))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

export default function Accounts() {
  const { auth } = useAuth()
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts', auth?.claims?.sub],
    queryFn: () => getAccounts(auth.token),
    enabled: !!auth?.token,
  })

  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <>
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Accounts</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            View all accounts associated with your profile. Click any account to explore its full transaction history.
          </p>
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table-root">
              <thead>
                <tr>
                  <th>Account Number</th>
                  <th>Currency</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(!data || data.length === 0) ? (
                  <tr><td colSpan={4}><EmptyState icon={Building2} title="No accounts" /></td></tr>
                ) : data.map(acc => (
                  <tr key={acc.account_number} style={{ cursor: 'pointer' }} onClick={() => setSelected(acc)}>
                    <td style={{ fontFamily: 'monospace', fontSize: '14px', color: '#79C0FF', whiteSpace: 'nowrap' }}>{acc.account_number}</td>
                    <td style={{ fontSize: '14px' }}>{acc.currency ?? 'INR'}</td>
                    <td className="tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(acc.balance)}</td>
                    <td><Badge variant={acc.status === 'ACTIVE' ? 'success' : 'neutral'}>{acc.status ?? 'Active'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>{data.length} account{data.length !== 1 ? 's' : ''} found</div>}
      </div>

      <AccountDrawer account={selected} onClose={() => setSelected(null)} />
    </>
  )
}
