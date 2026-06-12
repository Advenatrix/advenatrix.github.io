import { useEffect, useRef, useState } from 'react'
import { Panel, FlexCol, FlexRow, SpaceBetween } from '../components/ui'
import {
  getNation,
  getEcoHistory,
  updatePolicies,
  updateSubsidies,
  getUpkeepBreakdown,
  createCompany,
} from '../services/api'
import { useDebouncedCallback } from '../hooks/useDebounce'
import { fmtMoney } from '../utils/format'
import {
  SECTORS, SECTOR_COLORS, LEVELS,
  TAX_RATES_DEC, TAX_RATES, COMPANY_TAX_RATES,
  CIVIL_COST_MULT,
  ARMY_UPKEEP_MULT, AIRFORCE_UPKEEP_MULT, NAVAL_UPKEEP_MULT,
  ARMY_BUDGET_MULT, AIRFORCE_BUDGET_MULT, NAVAL_BUDGET_MULT,
  FUNDING_LABELS, BASE_FACTOR,
} from '../game/constants'
import type { Company, SectorCap } from '../game/types'

type TooltipKey = 'tax_laws' | 'corporate' | 'civil' | 'army' | 'airforce' | 'naval'
type GraphMetric = 'gdp' | 'treasury' | 'qol'

interface UpkeepBreakdown {
  total: number
  byFormation: { name: string; upkeep: number; count: number }[]
  unassigned: number
}

const METRIC_CONFIG: Record<GraphMetric, { label: string; color: string; format: (v: number) => string }> = {
  gdp: { label: 'GDP', color: 'var(--green-bright)', format: fmtMoney },
  treasury: { label: 'Treasury', color: 'var(--cyan-bright)', format: fmtMoney },
  qol: { label: 'QoL', color: 'var(--cyan)', format: v => v.toFixed(1) },
}

const TAX_QOL_TEXT = ['+2/t', '+1/t', '0', '-2/t', '-4/t'] as const
const CIVIL_QOL_TEXT = ['-1/t', '0', '+1/t', '+2/t', '+3/t'] as const

// ─── SavingDots component ─────────────────────────────────────────────
// Shows three animated dots while an API save is in progress.
// "saving" is a Set<string> — each key in the set represents an in-flight save.
// A Set is used instead of a boolean so we can track MULTIPLE concurrent saves
// (e.g., tax policy + subsidies saving at the same time).
//
// Props:
//   saving: boolean — whether the dots should be visible and animating
function SavingDots({ saving }: { saving: boolean }) {
  return (
    // inline-flex makes the span shrink-wrap its children while staying inline
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2, width: 20, height: 12,
      // When not saving, opacity = 0 → invisible but still takes up space (no layout shift)
      opacity: saving ? 1 : 0, transition: 'opacity 0.2s',
    }}>
      {/* Three dots, each with a staggered animation delay (0s, 0.15s, 0.3s) */}
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: '50%', background: 'var(--cyan)',
          // The 'pulse' keyframes are defined in src/index.css (line 456)
          animation: saving ? `pulse 0.8s ease-in-out ${i * 0.15}s infinite` : 'none',
          display: 'inline-block',
        }} />
      ))}
    </span>
  )
}

// ─── SpendingSlider component ─────────────────────────────────────────
// A horizontal row of buttons representing the 5 levels for one policy.
//
// Props:
//   label    — display name (e.g., "Tax Laws", "Army")
//   levels   — array of level names (e.g., LEVELS)
//   value    — current selected index (0-4)
//   onChange — called with the new index when user clicks a level button
//   tooltip  — HTML string shown on hover with detailed breakdown
//   onHover  — callback to notify parent which tooltip key is being hovered
//   hoverKey — which tooltip key this slider corresponds to
function SpendingSlider({ label, levels, value, onChange, tooltip, getTooltip, onHover, hoverKey }: {
  label: string
  levels: readonly string[]
  value: number
  onChange: (v: number) => void
  tooltip?: string
  getTooltip?: (idx: number) => string
  onHover: (key: TooltipKey | null) => void
  hoverKey: TooltipKey
}) {
  const [hover, setHover] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const displayTooltip = getTooltip && hoveredIdx !== null ? getTooltip(hoveredIdx) : tooltip

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', position: 'relative' }}
      onMouseEnter={() => { setHover(true); onHover(hoverKey) }}
      onMouseLeave={() => { setHover(false); setHoveredIdx(null); onHover(null) }}
      onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text)', minWidth: 140, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'default' }}>
        {label}
      </span>

      <div style={{ display: 'flex', gap: 2 }}>
        {levels.map((l, i) => (
          <button
            key={l}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseMove={() => { if (hoveredIdx !== i) setHoveredIdx(i) }}
            style={{
              fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)',
              background: i === value ? 'var(--cyan)' : '#000',
              color: i === value ? '#000' : 'var(--text-dim)',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {hover && displayTooltip && (
        <div style={{
          position: 'fixed', left: mousePos.x + 14, top: mousePos.y - 8, zIndex: 200,
          background: '#111', border: '1px solid var(--border)', padding: '6px 10px',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-bright)',
          whiteSpace: 'pre-line', minWidth: 260, lineHeight: 1.5, pointerEvents: 'none',
        }}>
          {displayTooltip}
        </div>
      )}
    </div>
  )
}

// ─── Date formatting for the graph ────────────────────────────────────
// The game uses turn numbers that increment each month (48h per turn).
// Turn 1 = January 1930, Turn 2 = February 1930, ..., Turn 13 = January 1931, etc.
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function turnToDateShort(t: number): string {
  // turn_number is 1-based, so subtract 1 to get 0-based month index
  const total = t - 1
  // Month cycles every 12 turns; year advances every 12 turns
  return `${MONTHS[total % 12]} ${1930 + Math.floor(total / 12)}`
}

// ─── LineGraph component ──────────────────────────────────────────────
// Renders an SVG line chart for one economic metric across recent turns.
//
// Props:
//   data   — array of eco_history records with turn_number + metric values
//   metric — which field to plot (gdp, income, inflation, etc.)
function LineGraph({ data, metric }: { data: { turn_number: number; [key: string]: any }[]; metric: GraphMetric }) {
  // tooltip state: null = hidden, or { x, y, d } where d is the data point
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: any } | null>(null)
  // ref to the container div — used to compute mouse coordinates relative to the SVG
  const ref = useRef<HTMLDivElement>(null)

  if (data.length < 1) {
    return <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-dim)' }}>Not enough data</div>
  }

  const cfg = METRIC_CONFIG[metric]

  // Extract values for the selected metric, compute min/max for Y-axis scaling
  const values = data.map(d => d[metric])
  const max = Math.max(...values) * 1.1 || 1  // 10% headroom above max
  const min = Math.min(...values) * 0.9        // 10% padding below min
  const range = max - min || 1                 // avoid division by zero

  // SVG dimensions and padding
  const W = 411; const H = 194; const PAD = 52; const BPAD = 22

  // Scale functions: map data index (0..N-1) → X pixel, value → Y pixel
  const xScale = (i: number) => data.length <= 1
    ? (PAD + W - BPAD) / 2  // center if only 1 data point
    : PAD + (i / (data.length - 1)) * (W - PAD - BPAD)
  const yScale = (v: number) => H - 18 - ((v - min) / range) * (H - 18 - 8)

  // Build the polyline points string: "x1,y1 x2,y2 ..."
  const pts = data.map((d, i) => `${xScale(i)},${yScale(d[metric])}`).join(' ')

  // Y-axis tick marks (5 evenly spaced values)
  const numTicks = 5
  const ticks = Array.from({ length: numTicks }, (_, i) => {
    const v = min + (range / (numTicks - 1)) * i
    const y = yScale(v)
    return { v: cfg.format(v), y }
  })

  // X-axis labels: show first, last, and every 3rd turn to avoid clutter
  const xTicks = data.filter((_, i) => i === 0 || i === data.length - 1 || data[i].turn_number % 3 === 0)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let closest = data[0]
    let minDist = Infinity
    data.forEach((d, i) => {
      const dx = xScale(i) - mx
      const dy = yScale(d[metric]) - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) { minDist = dist; closest = d }
    })
    if (minDist < 30) {
      setTooltip({ x: mx + 12, y: my - 8, d: closest })
    } else {
      setTooltip(null)
    }
  }

  function handleMouseLeave() { setTooltip(null) }

  return (
    // The outer div holds the ref and positions the absolutely-positioned tooltip
    <div ref={ref} style={{ position: 'relative', background: '#0a0a0a', border: '1px solid var(--border)', padding: 0 }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', cursor: 'crosshair' }}
           onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        {/* Y-axis gridlines + labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD} y1={t.y} x2={W - BPAD} y2={t.y} stroke="#222" strokeWidth={1} />
            <text x={PAD - 6} y={t.y + 3} fill="var(--text-dim)" fontFamily="var(--mono)" fontSize={9} textAnchor="end">{t.v}</text>
          </g>
        ))}
        {/* X-axis date labels */}
        {xTicks.map((d, i) => {
          const idx = data.indexOf(d)
          const x = xScale(idx)
          return <text key={i} x={x} y={H - 2} fill="var(--text-dim)" fontFamily="var(--sans)" fontSize={8} textAnchor="middle">{turnToDateShort(d.turn_number)}</text>
        })}
        {/* The actual line connecting data points */}
        <polyline points={pts} fill="none" stroke={cfg.color} strokeWidth={2} strokeLinejoin="round" />
        {/* Data point dots */}
        {data.map((d, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(d[metric])} r={3.5} fill={cfg.color} stroke="#000" strokeWidth={1} />
        ))}
      </svg>
      {/* Hover tooltip overlay — absolutely positioned within the container */}
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y, pointerEvents: 'none', zIndex: 100,
          background: '#111', border: '1px solid var(--border)', padding: '4px 8px',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-bright)', whiteSpace: 'nowrap',
        }}>
          <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--sans)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {turnToDateShort(tooltip.d.turn_number)}
          </div>
          <div style={{ color: cfg.color }}>{cfg.label}: {cfg.format(tooltip.d[metric])}</div>
        </div>
      )}
    </div>
  )
}

// ─── EconomyPage main component ───────────────────────────────────────

// ─── EconomyPage main component ───────────────────────────────────────
// This is the full economy management screen. It receives:
//   nationId       — the current player's nation ID (string UUID)
//   companies      — array of Company objects for this nation
//   provinces      — array of Province objects (all provinces in the game)
//   initialSliders — the starting positions of all 6 sliders (from the nation DB row)
//   nation         — the Nation object (has pop, qol, gdp for computations)
export function EconomyPage({ nationId, companies, initialSliders, nation, treasury, sectorCaps }: {
  nationId: string
  companies: Company[]
  initialSliders: { tax_laws: number; corporate: number; army: number; airforce: number; naval: number; civil: number }
  nation?: { population: number; qol: number; gdp: number }
  treasury?: number
  sectorCaps?: Record<string, SectorCap>
}) {
  // ── Slider state ──────────────────────────────────────────────────
  // Each slider has its own useState. The initial value comes from the database
  // via the parent (GamePage), which fetches it from GET /api/game/nations/:id.
  // The slider buttons update local state immediately (for responsive UI) AND
  // trigger a debounced API call to persist the change.
  const [taxLaws, setTaxLaws] = useState(initialSliders.tax_laws)
  const [corporate, setCorporate] = useState(initialSliders.corporate)
  const [army, setArmy] = useState(initialSliders.army)
  const [airforce, setAirforce] = useState(initialSliders.airforce)
  const [naval, setNaval] = useState(initialSliders.naval)
  const [civil, setCivil] = useState(initialSliders.civil)

  // ── Economic history for the graph ────────────────────────────────
  // Fetched from the server on mount. Contains { turn_number, gdp, income, ... }
  // for every turn this nation has participated in. We slice the last 10 for the graph.
  const [ecoHistory, setEcoHistory] = useState<any[]>([])

  // Currently selected graph metric (default: GDP)
  const [metric, setMetric] = useState<GraphMetric>('gdp')

  // ── Markets state ──────────────────────────────────────────────────
  const [showCreateCompany, setShowCreateCompany] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanySector, setNewCompanySector] = useState<string>(SECTORS[0])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // ── Saving tracker ────────────────────────────────────────────────
  // A Set of string keys representing in-flight API saves.
  // Each key is something like 'policies', 'subsidy-{uuid}', 'tap-{prov}-{resource}'.
  // Using a Set lets us show saving indicators independently for each operation.
  const [saving, setSaving] = useState<Set<string>>(new Set())

  // ── Company subsidies ─────────────────────────────────────────────
  // A map from companyId → subsidyAmount. Initialized from the companies prop.
  // Updated on every keystroke in the subsidy input field.
  const [companySubsidies, setCompanySubsidies] = useState<Record<string, number>>({})

  // ── Upkeep breakdown for military tooltips ────────────────────────
  // Fetched from the server. Object with keys 'army', 'navy', 'airforce',
  // each containing total upkeep + per-formation breakdown.
  const [upkeepBreakdown, setUpkeepBreakdown] = useState<Record<string, UpkeepBreakdown> | null>(null)

  // ── Tooltip hover tracking ────────────────────────────────────────
  // Which slider the user is currently hovering over (or null if none).
  // Used to compute the tooltip content lazily (only for the hovered slider).
  const setHoverKey = useState<TooltipKey | null>(null)[1]

  // ── KPI card hover tracking ──────────────────────────────────────
  // Which KPI the user is hovering over, so we can show a detailed tooltip
  // with the breakdown of that metric (GDP sources, income/expenses, etc.)
  type KpiKey = 'gdp' | 'income'
  const [kpiHover, setKpiHover] = useState<KpiKey | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // ── Live Refresh state ───────────────────────────────────────────
  // When toggled on, every slider save triggers a re-fetch of the nation
  // data (QoL, GDP, treasury) from the server so the user sees real-time
  // updates — useful for testing and checking that server-side state matches.
  const [liveRefresh, setLiveRefresh] = useState(false)
  // Freshly fetched nation data (overrides props when set)
  const [freshNation, setFreshNation] = useState<{ qol: number; gdp: number; treasury: number } | null>(null)
  // Timestamp of the last successful refresh
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  // ── Helper: re-fetch nation data from server ──────────────────────
  // Used by the live refresh feature. Fetches the latest QoL, GDP,
  // treasury, and eco_history so the user can verify slider effects.
  async function refreshNationData() {
    try {
      const data = await getNation(nationId)
      setFreshNation({ qol: data.qol ?? 50, gdp: data.gdp ?? 0, treasury: data.treasury ?? 0 })
      const { history } = await getEcoHistory(nationId)
      if (history.length > 0) setEcoHistory(history)
      setLastRefresh(new Date().toLocaleTimeString())
    } catch { /* silently fail — stale data is acceptable */ }
  }

  // ── Derived values ────────────────────────────────────────────────
  // These are computed from props on every render, not stored in state.
  // Using default values (40M pop, 50 QoL, 0 GDP) prevents crashes if nation is undefined.
  // When live refresh is active, use the freshly fetched values instead of props.
  const effectiveQol = freshNation?.qol ?? nation?.qol ?? 50
  const pop = nation?.population ?? 40_000_000
  const qol = effectiveQol

  // ─── Effects ──────────────────────────────────────────────────────

  // Effect 1: Fetch economic history on mount (and when nationId changes)
  // The dependency array [nationId] means this runs when the component mounts
  // and whenever nationId changes (e.g., switching to a different nation).
  useEffect(() => {
    // getEcoHistory is from our API helper — it automatically includes the JWT token
    getEcoHistory(nationId).then(({ history }) => setEcoHistory(history)).catch(() => {})
  }, [nationId])

  // Effect 2: Initialize company subsidies from the companies prop
  // Runs whenever the companies array changes (e.g., after a turn processes).
  // Maps each company's id → its current subsidies value from the server.
  useEffect(() => {
    setCompanySubsidies(Object.fromEntries(companies.map(c => [c.id, c.subsidies])))
  }, [companies])

  useEffect(() => {
    let cancelled = false
    getUpkeepBreakdown(nationId)
      .then(d => { if (!cancelled) setUpkeepBreakdown(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [nationId])

  // ─── Helper: run a save operation with loading indicator ──────────
  // Adds a key to the 'saving' Set while the async operation runs,
  // then removes it when done (regardless of success or failure).
  const withSaving = async (key: string, fn: () => Promise<any>) => {
    setSaving(prev => new Set(prev).add(key))
    try { await fn() } finally {
      setSaving(prev => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  // ─── Debounced save functions ─────────────────────────────────────
  // These wrap API calls so they only fire after the user stops interacting
  // for N milliseconds. Without debounce, dragging a slider across all 5 levels
  // would send 5 separate API calls — with debounce, only the final position is saved.

  // savePolicies: debounced by 200ms — saves all 7 slider positions at once
  const savePolicies = useDebouncedCallback(async (
    id: string, tl: number, ct: number, a: number, af: number, n: number, c: number
  ) => {
    await withSaving('policies', () => updatePolicies(id, {
      tax_level: tl,
      corporate_tax_level: ct,
      army_level: a,
      airforce_level: af,
      naval_level: n,
      civil_level: c,
    }))
    // If live refresh is on, re-fetch nation data after saving so the user
    // can immediately verify the server accepted the new slider positions.
    if (liveRefresh) await refreshNationData()
  }, 200)

  // saveSubsidy: debounced by 300ms — saves one company's subsidy amount
  const saveSubsidy = useDebouncedCallback(async (companyId: string, amount: number) => {
    await withSaving(`subsidy-${companyId}`, () => updateSubsidies(companyId, amount))
  }, 300)

  // handleCreateCompany: creates a new company in the selected sector
  async function handleCreateCompany() {
    if (!newCompanyName.trim() || !newCompanySector) return
    try {
      await createCompany({ name: newCompanyName.trim(), nation_id: nationId, sector: newCompanySector, profit: 0, subsidies: 0 })
      setShowCreateCompany(false)
      setNewCompanyName('')
      // Reload company data
      const data = await getNation(nationId)
      if (data.companies) setCompanySubsidies(Object.fromEntries(data.companies.map((c: any) => [c.id, c.subsidies])))
      if (data.sector_caps && freshNation) setFreshNation({ ...freshNation })
    } catch {}
  }

  // ─── Metric selector buttons configuration ────────────────────────
  const metrics: { key: GraphMetric; label: string }[] = [
    { key: 'gdp', label: 'GDP' },
    { key: 'treasury', label: 'Treasury' },
    { key: 'qol', label: 'QoL' },
  ]

  // Last eco_history entry — contains the current turn's snapshot
  const last = ecoHistory.length > 0 ? ecoHistory[ecoHistory.length - 1] : null
  const totals = {
    gdp: last?.gdp ?? 0,
    treasury: last?.treasury ?? 0,
    qol: last?.qol ?? 0,
  }
  // ── Derived values for KPI tooltips ───────────────────────────────
  const totalCompanyProfits = companies.reduce((s, c) => s + c.profit, 0)
  const qolTaxAtMax = Math.round(BASE_FACTOR * (pop / 40_000_000) * (qol / 50) * 0.80)
  const computedGdp = totalCompanyProfits + qolTaxAtMax
  // Total upkeep across all branches, weighted by military slider funding levels
  // (matches server/src/game/economy.ts multiplier logic)
  const totalUpkeep = Math.round((upkeepBreakdown?.army?.total ?? 0) * ARMY_UPKEEP_MULT[army])
    + Math.round((upkeepBreakdown?.airforce?.total ?? 0) * AIRFORCE_UPKEEP_MULT[airforce])
    + Math.round((upkeepBreakdown?.navy?.total ?? 0) * NAVAL_UPKEEP_MULT[naval])
  const curTreasury = freshNation?.treasury ?? treasury ?? 0
  const curGDP = freshNation?.gdp ?? nation?.gdp ?? 1
  const inflationMult = curTreasury < 0 ? 1 + (-curTreasury) / Math.max(1, curGDP) : 1
  const forecastIncome = computeForecastIncome()
  // ─── Income forecast computation ─────────────────────────────────
  // Income is computed client-side as a real-time preview of the current
  // turn's net change to treasury, based on the current slider positions.
  // This is NOT stored on the server — it's purely a forecasting tool to
  // show how the sliders interact with each other.
  function computeForecastIncome(): number {
    const qolTaxIncome = Math.round(BASE_FACTOR * (pop / 40_000_000) * (qol / 50) * TAX_RATES_DEC[taxLaws])
    const companyTaxIncome = Math.round(
      companies.reduce((s, c) => s + c.profit * COMPANY_TAX_RATES[corporate], 0)
    )
    const civilCost = Math.round((pop / 100_000) * (qol / 60) * CIVIL_COST_MULT[civil] * 1_500_000 * inflationMult)
    const armyBudget = Math.round((pop / 100_000) * (qol / 60) * ARMY_BUDGET_MULT[army] * 1_000_000 * inflationMult)
    const airforceBudget = Math.round((pop / 100_000) * (qol / 60) * AIRFORCE_BUDGET_MULT[airforce] * 1_000_000 * inflationMult)
    const navalBudget = Math.round((pop / 100_000) * (qol / 60) * NAVAL_BUDGET_MULT[naval] * 1_000_000 * inflationMult)
    const totalSubsidies = Math.round(companies.reduce((s, c) => s + (companySubsidies[c.id] ?? c.subsidies), 0) * inflationMult)
    return qolTaxIncome + companyTaxIncome - civilCost - armyBudget - airforceBudget - navalBudget - totalSubsidies - Math.round(totalUpkeep * inflationMult)
  }

  // ─── Tooltip content computation ──────────────────────────────────
  // Returns a multi-line string describing the effects of the hovered slider.
  // Each case computes the relevant formula in real-time based on current state.
  function tooltipForKey(key: TooltipKey, hoverIdx?: number): string {
    switch (key) {
      case 'tax_laws': {
        const idx = hoverIdx ?? taxLaws
        const rate = TAX_RATES[idx]
        const qolEffect = TAX_QOL_TEXT[idx]

        const qolIncome = Math.round(BASE_FACTOR * (pop / 40_000_000) * (qol / 50) * TAX_RATES_DEC[idx])

        return `Tax rate: ${rate}%\nQoL income: ${fmtMoney(qolIncome)}/t\nQoL change: ${qolEffect}`
      }

      case 'corporate': {
        const idx = hoverIdx ?? corporate
        const rate = (COMPANY_TAX_RATES[idx] * 100).toFixed(1)
        const totalProfit = companies.reduce((s, c) => s + c.profit, 0)
        const taxRevenue = Math.round(totalProfit * COMPANY_TAX_RATES[idx])
        const growthPct = (10 - COMPANY_TAX_RATES[idx] * 100).toFixed(1)
        return `Wealth tax: ${rate}%\nCompany tax: ~${fmtMoney(taxRevenue)}/t\nCompany growth: ~${growthPct}%/t net`
      }

      case 'civil': {
        const idx = hoverIdx ?? civil
        const mult = CIVIL_COST_MULT[idx]

        const cost = Math.round((pop / 100_000) * (qol / 60) * mult * 1_500_000)

        const qolEffect = CIVIL_QOL_TEXT[idx]
        return `Cost: ${fmtMoney(cost)}/t\nQoL change: ${qolEffect}`
      }

      case 'army':
      case 'airforce':
      case 'naval': {
        const idx = hoverIdx ?? (key === 'army' ? army : key === 'airforce' ? airforce : naval)
        const mult = (key === 'army' ? ARMY_UPKEEP_MULT : key === 'airforce' ? AIRFORCE_UPKEEP_MULT : NAVAL_UPKEEP_MULT)[idx]
        const budgetMult = (key === 'army' ? ARMY_BUDGET_MULT : key === 'airforce' ? AIRFORCE_BUDGET_MULT : NAVAL_BUDGET_MULT)[idx]
        const bd = upkeepBreakdown?.[key === 'naval' ? 'navy' : key]
        if (!bd) return 'Loading...'
        const effective = Math.round(bd.total * mult)
        const budget = Math.round((pop / 100_000) * (qol / 60) * budgetMult * 1_000_000)
        const lines = [
          `Base upkeep: ${fmtMoney(bd.total)}/t`,
          `Funding: x${mult.toFixed(2)} (${FUNDING_LABELS[idx]})`,
          `Effective upkeep: ${fmtMoney(effective)}/t`,
          `Base budget: ${fmtMoney(budget)}/t`,
        ]
        for (const f of bd.byFormation) lines.push(`  ${f.name}: ${fmtMoney(f.upkeep)} (${f.count} units)`)
        if (bd.unassigned > 0) lines.push(`  Unassigned: ${fmtMoney(bd.unassigned)}`)
        return lines.join('\n')
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────
  // The component returns JSX which React compiles to create DOM elements.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ═══ Panel: Economy ════════════════════════════════════════════ */}
      <Panel title="Economy">
        <div style={{ display: 'flex', gap: 16 }}>
          {/* ── Left column: Policies ──────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px' }}>
                Policies
              </span>
              <SavingDots saving={saving.has('policies')} />
              {/* Live Refresh toggle — enables re-fetching nation data after each slider save */}
              <button
                onClick={() => setLiveRefresh(!liveRefresh)}
                style={{
                  fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', marginLeft: 4,
                  border: '1px solid var(--border)',
                  background: liveRefresh ? 'var(--cyan)' : '#000',
                  color: liveRefresh ? '#000' : 'var(--text-dim)',
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                }}
                title="When on, re-fetches nation data (QoL, GDP, Treasury) from the server after every slider save"
              >
                Live Refresh
              </button>
              {/* Last refresh timestamp */}
              {lastRefresh && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--cyan-bright)', marginLeft: 4 }}>
                  @{lastRefresh}
                </span>
              )}
            </div>

            <SpendingSlider
              label="Tax Laws" levels={LEVELS} value={taxLaws}
              hoverKey="tax_laws" onHover={setHoverKey}
              getTooltip={idx => tooltipForKey('tax_laws', idx)}
              onChange={v => {
                setTaxLaws(v)
                savePolicies(nationId, v, corporate, army, airforce, naval, civil)
              }}
            />

            <SpendingSlider
              label="Corporate Tax" levels={LEVELS} value={corporate}
              hoverKey="corporate" onHover={setHoverKey}
              getTooltip={idx => tooltipForKey('corporate', idx)}
              onChange={v => {
                setCorporate(v)
                savePolicies(nationId, taxLaws, v, army, airforce, naval, civil)
              }}
            />

            {/* Military spending section header */}
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px' }}>
              Military Spending
            </div>

            {/* Military sliders — these are cosmetic in v2 but affect future combat morale */}
            <SpendingSlider
              label="Army" levels={LEVELS} value={army}
              hoverKey="army" onHover={setHoverKey}
              getTooltip={idx => tooltipForKey('army', idx)}
              onChange={v => {
                setArmy(v)
                savePolicies(nationId, taxLaws, corporate, v, airforce, naval, civil)
              }}
            />
            <SpendingSlider
              label="Airforce" levels={LEVELS} value={airforce}
              hoverKey="airforce" onHover={setHoverKey}
              getTooltip={idx => tooltipForKey('airforce', idx)}
              onChange={v => {
                setAirforce(v)
                savePolicies(nationId, taxLaws, corporate, army, v, naval, civil)
              }}
            />
            <SpendingSlider
              label="Naval" levels={LEVELS} value={naval}
              hoverKey="naval" onHover={setHoverKey}
              getTooltip={idx => tooltipForKey('naval', idx)}
              onChange={v => {
                setNaval(v)
                savePolicies(nationId, taxLaws, corporate, army, airforce, v, civil)
              }}
            />

            {/* Civil spending section header */}
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px' }}>
              Civil Spending
            </div>

            {/* Civil slider — costs money but improves QoL (growing future tax base) */}
            <SpendingSlider
              label="Civil" levels={LEVELS} value={civil}
              hoverKey="civil" onHover={setHoverKey}
              getTooltip={idx => tooltipForKey('civil', idx)}
              onChange={v => {
                setCivil(v)
                savePolicies(nationId, taxLaws, corporate, army, airforce, naval, v)
              }}
            />
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, background: 'var(--border)' }} />

          {/* ── Right column: Economic graph + KPIs ─────────────────── */}
          <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Economic Graph
            </div>

            {/* Metric toggle buttons — each switches the line graph to show that metric */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {metrics.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  style={{
                    fontFamily: 'var(--sans)', fontSize: 10, padding: '3px 8px', border: '1px solid var(--border)',
                    // Active button gets the metric's own color as background
                    background: metric === m.key ? METRIC_CONFIG[m.key].color : '#000',
                    color: metric === m.key ? '#000' : 'var(--text-dim)',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* SVG line graph — shows last 10 turns of the selected metric */}
            <LineGraph data={ecoHistory.slice(-10)} metric={metric} />

            {/* KPI cards — 4 key numbers displayed in a row */}
            <div style={{ display: 'flex', flex: 1, background: '#0a0a0a', border: '1px solid var(--border)', padding: '6px 10px' }}>
              {/* GDP with hover breakdown */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setKpiHover('gdp')} onMouseLeave={() => setKpiHover(null)}
                onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}>
                <div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>GDP</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--green-bright)' }}>{fmtMoney(freshNation?.gdp ?? totals.gdp)}</div>
                </div>
                {kpiHover === 'gdp' && (
                  <div style={{ position: 'fixed', left: mousePos.x + 14, top: mousePos.y - 8, zIndex: 200, background: '#111', border: '1px solid var(--border)', padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-bright)', whiteSpace: 'pre', lineHeight: 1.5, minWidth: 200, pointerEvents: 'none' }}>
                    <div>GDP Breakdown:</div>
                    <div> Company profits: {fmtMoney(totalCompanyProfits)}</div>
                    <div> QoL tax (max 80%): {fmtMoney(qolTaxAtMax)}</div>
                    <div style={{ borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: 2 }}>
                      GDP: {fmtMoney(computedGdp)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              {/* Income with hover breakdown (client-side forecast) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setKpiHover('income')} onMouseLeave={() => setKpiHover(null)}
                onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Income</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 22,
                  color: forecastIncome < 0 ? 'var(--red-bright)' : 'var(--cyan-bright)',
                }}>
                  {fmtMoney(forecastIncome)}
                </div>
                {kpiHover === 'income' && (() => {
                  const qolInc = Math.round(BASE_FACTOR * (pop / 40_000_000) * (qol / 50) * TAX_RATES_DEC[taxLaws])
                  const compTax = Math.round(companies.reduce((s, c) => s + c.profit * COMPANY_TAX_RATES[corporate], 0))
                  const civCost = Math.round((pop / 100_000) * (qol / 60) * CIVIL_COST_MULT[civil] * 1_500_000)
                  const armyBudget = Math.round((pop / 100_000) * (qol / 60) * ARMY_BUDGET_MULT[army] * 1_000_000)
                  const airforceBudget = Math.round((pop / 100_000) * (qol / 60) * AIRFORCE_BUDGET_MULT[airforce] * 1_000_000)
                  const navalBudget = Math.round((pop / 100_000) * (qol / 60) * NAVAL_BUDGET_MULT[naval] * 1_000_000)
                  const totalSubsidies = companies.reduce((s, c) => s + (companySubsidies[c.id] ?? c.subsidies), 0)
                  return (
                    <div style={{ position: 'fixed', left: mousePos.x + 14, top: mousePos.y - 8, zIndex: 200, background: '#111', border: '1px solid var(--border)', padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-bright)', whiteSpace: 'pre', lineHeight: 1.5, minWidth: 220, pointerEvents: 'none' }}>
                      <div>Income/Expense Breakdown:</div>
                      <div style={{ color: 'var(--cyan-bright)' }}> QoL tax: {fmtMoney(qolInc)}</div>
                      <div style={{ color: 'var(--cyan-bright)' }}> Company tax: {fmtMoney(compTax)}</div>
                      <div style={{ color: 'var(--red-bright)' }}> Civil cost: -{fmtMoney(civCost)}</div>
                      <div style={{ color: 'var(--red-bright)' }}> Army budget: -{fmtMoney(armyBudget)}</div>
                      <div style={{ color: 'var(--red-bright)' }}> Airforce budget: -{fmtMoney(airforceBudget)}</div>
                      <div style={{ color: 'var(--red-bright)' }}> Naval budget: -{fmtMoney(navalBudget)}</div>
                      <div style={{ color: 'var(--red-bright)' }}> Subsidies: -{fmtMoney(totalSubsidies)}</div>
                      <div style={{ color: 'var(--red-bright)' }}> Unit upkeep: -{fmtMoney(totalUpkeep)}</div>
                      {inflationMult > 1 && <div style={{ color: 'var(--amber-bright)' }}> Inflation: x{inflationMult.toFixed(2)}</div>}
                      <div style={{ borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: 2 }}>
                        Net change: <span style={{ color: forecastIncome < 0 ? 'var(--red-bright)' : 'var(--cyan-bright)' }}>{forecastIncome < 0 ? '-' : '+'}{fmtMoney(Math.abs(forecastIncome))}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              {/* QoL — uses fresh data when live refresh is on */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>QoL</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--cyan)' }}>{freshNation?.qol ?? totals.qol}</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              {/* Treasury — uses fresh data when live refresh is on */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Treasury</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 22,
                  color: (freshNation?.treasury ?? treasury ?? 0) > 0 ? 'var(--green-bright)' : 'var(--red-bright)',
                }}>
                  {fmtMoney(freshNation?.treasury ?? treasury ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* ═══ Panel: Markets ═══════════════════════════════════════════════ */}
      <Panel title="Markets">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SECTORS.map(sector => {
            const sc = sectorCaps?.[sector]
            const sectorCompanies = companies.filter(c => c.sector === sector)
            const sectorProfit = sectorCompanies.reduce((s, c) => s + c.profit, 0)
            const cap = sc?.cap ?? 0
            const pct = cap > 0 ? Math.min(100, Math.round((sectorProfit / cap) * 100)) : 0
            const sectorColor = SECTOR_COLORS[sector] || '#555'

            // ── Build per-company pie slices ───────────────
            const slices: { name: string; profit: number; pct: number; path: string; color: string }[] = []
            if (cap > 0) {
              const sorted = [...sectorCompanies].sort((a, b) => b.profit - a.profit)
              const cx = 60, cy = 60, r = 55
              let cum = -Math.PI / 2
              sorted.forEach((c, i) => {
                const a = (c.profit / cap) * 2 * Math.PI
                const hue = (i * 37 + (parseInt(sectorColor.slice(1), 16) % 360)) % 360
                const color = `hsl(${hue}, 70%, 60%)`
                const sx = cx + r * Math.cos(cum)
                const sy = cy + r * Math.sin(cum)
                const ex = cx + r * Math.cos(cum + a)
                const ey = cy + r * Math.sin(cum + a)
                const large = a > Math.PI ? 1 : 0
                const path = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`
                slices.push({ name: c.name, profit: c.profit, pct: (c.profit / cap) * 100, path, color })
                cum += a
              })
              // Untapped wedge fills the rest
              if (sectorProfit < cap) {
                const untappedPct = ((cap - sectorProfit) / cap) * 100
                const sx = cx + r * Math.cos(cum)
                const sy = cy + r * Math.sin(cum)
                const ex = cx + r * Math.cos(-Math.PI / 2 + 2 * Math.PI)
                const ey = cy + r * Math.sin(-Math.PI / 2 + 2 * Math.PI)
                const a = 2 * Math.PI - (cum + Math.PI / 2)
                const large = a > Math.PI ? 1 : 0
                const path = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`
                slices.push({ name: 'Untapped Market', profit: cap - sectorProfit, pct: untappedPct, path, color: '#2a2a2a' })
              }
            }

            return (
              <div key={sector} style={{
                display: 'flex', border: '1px solid var(--border)', background: '#050505',
              }}>
                {/* Left: sector info + companies */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px', minWidth: 0 }}>
                  {/* Header bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${sectorColor}33` }}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                      {sector}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-dim)' }}>
                      {fmtMoney(sectorProfit)} / {fmtMoney(cap)} ({pct}%)
                    </span>
                  </div>
                  {/* Company rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {sectorCompanies.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0' }}>
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--text)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--green-bright)', whiteSpace: 'nowrap' }}>
                          +{fmtMoney(c.profit)}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                          subsidy:
                        </span>
                        <input type="number"
                          value={Math.round((companySubsidies[c.id] ?? c.subsidies) / 1_000_000)}
                          onChange={e => {
                            const val = (parseInt(e.target.value) || 0) * 1_000_000
                            setCompanySubsidies(s => ({ ...s, [c.id]: val }))
                            saveSubsidy(c.id, val)
                          }}
                          style={{ width: 150, fontFamily: 'var(--mono)', fontSize: 13, padding: '2px 4px', background: '#111', border: '1px solid var(--border)', color: 'var(--text-bright)', outline: 'none' }}
                        />
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-dim)' }}>M</span>
                        <SavingDots saving={saving.has(`subsidy-${c.id}`)} />
                      </div>
                    ))}
                    {sectorCompanies.length === 0 && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-dim)', padding: '8px 0' }}>No companies</div>
                    )}
                  </div>
                </div>
                {/* Right: stacked pie chart */}
                <div style={{ width: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--border)', padding: '8px 0', flexShrink: 0 }}>
                  {cap > 0 ? (
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      {/* Per-company wedges */}
                      {slices.map((s, i) => (
                        <path key={i} d={s.path}
                          fill={s.color} stroke="#050505" strokeWidth={1}
                          style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as SVGElement).style.opacity = '0.7'; setTooltip({ x: e.clientX, y: e.clientY, text: `${s.name}: ${fmtMoney(s.profit)} (${s.pct.toFixed(1)}%)` }) }}
                          onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={e => { (e.currentTarget as SVGElement).style.opacity = '1'; setTooltip(null) }}
                        />
                      ))}
                      {/* Center hole with % — hoverable like wedges */}
                      <circle cx="60" cy="60" r="28" fill="#050505"
                        onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${sector}: ${fmtMoney(sectorProfit)} / ${fmtMoney(cap)} (${pct}%)` })}
                        onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                      <text x="60" y="57" textAnchor="middle" fill="var(--text-bright)" fontFamily="var(--mono)" fontSize="15" fontWeight="bold"
                        onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${sector}: ${fmtMoney(sectorProfit)} / ${fmtMoney(cap)} (${pct}%)` })}
                        onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >{pct}%</text>
                      <text x="60" y="70" textAnchor="middle" fill="var(--text-dim)" fontFamily="var(--sans)" fontSize="9"
                        onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${sector}: ${fmtMoney(sectorProfit)} / ${fmtMoney(cap)} (${pct}%)` })}
                        onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >util</text>
                    </svg>
                  ) : (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>—</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowCreateCompany(true)} style={{
            fontFamily: 'var(--sans)', fontSize: 12, padding: '6px 12px',
            border: '1px solid var(--cyan)', background: 'rgba(0,255,255,0.05)',
            color: 'var(--cyan-bright)', cursor: 'pointer', textTransform: 'uppercase',
          }}>+ Create Company ($1B)</button>
        </div>
      </Panel>

      {/* ── Create Company Modal ──────────────────────────────────────── */}
      {/* ── Floating tooltip ──────────────────────────────────────────── */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 500,
          background: '#111', border: '1px solid var(--border)', padding: '5px 8px',
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-bright)',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {tooltip.text}
        </div>
      )}

      {showCreateCompany && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setShowCreateCompany(false)}>
          <div style={{ background: '#0a0a0a', border: '1px solid var(--border)', padding: 20, minWidth: 320 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Create Company</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Name</div>
                <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 12, background: '#111', border: '1px solid var(--border)', color: 'var(--text-bright)', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Sector</div>
                <select value={newCompanySector} onChange={e => setNewCompanySector(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 12, background: '#111', border: '1px solid var(--border)', color: 'var(--text-bright)', outline: 'none' }}>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateCompany(false)} style={{
                fontFamily: 'var(--sans)', fontSize: 11, padding: '6px 14px', border: '1px solid var(--border)',
                background: '#000', color: 'var(--text-dim)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleCreateCompany} disabled={!newCompanyName.trim()} style={{
                fontFamily: 'var(--sans)', fontSize: 11, padding: '6px 14px', border: '1px solid var(--cyan)',
                background: 'var(--cyan)', color: '#000', cursor: 'pointer',
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
