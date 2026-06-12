import { useRef, useState, useCallback } from 'react'
import worldMap from '../../assets/world_map.png'

export interface MapPin {
  id: string
  nation_id: string | null
  x: number
  y: number
  label: string
  description: string
  type: 'admin' | 'player'
  visibility: 'private' | 'shared'
  created_by: string
}

interface GameMapProps {
  pins: MapPin[]
  currentPlayerId?: string
  onPinClick?: (pin: MapPin) => void
  onMapDoubleClick?: (x: number, y: number) => void
}

export function GameMap({ pins, currentPlayerId, onPinClick, onMapDoubleClick }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!onMapDoubleClick || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onMapDoubleClick(x, y)
  }, [onMapDoubleClick])

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
        cursor: onMapDoubleClick ? 'crosshair' : 'default',
      }}
    >
      <img
        src={worldMap}
        alt="World Map"
        draggable={false}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          userSelect: 'none',
        }}
      />
      {pins.map(pin => {
        const isMine = pin.created_by === currentPlayerId
        const isAdminPin = pin.type === 'admin'
        const color = isAdminPin ? 'var(--cyan-bright)' : isMine ? 'var(--green-bright)' : 'var(--amber-bright)'
        return (
          <div
            key={pin.id}
            onClick={() => onPinClick?.(pin)}
            onMouseEnter={() => setHoveredPin(pin.id)}
            onMouseLeave={() => setHoveredPin(null)}
            style={{
              position: 'absolute',
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: 'translate(-50%, -100%)',
              cursor: 'pointer',
              zIndex: hoveredPin === pin.id ? 10 : 1,
            }}
          >
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
              <path
                d="M12 0C5.4 0 0 5.4 0 12c0 9 12 16 12 16s12-7 12-16C24 5.4 18.6 0 12 0z"
                fill={color}
                stroke="#000"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="11" r="4" fill="#000" />
            </svg>
            {(hoveredPin === pin.id) && (
              <div style={{
                position: 'absolute',
                left: '50%',
                bottom: '100%',
                transform: 'translateX(-50%)',
                marginBottom: 4,
                background: '#000',
                border: '1px solid var(--border)',
                padding: '4px 8px',
                fontFamily: 'var(--sans)',
                fontSize: 12,
                color: 'var(--text-bright)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 20,
              }}>
                {pin.label}
                <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                  {isAdminPin ? 'Admin' : isMine ? 'Your pin' : 'Shared'}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
