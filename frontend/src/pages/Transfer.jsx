import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAccounts, postTransfer } from '../api/client'
import {
  ArrowRight, RefreshCw, Copy, CheckCheck, Zap, AlertTriangle,
  CheckCircle2, ArrowLeftRight, RotateCcw, Fingerprint
} from 'lucide-react'

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
}

function StatusToast({ result }) {
  if (!result) return null
  const isIdempotent = result.status === 200 && result.wasReplay
  const isSuccess = result.status === 200 || result.status === 201
  if (isIdempotent) {
    return (
      <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <Fingerprint size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">Idempotent Replay</span>
        </div>
        <p className="text-xs text-amber-300/70">Same idempotency key → same result returned. No duplicate transaction created.</p>
        <pre className="mt-2 text-xs font-mono text-amber-300/60 bg-black/30 p-2 rounded">{JSON.stringify(result.data, null, 2)}</pre>
      </div>
    )
  }
  if (isSuccess) {
    return (
      <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 size={16} className="text-green-400" />
          <span className="text-sm font-semibold text-green-400">Transfer Successful</span>
        </div>
        <pre className="text-xs font-mono text-green-300/70 bg-black/30 p-2 rounded mt-2">{JSON.stringify(result.data, null, 2)}</pre>
      </div>
    )
  }
  return (
    <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className="text-red-400" />
        <span className="text-sm font-semibold text-red-400">Transfer Failed — {result.status}</span>
      </div>
      <pre className="text-xs font-mono text-red-300/70 bg-black/30 p-2 rounded mt-2">{JSON.stringify(result.data, null, 2)}</pre>
    </div>
  )
}

export default function Transfer() {
  const { auth } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [ikey, setIkey] = useState(uuid())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [lastKey, setLastKey] = useState(null)
  const [lastFrom, setLastFrom] = useState(null)
  const [lastTo, setLastTo] = useState(null)
  const [lastAmount, setLastAmount] = useState(null)

  useEffect(() => {
    getAccounts(auth.token).then(setAccounts).catch(console.error)
  }, [auth.token])

  function copyKey() {
    navigator.clipboard.writeText(ikey).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submit(e, replay) {
    e?.preventDefault()
    const usedKey = replay ? lastKey : ikey
    const usedFrom = replay ? lastFrom : from
    const usedTo = replay ? lastTo : to
    const usedAmount = replay ? lastAmount : amount
    if (!usedKey || !usedFrom || !usedTo || !usedAmount) return
    setLoading(true)
    setResult(null)
    try {
      const r = await postTransfer(auth.token, usedKey, usedFrom, usedTo, parseFloat(usedAmount))
      setResult({ ...r, wasReplay: replay })
      if (!replay) {
        setLastKey(ikey)
        setLastFrom(from)
        setLastTo(to)
        setLastAmount(amount)
        setIkey(uuid()) // new key for next transfer
      }
    } catch (err) {
      setResult({ status: err.status ?? 500, data: err.data ?? { message: err.message } })
    } finally {
      setLoading(false)
    }
  }

  const myAccounts = accounts.map(a => a.account_number)

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Transfer</h1>
        <p className="text-slate-500 text-sm mt-1">Atomic money movement via SECURITY DEFINER function with idempotency</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Transfer form */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <ArrowLeftRight size={18} className="text-blue-400" />
            <h2 className="font-semibold text-slate-200">New Transfer</h2>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">From Account</label>
              <select
                className="input"
                value={from}
                onChange={e => setFrom(e.target.value)}
                required
              >
                <option value="">Select account…</option>
                {myAccounts.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="label">To Account</label>
              <input
                className="input font-mono"
                placeholder="FS0000000003"
                value={to}
                onChange={e => setTo(e.target.value)}
                required
              />
              <p className="text-xs text-slate-600 mt-1">Try FS0000000003 (Bob) or FS0000000004 (Carol)</p>
            </div>

            <div>
              <label className="label">Amount (₹)</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="100.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Idempotency Key</label>
              <div className="flex gap-2">
                <input
                  className="input font-mono text-xs"
                  value={ikey}
                  onChange={e => setIkey(e.target.value)}
                  required
                />
                <button type="button" onClick={copyKey} className="btn-secondary shrink-0 px-3">
                  {copied ? <CheckCheck size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
                <button type="button" onClick={() => setIkey(uuid())} className="btn-secondary shrink-0 px-3">
                  <RotateCcw size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1">Unique key per transfer — prevents duplicate submissions</p>
            </div>

            <button
              type="submit"
              disabled={loading || !from || !to || !amount}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Processing…</> : <>Send Transfer <ArrowRight size={14} /></>}
            </button>
          </form>
        </div>

        {/* Idempotency demo + result */}
        <div className="space-y-4">
          {/* Idempotency demo */}
          {lastKey && (
            <div className="card border-amber-800/30 bg-amber-900/5 p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint size={18} className="text-amber-400" />
                <h3 className="font-semibold text-amber-300">Idempotency Demo</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Re-send the last transfer with the <span className="text-amber-400 font-mono text-xs">{lastKey.slice(0, 16)}…</span> key.
                The backend detects the duplicate and returns the original result — no double-spend.
              </p>
              <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs space-y-1 mb-4">
                <div className="text-slate-500">// Same key, same request → same response</div>
                <div><span className="text-cyan-400">fromAccount</span> <span className="text-slate-400">=</span> <span className="text-green-400">"{lastFrom}"</span></div>
                <div><span className="text-cyan-400">toAccount</span>   <span className="text-slate-400">=</span> <span className="text-green-400">"{lastTo}"</span></div>
                <div><span className="text-cyan-400">amount</span>      <span className="text-slate-400">=</span> <span className="text-amber-400">{lastAmount}</span></div>
                <div><span className="text-cyan-400">idempotencyKey</span> <span className="text-slate-400">=</span> <span className="text-blue-400">"{lastKey.slice(0, 20)}…"</span></div>
              </div>
              <button
                onClick={(e) => submit(e, true)}
                disabled={loading}
                className="btn-secondary w-full justify-center"
              >
                <Zap size={14} className="text-amber-400" />
                Send Duplicate Request
              </button>
            </div>
          )}

          {/* Error guide */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">fn_post_transfer Error Codes</h3>
            <div className="space-y-2">
              {[
                ['FS001', '422', 'Insufficient funds'],
                ['FS002', '422', 'Destination account not found'],
                ['FS003', '403', 'Source account not yours'],
                ['FS004', '409', 'Idempotency key reused — different request'],
                ['FS005', '422', 'Account inactive / currency mismatch'],
                ['FS006', '400', 'Invalid request (amount ≤ 0, same account…)'],
              ].map(([code, http, msg]) => (
                <div key={code} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-red-400 w-10 shrink-0">{code}</span>
                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 w-10 text-center shrink-0">{http}</span>
                  <span className="text-slate-500">{msg}</span>
                </div>
              ))}
            </div>
          </div>

          {result && <StatusToast result={result} />}
        </div>
      </div>
    </div>
  )
}
