import type { CSSProperties, ReactNode } from 'react'
import { inputStyle, selectStyle } from './FormStyles'
import { FlexCol, FlexRow } from './Flex'

interface InputFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
  rows?: number
  min?: number
  max?: number
  step?: number
  style?: CSSProperties
}

export function InputField({ label, value, onChange, type = 'text', placeholder, disabled, multiline, rows = 3, min, max, step, style }: InputFieldProps) {
  const Tag = multiline ? 'textarea' : 'input'
  const extraProps = multiline ? { rows } : { type, min, max, step }
  return (
    <FlexCol gap={2}>
      <Label>{label}</Label>
      <Tag
        {...extraProps}
        value={value} placeholder={placeholder}
        onChange={(e: any) => onChange(e.target.value)} disabled={disabled}
        style={{ ...inputStyle, ...(multiline ? { resize: 'vertical' } : {}), ...style }}
      />
    </FlexCol>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
}

export function SelectField({ label, value, onChange, children, disabled }: SelectFieldProps) {
  return (
    <FlexCol gap={2}>
      <Label>{label}</Label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={selectStyle}>
        {children}
      </select>
    </FlexCol>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <span style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</span>
}

export function FormActions({ children }: { children: ReactNode }) {
  return <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>{children}</FlexRow>
}
