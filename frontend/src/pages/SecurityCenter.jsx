import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { verifyChain, anchorCheck } from '../api/client'
import ErrorState from '../components/ErrorState'
import Badge from '../components/Badge'
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle, XCircle, Database, Key, Eye, Lock } from 'lucide-react'
import { formatDateTime } from '../utils/format'

const ANCHOR_ID   = '1'
const ANCHOR_HASH = import.meta.env.VITE_ANCHOR_HASH ?? ''

const CONTROLS = [
  { id: 'rls',         label: 'Row-Level Security',      desc: 'Every query is automatically filtered to your account only', icon: Lock },
  { id: 'role',        label: 'Least-Privilege Roles',   desc: 'The app never runs with admin database credentials', icon: Key },
  { id: 'appendonly',  label: 'Append-Only Audit Log',   desc: 'Audit records cannot be edited or deleted once written', icon: Database },
  { id: 'jwt',         label: 'JWT Authentication',      desc: 'Every request is verified with a signed token that expires after 1 hour', icon: Key },
  { id: 'headers',     label: 'Security Headers',        desc: 'HTTP responses include headers that prevent clickjacking and MIME sniffing', icon: ShieldCheck },
]

export default function SecurityCenter() {
  const { auth } = useAuth()
  const [verifyTime, setVerifyTime] = useState(null)
  const [hasRun, setHasRun] = useState(false)

  const verify = useQuery({
    queryKey: ['audit-verify'],
    queryFn: async () => {
      const r = await verifyChain(auth.token)
      setVerifyTime(new Date().toISOString())
      return r
    },
    enabled: false,
  })

  function runVerify() {
    setHasRun(true)
    verify.refetch()
  }

  const anchor = useQuery({
    queryKey: ['anchor-check'],
    queryFn: () => anchorCheck(auth.token, ANCHOR_ID, ANCHOR_HASH),
    enabled: !!ANCHOR_HASH,
  })

  const chainOk = verify.data?.valid !== false && !verify.error
  const eventCount = verify.data?.eventCount ?? verify.data?.count ?? '—'
  const brokenId = verify.data?.firstInvalidId ?? verify.data?.brokenEventId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Security Center</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
          Verify the integrity of the security audit log. Run a live chain verification to confirm all audit records are intact and unmodified since they were created.
        </p>
      </div>

      {/* Chain status banner */}
      {verify.isFetching ? (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="skeleton" style={{ height: '20px', width: '60%' }} />
        </div>
      ) : (
        <div className="card" style={{
          padding: '14px 16px',
          background: !hasRun ? 'var(--bg)' : chainOk ? 'var(--accent-light)' : 'var(--danger-light)',
          borderColor: !hasRun ? 'var(--border)' : chainOk ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!hasRun
                ? <ShieldCheck size={20} style={{ color: 'var(--text-muted)' }} />
                : chainOk
                  ? <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                  : <ShieldAlert size={20} style={{ color: 'var(--danger)' }} />
              }
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: !hasRun ? 'var(--text-secondary)' : chainOk ? 'var(--accent)' : 'var(--danger)' }}>
                  {!hasRun ? 'Not yet verified. Click Verify now to check.' : chainOk ? 'Audit chain intact' : 'Audit chain compromised'}
                </div>
                <div style={{ fontSize: '12px', color: chainOk ? 'var(--text-secondary)' : 'var(--danger)', opacity: 0.8, marginTop: '1px' }}>
                  {eventCount !== '—' ? `${eventCount} events` : ''}{verifyTime ? `, verified at ${new Date(verifyTime).toLocaleTimeString()}` : ''}
                  {brokenId && ` · broken event id: `}
                  {brokenId && <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{brokenId}</code>}
                </div>
                {hasRun && chainOk && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Every SHA-256 hash was recomputed from scratch and matches. No event has been modified, deleted, or reordered since it was written.
                  </div>
                )}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={runVerify}
              disabled={verify.isFetching}
              style={{ fontSize: '14px' }}
            >
              <RefreshCw size={13} className={verify.isFetching ? 'animate-spin' : ''} />
              {verify.isFetching ? 'Verifying…' : 'Verify now'}
            </button>
          </div>
        </div>
      )}

      {/* Controls status */}
      <div>
        <div className="section-title">Security controls</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {CONTROLS.map((ctrl, i) => {
            const Icon = ctrl.icon
            return (
              <div key={ctrl.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                borderBottom: i < CONTROLS.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{ctrl.label}</div>
                  <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '1px' }}>{ctrl.desc}</div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
            )
          })}
        </div>
      </div>

      {/* Anchor check */}
      <div>
        <div className="section-title">External anchor check</div>
        <div className="card" style={{ padding: '14px 16px' }}>
          {!ANCHOR_HASH ? (
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              External anchor verification is not configured for this deployment.
            </div>
          ) : anchor.isLoading ? (
            <div className="skeleton" style={{ height: '16px', width: '50%' }} />
          ) : anchor.error ? (
            <ErrorState message={anchor.error.message} onRetry={() => anchor.refetch()} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {anchor.data?.match
                ? <CheckCircle size={16} style={{ color: 'var(--accent)' }} />
                : <XCircle size={16} style={{ color: 'var(--danger)' }} />
              }
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: anchor.data?.match ? 'var(--accent)' : 'var(--danger)' }}>
                  {anchor.data?.match ? 'Anchor matches' : 'Anchor mismatch: possible replay attack'}
                </div>
                <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  id={ANCHOR_ID} hash={ANCHOR_HASH.slice(0, 16)}…
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
