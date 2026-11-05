import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transfer from './pages/Transfer'
import AuditChain from './pages/AuditChain'
import SecurityLab from './pages/SecurityLab'
import {
  LayoutDashboard, ArrowLeftRight, Link2, FlaskConical,
  Shield, LogOut, ChevronRight
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', label: 'Dashboard',     Icon: LayoutDashboard },
  { to: '/transfer',  label: 'Transfer',       Icon: ArrowLeftRight   },
  { to: '/audit',     label: 'Audit Chain',    Icon: Link2            },
  { to: '/lab',       label: 'Security Lab',   Icon: FlaskConical     },
]

function Sidebar() {
  const { auth, signout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    signout()
    navigate('/')
  }

  const user = auth?.claims?.sub ?? 'Unknown'
  const role = auth?.claims?.roles?.[0] ?? 'USER'

  return (
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center glow-blue">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-100 leading-none">FinShield</div>
            <div className="text-xs text-slate-500 mt-0.5">Secure Banking Demo</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
               ${isActive
                 ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                 : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-blue-500/60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="card-elevated px-3 py-3 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">{user[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 truncate">{user}</div>
              <div className="text-xs text-slate-500 truncate uppercase tracking-wide">{role}</div>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary w-full justify-center">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-950">
        {children}
      </main>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { auth } = useAuth()
  return auth ? <Layout>{children}</Layout> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/transfer"  element={<ProtectedRoute><Transfer /></ProtectedRoute>} />
          <Route path="/audit"     element={<ProtectedRoute><AuditChain /></ProtectedRoute>} />
          <Route path="/lab"       element={<ProtectedRoute><SecurityLab /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
