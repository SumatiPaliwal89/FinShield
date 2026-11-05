import { useState, useEffect } from 'react'
import { login, verifyChain, getAuditEvents } from '../api/client'
import { Link2, ShieldCheck, ShieldX, RefreshCw, ChevronRight, CheckCircle2, AlertTriangle, Lock, Eye } from 'lucide-react'

const AUDITOR = { username: 'auditor', password: 'Auditor#Dev2026' }

function Block({ event, index, isHead }) {
  const [expanded, setExpanded] = useState(false)
  let payload = {}
  try { payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload } catch (_) {}

  return (
    <div className="flex items-stretch shrink-0">
      {/* Chain link */}
      {index > 0 && (
        <div className="flex items-center px-1">
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/50 to-blue-500/50" />
            <ChevronRight size={12} className="text-blue-500/50 -mt-2 -ml-1" />
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-52 shrink-0 rounded-xl border p-4 text-left transition-all hover:border-blue-500/40
          ${isHead
            ? 'border-blue-500/60 bg-blue-900/10 glow-blue'
            : 'border-slate-700/60 bg-slate-900 hover:bg-slate-800/50'}`}
      >
        {/* Block header */}
        <div className="flex items-center justify-between mb-3">
          <div className={`text-xs font-bold px-2 py-0.5 rounded-full border
            ${isHead
              ? 'text-blue-400 bg-blue-900/30 border-blue-700/40'
              : 'text-slate-500 bg-slate-800 border-slate-700'}`}>
            #{event.id}
          </div>
          <div className="w-5 h-5 rounded-full bg-green-900/40 border border-green-800/40 flex items-center justify-center">
            <CheckCircle2 size={11} className="text-green-400" />
          </div>
        </div>

        {/* Event type */}
        <div className="text-sm font-semibold text-slate-200 mb-1">
          {event.event_type?.replace('_', ' ')}
        </div>

        {/* Actor */}
        <div className="text-xs text-slate-500 mb-3">
          by <span className="text-cyan-400 font-medium">{event.actor}</span>
        </div>

        {/* Hash preview */}
        <div className="space-y-1">
          <div className="text-xs font-mono text-slate-600 truncate" title={event.hash}>
            <span className="text-slate-500">hash </span>{event.hash_preview}
          </div>
          <div className="text-xs font-mono text-slate-700 truncate" title={event.prev_hash}>
            <span className="text-slate-600">prev </span>{event.prev_hash_preview}
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-3 text-xs text-slate-700">
          {new Date(event.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Expanded payload */}
        {expanded && Object.keys(payload).length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs font-mono text-slate-400 space-y-0.5">
            {Object.entries(payload).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-cyan-500 shrink-0">{k}</span>
                <span className="text-slate-400 truncate">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </button>
    </div>
  )
}

export default function AuditChain() {
  const [token, setToken] = useState(null)
  const [events, setEvents] = useState([])
  const [verifyResult, setVerifyResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const { token: t } = await login(AUDITOR.username, AUDITOR.password)
        setToken(t)
        const evts = await getAuditEvents(t)
        setEvents(Array.isArray(evts) ? evts.reverse() : [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function verify() {
    if (!token) return
    setVerifying(true)
    try {
      const r = await verifyChain(token)
      setVerifyResult(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setVerifying(false)
    }
  }

  async function refresh() {
    if (!token) return
    setLoading(true)
    try {
      const evts = await getAuditEvents(token)
      setEvents(Array.isArray(evts) ? evts.reverse() : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const headEvent = events[events.length - 1]

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Audit Chain</h1>
          <p className="text-slate-500 text-sm mt-1">
            SHA-256 hash chain — tamper-evident, append-only, independently verifiable
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={loading} className="btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={verify} disabled={verifying || !token} className="btn-primary">
            {verifying
              ? <><RefreshCw size={14} className="animate-spin" /> Verifying…</>
              : <><ShieldCheck size={14} /> Verify Chain</>}
          </button>
        </div>
      </div>

      {/* Verify result */}
      {verifyResult && (
        <div className={`card mb-6 p-5 animate-fade-in ${verifyResult.valid ? 'border-green-800/40 bg-green-900/10' : 'border-red-800/40 bg-red-900/10'}`}>
          <div className="flex items-center gap-3">
            {verifyResult.valid
              ? <ShieldCheck size={20} className="text-green-400" />
              : <ShieldX size={20} className="text-red-400" />}
            <div>
              <div className={`text-base font-bold ${verifyResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                {verifyResult.valid ? 'Chain Intact' : 'Chain Broken'}
              </div>
              <div className="text-sm text-slate-400">
                {verifyResult.eventsChecked} events verified
                {verifyResult.firstBrokenId && ` — first broken at event #${verifyResult.firstBrokenId}`}
                {verifyResult.problem && ` — ${verifyResult.problem}`}
              </div>
            </div>
            {verifyResult.headHash && (
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-600">Head hash</div>
                <div className="font-mono text-xs text-slate-400">{verifyResult.headHash.slice(0, 24)}…</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{events.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total Events</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-sm font-mono text-slate-300 truncate">
            {headEvent?.hash_preview ?? '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Head Hash (preview)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
            <span className="text-sm font-medium text-green-400">Append Only</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Triggers block DELETE/UPDATE</div>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5 mb-6 bg-slate-900/50">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={15} className="text-blue-400" />
          <span className="text-sm font-semibold text-slate-300">How the chain is built</span>
        </div>
        <div className="flex gap-6 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-2"><span className="text-cyan-400 font-mono">canonical</span> = sha256(prev_hash ‖ timestamp ‖ event_type ‖ actor ‖ payload)</div>
          <div className="flex items-center gap-2"><span className="text-cyan-400 font-mono">hash[n]</span> = sha256(canonical[n])</div>
          <div className="flex items-center gap-2"><span className="text-cyan-400 font-mono">prev_hash[n]</span> = hash[n-1]</div>
          <div className="flex items-center gap-2"><span className="text-green-400">Advisory lock 727001</span> serialises writes</div>
        </div>
      </div>

      {/* Chain visualization */}
      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <RefreshCw size={24} className="animate-spin text-slate-600" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-red-400 text-sm">{error}</div>
      ) : events.length === 0 ? (
        <div className="card p-16 text-center">
          <Link2 size={32} className="text-slate-700 mx-auto mb-3" />
          <div className="text-slate-600 text-sm">No audit events yet — make a transfer to generate them</div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Eye size={15} className="text-slate-500" />
            <span className="text-sm text-slate-500">Click any block to expand payload · Scroll horizontally to see the full chain</span>
          </div>
          <div className="card p-6 overflow-x-auto">
            {/* Genesis marker */}
            <div className="flex items-center gap-2 mb-4">
              <div className="text-xs font-mono text-slate-700 px-2 py-1 rounded border border-slate-800 bg-slate-900/50">
                GENESIS: {'0'.repeat(16)}…
              </div>
              <ChevronRight size={12} className="text-slate-700" />
            </div>
            <div className="flex items-stretch">
              {events.map((evt, i) => (
                <Block key={evt.id} event={evt} index={i} isHead={i === events.length - 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
