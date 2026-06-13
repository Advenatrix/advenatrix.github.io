import type { Resource } from './types'

export const RESOURCE_LABELS: Record<Resource, string> = {
  oil: 'Oil',
  alloys: 'Alloys',
  energy: 'Energy',
  chips: 'Chips',
  rubber: 'Rubber',
  plastics: 'Plastics',
  chemicals: 'Chemicals',
  aluminum: 'Aluminum',
  tungsten: 'Tungsten',
  chromium: 'Chromium',
  uranium: 'Uranium',
  iron: 'Iron',
  titanium: 'Titanium',
  cobalt: 'Cobalt',
  antimony: 'Antimony',
}

export const RESOURCE_CATEGORIES: Record<Resource, 'synthetic' | 'unsynthetic'> = {
  oil: 'synthetic',
  alloys: 'synthetic',
  energy: 'synthetic',
  chips: 'synthetic',
  rubber: 'synthetic',
  plastics: 'synthetic',
  chemicals: 'synthetic',
  aluminum: 'unsynthetic',
  tungsten: 'unsynthetic',
  chromium: 'unsynthetic',
  uranium: 'unsynthetic',
  iron: 'unsynthetic',
  titanium: 'unsynthetic',
  cobalt: 'unsynthetic',
  antimony: 'unsynthetic',
}

export const SECTORS: readonly string[] = [
  'Agriculture',
  'Heavy Industry',
  'Energy',
  'Consumer Goods',
  'Military & Aerospace',
  'Pharmaceuticals',
  'Transport & Trade',
]

export const SECTOR_COLORS: Record<string, string> = {
  'Agriculture': '#3a7d3a',
  'Heavy Industry': '#8a8a8a',
  'Energy': '#d97a2e',
  'Consumer Goods': '#c46a7a',
  'Military & Aerospace': '#3a6ba5',
  'Pharmaceuticals': '#7a4a9a',
  'Transport & Trade': '#c4a234',
}

export const LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'] as const

export const TAX_RATES_DEC = [0.10, 0.25, 0.40, 0.60, 0.80]
export const TAX_RATES = [10, 25, 40, 60, 80] as const
export const COMPANY_TAX_RATES = [0.01, 0.04, 0.08, 0.13, 0.17] as const
export const CIVIL_COST_MULT = [0, 1, 2, 3, 4]
export const ARMY_UPKEEP_MULT = [0.25, 0.5, 1.0, 1.5, 2.5]
export const AIRFORCE_UPKEEP_MULT = [0.25, 0.5, 1.0, 1.5, 2.5]
export const NAVAL_UPKEEP_MULT = [0.25, 0.5, 1.0, 1.5, 2.5]
export const ARMY_BUDGET_MULT = [0, 0.25, 0.5, 1.0, 1.5]
export const AIRFORCE_BUDGET_MULT = [0, 0.25, 0.5, 1.0, 1.5]
export const NAVAL_BUDGET_MULT = [0, 0.25, 0.5, 1.0, 1.5]
export const FUNDING_LABELS = ['Underfunded', 'Low', 'Standard', 'High', 'Overfunded']
export const BASE_FACTOR = 1_200_000_000
