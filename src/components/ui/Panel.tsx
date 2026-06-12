import type { ReactNode } from 'react'

interface PanelProps {
  title?: string
  children: ReactNode
  className?: string
}

export function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <div className={`panel ${className}`}>
      {title && <div className="panel-header">{title}</div>}
      <div className="panel-body">{children}</div>
    </div>
  )
}
