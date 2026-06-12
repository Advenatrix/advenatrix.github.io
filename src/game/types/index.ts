export type Resource =
  | 'oil' | 'alloys' | 'energy' | 'chips' | 'rubber' | 'plastics' | 'chemicals'
  | 'aluminum' | 'tungsten' | 'chromium' | 'uranium' | 'iron' | 'titanium' | 'cobalt' | 'antimony'

export const SYNTHETIC_RESOURCES: Resource[] = [
  'oil', 'alloys', 'energy', 'chips', 'rubber', 'plastics', 'chemicals'
]

export const UNSYNTHETIC_RESOURCES: Resource[] = [
  'aluminum', 'tungsten', 'chromium', 'uranium', 'iron', 'titanium', 'cobalt', 'antimony'
]

export const ALL_RESOURCES: Resource[] = [...SYNTHETIC_RESOURCES, ...UNSYNTHETIC_RESOURCES]

export interface Nation {
  id: string
  name: string
  player_id: string | null
  gdp: number
  production_units: number
  flag_url: string
  leader_name: string
  leader_picture: string
  population: number
  qol: number
  corporate_tax_level: number
  treasury?: number
  tax_level?: number
  army_level?: number
  airforce_level?: number
  naval_level?: number
  civil_level?: number
  sector_caps?: Record<string, SectorCap>
  companies?: Company[]
}

export interface Province {
  id: string
  name: string
  x: number
  y: number
  nation_id: string | null
}

export interface ProvinceResource {
  province_id: string
  resource: Resource
  amount: number
}

export const SECTORS = [
  'Agriculture',
  'Heavy Industry',
  'Energy',
  'Consumer Goods',
  'Military & Aerospace',
  'Pharmaceuticals',
  'Transport & Trade',
] as const

export type Sector = typeof SECTORS[number]

export interface Company {
  id: string
  name: string
  nation_id: string
  profit: number
  subsidies: number
  sector: Sector
}

export interface SectorCap {
  cap: number
  total_profit: number
  mod_mult: number
}

export interface Building {
  id: string
  province_id: string
  type: string
  level: number
  status: 'building' | 'active' | 'damaged'
  turns_left: number
}

export interface Turn {
  id: string
  number: number
  status: 'open' | 'processing' | 'done'
  deadline: string
  processed_at: string | null
}

export interface Order {
  id: string
  turn_id: string
  nation_id: string
  type: string
  target_id: string | null
  payload: string | null
}

export interface Tech {
  nation_id: string
  tech_id: string
  researched_at: string
}
