import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login, decodeJwt } from '../api/client'
import { Shield, Lock, User, ArrowRight, Database, GitBranch, Key, Eye, EyeOff, Zap } from 'lucide-react'

const QUICK_USERS = [
  { label: 'Alice',   username: 'alice',   password: 'Alice#Dev2026',   color: 'bg-violet-500',  desc: 'Customer · 2 accounts' },
  { label: 'Bob',     username: 'bob',     password: 'Bob#Dev2026',     color: 'bg-blue-500',    desc: 'Customer · 1 account'  },
  { label: 'Carol',   username: 'carol',   password: 'Carol#Dev2026',   color: 'bg-pink-500',    desc: 'Customer · 1 account'  },
  { label: 'Auditor', username: 'auditor', password: 'Auditor#Dev2026', color: 'bg-amber-500',   desc: 'Read-only audit access' },
]

const FEATURES = [
  { Icon: Database,  text: 'Row-Level Security — each user sees only their own data' },
  { Icon: Lock,      text: 'SECURITY DEFINER — transfers enforced at database layer'  },
  { Icon: GitBranch, text: 'SHA-256 audit chain — tamper-evident, independently verified' },
  { Icon: Key,       text: 'JWT + BCrypt — stateless, timing-safe authentication'    },
]

function JwtCard({ claims }) {
  return (
    <div className="mt-4 card-elevated p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">JWT Decoded</span>
      </div>
      <div className="font-mono text-xs space-y-1.5">
        {Object.entries(claims).map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <span className="text-cyan-400 w-16 shrink-0">{k}</span>
            <span className="text-slate-300 break-all">
              {k === 'exp' || k === 'iat'
                ? `${v} (${new Date(v * 1000).toLocaleTimeString()})`
                : k === 'roles'
                  ? JSON.stringify(v)
                  : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Login() {
  const { signin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jwtClaims, setJwtClaims] = useState(null)

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    setJwtClaims(null)
    try {
      const { token } = await login(username, password)
      const claims = decodeJwt(token)
      setJwtClaims(claims)
      signin(token)
      setTimeout(() => navigate('/dashboard'), 1400)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(u) {
    setUsername(u.username)
    setPassword(u.password)
    setError('')
    setJwtClaims(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-slate-900 border-r border-slate-800 p-12">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center glow-blue">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gradient">FinShield</div>
              <div className="text-sm text-slate-500">Secure Banking Backend</div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-100 leading-tight mb-4">
            Defence in depth,<br />
            <span className="text-gradient">layer by layer.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-10">
            A production-grade banking backend demonstrating seven security layers
            built over seven days — from schema design to an independent CLI verifier.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-blue-400" />
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-600">
          <span>Spring Boot 3</span>
          <span>·</span>
          <span>PostgreSQL 16</span>
          <span>·</span>
          <span>46 tests passing</span>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">FinShield</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-100 mb-1">Sign in</h2>
          <p className="text-slate-500 text-sm mb-6">Select a demo account or enter credentials</p>

          {/* Quick select */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {QUICK_USERS.map((u) => (
              <button
                key={u.username}
                onClick={() => quickLogin(u)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all
                  ${username === u.username
                    ? 'border-blue-500/50 bg-blue-600/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-800'}`}
              >
                <div className={`w-6 h-6 rounded-full ${u.color} flex items-center justify-center shrink-0`}>
                  <span className="text-xs font-bold text-white">{u.label[0]}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">{u.label}</div>
                  <div className="text-xs text-slate-500">{u.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">or enter manually</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="input pl-9"
                  placeholder="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="input pl-9 pr-9"
                  type={showPw ? 'text' : 'password'}
                  placeholder="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <><Zap size={15} className="animate-pulse" /> Authenticating…</>
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {jwtClaims && <JwtCard claims={jwtClaims} />}
        </div>
      </div>
    </div>
  )
}
