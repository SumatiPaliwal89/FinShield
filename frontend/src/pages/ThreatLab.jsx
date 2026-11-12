import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { labSqliVuln, labSqliFixed, labBolaVuln, labBolaFixed, labJwtTamper } from '../api/client'
import Badge from '../components/Badge'
import { FlaskConical, Play, Shield, ShieldAlert, XCircle, CheckCircle } from 'lucide-react'

// exploitStatus: 'success' | 'blocked' | 'empty' | null
function TerminalPanel({ lines = [], loading, exploitStatus = null }) {
  return (
    <div>
      <div className="terminal" style={{ minHeight: '140px', maxHeight: '220px', overflowY: 'auto' }}>
        {loading && <div className="t-dim">Running…</div>}
        {lines.length === 0 && !loading && <div className="t-dim">awaiting run</div>}
        {lines.map((l, i) => (
          <div key={i} className={l.cls ?? ''}>{l.text}</div>
        ))}
      </div>
      {!loading && exploitStatus === 'success' && (
        <div style={{
          marginTop: '8px', padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <XCircle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#EF4444' }}>Exploit succeeded — sensitive data was returned</span>
        </div>
      )}
      {!loading && exploitStatus === 'blocked' && (
        <div style={{
          marginTop: '8px', padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>Attack blocked — request rejected with {lines.find(l => l.cls === 't-error')?.text ?? '4xx'}</span>
        </div>
      )}
      {!loading && exploitStatus === 'empty' && (
        <div style={{
          marginTop: '8px', padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B' }}>Mitigated — endpoint returned empty response</span>
        </div>
      )}
      {!loading && exploitStatus === 'own' && (
        <div style={{
          marginTop: '8px', padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>Isolated — returns your own data only, never another user's</span>
        </div>
      )}
    </div>
  )
}

function getStatus(status, data) {
  if (status >= 400) return 'blocked'
  const hasData = Array.isArray(data) ? data.length > 0 : (data && typeof data === 'object' && Object.keys(data).length > 0)
  return hasData ? 'success' : 'empty'
}

function SplitLab({ title, vulnLabel, fixedLabel, onRunVuln, onRunFixed, vulnResult, fixedResult, loadingVuln, loadingFixed, disabled, vulnStatus, fixedStatus }) {
  return (
    <div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Vulnerable */}
        <div style={{
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px',
          overflow: 'hidden', background: 'var(--surface)',
          boxShadow: '0 0 20px rgba(239,68,68,0.06)',
        }}>
          <div style={{
            padding: '11px 14px', borderBottom: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(239,68,68,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={14} style={{ color: '#EF4444' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444', letterSpacing: '0.02em' }}>VULNERABLE</span>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
              color: '#EF4444', background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)', padding: '2px 7px', borderRadius: '3px',
            }}>ATTACK</span>
          </div>
          <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', lineHeight: 1.6 }}>
            {vulnLabel}
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-danger" onClick={onRunVuln} disabled={disabled || loadingVuln}
              style={{ fontSize: '13px', width: '100%', justifyContent: 'center' }}>
              <Play size={13} /> {loadingVuln ? 'Running…' : 'Run exploit'}
            </button>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <TerminalPanel lines={vulnResult} loading={loadingVuln} exploitStatus={vulnStatus} />
          </div>
        </div>

        {/* Fixed */}
        <div style={{
          border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px',
          overflow: 'hidden', background: 'var(--surface)',
          boxShadow: '0 0 20px rgba(16,185,129,0.06)',
        }}>
          <div style={{
            padding: '11px 14px', borderBottom: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(16,185,129,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={14} style={{ color: '#10B981' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#10B981', letterSpacing: '0.02em' }}>HARDENED</span>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
              color: '#10B981', background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)', padding: '2px 7px', borderRadius: '3px',
            }}>BLOCKED</span>
          </div>
          <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', lineHeight: 1.6 }}>
            {fixedLabel}
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-secondary" onClick={onRunFixed} disabled={disabled || loadingFixed}
              style={{ fontSize: '13px', width: '100%', justifyContent: 'center', borderColor: 'rgba(16,185,129,0.3)', color: '#10B981' }}>
              <Play size={13} /> {loadingFixed ? 'Running…' : 'Run defence'}
            </button>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <TerminalPanel lines={fixedResult} loading={loadingFixed} exploitStatus={fixedStatus} />
          </div>
        </div>
      </div>
    </div>
  )
}

function fmt(status, data) {
  const lines = []
  lines.push({ text: `HTTP ${status}`, cls: status < 300 ? 't-success' : 't-error' })
  const pretty = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  pretty.split('\n').forEach(l => lines.push({ text: l, cls: 't-dim' }))
  return lines
}

const TABS = [
  { label: 'SQL Injection', owasp: 'A03' },
  { label: 'BOLA',          owasp: 'A01' },
  { label: 'JWT Tamper',    owasp: 'A07' },
]

const OWASP_CHIPS = [
  { code: 'A03', name: 'SQL Injection',   desc: 'UNION injection leaks bcrypt hashes from the users table' },
  { code: 'A01', name: 'BOLA',            desc: 'URL-supplied ID bypasses ownership checks' },
  { code: 'A07', name: 'Auth Bypass',     desc: 'Modified JWT signature accepted by vulnerable endpoint' },
]

export default function ThreatLab() {
  const { auth } = useAuth()
  const [tab, setTab] = useState(0)
  const [labEnabled] = useState(true)

  const [sqliVulnRes, setSqliVulnRes] = useState([])
  const [sqliFixedRes, setSqliFixedRes] = useState([])
  const [sqliVulnLoading, setSqliVulnLoading] = useState(false)
  const [sqliFixedLoading, setSqliFixedLoading] = useState(false)
  const [sqliVulnStatus, setSqliVulnStatus] = useState(null)
  const [sqliFixedStatus, setSqliFixedStatus] = useState(null)

  const [bolaVulnRes, setBolaVulnRes] = useState([])
  const [bolaFixedRes, setBolaFixedRes] = useState([])
  const [bolaVulnLoading, setBolaVulnLoading] = useState(false)
  const [bolaFixedLoading, setBolaFixedLoading] = useState(false)
  const [bolaVulnStatus, setBolaVulnStatus] = useState(null)
  const [bolaFixedStatus, setBolaFixedStatus] = useState(null)

  const [jwtTamperRes, setJwtTamperRes] = useState([])
  const [jwtLoading, setJwtLoading] = useState(false)
  const [jwtStatus, setJwtStatus] = useState(null)
  const [bolaTarget, setBolaTarget] = useState('2')

  const SQLI_PAYLOAD = "x' UNION SELECT username, password_hash FROM users--"

  async function runSqliVuln() {
    setSqliVulnLoading(true)
    setSqliVulnStatus(null)
    setSqliVulnRes([{ text: `GET /api/lab/profile/vuln?name=${SQLI_PAYLOAD}`, cls: 't-prompt' }])
    try {
      const { status, data } = await labSqliVuln(SQLI_PAYLOAD)
      setSqliVulnRes(prev => [...prev, ...fmt(status, data)])
      setSqliVulnStatus(getStatus(status, data))
    } catch (e) {
      setSqliVulnRes(prev => [...prev, { text: e.message, cls: 't-error' }])
      setSqliVulnStatus('blocked')
    }
    setSqliVulnLoading(false)
  }

  async function runSqliFixed() {
    setSqliFixedLoading(true)
    setSqliFixedStatus(null)
    setSqliFixedRes([{ text: `GET /api/lab/profile?name=${SQLI_PAYLOAD}`, cls: 't-prompt' }])
    try {
      const { status, data } = await labSqliFixed(auth.token, SQLI_PAYLOAD)
      setSqliFixedRes(prev => [...prev, ...fmt(status, data)])
      setSqliFixedStatus(getStatus(status, data) === 'success' ? 'empty' : getStatus(status, data))
    } catch (e) {
      setSqliFixedRes(prev => [...prev, { text: e.message, cls: 't-error' }])
      setSqliFixedStatus('blocked')
    }
    setSqliFixedLoading(false)
  }

  async function runBolaVuln() {
    setBolaVulnLoading(true)
    setBolaVulnStatus(null)
    setBolaVulnRes([{ text: `GET /api/lab/customer/${bolaTarget}/vuln`, cls: 't-prompt' }])
    try {
      const { status, data } = await labBolaVuln(auth.token, bolaTarget)
      setBolaVulnRes(prev => [...prev, ...fmt(status, data)])
      setBolaVulnStatus(getStatus(status, data))
    } catch (e) {
      setBolaVulnRes(prev => [...prev, { text: e.message, cls: 't-error' }])
      setBolaVulnStatus('blocked')
    }
    setBolaVulnLoading(false)
  }

  async function runBolaFixed() {
    setBolaFixedLoading(true)
    setBolaFixedStatus(null)
    setBolaFixedRes([{ text: 'GET /api/lab/customer', cls: 't-prompt' }])
    try {
      const { status, data } = await labBolaFixed(auth.token)
      setBolaFixedRes(prev => [...prev, ...fmt(status, data)])
      // hardened BOLA always returns own data (HTTP 200) — that IS the defence
      setBolaFixedStatus(status < 400 ? 'own' : 'blocked')
    } catch (e) {
      setBolaFixedRes(prev => [...prev, { text: e.message, cls: 't-error' }])
      setBolaFixedStatus('blocked')
    }
    setBolaFixedLoading(false)
  }

  async function runJwtTamper() {
    setJwtLoading(true)
    setJwtStatus(null)
    const tampered = auth.token.slice(0, -4) + 'XXXX'
    setJwtTamperRes([{ text: `GET /api/accounts  Authorization: Bearer ${tampered.slice(0,30)}…`, cls: 't-prompt' }])
    try {
      const { status, data } = await labJwtTamper(tampered)
      setJwtTamperRes(prev => [...prev, ...fmt(status, data)])
      setJwtStatus(status >= 400 ? 'blocked' : 'success')
    } catch (e) {
      setJwtTamperRes(prev => [...prev, { text: e.message, cls: 't-error' }])
      setJwtStatus('blocked')
    }
    setJwtLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Threat Lab</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444',
              boxShadow: '0 0 8px rgba(239,68,68,0.8)',
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', letterSpacing: '0.1em', fontFamily: 'monospace' }}>LIVE ENVIRONMENT</span>
          </div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
          Real attacks against real endpoints. Run each exploit to see it succeed, then run the defence to see it blocked.
        </p>

        {/* OWASP chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {OWASP_CHIPS.map(c => (
            <div key={c.code} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '6px', padding: '6px 12px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', fontFamily: 'monospace', letterSpacing: '0.06em' }}>OWASP {c.code}</span>
              <span style={{ width: '1px', height: '12px', background: 'rgba(239,68,68,0.25)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)} style={{
            padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '14px', fontWeight: tab === i ? 600 : 400,
            color: tab === i ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: tab === i ? '2px solid var(--danger)' : '2px solid transparent',
            marginBottom: '-1px',
            transition: 'color 0.1s',
          }}>
            {t.label}
            <span style={{
              fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
              color: tab === i ? '#EF4444' : 'var(--text-muted)',
              background: tab === i ? 'rgba(239,68,68,0.1)' : 'var(--bg)',
              border: `1px solid ${tab === i ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.04em',
            }}>{t.owasp}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <SplitLab
          title="SQL Injection — /api/lab/profile/vuln"
          vulnLabel={"UNION injection: x' UNION SELECT username, password_hash FROM users--   →   leaks all bcrypt hashes"}
          fixedLabel={"Same payload with parameterised query   →   treated as literal search string, returns nothing"}
          onRunVuln={runSqliVuln}
          onRunFixed={runSqliFixed}
          vulnResult={sqliVulnRes}
          fixedResult={sqliFixedRes}
          loadingVuln={sqliVulnLoading}
          loadingFixed={sqliFixedLoading}
          disabled={!labEnabled}
          vulnStatus={sqliVulnStatus}
          fixedStatus={sqliFixedStatus}
        />
      )}

      {tab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Context card */}
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            background: 'var(--surface)', borderLeft: '3px solid #F59E0B',
            border: '1px solid var(--border)', borderLeftWidth: '3px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B', marginBottom: '4px' }}>Scenario</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You are logged in as <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{auth?.claims?.sub ?? 'unknown'}</strong> (customer {auth?.claims?.cid ?? '?'}). Enter a <strong style={{ color: 'var(--text-primary)' }}>different</strong> customer ID to attempt to read another user's private profile data via the vulnerable endpoint. The hardened endpoint ignores the ID and always returns only your own data.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label className="label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Target customer ID:</label>
            <input className="input mono" value={bolaTarget} onChange={e => setBolaTarget(e.target.value)}
              style={{ width: '80px', fontFamily: 'monospace', fontSize: '14px' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Enter a different customer's ID (not {auth?.claims?.cid ?? 'yours'}) to see the exploit succeed</span>
          </div>

          <SplitLab
            title="BOLA — Broken Object Level Authorisation"
            vulnLabel={"GET /api/lab/customer/{id}/vuln   →   no ownership check, returns any customer's data"}
            fixedLabel={"GET /api/lab/customer   →   identity read from JWT only, cannot be overridden"}
            onRunVuln={runBolaVuln}
            onRunFixed={runBolaFixed}
            vulnResult={bolaVulnRes}
            fixedResult={bolaFixedRes}
            loadingVuln={bolaVulnLoading}
            loadingFixed={bolaFixedLoading}
            disabled={!labEnabled}
            vulnStatus={bolaVulnStatus}
            fixedStatus={bolaFixedStatus}
          />
        </div>
      )}

      {tab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Context card */}
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            background: 'var(--surface)', borderLeft: '3px solid #8B5CF6',
            border: '1px solid var(--border)', borderLeftWidth: '3px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#8B5CF6', marginBottom: '4px' }}>How it works</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Every API request must carry a valid HS256 signature. This test takes your live token, replaces the last 4 characters of the signature with XXXX, and sends it. A correctly implemented backend rejects it with 401 Unauthorized.
            </div>
          </div>

          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>JWT Signature Tamper</div>

          <div style={{
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: '8px',
            overflow: 'hidden', background: 'var(--surface)',
            boxShadow: '0 0 20px rgba(139,92,246,0.06)',
          }}>
            <div style={{
              padding: '11px 14px', borderBottom: '1px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(139,92,246,0.08)',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6', letterSpacing: '0.02em' }}>SIGNATURE TAMPER TEST</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                color: '#8B5CF6', background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)', padding: '2px 7px', borderRadius: '3px',
              }}>OWASP A07</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={runJwtTamper} disabled={!labEnabled || jwtLoading}
                style={{ width: 'fit-content', borderColor: 'rgba(139,92,246,0.4)', color: '#8B5CF6' }}>
                <Play size={13} /> {jwtLoading ? 'Running…' : 'Run tamper test'}
              </button>
              <TerminalPanel lines={jwtTamperRes} loading={jwtLoading} exploitStatus={jwtStatus} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
