export const UNIT_TYPES: Record<string, string[]> = {
  army: [
    'Infantry Battalion',
    'Siege Battalion',
    'Cavalry Battalion',
    'Mechanized Battalion',
    'Light Tank Battalion',
    'Medium Tank Battalion',
    'Heavy Tank Battalion',
    'Artillery Battalion',
  ],
  navy: [
    'Destroyer',
    'Cruiser',
    'Battlecruiser',
    'Battleship',
    'Carrier',
    'Submarine',
  ],
  airforce: [
    'Fighter Squadron',
    'Heavy Fighter Squadron',
    'Light Bomber',
    'Bomber',
    'Flying Boat',
  ],
}

export const BRANCH_LABELS: Record<string, string> = {
  army: 'Army',
  navy: 'Navy',
  airforce: 'Air Force',
}
