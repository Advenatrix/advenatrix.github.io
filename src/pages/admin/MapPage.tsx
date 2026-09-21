import { useEffect, useState, useRef } from 'react'
import { Panel, Button, FlexCol, FlexRow } from '../../components/ui'

export function MapPage() {
  const [mapUrl, setMapUrl] = useState('')
  const [mapDimensions, setMapDimensions] = useState({ width: 1920, height: 1080 })
  const [previewUrl, setPreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('georp_map_url')
    if (stored) {
      setMapUrl(stored)
      setPreviewUrl(stored)
    }
    const w = localStorage.getItem('georp_map_width')
    const h = localStorage.getItem('georp_map_height')
    if (w) setMapDimensions(d => ({ ...d, width: parseInt(w) }))
    if (h) setMapDimensions(d => ({ ...d, height: parseInt(h) }))
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setPreviewUrl(dataUrl)
      const img = new Image()
      img.onload = () => {
        setMapDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!previewUrl) return
    setSaving(true)
    setMessage('')
    localStorage.setItem('georp_map_url', previewUrl)
    localStorage.setItem('georp_map_width', String(mapDimensions.width))
    localStorage.setItem('georp_map_height', String(mapDimensions.height))
    setMapUrl(previewUrl)
    setMessage('Map saved. Pins will auto-resize (they use percentage coordinates).')
    setSaving(false)
  }

  return (
    <FlexCol gap={20}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
        Map Management
      </div>

      {message && (
        <div style={{
          padding: '8px 12px', background: '#000', border: '1px solid var(--green-bright)',
          color: 'var(--green-bright)', fontFamily: 'var(--mono)', fontSize: 13,
        }}>{message}</div>
      )}

      <Panel title="Upload Map">
        <FlexCol gap={12}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)' }}>
            Current dimensions: {mapDimensions.width} x {mapDimensions.height}px
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}
          />
          <FlexRow gap={8}>
            <Button onClick={handleSave} disabled={saving || !previewUrl}>
              {saving ? 'Saving...' : 'Save Map'}
            </Button>
            <Button variant="secondary" onClick={() => {
              localStorage.removeItem('georp_map_url')
              localStorage.removeItem('georp_map_width')
              localStorage.removeItem('georp_map_height')
              setPreviewUrl('')
              setMapUrl('')
              setMessage('Reset to default map. Reload pages to see default.')
            }}>
              Reset to Default
            </Button>
          </FlexRow>
        </FlexCol>
      </Panel>

      {previewUrl && (
        <Panel title="Preview">
          <div style={{
            position: 'relative', border: '1px solid var(--border)', overflow: 'hidden',
            maxHeight: 400, display: 'flex', justifyContent: 'center', background: '#000',
          }}>
            <img src={previewUrl} alt="Map preview" style={{
              maxWidth: '100%', maxHeight: 400, objectFit: 'contain',
            }} />
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            Pins use percentage coordinates (0-100), so they auto-resize to any map dimensions.
          </div>
        </Panel>
      )}
    </FlexCol>
  )
}
