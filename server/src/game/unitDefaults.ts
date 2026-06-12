const UNIT_DEFAULTS: Record<string, { build_cost: number; build_time: number; upkeep: number }> = {
  // ── Naval ──
  'Battleship': { build_cost: 270_000_000, build_time: 12, upkeep: 120_000_000 },
  'Aircraft Carrier': { build_cost: 250_000_000, build_time: 12, upkeep: 135_000_000 },
  'Battlecruiser': { build_cost: 190_000_000, build_time: 11, upkeep: 90_000_000 },
  'Heavy Cruiser': { build_cost: 120_000_000, build_time: 8, upkeep: 55_000_000 },
  'Escort Carrier': { build_cost: 120_000_000, build_time: 5, upkeep: 70_000_000 },
  'Light Cruiser': { build_cost: 60_000_000, build_time: 4, upkeep: 20_000_000 },
  'Destroyer': { build_cost: 15_000_000, build_time: 2, upkeep: 6_000_000 },
  'Coastal Battleship': { build_cost: 90_000_000, build_time: 7, upkeep: 30_000_000 },
  'Attack Submarine': { build_cost: 5_000_000, build_time: 3, upkeep: 3_000_000 },
  'Cruiser Submarine': { build_cost: 7_000_000, build_time: 4, upkeep: 4_000_000 },
  'Midget Submarine': { build_cost: 2_000_000, build_time: 1, upkeep: 500_000 },
  'Gunboat': { build_cost: 5_000_000, build_time: 1, upkeep: 800_000 },
  'Torpedo Patrol Boat': { build_cost: 2_000_000, build_time: 1, upkeep: 500_000 },
  'Armed Merchant Vessel': { build_cost: 1_000_000, build_time: 2, upkeep: 400_000 },

  // ── Airforce ──
  'Fighter Squadron': { build_cost: 1_000_000, build_time: 2, upkeep: 8_000_000 },
  'Light Bomber': { build_cost: 2_000_000, build_time: 3, upkeep: 10_000_000 },
  'Bomber Squadron': { build_cost: 4_000_000, build_time: 4, upkeep: 20_000_000 },
  'Heavy Fighter Squadron': { build_cost: 1_500_000, build_time: 2, upkeep: 10_000_000 },
  'Flying Boat Squadron': { build_cost: 1_000_000, build_time: 3, upkeep: 6_000_000 },

  // ── Land ──
  'Infantry Battalion': { build_cost: 200_000, build_time: 2, upkeep: 3_000_000 },
  'Siege Battalion': { build_cost: 500_000, build_time: 2, upkeep: 5_000_000 },
  'Cavalry Battalion': { build_cost: 200_000, build_time: 2, upkeep: 3_000_000 },
  'Mechanized Battalion': { build_cost: 400_000, build_time: 3, upkeep: 4_000_000 },
  'Light Tank Battalion': { build_cost: 450_000, build_time: 4, upkeep: 6_000_000 },
  'Medium Tank Battalion': { build_cost: 600_000, build_time: 4, upkeep: 8_000_000 },
  'Heavy Tank Battalion': { build_cost: 1_000_000, build_time: 5, upkeep: 12_000_000 },
}

// Aliases for seed data that uses generic names
const ALIASES: Record<string, string> = {
  'Cruiser': 'Light Cruiser',
  'Carrier': 'Aircraft Carrier',
  'Submarine': 'Attack Submarine',
  'Light Bomber Squadron': 'Light Bomber',
  'Flying Boat': 'Flying Boat Squadron',
  'Bomber': 'Bomber Squadron',
  'Artillery Battalion': 'Siege Battalion',
}

export function getUnitDefaults(unitType: string) {
  const key = ALIASES[unitType] || unitType
  return UNIT_DEFAULTS[key] || UNIT_DEFAULTS['Infantry Battalion']
}

export function getStatMultiplier(stat: string): number {
  if (stat === 'High') return 4
  if (stat === 'Medium') return 2
  return 1
}

export function computeUnitCosts(baseCost: number, baseUpkeep: number, armor: string, firepower: string, speed: string) {
  const mult = getStatMultiplier(armor) * getStatMultiplier(firepower) * getStatMultiplier(speed)
  return {
    build_cost: Math.round(baseCost * mult),
    upkeep: baseUpkeep,
  }
}