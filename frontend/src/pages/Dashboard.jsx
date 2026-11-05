import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { login, getAccounts, getLedger } from '../api/client'
import {
  Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, RefreshCw,
  CreditCard, Activity, Clock, CheckCircle, Shield, Users
} from 'lucide-react'

const RLS_USERS = [
  { label: 'Alice',  username: 'alice',  password: 'Alice#Dev2026',  color: 'bg-violet-500' },
  { label: 'Bob',    username: 'bob',    password: 'Bob#Dev2026',    color: 'bg-blue-500'   },
  { label: 'Carol',  username: 'carol',  password: 'Carol#Dev2026',  color: 'bg-pink-500'   },
]

function fmt(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'text-blue-400  bg-blue-900/20  border-blue-800/30',
    green:  'text-green-400 bg-green-900/20 border-green-800/30',
    violet: 'text-violet-400 bg-violet-900/20 border-violet-800/30',
    amber:  'text-amber-400 bg-amber-900/20 border-amber-800/30',
  }
  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-100 mb-0.5">{value}</div>
      <div className="text-sm font-medium text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  )
}

function AccountCard({ account }) {
  const statusColor = account.status === 'ACTIVE'
    ? 'bg-green-900/30 text-green-400 border-green-800/30'
    : 'bg-red-900/30 text-red-400 border-red-800/30'

  return (
    <div className="card p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
          <CreditCard size={18} className="text-blue-400" />
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
          {account.status}
        </span>
      </div>
      <div className="font-mono text-sm text-slate-500 mb-1">{account.account_number}</div>
      <div className="text-2xl font-bold text-slate-100 mb-1">{fmt(account.balance)}</div>
      <div className="text-xs text-slate-600">{account.currency} account</div>
    </div>
  )
}

function LedgerRow({ entry }) {
  const isDebit = entry.entry_type === 'DEBIT'
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-800/50 last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDebit ? 'bg-red-900/30' : 'bg-green-900/30'}`}>
        {isDebit
          ? <ArrowUpRight size={14} className="text-red-400" />
          : <ArrowDownLeft size={14} className="text-green-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-300 capitalize">{entry.entry_type.toLowerCase()}</div>
        <div className="text-xs text-slate-600 font-mono truncate">{entry.account_number || entry.account_id}</div>
      </div>
      <div className={`text-sm font-semibold ${isDebit ? 'text-red-400' : 'text-green-400'}`}>
        {isDebit ? '−' : '+'}{fmt(entry.amount)}
      </div>
      <div className="text-xs text-slate-600 shrink-0">
        {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { auth, signin } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [rlsUser, setRlsUser] = useState(null) // null = current auth user
  const [rlsToken, setRlsToken] = useState(auth?.token)
  const [rlsLabel, setRlsLabel] = useState(auth?.claims?.sub)
  const [rlsSwitching, setRlsSwitching] = useState(false)

  const refresh = useCallback(async (token) => {
    setLoading(true)
    try {
      const [acc, led] = await Promise.all([getAccounts(token), getLedger(token)])
      setAccounts(acc)
      setLedger(led.slice(0, 10))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh(rlsToken) }, [rlsToken])

  async function switchRlsUser(u) {
    if (rlsLabel === u.label) return
    setRlsSwitching(true)
    try {
      const { token } = await login(u.username, u.password)
      setRlsToken(token)
      setRlsLabel(u.label)
      setRlsUser(u)
    } catch (e) {
      console.error(e)
    } finally {
      setRlsSwitching(false)
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0)
  const expDate = auth?.claims?.exp ? new Date(auth.claims.exp * 1000) : null

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Viewing data as <span className="text-blue-400 font-medium">{rlsLabel}</span>
            {rlsUser && <span className="ml-2 text-xs text-amber-400">(RLS demo — not signed in as this user)</span>}
          </p>
        </div>
        <button onClick={() => refresh(rlsToken)} className="btn-secondary">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Wallet}       label="Total Balance"   value={fmt(totalBalance)}     color="blue"   />
        <StatCard icon={CreditCard}   label="Accounts"        value={accounts.length}       color="violet" sub="RLS-filtered" />
        <StatCard icon={Activity}     label="Ledger Entries"  value={ledger.length}         color="green"  sub="visible to this user" />
        <StatCard icon={Clock}        label="Token Expires"   value={expDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '—'} color="amber" sub="15-min TTL" />
      </div>

      {/* RLS Demo Banner */}
      <div className="card border-blue-800/30 bg-blue-900/10 p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">Row-Level Security Demo</span>
          </div>
          <span className="text-sm text-slate-400 mr-2">Switch user to see RLS in action — accounts and ledger update instantly:</span>
          <div className="flex gap-2 flex-wrap">
            {RLS_USERS.map(u => (
              <button
                key={u.username}
                onClick={() => switchRlsUser(u)}
                disabled={rlsSwitching}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${rlsLabel === u.label
                    ? 'bg-blue-600/30 border-blue-500/40 text-blue-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
              >
                <span className={`w-2 h-2 rounded-full ${u.color}`} />
                {u.label}
              </button>
            ))}
          </div>
          {rlsSwitching && <span className="text-xs text-slate-500">Switching…</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Accounts */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-200">Accounts</h2>
            <span className="ml-auto text-xs text-slate-600 font-mono bg-slate-800 px-2 py-0.5 rounded">
              customer_id = {rlsUser?.label === 'Alice' ? 1 : rlsUser?.label === 'Bob' ? 2 : rlsUser?.label === 'Carol' ? 3 : auth?.claims?.cid ?? '?'}
            </span>
          </div>
          {loading ? (
            <div className="card p-12 flex items-center justify-center">
              <RefreshCw size={20} className="animate-spin text-slate-600" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="card p-8 text-center text-slate-600 text-sm">No accounts visible</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map(a => <AccountCard key={a.id} account={a} />)}
            </div>
          )}
        </div>

        {/* Ledger */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-200">Recent Ledger</h2>
            <span className="ml-auto text-xs text-slate-600">last 10 entries</span>
          </div>
          <div className="card px-4">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <RefreshCw size={20} className="animate-spin text-slate-600" />
              </div>
            ) : ledger.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm">No ledger entries yet</div>
            ) : (
              ledger.map((e, i) => <LedgerRow key={i} entry={e} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
