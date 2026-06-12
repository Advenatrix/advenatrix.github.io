export interface Modifier {
  id: string
  name: string
  description: string
  effects: string[]
}

export const BASIC_MODIFIERS: Modifier[] = [
  {
    id: 'laissez_faire',
    name: 'Laissez Faire',
    description: 'Enacting the initiative for a free and dynamic economy, we encourage growth and competition within our own markets.\n\nBusinesses function best when left alone by the government. By freeing our hard-working businessmen from strangulating red tape, only the sky is the limit!',
    effects: ['1.2 billion base income (+20.00%)'],
  },
  {
    id: 'strengthed_industries',
    name: 'Strengthed Industries',
    description: 'Our economic investments are finally baring fruits. The populace emigrate from the rural countrysides, flocking to the cities as millions of jobs are produced.\n\nEconomic growth skyrockets, businesses expands, and competition increases. With this resource infront of us, we musn\'t lower our guard now.',
    effects: ['+200 million monthly'],
  },
  {
    id: 'expanded_naval_shipyards',
    name: 'Expanded Naval Shipyards',
    description: 'Effort in the expansion of naval capacity have been successful. Our nation is a step closer to become a naval power to be reckoned with.',
    effects: ['Additional 5 production slots dedicated to the navy'],
  },
  {
    id: 'arctic_industrial_complex',
    name: 'Arctic Industrial Complex',
    description: 'Billions allocated to the industrial sector proves to be a wise investment, as our industrial capacity have gone drastic transformation over the course of months.\n\nThe rapid expansion of railroads have proven to be essential for the industrialization of our nation.',
    effects: ['1.4 billion base income (+40.00%)'],
  },
  {
    id: 'trade_center',
    name: 'The Trade Center',
    description: 'The skyscraper project have turned our capital into a burgeoning commerce nexus. Everything have gone to plan. Money is flowing.',
    effects: ['+50 million monthly'],
  },
  {
    id: 'agrarian_giant',
    name: 'Agrarian Giant',
    description: 'Extensive focus on agricultural developments have proven to be successful.\n\nGrain production have doubled since last year, as a result of the implementations of advanced farming machinery.',
    effects: ['+150 million monthly'],
  },
  {
    id: 'gradual_industrialization',
    name: 'Gradual Industrialization',
    description: 'Our great effort have bared fruits, as thousands of hours of hard labour of reverse engineering foreign equipment introduced the first domestically designed machinery.',
    effects: ['+40 million monthly'],
  },
  {
    id: 'migrant_workers',
    name: 'Migrant Workers',
    description: 'The initiative to give out work permits to poor workers have caused millions to flock to the Empire in search of jobs.\n\nThe surge of immigrants proves to be vital as the agrarian, and construction sectors are reinforced with a vast pool of manpower.',
    effects: ['1.3 billion base income (+30.00%)'],
  },
  {
    id: 'specialized_steel',
    name: 'Specialized Steel Industry',
    description: 'The decision to expand the steel sector have turned our nation into one of the world\'s largest steel manufacturer.\n\nRapid industrialization is encouraged through extensive investments and spending. Thousands of jobs are produced each month, and the sector expands annually.',
    effects: ['+80 million monthly'],
  },
  {
    id: 'agriculture_industrialisation',
    name: 'Agriculture Industrialisation',
    description: 'Extensive spending on the backbone economical source of the country to fuel the war machine, with new machinery for more efficient farming and new selected seeds, food source won\'t be a problem anymore.',
    effects: ['+100 million monthly'],
  },
  {
    id: 'decent_standards',
    name: 'Decent Standards of Living',
    description: 'With great attention to our citizens, the government\'s spending have been greatly allocated to civil development.\n\nCitizens reap the benefits of great availability and high quality rail and ferry transports. Well-paved roads, and with many great civilian conveniences alongside with high populace happiness.',
    effects: ['1.5 billion base income (+50.00%)'],
  },
  {
    id: 'seaborne_republic',
    name: 'Seaborne Republic',
    description: 'Our people are no strangers to the sea; our children grew alongside with the ocean itself.\n\nOver centuries our shipbuilding industry have become experienced and specialized.',
    effects: ['Additional 3 production slots dedicated to the navy'],
  },
  {
    id: 'role_model',
    name: 'The Role Model',
    description: 'Our nation stands as a beacon of hope for the marginalized minorities within our borders.\n\nHer unwavering activism and steadfast love for her nation have given the people something rarer than gold itself: A reason to fight.',
    effects: ['+60 million monthly', '+10 in defensive wars'],
  },
  {
    id: 'great_leap',
    name: 'The Great Leap Forward',
    description: 'Our nation\'s great effort to bolster the economy have come to fruition. The agricultural sector have been expanded, with hundred of acres commandeered for grain production.',
    effects: ['+300 million monthly'],
  },
  {
    id: 'emperor_initiative',
    name: 'The Emperor\'s Initiative',
    description: 'We musn\'t fall behind in the Great Game. To survive in this new era, our nation must evolve, adapt, and modernize.\n\nWe refuse to be on the backfoot, and we will lead our people to great prosperity.',
    effects: ['+200 million monthly'],
  },
]

export function getRandomModifiers(nationId: string, count: number = 3): Modifier[] {
  let hash = 0
  for (let i = 0; i < nationId.length; i++) {
    hash = ((hash << 5) - hash) + nationId.charCodeAt(i)
    hash |= 0
  }
  const shuffled = [...BASIC_MODIFIERS].sort((a, b) => {
    const ha = (hash + a.id.charCodeAt(0)) % BASIC_MODIFIERS.length
    const hb = (hash + b.id.charCodeAt(0)) % BASIC_MODIFIERS.length
    return ha - hb
  })
  return shuffled.slice(0, Math.min(count, shuffled.length))
}
