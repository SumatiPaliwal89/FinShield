const VARIANTS = {
  success: { color: 'var(--accent)', bg: 'var(--accent-light)', border: 'rgba(59,130,246,0.3)' },
  danger:  { color: 'var(--danger)', bg: 'var(--danger-light)', border: '#FBD0CC' },
  warning: { color: '#8A5D00', bg: 'var(--warning-light)', border: '#F5D78E' },
  info:    { color: 'var(--info)', bg: 'var(--info-light)', border: '#BFDBFE' },
  neutral: { color: 'var(--text-secondary)', bg: 'var(--bg)', border: 'var(--border)' },
}

export default function Badge({ variant = 'neutral', children, dot = false }) {
  const style = VARIANTS[variant] ?? VARIANTS.neutral
  return (
    <span
      className="badge"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      {dot && (
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: style.color, flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  )
}
