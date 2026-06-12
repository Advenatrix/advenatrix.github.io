import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

interface FlexProps {
  gap?: number
  style?: CSSProperties
  children: ReactNode
}

export function FlexCol({ gap, style, children, ...props }: FlexProps & HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }} {...props}>{children}</div>
}

export function FlexRow({ gap, style, children, ...props }: FlexProps & HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: 'flex', gap, alignItems: 'center', ...style }} {...props}>{children}</div>
}

export function SpaceBetween({ gap, style, children, ...props }: FlexProps & HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap, ...style }} {...props}>{children}</div>
}

export function FlexEnd({ gap, style, children, ...props }: FlexProps & HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: 'flex', gap, justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, ...style }} {...props}>{children}</div>
}
