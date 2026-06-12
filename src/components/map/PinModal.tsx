import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { MapPin } from './GameMap'

interface PinModalProps {
  open: boolean
  onClose: () => void
  pin: MapPin | null
  isNew: boolean
  onSave: (data: { label: string; description: string; visibility: string }) => Promise<void>
  onDelete?: () => Promise<void>
  currentPlayerId?: string
}

export function PinModal({ open, onClose, pin, isNew, onSave, onDelete, currentPlayerId }: PinModalProps) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (pin && !isNew) {
      setLabel(pin.label)
      setDescription(pin.description)
      setVisibility(pin.visibility)
    } else {
      setLabel('')
      setDescription('')
      setVisibility('private')
    }
  }, [open, pin, isNew])

  async function handleSave() {
    if (!label.trim()) return
    setSaving(true)
    try {
      await onSave({ label, description, visibility })
      onClose()
    } catch { }
    setSaving(false)
  }

  const isOwner = pin && currentPlayerId && pin.created_by === currentPlayerId
  const isAdminPin = pin?.type === 'admin'

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'New Pin' : pin?.label || 'Pin'} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)', fontSize: 14 }}>
        {isNew && (
          <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0 }}>
            Double-clicked at ({pin?.x.toFixed(1)}, {pin?.y.toFixed(1)})
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Label *</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            disabled={!isNew && !isOwner}
            style={{ padding: '6px 8px', background: '#000', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={!isNew && !isOwner}
            rows={3}
            style={{ padding: '6px 8px', background: '#000', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none', resize: 'vertical' }}
          />
        </div>
        {!isAdminPin && (isNew || isOwner) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Visibility</label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value)}
              style={{ padding: '6px 8px', background: '#000', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none' }}
            >
              <option value="private">Private (only you)</option>
              <option value="shared">Shared (visible to others)</option>
            </select>
          </div>
        )}
        {pin && !isNew && (
          <div style={{ color: 'var(--text-dim)', fontSize: 11, display: 'flex', gap: 16 }}>
            <span>Type: {pin.type}</span>
            {pin.type === 'player' && <span>Visibility: {pin.visibility}</span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          {(isNew || isOwner) && (
            <>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              {isNew && <Button onClick={handleSave} disabled={saving || !label.trim()}>{saving ? 'Saving...' : 'Create'}</Button>}
              {!isNew && isOwner && <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>}
              {!isNew && isOwner && !isAdminPin && onDelete && (
                <Button variant="danger" onClick={onDelete}>Delete</Button>
              )}
            </>
          )}
          {!isNew && !isOwner && (
            <Button variant="secondary" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
