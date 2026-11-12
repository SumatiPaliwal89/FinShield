export function SkeletonLine({ width = '100%', height = '14px', style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: '4px', ...style }}
    />
  )
}

export function SkeletonCard({ height = '80px' }) {
  return (
    <div className="card" style={{ padding: '16px', height }}>
      <SkeletonLine width="40%" height="12px" />
      <SkeletonLine width="60%" height="20px" style={{ marginTop: '8px' }} />
      <SkeletonLine width="30%" height="11px" style={{ marginTop: '8px' }} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '0',
        borderBottom: '1px solid var(--border)',
        padding: '8px 12px',
        background: 'var(--bg)',
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="60%" height="11px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            padding: '10px 12px',
            borderBottom: r < rows - 1 ? '1px solid var(--border)' : 'none',
            gap: '0',
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={c === 0 ? '70%' : '50%'} height="13px" />
          ))}
        </div>
      ))}
    </div>
  )
}
