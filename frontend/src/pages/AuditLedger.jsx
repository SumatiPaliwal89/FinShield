import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getAuditEvents } from '../api/client'
import { SkeletonTable } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import Drawer from '../components/Drawer'
import Badge from '../components/Badge'
import { formatDateTime, relativeTime, shortHash } from '../utils/format'
import { Link2 } from 'lucide-react'

function AuditDrawer({ event, onClose }) {
  if (!event) return null
  const payload = event.payload ?? event.canonicalJson ?? '{}'
  const prevHash = event.prevHash ?? event.prev_hash
  const hash = event.hash ?? event.eventHash

  return (
    <Drawer isOpen={!!event} onClose={onClose} title={`Event #${event.id}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-flat" style={{ padding: '12px' }}>
          {[
            ['ID', event.id],
            ['Type', event.eventType ?? event.event_type],
            ['Actor', event.actor ?? event.actorId ?? event.actor_id],
            ['Time', formatDateTime(event.createdAt ?? event.created_at)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span className="mono" style={{ fontFamily: 'monospace', fontSize: '14px' }}>{String(v ?? 'n/a')}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Prev Hash</div>
          <div className="terminal" style={{ wordBreak: 'break-all', fontSize: '11px', lineHeight: 1.5, padding: '8px 10px' }}>
            {prevHash ?? <span style={{ color: '#484F58' }}>null (genesis event)</span>}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Hash</div>
          <div className="terminal" style={{ wordBreak: 'break-all', fontSize: '11px', lineHeight: 1.5, padding: '8px 10px' }}>
            {hash ?? 'not available'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Canonical Payload</div>
          <div className="terminal" style={{ maxHeight: '240px', overflow: 'auto', fontSize: '11px' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {typeof payload === 'string' ? (() => { try { return JSON.stringify(JSON.parse(payload), null, 2) } catch { return payload } })() : JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

export default function AuditLedger() {
  const { auth } = useAuth()
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => getAuditEvents(auth.token),
  })

  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <>
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Audit Ledger</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            A complete, tamper-evident record of every financial and security event. Click any row to inspect its full details. All records are permanent and cannot be modified.
          </p>
        </div>

        {/* Hash chain visualization */}
        {!isLoading && data && data.length > 0 && (
          <div className="card" style={{ padding: '16px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              SHA-256 Chain — last {Math.min(data.length, 5)} events
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', paddingBottom: '4px' }}>
              {data.slice(-5).map((evt, i, arr) => {
                const hash = evt.hash ?? evt.eventHash ?? ''
                const type = evt.eventType ?? evt.event_type ?? 'EVENT'
                const isLast = i === arr.length - 1
                return (
                  <div key={evt.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div
                      onClick={() => setSelected(evt)}
                      style={{
                        background: isLast ? 'rgba(59,130,246,0.1)' : '#080A0D',
                        border: `1px solid ${isLast ? 'rgba(59,130,246,0.4)' : '#1E2230'}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        minWidth: '110px',
                        boxShadow: isLast ? '0 0 12px rgba(59,130,246,0.15)' : 'none',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '4px' }}>#{evt.id}</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: isLast ? '#3B82F6' : 'var(--text-secondary)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{type}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#3A4255', letterSpacing: '-0.01em' }}>
                        {hash ? hash.slice(0, 8) + '…' : 'no hash'}
                      </div>
                      {isLast && <div style={{ fontSize: '10px', color: '#3B82F6', marginTop: '4px', fontFamily: 'monospace' }}>&larr; HEAD</div>}
                    </div>
                    {!isLast && (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', color: '#2A3045', fontSize: '20px', flexShrink: 0 }}>&#8594;</div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Each block's hash includes the previous block's hash. Modify any block and every subsequent hash breaks.
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table-root">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>Type</th>
                  <th>Actor</th>
                  <th>Time</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {(!data || data.length === 0) ? (
                  <tr><td colSpan={5}><EmptyState icon={Link2} title="No audit events" /></td></tr>
                ) : data.map(evt => {
                  const hash = evt.hash ?? evt.eventHash
                  const type = evt.eventType ?? evt.event_type ?? 'EVENT'
                  const actor = evt.actor ?? evt.actorId ?? evt.actor_id ?? 'system'
                  const ts = evt.createdAt ?? evt.created_at
                  return (
                    <tr key={evt.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(evt)}>
                      <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{evt.id}</td>
                      <td style={{ fontSize: '14px' }}>
                        <Badge variant={type.includes('TRANSFER') ? 'info' : type.includes('SECURITY') ? 'warning' : 'neutral'}>
                          {type}
                        </Badge>
                      </td>
                      <td className="mono" style={{ fontSize: '14px' }}>{actor}</td>
                      <td title={formatDateTime(ts)} style={{ fontSize: '14px', color: 'var(--text-muted)', cursor: 'default' }}>
                        {relativeTime(ts)}
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                          {shortHash(hash)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>{data.length} events total</div>
        )}
      </div>

      <AuditDrawer event={selected} onClose={() => setSelected(null)} />
    </>
  )
}
