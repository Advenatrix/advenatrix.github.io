import { useEffect, useState, useMemo } from 'react'
import { Panel, Button, FlexCol, FlexRow, SpaceBetween } from '../components/ui'
import { useAuthStore } from '../game/store/authStore'
import { getNation, getNations, getCurrentTurn, getPins, createPin, updatePin, deletePin } from '../services/api'
import { fmtMoney } from '../utils/format'
import { SECTORS, SECTOR_COLORS } from '../game/constants'
import { PoliticalPage } from './PoliticalPage'
import { EconomyPage } from './EconomyPage'
import { TradePage } from './TradePage'
import { DiplomacyPage } from './DiplomacyPage'
import { MilitaryPage } from './MilitaryPage'
import { OperationsPage } from './OperationsPage'
import { GameMap } from '../components/map/GameMap'
import type { MapPin } from '../components/map/GameMap'
import { PinModal } from '../components/map/PinModal'

function shortSectorName(s: string): string {
  return s.split(' & ').map(w => w.slice(0, 4)).join('/').replace(/[/]$/, '')
}

function SectorSidebar({ nation }: { nation: any }) {
  const caps = nation.sector_caps || {}
  const companies = nation.companies || []

  const rows = useMemo(() => {
    return SECTORS.map(sector => {
      const sc = caps[sector]
      if (!sc) return null
      const sectorCompanies = companies.filter((c: any) => c.sector === sector)
      const cap = sc.cap
      const totalProfit = sc.total_profit
      const pct = cap > 0 ? Math.min(100, Math.round((totalProfit / cap) * 100)) : 0
      return { sector, cap, totalProfit, pct, companies: sectorCompanies }
    }).filter(Boolean)
  }, [caps, companies])

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  return (
    <FlexCol gap={8}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Sector Cap Utilization
      </div>
      <FlexCol gap={3}>
        {rows.map(r => {
          if (!r) return null
          return (
            <div key={r.sector}>
              <SpaceBetween style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 1 }}>
                <span>{shortSectorName(r.sector)}</span>
                <span>{r.pct}%</span>
              </SpaceBetween>
              <div style={{ height: 14, background: '#111', border: '1px solid var(--border)', display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {r.companies.length > 0 && r.totalProfit > 0 ? (
                  <>
                    <div style={{ width: `${r.pct}%`, display: 'flex', overflow: 'hidden' }}>
                      {r.companies.map((c: any, i: number) => {
                        const share = r.totalProfit > 0 ? (c.profit / r.totalProfit) * 100 : 0
                        const baseHue = parseInt(SECTOR_COLORS[r.sector].slice(1), 16) % 360
                        const hue = (i * 37 + baseHue) % 360
                        return (
                          <div key={c.id} style={{
                            width: `${Math.max(0.5, share)}%`,
                            background: `hsl(${hue}, 70%, 60%)`,
                            borderRight: '1px solid rgba(0,0,0,0.3)',
                          }}
                            onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${c.name}: ${fmtMoney(c.profit)}` })}
                            onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        )
                      })}
                    </div>
                    <div style={{ flex: 1, background: '#1a1a1a' }}
                      onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `Unused capacity: ${fmtMoney(r.cap - r.totalProfit)}` })}
                      onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  </>
                ) : (
                  <div style={{ width: '100%', background: '#1a1a1a' }}
                    onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `Unused capacity: ${fmtMoney(r.cap - r.totalProfit)}` })}
                    onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </FlexCol>

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 500,
          background: '#111', border: '1px solid var(--border)', padding: '3px 6px',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-bright)',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {tooltip.text}
        </div>
      )}
    </FlexCol>
  )
}

type Page = 'political' | 'economy' | 'trade' | 'diplomacy' | 'military' | 'operations' | null

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'political', label: 'Political' },
  { id: 'economy', label: 'Economy' },
  { id: 'trade', label: 'Trade' },
  { id: 'diplomacy', label: 'Diplomacy' },
  { id: 'military', label: 'Military' },
  { id: 'operations', label: 'Operations' },
]

export function GamePage() {
  const { user, logout } = useAuthStore()
  const [nation, setNation] = useState<any>(null)
  const [turn, setTurn] = useState<any>(null)
  const [page, setPage] = useState<Page>(null)
  const [pins, setPins] = useState<MapPin[]>([])
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [newPinCoords, setNewPinCoords] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!user) return
    loadGameData()
  }, [user])

  async function loadGameData(targetNationId?: string) {
    try {
      const { nations } = await getNations()
      if (nations.length > 0) {
        const id = targetNationId || nations.find((n: any) => n.player_id === user?.id)?.id || nations[0].id
        const nationData = await getNation(id)
        setNation(nationData)
      }
      const { turn: t } = await getCurrentTurn()
      setTurn(t)
      const { pins: pinsData } = await getPins()
      setPins(pinsData)
    } catch (err) {
      console.error('Failed to load game data', err)
    }
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const SEASONS = ['Winter','Winter','Spring','Spring','Spring','Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter']

  function turnToDate(turnNum: number): { date: string; season: string; turn: number } {
    const totalMonths = turnNum - 1
    const year = 1930 + Math.floor(totalMonths / 12)
    const month = (totalMonths % 12)
    return {
      date: `${MONTH_NAMES[month]} ${year}`,
      season: SEASONS[month],
      turn: turnNum,
    }
  }

  function handlePinClick(pin: MapPin) {
    setSelectedPin(pin)
    setNewPinCoords(null)
  }

  function handleMapDoubleClick(x: number, y: number) {
    setNewPinCoords({ x, y })
    setSelectedPin(null)
  }

  async function handleSaveNewPin(data: { label: string; description: string; visibility: string }) {
    if (!newPinCoords) return
    await createPin({ ...newPinCoords, ...data })
    setNewPinCoords(null)
    const { pins: pinsData } = await getPins()
    setPins(pinsData)
  }

  async function handleUpdatePin(data: { label: string; description: string; visibility: string }) {
    if (!selectedPin) return
    await updatePin(selectedPin.id, data)
    setSelectedPin(null)
    const { pins: pinsData } = await getPins()
    setPins(pinsData)
  }

  async function handleDeletePin() {
    if (!selectedPin) return
    if (!window.confirm('Delete this pin?')) return
    await deletePin(selectedPin.id)
    setSelectedPin(null)
    const { pins: pinsData } = await getPins()
    setPins(pinsData)
  }

  const PAGES: Record<string, React.ComponentType<any>> = {
    political: PoliticalPage,
    economy: EconomyPage,
    military: MilitaryPage,
    operations: OperationsPage,
    diplomacy: DiplomacyPage,
    trade: TradePage,
  }

  const PageComponent = page && PAGES[page]

  return (
    <div className="game-page">
      <div className="top-bar">
        {nation ? (
          <div className="top-bar-flag">
            <img src={nation.flag_url} alt="" className="top-bar-flag-img"
              onError={e => (e.target as HTMLElement).style.display = 'none'} />
          </div>
        ) : (
          <div className="top-bar-flag" />
        )}
        <FlexRow gap={4} style={{ marginLeft: 12 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-btn${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(page === item.id ? null : item.id)}
            >
              {item.label}
            </button>
          ))}
        </FlexRow>
        <div style={{ flex: 1 }} />
        {turn && (() => {
          const info = turnToDate(turn.number)
          return (
            <div style={{ textAlign: 'right', fontFamily: 'var(--serif)', padding: '0 4px' }}>
              <div style={{ fontSize: 22, color: 'var(--cyan-bright)', letterSpacing: 1 }}>
                {info.date}
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-dim)', letterSpacing: 1 }}>
                {info.season} &middot; Turn {info.turn}
              </div>
            </div>
          )
        })()}
      </div>
      <div className="game-layout">
        <aside className="sidebar-left">
          {nation ? (
            <FlexCol gap={10}>
              <div className="leader-frame">
                <img src={nation.leader_picture || ''} alt="leader"
                  onError={e => (e.target as HTMLElement).style.display = 'none'} />
              </div>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--text)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                {nation.leader_name}
              </p>
              {nation.sector_caps && (
                <FlexCol gap={2} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Sector Modifiers
                  </div>
                  {SECTORS.map(s => {
                    const sc = nation.sector_caps[s]
                    return (
                      <SpaceBetween key={s} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 2px' }}>
                        <span style={{ color: 'var(--text)' }}>{shortSectorName(s)}</span>
                        <span style={{ color: 'var(--cyan-bright)' }}>{sc?.mod_mult.toFixed(1)}×</span>
                      </SpaceBetween>
                    )
                  })}
                  <FlexCol gap={2} style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                    <SpaceBetween style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-dim)' }}>Treasury</span>
                      <span style={{ color: (nation.treasury ?? 0) >= 0 ? 'var(--green-bright)' : 'var(--red-bright)' }}>{fmtMoney(nation.treasury ?? 0)}</span>
                    </SpaceBetween>
                    <SpaceBetween style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-dim)' }}>GDP</span>
                      <span style={{ color: 'var(--green-bright)' }}>{fmtMoney(nation.gdp ?? 0)}</span>
                    </SpaceBetween>
                  </FlexCol>
                </FlexCol>
              )}
            </FlexCol>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>Loading...</p>
          )}
          <div style={{ marginTop: 'auto', paddingTop: 12 }}>
            <Button variant="secondary" onClick={logout}>Logout</Button>
          </div>
        </aside>
        <main className="map-container">
          {!page ? (
            <Panel title="Map">
              <div className="crt-map" style={{ height: 'calc(100vh - 140px)', minHeight: 500 }}>
                <GameMap
                  pins={pins}
                  currentPlayerId={user?.id}
                  onPinClick={handlePinClick}
                  onMapDoubleClick={handleMapDoubleClick}
                />
              </div>
            </Panel>
          ) : PageComponent && nation ? (
            <PageComponent nationId={nation.id} nation={nation} treasury={nation.treasury ?? 0} companies={nation?.companies || []} sectorCaps={nation.sector_caps} initialSliders={{ tax_laws: nation.tax_level ?? 2, corporate: nation.corporate_tax_level ?? 2, army: nation.army_level ?? 2, airforce: nation.airforce_level ?? 1, naval: nation.naval_level ?? 1, civil: nation.civil_level ?? 2 }} />
          ) : (
            <Panel title={NAV_ITEMS.find(n => n.id === page)?.label || ''}>
              <div className="map-placeholder">
                <p>Coming soon</p>
              </div>
            </Panel>
          )}
        </main>
        <aside className="sidebar-right">
          {nation && nation.sector_caps ? <SectorSidebar nation={nation} /> : null}
        </aside>
      </div>

      <PinModal
        open={!!newPinCoords || !!selectedPin}
        onClose={() => { setNewPinCoords(null); setSelectedPin(null) }}
        pin={newPinCoords ? { id: 'new', nation_id: null, x: newPinCoords.x, y: newPinCoords.y, label: '', description: '', type: 'player', visibility: 'private', created_by: user?.id || '' } : selectedPin}
        isNew={!!newPinCoords}
        onSave={newPinCoords ? handleSaveNewPin : handleUpdatePin}
        onDelete={selectedPin && selectedPin.created_by === user?.id ? handleDeletePin : undefined}
        currentPlayerId={user?.id}
      />
    </div>
  )
}
