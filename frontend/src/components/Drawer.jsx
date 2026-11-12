import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Drawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div
        onClick={onClose}
        style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }}
      />
      <div
        className="animate-slide-in-right"
        style={{
          width: '380px',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
