import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAccounts, getLedger, getTransfers, login } from '../api/client'
import { SkeletonCard, SkeletonTable } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import Badge from '../components/Badge'
import { formatINR, relativeTime } from '../utils/format'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Building2, ArrowLeftRight, ShieldCheck, TrendingUp } from 'lucide-react'

const KPI_CONFIG = {
  balance:   { color: '#3B82F6', glow: 'rgba(59,130,246,0.12)' },
  accounts:  { color: '#8B5CF6', glow: 'rgba(139,92,246,0.12)' },
  transfers: { color: '#06B6D4', glow: 'rgba(6,182,212,0.12)'  },
  session:   { color: '#10B981', glow: 'rgba(16,185,129,0.12)' },
}

function KpiCard({ id, label, value, sub, loading }) {
  const { color, glow } = KPI_CONFIG[id]
  if (loading) return <div className="skeleton" style={{ height: '88px', borderRadius: '8px' }} />
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${color}25`,
      borderTop: `2px solid ${color}`,
      borderRadius: '8px',
      padding: '14px 16px',
      boxShadow: `0 0 18px ${glow}`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: `radial-gradient(circle at top right, ${glow} 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.1em', color, marginBottom: '8px', fontWeight: 600 }}>{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>{sub}</div>}
    </div>
  )
}

const DEMO_USERS = [
  { label: 'Alice', username: 'alice', password: 'Alice#Dev2026', color: '#3B82F6' },
  { label: 'Bob',   username: 'bob',   password: 'Bob#Dev2026',   color: '#8B5CF6' },
]

export default function Overview() {
  const { auth, signin } = useAuth()
  const queryClient = useQueryClient()
  const [switching, setSwitching] = useState(null)
  const token = auth?.token
  const exp = auth?.claims?.exp
  const role = auth?.claims?.roles?.[0] ?? ''
  const user = auth?.claims?.sub ?? ''

  async function switchUser(u) {
    setSwitching(u.username)
    try {
      const { token: t } = await login(u.username, u.password)
      queryClient.clear()
      signin(t)
    } catch (_) {}
    setSwitching(null)
  }

  const accounts  = useQuery({ queryKey: ['accounts'],  queryFn: () => getAccounts(token)  })
  const transfers = useQuery({ queryKey: ['transfers'], queryFn: () => getTransfers(token) })
  const ledger    = useQuery({ queryKey: ['ledger'],    queryFn: () => getLedger(token)    })

  const totalBalance = accounts.data?.reduce((s, a) => s + (a.balance ?? 0), 0) ?? 0
  const txCount      = transfers.data?.length ?? 0
  const sessionLeft  = exp ? Math.max(0, Math.floor((exp - Date.now() / 1000) / 60)) : null
  const sessionDanger = sessionLeft !== null && sessionLeft < 5

  const chartData = (() => {
    if (!ledger.data) return []
    const byDate = {}
    ledger.data.forEach(e => {
      const d = e.created_at?.slice(0, 10)
      if (!d) return
      byDate[d] = (byDate[d] ?? 0) + Math.abs(e.amount ?? 0)
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, volume]) => ({ date: date.slice(5), volume }))
  })()

  const recentTransfers = transfers.data?.slice(0, 8) ?? []

  if (accounts.error) return <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Page description */}
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '4px' }}>Overview</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Your financial dashboard. View real-time account balances, recent transfers, and session status. All data is scoped exclusively to your account.
        </p>
      </div>

      {/* Status bar */}
      <div style={{
        background: '#080A0D', border: '1px solid #161B26', borderRadius: '6px',
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '18px',
        fontFamily: 'monospace', fontSize: '11px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3FB950', boxShadow: '0 0 6px rgba(63,185,80,0.7)' }} />
          <span style={{ color: '#3FB950', letterSpacing: '0.08em', fontWeight: 700 }}>LIVE</span>
        </div>
        {[['user', user], ['role', role], ['rls', 'enabled'], ['alg', 'HS256']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '4px' }}>
            <span style={{ color: '#3A4255' }}>{k}:</span>
            <span style={{ color: '#79C0FF' }}>{v}</span>
          </div>
        ))}
        {exp && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <span style={{ color: '#3A4255' }}>exp:</span>
            <span style={{ color: sessionDanger ? '#EF4444' : '#3A4255' }}>{sessionLeft !== null ? `${sessionLeft}m` : ''}</span>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <KpiCard id="balance"   label="TOTAL BALANCE"  value={formatINR(totalBalance)} sub={`${accounts.data?.length ?? 0} accounts`} loading={accounts.isLoading} />
        <KpiCard id="accounts"  label="ACCOUNTS"       value={accounts.data?.length ?? 0} sub="active" loading={accounts.isLoading} />
        <KpiCard id="transfers" label="TRANSFERS"      value={txCount} sub="all time" loading={transfers.isLoading} />
        <KpiCard id="session"   label="SESSION"        value={sessionLeft !== null ? `${sessionLeft}m` : 'active'} sub={sessionDanger ? 'expiring soon' : 'remaining'} loading={false} />
      </div>

      {/* RLS Demo switcher */}
      <div className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #3FB950' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>Live RLS Demonstration</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Switch users instantly to see Row-Level Security in action. The same query returns only that user's accounts.</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.username}
                className="btn btn-secondary"
                onClick={() => switchUser(u)}
                disabled={!!switching || auth?.claims?.sub === u.username}
                style={{
                  borderColor: auth?.claims?.sub === u.username ? u.color : undefined,
                  color: auth?.claims?.sub === u.username ? u.color : undefined,
                  fontWeight: auth?.claims?.sub === u.username ? 600 : undefined,
                  minWidth: '80px', justifyContent: 'center',
                }}
              >
                {switching === u.username ? 'Switching...' : u.label}
                {auth?.claims?.sub === u.username && ' ✓'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account cards */}
      <div>
        <div className="section-title">Accounts</div>
        {accounts.isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <SkeletonCard height="80px" /><SkeletonCard height="80px" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {accounts.data?.map(acc => (
              <div key={acc.account_number} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: '3px solid #3B82F6', borderRadius: '8px', padding: '12px 14px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(59,130,246,0.03) 0%, transparent 60%)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Savings Account</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#79C0FF' }}>{acc.account_number}</div>
                  </div>
                  <Badge variant={acc.status === 'ACTIVE' ? 'success' : 'neutral'}>{acc.status ?? 'ACTIVE'}</Badge>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(acc.balance ?? 0)}</div>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '2px' }}>{acc.currency ?? 'INR'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <TrendingUp size={13} style={{ color: '#3B82F6' }} />
            <span className="section-title" style={{ marginBottom: 0 }}>Ledger volume · 14d</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#3A4255', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#3A4255', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={56} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#080A0D', border: '1px solid #1E2230', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                labelStyle={{ color: '#79C0FF' }}
                formatter={v => [formatINR(v), 'volume']}
              />
              <Area type="monotone" dataKey="volume" stroke="#3B82F6" strokeWidth={2} fill="url(#vol)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent transfers */}
      <div>
        <div className="section-title">Recent transfers</div>
        {transfers.isLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table-root" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '30%' }} /><col style={{ width: '30%' }} />
                <col style={{ width: '22%' }} /><col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr><th>From</th><th>To</th><th style={{ textAlign: 'right' }}>Amount</th><th>Time</th></tr>
              </thead>
              <tbody>
                {recentTransfers.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontFamily: 'monospace', fontSize: '14px' }}>No transfers yet</td></tr>
                ) : recentTransfers.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: t.from_account_number ? '#79C0FF' : 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.from_account_number ?? 'external'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', color: t.to_account_number ? 'var(--text-secondary)' : 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.to_account_number ?? 'external'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatINR(t.amount)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{relativeTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Protection card */}
      <div className="card" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>Session security</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[['User', user], ['Role', role], ['Expires', exp ? new Date(exp * 1000).toLocaleTimeString() : 'N/A']].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>{k}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
