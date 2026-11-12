import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: '8px',
    }}>
      <AlertTriangle size={32} strokeWidth={1.5} style={{ color: 'var(--danger)' }} />
      <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary" style={{ marginTop: '8px' }}>
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}
