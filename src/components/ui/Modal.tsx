import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#0a0a0a', border: '1px solid var(--border)', width: wide ? 600 : 400,
        maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--sans)', fontSize: 14, textTransform: 'uppercase',
          letterSpacing: 1, color: 'var(--cyan-bright)',
        }}>
          {title}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 16, padding: 0, lineHeight: 1,
            }}
          >×</button>
        </div>
        <div style={{ padding: 14, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
