import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { getAccounts, getTransfers, postTransfer, getLedger } from '../api/client'
import { SkeletonTable } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import Badge from '../components/Badge'
import { formatINR, relativeTime } from '../utils/format'
import { RefreshCw, Copy, ArrowRight, CheckCircle } from 'lucide-react'

function genKey() {
  return 'FS-' + [...crypto.getRandomValues(new Uint8Array(12))]
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 20)
}

const ERROR_CODES = {
  FS001: 'Insufficient funds',
  FS002: 'Destination account not found',
  FS003: 'Not the account owner or missing context',
  FS004: 'Idempotency key already used',
  FS005: 'Account inactive or currency mismatch',
  FS006: 'Invalid request parameters',
}

export default function Transfers() {
  const { auth } = useAuth()
  const token = auth.token

  const [idemKey, setIdemKey] = useState(genKey)
  const [from, setFrom] = useState('')
  const [to, setTo]   = useState('')
  const [amount, setAmount] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [txError, setTxError] = useState(null)
  const [lastPayload, setLastPayload] = useState(null)

  const user = auth?.claims?.sub
  const accounts = useQuery({ queryKey: ['accounts',  user], queryFn: () => getAccounts(token),  enabled: !!token })
  const transfers = useQuery({ queryKey: ['transfers', user], queryFn: () => getTransfers(token), enabled: !!token })
  const ledger = useQuery({ queryKey: ['ledger',    user], queryFn: () => getLedger(token),    enabled: !!token })

  const accountOptions = accounts.data ?? []

  function copyKey() {
    navigator.clipboard.writeText(idemKey).then(() => toast.success('Copied'))
  }

  function regenKey() { setIdemKey(genKey()) }

  async function submit() {
    setSubmitting(true)
    setTxError(null)
    const payload = { idemKey, from, to, amount: parseFloat(amount) }
    setLastPayload(payload)
    try {
      const res = await postTransfer(token, idemKey, from, to, parseFloat(amount))
      setResult(res)
      setConfirm(false)
      transfers.refetch()
      accounts.refetch()
      ledger.refetch()
      toast.success('Transfer submitted')
    } catch (err) {
      const code = err.data?.errorCode ?? ''
      const desc = ERROR_CODES[code] ?? err.message
      setTxError({ code, desc, raw: err.message })
      setConfirm(false)
      toast.error(`Transfer failed${code ? ` · ${code}` : ''}`)
    } finally {
      setSubmitting(false)
    }
  }

  function retryWithSameKey() {
    if (lastPayload) {
      setIdemKey(lastPayload.idemKey)
      setFrom(lastPayload.from)
      setTo(lastPayload.to)
      setAmount(String(lastPayload.amount))
      setResult(null)
      setTxError(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      {/* Form */}
      <div style={{ flex: '0 0 360px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>New Transfer</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
            Send funds between accounts. Every transfer is atomic and either fully completes or fully rolls back. Duplicate requests are automatically detected and safely ignored.
          </p>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Idempotency key</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="input mono" value={idemKey} onChange={e => setIdemKey(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1 }} />
              <button className="btn btn-secondary" onClick={copyKey} title="Copy"><Copy size={14} /></button>
              <button className="btn btn-secondary" onClick={regenKey} title="Regenerate"><RefreshCw size={14} /></button>
            </div>
          </div>

          <div>
            <label className="label">From account</label>
            <select className="input" value={from} onChange={e => setFrom(e.target.value)} required>
              <option value="">Select…</option>
              {accountOptions.map(a => (
                <option key={a.account_number} value={a.account_number}>
                  {a.account_number} · {formatINR(a.balance)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">To account</label>
            <input className="input mono" value={to} onChange={e => setTo(e.target.value)}
              placeholder="Account number" style={{ fontFamily: 'monospace', fontSize: '14px' }} />
          </div>

          <div>
            <label className="label">Amount (INR)</label>
            <input className="input tabular" type="number" min="0.01" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>

          {txError && (
            <div style={{ background: 'var(--danger-light)', border: '1px solid #FBD0CC', borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {txError.code && (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'var(--danger)',
                    background: '#FBCECE', border: '1px solid #FBD0CC', padding: '1px 6px', borderRadius: '3px' }}>
                    {txError.code}
                  </span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500 }}>{txError.desc}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{txError.raw}</div>
              <button className="btn btn-secondary" onClick={retryWithSameKey} style={{ marginTop: '8px', fontSize: '11px' }}>
                <RefreshCw size={12} /> Retry with same key
              </button>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Success card */}
              <div style={{ background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <CheckCircle size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>Transfer complete</span>
                </div>
                {[['Transfer ID', result.data?.transfer_id ?? result.data?.id ?? 'N/A'],
                  ['Status', result.data?.status ?? 'COMPLETED'],
                  ['HTTP', result.status]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                    <span className="mono" style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '11px' }}>{String(v)}</span>
                  </div>
                ))}
              </div>

              {/* Atomic proof panel */}
              <div style={{ background: '#060810', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3B82F6' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#3B82F6', letterSpacing: '0.08em', fontFamily: 'monospace' }}>ATOMIC TRANSACTION PROOF</span>
                </div>
                <div style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.9 }}>
                  <div style={{ color: '#EF4444' }}>↓ DEBIT &nbsp; {from} &nbsp; -{formatINR(parseFloat(amount) || 0)}</div>
                  <div style={{ color: '#10B981' }}>↑ CREDIT &nbsp; {to} &nbsp; +{formatINR(parseFloat(amount) || 0)}</div>
                  <div style={{ color: '#3A4255', marginTop: '6px', fontSize: '11px' }}>Both entries committed in one ACID transaction — or neither.</div>
                  <div style={{ color: '#3A4255', fontSize: '11px' }}>Balance constraint enforced at the database level, not in application code.</div>
                </div>
              </div>

              {/* Idempotency demo */}
              {lastPayload && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B', marginBottom: '3px' }}>Try duplicate request</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Submit the same transfer again with the same idempotency key to prove duplicate prevention.</div>
                  <button className="btn btn-secondary" onClick={() => submit()} disabled={submitting}
                    style={{ fontSize: '12px', borderColor: 'rgba(245,158,11,0.3)' }}>
                    {submitting ? 'Submitting...' : 'Send duplicate request'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!confirm ? (
            <button
              className="btn btn-primary"
              disabled={!from || !to || !amount || submitting || parseFloat(amount) <= 0}
              onClick={() => setConfirm(true)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <ArrowRight size={15} /> Review Transfer
            </button>
          ) : (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Confirm transfer</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                <span className="mono">{from}</span> → <span className="mono">{to}</span> · <strong className="tabular">{formatINR(parseFloat(amount) || 0)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={submit} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? 'Submitting…' : 'Confirm'}
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent transfers table */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '12px' }}>
          <div className="section-title">Recent transfers</div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>Your recent transfer history</p>
        </div>
        {transfers.isLoading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : transfers.error ? (
          <ErrorState message={transfers.error.message} onRetry={transfers.refetch} />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table-root" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {(!transfers.data || transfers.data.length === 0) ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px', fontFamily: 'monospace', fontSize: '13px' }}>No transfers yet</td></tr>
                ) : transfers.data.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.from_account_number ? '#79C0FF' : 'var(--text-disabled)' }}>{t.from_account_number ?? 'external'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.to_account_number ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>{t.to_account_number ?? 'external'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatINR(t.amount)}</td>
                    <td><Badge variant={t.status === 'COMPLETED' ? 'success' : t.status === 'FAILED' ? 'danger' : 'neutral'}>{t.status ?? 'COMPLETED'}</Badge></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{relativeTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
