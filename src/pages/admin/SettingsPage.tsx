import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../../services/adminApi'
import { Panel, Button, FlexCol, InputField } from '../../components/ui'

export function SettingsPage() {
  const [form, setForm] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getSettings().then(({ settings }) => {
      setForm({ ...settings })
    }).catch((e: any) => console.error(e)).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const { settings: updated } = await updateSettings({
        turn_duration_hours: parseInt(form.turn_duration_hours),
        starting_gdp: parseInt(form.starting_gdp),
        starting_population: parseInt(form.starting_population),
        starting_qol: parseInt(form.starting_qol),
        base_income_multiplier: parseFloat(form.base_income_multiplier),
      })
      setForm({ ...updated })
      setMessage('Settings saved.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 14 }}>Loading settings...</div>

  const fields = [
    { key: 'turn_duration_hours', label: 'Turn Duration (hours)', type: 'number' },
    { key: 'starting_gdp', label: 'Starting GDP', type: 'number' },
    { key: 'starting_population', label: 'Starting Population', type: 'number' },
    { key: 'starting_qol', label: 'Starting QoL', type: 'number' },
    { key: 'base_income_multiplier', label: 'Base Income Multiplier', type: 'number', step: 0.1 },
  ]

  return (
    <FlexCol gap={16}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-bright)' }}>
        Game Settings
      </div>

      {message && (
        <div style={{
          padding: '8px 12px', background: '#000', border: '1px solid var(--amber-bright)',
          color: 'var(--amber-bright)', fontFamily: 'var(--mono)', fontSize: 13,
        }}>{message}</div>
      )}

      <Panel title="Settings">
        <FlexCol gap={12} style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
          {fields.map(field => (
            <InputField key={field.key} label={field.label} type={field.type}
              value={String(form[field.key] ?? '')}
              onChange={v => setForm(f => ({ ...f, [field.key]: v }))}
              step={field.step} style={{ maxWidth: 300 }}
            />
          ))}
          <div style={{ marginTop: 8 }}>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </FlexCol>
      </Panel>
    </FlexCol>
  )
}
