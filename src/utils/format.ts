export function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1)
    return `${sign}$${val.endsWith('.0') ? val.slice(0, -2) : val}M`
  }
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs}`
}
