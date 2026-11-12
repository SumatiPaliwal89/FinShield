import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

const COMMANDS = [
  { label: 'Overview',       path: '/overview' },
  { label: 'Accounts',       path: '/accounts' },
  { label: 'Transfers',      path: '/transfers' },
  { label: 'Activity',       path: '/activity' },
  { label: 'Security Center',path: '/security', auditorOnly: true },
  { label: 'Audit Ledger',   path: '/audit',    auditorOnly: true },
  { label: 'Threat Lab',     path: '/lab' },
  { label: 'Session & Access', path: '/session' },
]

export default function CommandPalette({ onClose, isAuditor }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const items = COMMANDS.filter(c => {
    if (c.auditorOnly && !isAuditor) return false
    return c.label.toLowerCase().includes(query.toLowerCase())
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [query])

  function go(path) {
    navigate(path)
    onClose()
  }

  function onKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(v => Math.min(v + 1, items.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)) }
    if (e.key === 'Enter' && items[selected]) go(items[selected].path)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '120px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card animate-fade-in" style={{ width: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Go to page…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: '14px', background: 'transparent',
              color: 'var(--text-primary)',
            }}
          />
          <kbd style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 5px', borderRadius: '4px' }}>Esc</kbd>
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {items.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No results</div>
          )}
          {items.map((item, i) => (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                border: 'none', borderBottom: '1px solid var(--border)',
                background: i === selected ? 'var(--bg)' : 'transparent',
                color: i === selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: i === selected ? 500 : 400,
              }}
              onMouseEnter={() => setSelected(i)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
