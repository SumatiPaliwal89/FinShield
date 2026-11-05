import { useState, useEffect, useRef } from 'react'
import { login, labSqliVuln, labSqliFixed, labBolaVuln, labBolaFixed } from '../api/client'
import {
  FlaskConical, ShieldOff, ShieldCheck, Play, RotateCcw,
  Terminal, AlertTriangle, CheckCircle2, Zap, ChevronDown, ChevronUp, Info
} from 'lucide-react'

const ALICE = { username: 'alice', password: 'Alice#Dev2026' }

function useLab() {
  const [aliceToken, setAliceToken] = useState(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')

  useEffect(() => {
    login(ALICE.username, ALICE.password)
      .then(({ token }) => { setAliceToken(token); setReady(true) })
      .catch(e => setInitError(e.message))
  }, [])

  return { aliceToken, ready, initError }
}

function TerminalOutput({ lines }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight) }, [lines])
  if (!lines.length) return null
  return (
    <div ref={ref} className="terminal mt-3 max-h-44">
      {lines.map((l, i) => (
        <div key={i} className={
          l.t === 'cmd'   ? 'text-cyan-400' :
          l.t === 'info'  ? 'text-slate-500' :
          l.t === 'hit'   ? 'text-red-400 font-semibold' :
          l.t === 'ok'    ? 'text-green-400' :
          l.t === 'warn'  ? 'text-amber-400' :
          'text-slate-300'
        }>{l.v}</div>
      ))}
    </div>
  )
}

function PanelHeader({ variant }) {
  const vuln = variant === 'vuln'
  return (
    <div className={`flex items-center gap-2 px-5 py-3 border-b rounded-t-xl
      ${vuln ? 'border-red-900/40 bg-red-900/10' : 'border-green-900/40 bg-green-900/10'}`}>
      {vuln
        ? <ShieldOff size={15} className="text-red-400" />
        : <ShieldCheck size={15} className="text-green-400" />}
      <span className={`text-sm font-bold uppercase tracking-wide ${vuln ? 'text-red-400' : 'text-green-400'}`}>
        {vuln ? 'Vulnerable' : 'Secure'}
      </span>
      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium
        ${vuln ? 'badge-vuln' : 'badge-secure'}`}>
        {vuln ? 'EXPLOITABLE' : 'PATCHED'}
      </span>
    </div>
  )
}

// ── A1: SQL Injection ──────────────────────────────────────────────────────────

const SQLI_PAYLOAD = "x' UNION SELECT username, password_hash FROM users--"

function SqliSection({ aliceToken, ready }) {
  const [vulnLines, setVulnLines] = useState([])
  const [fixLines, setFixLines] = useState([])
  const [runningVuln, setRunningVuln] = useState(false)
  const [runningFix, setRunningFix] = useState(false)
  const [open, setOpen] = useState(true)

  async function runVuln() {
    setRunningVuln(true)
    setVulnLines([
      { t: 'info', v: '$ GET /api/lab/profile/vuln?name=...' },
      { t: 'warn', v: `  Payload: ${SQLI_PAYLOAD}` },
      { t: 'info', v: '  No auth required. Sending...' },
    ])
    try {
      const { status, data } = await labSqliVuln(SQLI_PAYLOAD)
      const hits = data.filter(r => {
        const vals = Object.values(r).join(' ')
        return vals.includes('$2') || vals.includes('$2a')
      })
      setVulnLines(prev => [
        ...prev,
        { t: 'cmd', v: `  HTTP ${status} — ${data.length} row(s) returned` },
        ...(hits.length
          ? [
              { t: 'hit', v: `  ⚡ INJECTION SUCCESSFUL — leaked ${hits.length} password hash(es)!` },
              ...hits.map(r => ({ t: 'hit', v: `  → ${JSON.stringify(r)}` })),
              { t: 'warn', v: '  BCrypt hashes ($2a$...) can be cracked offline.' },
              { t: 'warn', v: '  RLS on "customers" did NOT protect "users" table.' },
            ]
          : [{ t: 'ok', v: `  Rows: ${JSON.stringify(data)}` }]),
      ])
    } catch (e) {
      setVulnLines(prev => [...prev, { t: 'warn', v: `  Error: ${e.message}` }])
    } finally {
      setRunningVuln(false)
    }
  }

  async function runFix() {
    setRunningFix(true)
    setFixLines([
      { t: 'info', v: '$ GET /api/lab/profile?name=...' },
      { t: 'warn', v: `  Payload: ${SQLI_PAYLOAD}` },
      { t: 'info', v: '  Parameterized query. RLS bound to JWT. Sending...' },
    ])
    try {
      const { status, data } = await labSqliFixed(aliceToken, SQLI_PAYLOAD)
      const hits = data.filter(r => Object.values(r).join('').includes('$2'))
      setFixLines(prev => [
        ...prev,
        { t: 'cmd', v: `  HTTP ${status} — ${data.length} row(s) returned` },
        hits.length
          ? { t: 'hit', v: `  ⚡ Hashes leaked: ${hits.length}` }
          : { t: 'ok', v: '  ✓ No password hashes in response.' },
        { t: 'ok', v: `  Result: ${JSON.stringify(data)}` },
        data.length === 0
          ? { t: 'ok', v: '  ✓ UNION payload treated as a literal string — empty result.' }
          : { t: 'ok', v: '  ✓ RLS filtered to only Alice\'s own rows.' },
      ])
    } catch (e) {
      setFixLines(prev => [...prev, { t: 'warn', v: `  Error: ${e.message}` }])
    } finally {
      setRunningFix(false)
    }
  }

  return (
    <div className="card mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-6 py-4 border-b border-slate-800 hover:bg-slate-800/30 transition-colors rounded-t-xl"
      >
        <span className="badge-vuln">OWASP A03</span>
        <span className="text-base font-bold text-slate-200">SQL Injection</span>
        <span className="text-xs text-slate-500 flex-1 text-left">UNION-based injection leaks password hashes from the users table</span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="p-6 animate-fade-in">
          {/* Explanation */}
          <div className="card-elevated p-4 mb-5 text-sm text-slate-400 leading-relaxed">
            <div className="flex gap-2">
              <Info size={15} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                The vulnerable endpoint concatenates user input directly into SQL.
                A UNION attack escapes the <code className="text-cyan-400 text-xs">customers</code> table (which has RLS)
                and reads directly from <code className="text-cyan-400 text-xs">users</code> — which has <strong className="text-slate-300">no RLS</strong>.
                The fix uses a parameterised query; the injection payload is treated as a literal string.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Vulnerable panel */}
            <div className={`rounded-xl border border-red-900/40 overflow-hidden`}>
              <PanelHeader variant="vuln" />
              <div className="p-4 space-y-3">
                <div>
                  <div className="label">Endpoint</div>
                  <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1.5 rounded block">GET /api/lab/profile/vuln?name=…</code>
                </div>
                <div>
                  <div className="label">Attack payload</div>
                  <code className="text-xs text-red-300 bg-black/40 px-2 py-1.5 rounded block break-all">{SQLI_PAYLOAD}</code>
                </div>
                <div>
                  <div className="label">Vulnerability</div>
                  <code className="text-xs text-slate-400 bg-black/40 px-2 py-1.5 rounded block">
                    {"SELECT … WHERE full_name ILIKE '%\" + name + \"%'"}<br/>
                    {'// String concat — no parameterisation'}<br/>
                    {'// No auth required (developer mistake)'}
                  </code>
                </div>
                <div className="flex gap-2">
                  <button onClick={runVuln} disabled={runningVuln} className="btn-danger flex-1 justify-center">
                    {runningVuln ? <><RefreshCw size={13} className="animate-spin" /> Running…</> : <><Play size={13} /> Execute Attack</>}
                  </button>
                  <button onClick={() => setVulnLines([])} className="btn-secondary px-3">
                    <RotateCcw size={13} />
                  </button>
                </div>
                <TerminalOutput lines={vulnLines} />
              </div>
            </div>

            {/* Secure panel */}
            <div className={`rounded-xl border border-green-900/40 overflow-hidden`}>
              <PanelHeader variant="fix" />
              <div className="p-4 space-y-3">
                <div>
                  <div className="label">Endpoint</div>
                  <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1.5 rounded block">GET /api/lab/profile?name=…</code>
                </div>
                <div>
                  <div className="label">Same payload</div>
                  <code className="text-xs text-green-300 bg-black/40 px-2 py-1.5 rounded block break-all">{SQLI_PAYLOAD}</code>
                </div>
                <div>
                  <div className="label">Fix</div>
                  <code className="text-xs text-slate-400 bg-black/40 px-2 py-1.5 rounded block">
                    {"SELECT … WHERE full_name ILIKE ? ESCAPE '\\'"}<br/>
                    // Parameterised — payload is a literal<br/>
                    // rls.bind(jwtCustomerId) — SET LOCAL app.customer_id
                  </code>
                </div>
                <div className="flex gap-2">
                  <button onClick={runFix} disabled={runningFix || !ready} className="btn-success flex-1 justify-center">
                    {runningFix ? <><RefreshCw size={13} className="animate-spin" /> Running…</> : <><Play size={13} /> Test Defense</>}
                  </button>
                  <button onClick={() => setFixLines([])} className="btn-secondary px-3">
                    <RotateCcw size={13} />
                  </button>
                </div>
                <TerminalOutput lines={fixLines} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── A5: BOLA ──────────────────────────────────────────────────────────────────

function BolaSection({ aliceToken, ready }) {
  const [vulnLines, setVulnLines] = useState([])
  const [fixLines, setFixLines] = useState([])
  const [runningVuln, setRunningVuln] = useState(false)
  const [runningFix, setRunningFix] = useState(false)
  const [targetId, setTargetId] = useState('2')
  const [open, setOpen] = useState(true)

  async function runVuln() {
    setRunningVuln(true)
    setVulnLines([
      { t: 'info', v: `$ GET /api/lab/customer/${targetId}/vuln` },
      { t: 'warn', v: `  Alice's token used. Path param id = ${targetId} (Bob's customer ID)` },
      { t: 'warn', v: `  rls.bind(${targetId}) — attacker controls the RLS context!` },
    ])
    try {
      const { status, data } = await labBolaVuln(aliceToken, targetId)
      const name = data?.[0]?.full_name ?? JSON.stringify(data)
      setVulnLines(prev => [
        ...prev,
        { t: 'cmd', v: `  HTTP ${status} — ${data.length} row(s)` },
        { t: 'hit', v: `  ⚡ BOLA SUCCESSFUL — Alice sees: "${name}"` },
        { t: 'warn', v: `  Alice (cid=1) used path id=${targetId} to impersonate another customer.` },
        { t: 'warn', v: '  JWT is valid — but identity comes from URL, not from the token.' },
      ])
    } catch (e) {
      setVulnLines(prev => [...prev, { t: 'warn', v: `  Error: ${e.message}` }])
    } finally {
      setRunningVuln(false)
    }
  }

  async function runFix() {
    setRunningFix(true)
    setFixLines([
      { t: 'info', v: '$ GET /api/lab/customer' },
      { t: 'info', v: "  Alice's token used. Customer ID comes from JWT claim 'cid'." },
      { t: 'info', v: '  No path parameter — attacker cannot supply their own ID.' },
    ])
    try {
      const { status, data } = await labBolaFixed(aliceToken)
      const name = data?.[0]?.full_name ?? JSON.stringify(data)
      setFixLines(prev => [
        ...prev,
        { t: 'cmd', v: `  HTTP ${status} — ${data.length} row(s)` },
        { t: 'ok', v: `  ✓ Returns: "${name}" — Alice can only see herself.` },
        { t: 'ok', v: '  rls.bind(jwtCustomerId) — identity always from verified JWT.' },
        { t: 'ok', v: '  Trying id=2 or id=3 in the URL has no effect.' },
      ])
    } catch (e) {
      setFixLines(prev => [...prev, { t: 'warn', v: `  Error: ${e.message}` }])
    } finally {
      setRunningFix(false)
    }
  }

  return (
    <div className="card">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-6 py-4 border-b border-slate-800 hover:bg-slate-800/30 transition-colors rounded-t-xl"
      >
        <span className="badge-vuln">OWASP A01</span>
        <span className="text-base font-bold text-slate-200">Broken Object Level Authorization</span>
        <span className="text-xs text-slate-500 flex-1 text-left">Alice uses a valid JWT but supplies Bob's customer ID to bypass isolation</span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="p-6 animate-fade-in">
          <div className="card-elevated p-4 mb-5 text-sm text-slate-400 leading-relaxed">
            <div className="flex gap-2">
              <Info size={15} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                The vulnerable endpoint calls <code className="text-cyan-400 text-xs">rls.bind(urlId)</code> — accepting identity from the URL path.
                Alice is authenticated, but by supplying Bob's ID (<code className="text-amber-400 text-xs">id=2</code>) she can read his profile.
                The fix only ever calls <code className="text-cyan-400 text-xs">rls.bind(jwtCustomerId)</code> — identity is always extracted from
                the signed JWT, which the attacker cannot modify.
              </div>
            </div>
          </div>

          {/* Target selector */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <span className="text-xs text-slate-500">Attack target (customer ID):</span>
            {[['2', 'Bob'], ['3', 'Carol']].map(([id, name]) => (
              <button
                key={id}
                onClick={() => setTargetId(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${targetId === id
                    ? 'bg-red-900/30 border-red-700/50 text-red-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
              >
                ID={id} ({name})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Vulnerable */}
            <div className="rounded-xl border border-red-900/40 overflow-hidden">
              <PanelHeader variant="vuln" />
              <div className="p-4 space-y-3">
                <div>
                  <div className="label">Endpoint</div>
                  <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1.5 rounded block">GET /api/lab/customer/{'{id}'}/vuln</code>
                </div>
                <div>
                  <div className="label">Request</div>
                  <code className="text-xs text-slate-400 bg-black/40 px-2 py-1.5 rounded block">
                    Bearer: Alice's token (valid, cid=1)<br/>
                    Path: /api/lab/customer/<span className="text-red-400">{targetId}</span>/vuln<br/>
                    // attacker-controlled ID in URL
                  </code>
                </div>
                <div>
                  <div className="label">Vulnerable code</div>
                  <code className="text-xs text-slate-400 bg-black/40 px-2 py-1.5 rounded block">
                    rls.bind(requestedId) // ← URL parameter!<br/>
                    SELECT … WHERE id = requestedId
                  </code>
                </div>
                <div className="flex gap-2">
                  <button onClick={runVuln} disabled={runningVuln || !ready} className="btn-danger flex-1 justify-center">
                    {runningVuln ? <><RefreshCw size={13} className="animate-spin" /> Running…</> : <><Play size={13} /> Execute BOLA</>}
                  </button>
                  <button onClick={() => setVulnLines([])} className="btn-secondary px-3">
                    <RotateCcw size={13} />
                  </button>
                </div>
                <TerminalOutput lines={vulnLines} />
              </div>
            </div>

            {/* Secure */}
            <div className="rounded-xl border border-green-900/40 overflow-hidden">
              <PanelHeader variant="fix" />
              <div className="p-4 space-y-3">
                <div>
                  <div className="label">Endpoint</div>
                  <code className="text-xs text-slate-300 bg-slate-800 px-2 py-1.5 rounded block">GET /api/lab/customer</code>
                </div>
                <div>
                  <div className="label">Request</div>
                  <code className="text-xs text-slate-400 bg-black/40 px-2 py-1.5 rounded block">
                    Bearer: Alice's token (cid=1)<br/>
                    // No ID in URL — cannot be tampered<br/>
                    // ID always from JWT claim 'cid'
                  </code>
                </div>
                <div>
                  <div className="label">Secure code</div>
                  <code className="text-xs text-slate-400 bg-black/40 px-2 py-1.5 rounded block">
                    rls.bind(jwtCustomerId) // ← from JWT!<br/>
                    SELECT … WHERE id = jwtCustomerId
                  </code>
                </div>
                <div className="flex gap-2">
                  <button onClick={runFix} disabled={runningFix || !ready} className="btn-success flex-1 justify-center">
                    {runningFix ? <><RefreshCw size={13} className="animate-spin" /> Running…</> : <><Play size={13} /> Test Defense</>}
                  </button>
                  <button onClick={() => setFixLines([])} className="btn-secondary px-3">
                    <RotateCcw size={13} />
                  </button>
                </div>
                <TerminalOutput lines={fixLines} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SecurityLab() {
  const { aliceToken, ready, initError } = useLab()

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-red-900/30 border border-red-800/40 flex items-center justify-center">
            <FlaskConical size={18} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Ethical Hacking Laboratory</h1>
        </div>
        <p className="text-slate-500 text-sm">
          Live exploit demonstration against deliberately vulnerable endpoints, alongside their hardened counterparts.
          Real API calls — real responses.
        </p>
      </div>

      {/* Auth status */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border mb-6 text-xs
        ${ready
          ? 'bg-green-900/10 border-green-800/30'
          : initError
            ? 'bg-red-900/10 border-red-800/30'
            : 'bg-slate-800/50 border-slate-700/50'}`}
      >
        <div className={`w-2 h-2 rounded-full ${ready ? 'bg-green-400 animate-pulse' : initError ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
        {ready
          ? <span className="text-green-400">Lab ready — Alice's token acquired ({aliceToken?.slice(0, 24)}…)</span>
          : initError
            ? <span className="text-red-400">Init failed: {initError} — ensure backend is running on :8080</span>
            : <span className="text-slate-400">Acquiring Alice's token for authenticated endpoints…</span>}
      </div>

      <SqliSection aliceToken={aliceToken} ready={ready} />
      <BolaSection aliceToken={aliceToken} ready={ready} />
    </div>
  )
}
