import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Eye, EyeOff, ShieldCheck, Key, Database, Link2 } from 'lucide-react'
import { login } from '../api/client'
import { useAuth } from '../context/AuthContext'

const DEMO_CREDS = [
  { username: 'alice',   password: 'Alice#Dev2026',   role: 'CUSTOMER' },
  { username: 'bob',     password: 'Bob#Dev2026',     role: 'CUSTOMER' },
  { username: 'auditor', password: 'Auditor#Dev2026', role: 'AUDITOR'  },
]

const FEATURES = [
  { Icon: Database, label: 'Row-Level Security',    desc: 'Database-enforced tenant isolation on every query' },
  { Icon: Key,      label: 'JWT Authentication',    desc: 'HS256 signed tokens · 1h TTL · RBAC roles claim' },
  { Icon: Link2,    label: 'SHA-256 Audit Chain',   desc: 'Append-only ledger with cryptographic integrity' },
  { Icon: ShieldCheck, label: 'Least-Privilege Roles', desc: 'finshield_app · finshield_auditor — no superuser' },
]

export default function Login() {
  const navigate = useNavigate()
  const { signin } = useAuth()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [demoOpen, setDemoOpen] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await login(username, password)
      queryClient.clear()
      const claims = signin(token)
      const isAuditor = claims?.roles?.includes('AUDITOR')
      navigate(isAuditor ? '/security' : '/overview')
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0C0E12' }}>

      {/* ── Left panel ── */}
      <div style={{
        flex: 1,
        background: '#080A0D',
        borderRight: '1px solid #161B26',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage: 'linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />
        {/* blue glow */}
        <div style={{
          position: 'absolute', top: '-120px', right: '-120px',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: '480px' }}>
          {/* system status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#3FB950', boxShadow: '0 0 10px rgba(63,185,80,0.8)' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3A4255', letterSpacing: '0.12em' }}>
              ALL SYSTEMS OPERATIONAL
            </span>
          </div>

          {/* brand */}
          <div style={{ marginBottom: '36px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 800, color: '#E2E6ED', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '14px' }}>
              FinShield
            </h1>
            <p style={{ fontSize: '18px', color: '#5A6478', lineHeight: 1.5, maxWidth: '380px' }}>
              Banking security platform with real database-enforced security layers
            </p>
          </div>

          {/* feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {FEATURES.map(({ Icon, label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} style={{ color: '#3B82F6' }} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#E2E6ED', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#5A6478', lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        width: '45%',
        flexShrink: 0,
        background: '#0C0E12',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 48px',
      }}>
        {/* heading */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#3A4255', letterSpacing: '0.12em', marginBottom: '14px' }}>
            AUTHENTICATION REQUIRED
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#E2E6ED', letterSpacing: '-0.02em', marginBottom: '8px', lineHeight: 1.1 }}>
            Sign in
          </h2>
          <p style={{ fontSize: '15px', color: '#5A6478' }}>
            Enter your credentials to start a session
          </p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <label className="label" style={{ fontSize: '14px', marginBottom: '8px' }}>Username</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="alice · bob · auditor"
              autoComplete="username"
              autoFocus
              required
              style={{ fontSize: '16px', padding: '13px 16px' }}
            />
          </div>

          <div>
            <label className="label" style={{ fontSize: '14px', marginBottom: '8px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                style={{ fontSize: '16px', padding: '13px 16px', paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#3A4255',
                  display: 'flex', alignItems: 'center', padding: 0,
                }}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              fontFamily: 'monospace', fontSize: '13px', color: '#EF4444',
              background: '#1A0A0A', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', padding: '12px 16px',
            }}>
              ✗ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', fontSize: '16px', padding: '14px 24px', marginTop: '4px' }}
          >
            {loading ? 'Authenticating…' : 'Sign in'}
          </button>
        </form>

        {/* demo credentials */}
        <div style={{ marginTop: '36px', paddingTop: '28px', borderTop: '1px solid #161B26' }}>
          <button
            onClick={() => setDemoOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              background: 'none', border: '1px solid #1E2230', cursor: 'pointer',
              color: '#5A6478', fontSize: '13px', fontFamily: 'monospace',
              padding: '10px 14px', borderRadius: '6px', letterSpacing: '0.04em',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A2F40'; e.currentTarget.style.color = '#7A8699' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E2230'; e.currentTarget.style.color = '#5A6478' }}
          >
            {demoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>demo credentials</span>
          </button>

          {demoOpen && (
            <div className="animate-fade-in" style={{
              marginTop: '10px',
              background: '#080A0D',
              border: '1px solid #1E2230',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #1E2230', fontSize: '11px', color: '#3A4255', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                USERNAME · PASSWORD · ROLE
              </div>
              {DEMO_CREDS.map((cred, i) => (
                <button
                  key={cred.username}
                  onClick={() => { setUsername(cred.username); setPassword(cred.password) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '13px 16px',
                    background: 'none', border: 'none',
                    borderBottom: i < DEMO_CREDS.length - 1 ? '1px solid #161B26' : 'none',
                    cursor: 'pointer', textAlign: 'left', gap: '12px',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0F1218'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', minWidth: 0 }}>
                    <span style={{ fontSize: '14px', color: '#58A6FF', fontFamily: 'monospace', flexShrink: 0 }}>{cred.username}</span>
                    <span style={{ fontSize: '12px', color: '#3A4255', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cred.password}</span>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0,
                    fontFamily: 'monospace',
                    color: cred.role === 'AUDITOR' ? '#3FB950' : '#58A6FF',
                    background: cred.role === 'AUDITOR' ? 'rgba(63,185,80,0.08)' : 'rgba(88,166,255,0.08)',
                    border: `1px solid ${cred.role === 'AUDITOR' ? 'rgba(63,185,80,0.3)' : 'rgba(88,166,255,0.3)'}`,
                    padding: '3px 8px', borderRadius: '4px',
                  }}>
                    {cred.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
