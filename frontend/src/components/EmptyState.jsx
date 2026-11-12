import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here', message = '' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: '8px',
      color: 'var(--text-muted)',
    }}>
      <Icon size={32} strokeWidth={1.5} />
      <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{title}</div>
      {message && <div style={{ fontSize: '13px' }}>{message}</div>}
    </div>
  )
}
