import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import {
  LayoutDashboard, Building2, ArrowLeftRight, Activity,
  Shield, Link2, FlaskConical, KeyRound,
  ChevronLeft, ChevronRight, LogOut, User, Menu
} from 'lucide-react'

import Login from './pages/Login'
import Overview from './pages/Overview'
import Accounts from './pages/Accounts'
import Transfers from './pages/Transfers'
import ActivityPage from './pages/ActivityPage'
import SecurityCenter from './pages/SecurityCenter'
import AuditLedger from './pages/AuditLedger'
import ThreatLab from './pages/ThreatLab'
import SessionAccess from './pages/SessionAccess'
import CommandPalette from './components/CommandPalette'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

const BANKING_NAV = [
  { to: '/overview',  label: 'Overview',   Icon: LayoutDashboard },
  { to: '/accounts',  label: 'Accounts',   Icon: Building2 },
  { to: '/transfers', label: 'Transfers',  Icon: ArrowLeftRight },
  { to: '/activity',  label: 'Activity',   Icon: Activity },
]

const SECURITY_NAV = [
  { to: '/security', label: 'Security Center', Icon: Shield,       auditorOnly: true },
  { to: '/audit',    label: 'Audit Ledger',    Icon: Link2,        auditorOnly: true },
  { to: '/lab',      label: 'Threat Lab',      Icon: FlaskConical, auditorOnly: false },
  { to: '/session',  label: 'Session & Access',Icon: KeyRound,     auditorOnly: false },
]

const BREADCRUMB_MAP = {
  '/overview':  'Overview',
  '/accounts':  'Accounts',
  '/transfers': 'Transfers',
  '/activity':  'Activity',
  '/security':  'Security Center',
  '/audit':     'Audit Ledger',
  '/lab':       'Threat Lab',
  '/session':   'Session & Access',
}

function TokenChip({ exp }) {
  const [label, setLabel] = useState('')
  const [danger, setDanger] = useState(false)

  useEffect(() => {
    function update() {
      if (!exp) return
      const secs = exp - Math.floor(Date.now() / 1000)
      if (secs <= 0) { setLabel('Expired'); setDanger(true); return }
      const m = Math.floor(secs / 60)
      const s = secs % 60
      setLabel(`${m}:${s.toString().padStart(2, '0')}`)
      setDanger(secs < 300)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [exp])

  if (!label) return null
  return (
    <span
      className="text-xs font-mono px-2 py-1 rounded border"
      style={{
        color: danger ? 'var(--danger)' : 'var(--text-secondary)',
        borderColor: danger ? '#FBCECA' : 'var(--border)',
        background: danger ? 'var(--danger-light)' : 'var(--surface)',
      }}
    >
      {label}
    </span>
  )
}

function Sidebar({ collapsed, onToggle }) {
  const { auth, signout } = useAuth()
  const navigate = useNavigate()
  const isAuditor = auth?.claims?.roles?.includes('AUDITOR')
  const user = auth?.claims?.sub ?? ''

  return (
    <aside
      style={{
        width: collapsed ? '48px' : '220px',
        minHeight: '100vh',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '14px 12px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '8px',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em' }}>FinShield</span>
            <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.02em' }}>v1.0</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="btn-ghost"
          style={{ padding: '4px', borderRadius: '6px', color: 'var(--sidebar-text)' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {!isAuditor && !collapsed && (
          <div className="section-header">Banking</div>
        )}
        {!isAuditor && BANKING_NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {!collapsed && (
          <div className="section-header" style={{ marginTop: '8px' }}>Security</div>
        )}
        {collapsed && <div style={{ height: '8px' }} />}
        {SECURITY_NAV.filter(n => !n.auditorOnly || isAuditor).map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '8px', borderTop: '1px solid var(--sidebar-border)' }}>
        {!collapsed && (
          <div style={{
            padding: '8px 10px',
            borderRadius: '6px',
            marginBottom: '4px',
            background: 'var(--sidebar-hover)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>
                  {user ? user[0].toUpperCase() : '?'}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize' }}>{user}</div>
                <div style={{ color: 'var(--sidebar-text)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {isAuditor ? 'Auditor' : 'Customer'}
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => { queryClient.clear(); signout(); navigate('/') }}
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}

function Topbar({ collapsed, onMenuClick }) {
  const { auth } = useAuth()
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const page = BREADCRUMB_MAP[location.pathname] ?? ''
  const exp = auth?.claims?.exp

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header style={{
        height: '52px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>FinShield</span>
          {page && (
            <>
              <span style={{ color: 'var(--text-disabled)', fontSize: '17px', lineHeight: 1 }}>/</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500 }}>{page}</span>
            </>
          )}
        </div>

        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.07em',
          color: 'var(--text-muted)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          padding: '4px 10px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          fontFamily: 'monospace',
        }}>
          Local · Synthetic Data
        </span>

        <button
          onClick={() => setPaletteOpen(true)}
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>⌘K</span>
        </button>

        <TokenChip exp={exp} />
      </header>

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} isAuditor={auth?.claims?.roles?.includes('AUDITOR')} />
      )}
    </>
  )
}

function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar collapsed={collapsed} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

const BANKING_PATHS = ['/overview', '/accounts', '/transfers', '/activity']

function ProtectedRoute({ children, auditorOnly = false }) {
  const { auth } = useAuth()
  const location = useLocation()
  if (!auth) return <Navigate to="/" replace />
  const isAuditor = auth.claims?.roles?.includes('AUDITOR')
  if (auditorOnly && !isAuditor) return <Navigate to="/overview" replace />
  if (isAuditor && BANKING_PATHS.includes(location.pathname)) {
    return <Navigate to="/security" replace />
  }
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"          element={<Login />} />
            <Route path="/overview"  element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            <Route path="/accounts"  element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute><Transfers /></ProtectedRoute>} />
            <Route path="/activity"  element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
            <Route path="/security"  element={<ProtectedRoute auditorOnly><SecurityCenter /></ProtectedRoute>} />
            <Route path="/audit"     element={<ProtectedRoute auditorOnly><AuditLedger /></ProtectedRoute>} />
            <Route path="/lab"       element={<ProtectedRoute><ThreatLab /></ProtectedRoute>} />
            <Route path="/session"   element={<ProtectedRoute><SessionAccess /></ProtectedRoute>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
