import type { CSSProperties } from 'react'

export const inputStyle: CSSProperties = {
  padding: '6px 8px', background: '#000', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none',
}

export const selectStyle: CSSProperties = {
  ...inputStyle, cursor: 'pointer',
}

export const btnStyle: CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 12, padding: '2px 8px',
  border: '1px solid var(--border)', background: '#000',
  color: 'var(--text-dim)', cursor: 'pointer',
  textTransform: 'uppercase', letterSpacing: 0.3,
}

export const primaryBtnStyle: CSSProperties = {
  padding: '6px 12px', background: 'var(--accent)', color: '#000',
  border: 'none', fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer',
}
