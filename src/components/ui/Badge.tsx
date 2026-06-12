interface BadgeProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{label}</span>
}
