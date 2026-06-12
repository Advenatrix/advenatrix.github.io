interface MapPinIconProps {
  color?: string
  size?: number
}

export function MapPinIcon({ color = 'var(--accent)', size = 24 }: MapPinIconProps) {
  const height = Math.round(size * 28 / 24)
  return (
    <svg width={size} height={height} viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 9 12 16 12 16s12-7 12-16C24 5.4 18.6 0 12 0z"
        fill={color}
        stroke="#000"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="4" fill="#000" />
    </svg>
  )
}
