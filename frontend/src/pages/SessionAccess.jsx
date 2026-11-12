import { useAuth } from '../context/AuthContext'
import { decodeJwt } from '../api/client'
import { formatDateTime } from '../utils/format'
import Badge from '../components/Badge'
import { KeyRound, ShieldCheck, User, Clock } from 'lucide-react'

const PROTECTIONS = [
  { label: 'Token Verification',     desc: 'Your session token is verified on every request before anything is returned' },
  { label: 'Data Isolation',         desc: 'Your account data is automatically scoped to your identity at the database level' },
  { label: 'Stateless Session',      desc: 'No session data is stored on the server — your token is the only credential' },
  { label: 'Role-Based Access',      desc: 'Auditors and customers have different permissions enforced on every endpoint' },
  { label: 'Immutable Audit Log',    desc: 'All transfers are permanently logged and cannot be altered after the fact' },
]

function Field({ label, value, mono = false }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: mono ? '12px' : '14px', fontFamily: mono ? 'monospace' : undefined, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
        {value ?? 'unknown'}
      </div>
    </div>
  )
}

export default function SessionAccess() {
  const { auth } = useAuth()
  const token = auth?.token ?? ''
  const claims = auth?.claims ?? {}

  const parts = token ? token.split('.') : ['', '', '']
  const [header, payload, sig] = parts
  const headerDecoded = (() => { try { return JSON.parse(atob((header ?? '').replace(/-/g,'+').replace(/_/g,'/'))) } catch { return {} } })()

  const isAuditor = claims.roles?.includes('AUDITOR')
  const exp = claims.exp ? new Date(claims.exp * 1000) : null
  const iat = claims.iat ? new Date(claims.iat * 1000) : null
  const expired = exp && exp < new Date()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Session & Access</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
          Inspect your current session details, JWT token claims, role permissions, and the security controls active for your account.
        </p>
      </div>

      {/* JWT Inspector */}
      <div>
        <div className="section-title">JWT</div>
        <div className="card" style={{ padding: '16px' }}>
          <div>
            <Field label="Subject (sub)" value={claims.sub} />
            <Field label="Roles" value={claims.roles?.join(', ')} />
            <Field label="Issued At" value={iat ? formatDateTime(iat.toISOString()) : 'unknown'} />
            <Field label="Expires" value={exp ? formatDateTime(exp.toISOString()) : 'unknown'} />
            <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Status</div>
              <Badge variant={expired ? 'danger' : 'success'} dot>{expired ? 'Expired' : 'Valid'}</Badge>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Header</div>
            <div className="terminal" style={{ fontSize: '11px', padding: '8px 10px' }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(headerDecoded, null, 2)}</pre>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Payload</div>
            <div className="terminal" style={{ fontSize: '11px', padding: '8px 10px' }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(claims, null, 2)}</pre>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Signature (base64url)</div>
            <div className="terminal" style={{ fontSize: '11px', padding: '8px 10px', wordBreak: 'break-all' }}>
              {sig ?? 'not available'}
            </div>
          </div>
        </div>
      </div>

      {/* Role */}
      <div>
        <div className="section-title">Role & permissions</div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <User size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{claims.sub ?? 'unknown'}</div>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isAuditor ? 'finshield_auditor' : 'finshield_app'}
              </div>
            </div>
            <Badge variant={isAuditor ? 'warning' : 'info'}>{isAuditor ? 'AUDITOR' : 'CUSTOMER'}</Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              ['View own accounts', true],
              ['Transfer funds', !isAuditor],
              ['View own ledger', true],
              ['View audit events', isAuditor],
              ['Verify audit chain', isAuditor],
              ['Access Security Center', isAuditor],
            ].map(([perm, allowed]) => (
              <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <ShieldCheck size={14} style={{ color: allowed ? 'var(--accent)' : 'var(--text-disabled)', flexShrink: 0 }} />
                <span style={{ color: allowed ? 'var(--text-primary)' : 'var(--text-disabled)' }}>{perm}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active protections */}
      <div>
        <div className="section-title">Active protections</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {PROTECTIONS.map((p, i) => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '11px 16px',
              borderBottom: i < PROTECTIONS.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <KeyRound size={14} style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '1px' }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
