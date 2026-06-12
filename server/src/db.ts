import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { getUnitDefaults, computeUnitCosts } from './game/unitDefaults.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'georp.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDb() {
  db.exec(`
    create table if not exists players (
      id text primary key,
      username text unique not null,
      password text not null,
      created_at text not null default (datetime('now'))
    );

    create table if not exists nations (
      id text primary key,
      name text not null,
      player_id text unique references players(id),
      gdp integer not null default 100000,
      production_units integer not null default 100,
      flag_url text not null default '',
      leader_name text not null default '',
      leader_picture text not null default '',
      population integer not null default 100000000,
      qol integer not null default 50,
      tax_level integer not null default 2,
      corporate_tax_level integer not null default 2,
      civil_level integer not null default 2,
      army_level integer not null default 1,
      airforce_level integer not null default 1,
      naval_level integer not null default 1,
      created_at text not null default (datetime('now'))
    );

    create table if not exists companies (
      id text primary key,
      name text not null,
      nation_id text not null references nations(id) on delete cascade,
      profit integer not null default 0,
      subsidies integer not null default 0,
      sector text not null default ''
    );

    create table if not exists sector_modifiers (
      nation_id text not null references nations(id) on delete cascade,
      sector text not null,
      mod_mult real not null default 1.0,
      primary key (nation_id, sector)
    );

    create table if not exists turns (
      id text primary key,
      number integer not null,
      status text not null default 'open' check (status in ('open', 'done')),
      deadline text not null,
      processed_at text
    );

    create table if not exists orders (
      id text primary key,
      turn_id text not null references turns(id) on delete cascade,
      nation_id text not null references nations(id) on delete cascade,
      type text not null,
      target_id text,
      payload text
    );

    create table if not exists eco_history (
      id integer primary key autoincrement,
      nation_id text not null references nations(id) on delete cascade,
      turn_number integer not null,
      gdp integer not null default 0,
      treasury integer not null default 0,
      qol integer not null default 50
    );

    create table if not exists game_settings (
      id text primary key,
      turn_duration_hours integer not null default 48,
      starting_gdp integer not null default 500000,
      starting_population integer not null default 100000000,
      starting_qol integer not null default 50,
      base_income_multiplier real not null default 1.0
    );

    create table if not exists pins (
      id text primary key,
      nation_id text references nations(id) on delete cascade,
      x real not null,
      y real not null,
      label text not null,
      description text not null default '',
      type text not null check (type in ('admin', 'player')),
      visibility text not null default 'private' check (visibility in ('private', 'shared')),
      created_by text not null,
      created_at text not null default (datetime('now'))
    );

    create table if not exists intel_shares (
      id text primary key,
      sharer_nation_id text not null references nations(id) on delete cascade,
      target_nation_id text not null references nations(id) on delete cascade,
      created_at text not null default (datetime('now')),
      unique(sharer_nation_id, target_nation_id)
    );

    create table if not exists unit_templates (
      id text primary key,
      nation_id text not null references nations(id) on delete cascade,
      name text not null,
      branch text not null check (branch in ('army', 'navy', 'airforce')),
      unit_type text not null default 'Infantry Battalion',
      armor text not null check (armor in ('Low', 'Medium', 'High')),
      firepower text not null check (firepower in ('Low', 'Medium', 'High')),
      speed text not null check (speed in ('Low', 'Medium', 'High')),
      build_cost integer not null default 0,
      build_time integer not null default 1,
      upkeep integer not null default 0,
      created_at text not null default (datetime('now'))
    );

    create table if not exists formations (
      id text primary key,
      nation_id text not null references nations(id) on delete cascade,
      name text not null,
      type text not null check (type in ('division', 'fleet', 'airgroup')),
      branch text not null check (branch in ('army', 'navy', 'airforce')),
      created_at text not null default (datetime('now'))
    );

    create table if not exists units (
      id text primary key,
      template_id text references unit_templates(id) on delete set null,
      formation_id text references formations(id) on delete cascade,
      nation_id text not null references nations(id) on delete cascade,
      name text not null,
      unit_type text not null default 'Infantry Battalion',
      armor text not null check (armor in ('Low', 'Medium', 'High')),
      firepower text not null check (firepower in ('Low', 'Medium', 'High')),
      speed text not null check (speed in ('Low', 'Medium', 'High')),
      strength integer not null default 100,
      status text not null default 'active' check (status in ('active', 'damaged', 'destroyed', 'building')),
      build_cost integer not null default 0,
      build_time integer not null default 0,
      upkeep integer not null default 0,
      ready_turn integer,
      created_at text not null default (datetime('now'))
    );

    create table if not exists fronts (
      id text primary key,
      name text not null,
      attacker_nation_id text not null references nations(id) on delete cascade,
      defender_nation_id text references nations(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending', 'active', 'resolved')),
      progress integer not null default 0,
      max_progress integer not null default 10,
      front_width integer not null default 1,
      retreating_by text,
      war_name text not null default '',
      created_at text not null default (datetime('now'))
    );

    create table if not exists front_participants (
      id text primary key,
      front_id text not null references fronts(id) on delete cascade,
      nation_id text not null references nations(id) on delete cascade,
      side text not null check (side in ('attacker', 'defender')),
      unique(front_id, nation_id)
    );

    create table if not exists front_assignments (
      id text primary key,
      front_id text not null references fronts(id) on delete cascade,
      formation_id text not null references formations(id) on delete cascade,
      unique(front_id, formation_id)
    );

    create table if not exists battles (
      id text primary key,
      front_id text not null references fronts(id) on delete cascade,
      attacker_nation_id text not null,
      defender_nation_id text not null,
      turn_number integer not null,
      result text not null check (result in ('attacker_win', 'defender_win', 'stalemate')),
      attacker_losses integer not null default 0,
      defender_losses integer not null default 0,
      log text not null default '[]',
      battle_type text not null default 'frontline',
      progress_before integer,
      progress_after integer,
      created_at text not null default (datetime('now'))
    );
  `)

  // Migrate existing tables to add unit_type if missing
  try {
    const tmplCols = db.prepare("pragma table_info('unit_templates')").all() as any[]
    if (!tmplCols.find((c: any) => c.name === 'unit_type')) {
      db.exec("alter table unit_templates add column unit_type text not null default 'Infantry Battalion'")
    }
    const unitCols = db.prepare("pragma table_info('units')").all() as any[]
    if (!unitCols.find((c: any) => c.name === 'unit_type')) {
      db.exec("alter table units add column unit_type text not null default 'Infantry Battalion'")
    }
  } catch {}

  // V2 migrations: extend fronts with new columns
  // V2b: make defender_nation_id nullable
  try {
    const frontsCols = db.prepare("pragma table_info('fronts')").all() as any[]
    const defCol = frontsCols.find((c: any) => c.name === 'defender_nation_id')
    if (defCol && defCol.notnull === 1) {
      db.pragma('foreign_keys = OFF')
      db.exec('BEGIN TRANSACTION')
      db.exec(`
        create table fronts_new2 (
          id text primary key,
          name text not null,
          attacker_nation_id text not null references nations(id) on delete cascade,
          defender_nation_id text references nations(id) on delete cascade,
          status text not null default 'pending' check (status in ('pending', 'active', 'resolved')),
          progress integer not null default 0,
          max_progress integer not null default 10,
          front_width integer not null default 1,
          retreating_by text,
          war_name text not null default '',
          created_at text not null default (datetime('now'))
        )
      `)
      db.exec(`insert into fronts_new2 select * from fronts`)
      db.exec('drop table fronts')
      db.exec('alter table fronts_new2 rename to fronts')
      db.exec('COMMIT')
      db.pragma('foreign_keys = ON')
    }
  } catch {}

  try {
    const frontsCols = db.prepare("pragma table_info('fronts')").all() as any[]
    if (!frontsCols.find((c: any) => c.name === 'progress')) {
      const sql = db.prepare("select sql from sqlite_master where type='table' and name='fronts'").get() as any
      if (sql && !sql.sql.includes('pending')) {
        db.pragma('foreign_keys = OFF')
        db.exec('BEGIN TRANSACTION')
        db.exec(`
          create table fronts_new (
            id text primary key,
            name text not null,
            attacker_nation_id text not null references nations(id) on delete cascade,
            defender_nation_id text references nations(id) on delete cascade,
            status text not null default 'pending' check (status in ('pending', 'active', 'resolved')),
            progress integer not null default 0,
            max_progress integer not null default 10,
            front_width integer not null default 1,
            retreating_by text,
            war_name text not null default '',
            created_at text not null default (datetime('now'))
          )
        `)
        db.exec(`insert into fronts_new select id, name, attacker_nation_id, defender_nation_id, status, 0, 10, 1, null, '', created_at from fronts`)
        db.exec('drop table fronts')
        db.exec('alter table fronts_new rename to fronts')
        db.exec('COMMIT')
        db.pragma('foreign_keys = ON')
      } else {
        db.exec("alter table fronts add column progress integer not null default 0")
        db.exec("alter table fronts add column max_progress integer not null default 10")
        db.exec("alter table fronts add column front_width integer not null default 1")
        db.exec("alter table fronts add column retreating_by text")
        db.exec("alter table fronts add column war_name text not null default ''")
      }
    }
  } catch {}

  // Migration: add build_cost / build_time / upkeep / ready_turn
  try {
    const tmplCols2 = db.prepare("pragma table_info('unit_templates')").all() as any[]
    if (!tmplCols2.find((c: any) => c.name === 'build_cost')) {
      db.exec("alter table unit_templates add column build_cost integer not null default 0")
      db.exec("alter table unit_templates add column build_time integer not null default 1")
      db.exec("alter table unit_templates add column upkeep integer not null default 0")
    }
  } catch {}
  try {
    const unitCols2 = db.prepare("pragma table_info('units')").all() as any[]
    if (!unitCols2.find((c: any) => c.name === 'build_cost')) {
      db.exec("alter table units add column build_cost integer not null default 0")
      db.exec("alter table units add column build_time integer not null default 0")
      db.exec("alter table units add column upkeep integer not null default 0")
      db.exec("alter table units add column ready_turn integer")
    }
    // Backfill existing units with computed values
    const unbackfilled = db.prepare("select id, unit_type, armor, firepower, speed, status from units where build_cost = 0 and status != 'building'").all() as any[]
    for (const u of unbackfilled) {
      const defs = getUnitDefaults(u.unit_type)
      const { build_cost, upkeep } = computeUnitCosts(defs.build_cost, defs.upkeep, u.armor, u.firepower, u.speed)
      db.prepare('update units set build_cost = ?, build_time = ?, upkeep = ? where id = ?')
        .run(build_cost, defs.build_time, upkeep, u.id)
    }
  } catch {}

  try {
    const battleCols = db.prepare("pragma table_info('battles')").all() as any[]
    if (!battleCols.find((c: any) => c.name === 'battle_type')) {
      db.exec("alter table battles add column battle_type text not null default 'frontline'")
    }
    if (!battleCols.find((c: any) => c.name === 'progress_before')) {
      db.exec("alter table battles add column progress_before integer")
    }
    if (!battleCols.find((c: any) => c.name === 'progress_after')) {
      db.exec("alter table battles add column progress_after integer")
    }
  } catch {}

  // Migration: add income / qol to eco_history
  try {
    const ecoCols = db.prepare("pragma table_info('eco_history')").all() as any[]
    if (!ecoCols.find((c: any) => c.name === 'income')) {
      db.exec("alter table eco_history add column income integer not null default 0")
    }
    if (!ecoCols.find((c: any) => c.name === 'qol')) {
      db.exec("alter table eco_history add column qol integer not null default 50")
    }
  } catch {}

  // Migration: drop money_printing from nations
  try {
    const natCols = db.prepare("pragma table_info('nations')").all() as any[]
    if (natCols.find((c: any) => c.name === 'money_printing')) {
      db.pragma('foreign_keys = OFF')
      db.exec('BEGIN TRANSACTION')
      db.exec(`
        create table nations_new (
          id text primary key,
          name text not null,
          player_id text unique references players(id),
          gdp integer not null default 100000,
          production_units integer not null default 100,
          flag_url text not null default '',
          leader_name text not null default '',
          leader_picture text not null default '',
          population integer not null default 100000000,
          qol integer not null default 50,
          tax_level integer not null default 2,
          corporate_tax_level integer not null default 2,
          civil_level integer not null default 2,
          army_level integer not null default 1,
          airforce_level integer not null default 1,
          naval_level integer not null default 1,
          created_at text not null default (datetime('now'))
        )
      `)
      db.exec(`
        insert into nations_new (id, name, player_id, gdp, production_units, flag_url, leader_name, leader_picture, population, qol, tax_level, corporate_tax_level, civil_level, army_level, airforce_level, naval_level, created_at)
        select id, name, player_id, gdp, production_units, flag_url, leader_name, leader_picture, population, qol, tax_level, corporate_tax_level, civil_level, army_level, airforce_level, naval_level, created_at from nations
      `)
      db.exec('drop table nations')
      db.exec('alter table nations_new rename to nations')
      db.exec('COMMIT')
      db.pragma('foreign_keys = ON')
    }
  } catch {}

  // Migration: drop income/inflation from eco_history
  try {
    const ecoCols2 = db.prepare("pragma table_info('eco_history')").all() as any[]
    const hasIncome = ecoCols2.find((c: any) => c.name === 'income')
    const hasInflation = ecoCols2.find((c: any) => c.name === 'inflation')
    if (hasIncome || hasInflation) {
      db.exec('BEGIN TRANSACTION')
      db.exec(`
        create table eco_history_new (
          id integer primary key autoincrement,
          nation_id text not null references nations(id) on delete cascade,
          turn_number integer not null,
          gdp integer not null default 0,
          treasury integer not null default 0,
          qol integer not null default 50
        )
      `)
      db.exec(`
        insert into eco_history_new (id, nation_id, turn_number, gdp, treasury, qol)
        select id, nation_id, turn_number, gdp, treasury, qol from eco_history
      `)
      db.exec('drop table eco_history')
      db.exec('alter table eco_history_new rename to eco_history')
      db.exec('COMMIT')
    }
  } catch {}

  // Migration: drop inflation_rate_modifier from game_settings
  try {
    const gsCols = db.prepare("pragma table_info('game_settings')").all() as any[]
    if (gsCols.find((c: any) => c.name === 'inflation_rate_modifier')) {
      db.exec('BEGIN TRANSACTION')
      db.exec(`
        create table game_settings_new (
          id text primary key,
          turn_duration_hours integer not null default 48,
          starting_gdp integer not null default 500000,
          starting_population integer not null default 100000000,
          starting_qol integer not null default 50,
          base_income_multiplier real not null default 1.0
        )
      `)
      db.exec(`
        insert into game_settings_new (id, turn_duration_hours, starting_gdp, starting_population, starting_qol, base_income_multiplier)
        select id, turn_duration_hours, starting_gdp, starting_population, starting_qol, base_income_multiplier from game_settings
      `)
      db.exec('drop table game_settings')
      db.exec('alter table game_settings_new rename to game_settings')
      db.exec('COMMIT')
    }
  } catch {}

  // Migration V3: compute GDP using the new formula.
  // GDP = total company profits + QoL tax at max level (Very High = 80%).
  // Updates the turn-0 eco_history snapshot for existing nations.
  const BASE_FACTOR = 1_200_000
  try {
    const nations = db.prepare('select id, population, qol from nations').all() as any[]
    for (const nation of nations) {
      const companies = db.prepare('select profit from companies where nation_id = ?').all(nation.id) as any[]
      const totalProfit = companies.reduce((s: number, c: any) => s + c.profit, 0)
      const pop = nation.population ?? 40000000
      const qol = nation.qol ?? 50
      const qolTaxAtMax = Math.round(BASE_FACTOR * (pop / 40000000) * (qol / 50) * 0.80)
      const computedGdp = totalProfit + qolTaxAtMax
      db.prepare('update eco_history set gdp = ? where nation_id = ? and turn_number = 0')
        .run(computedGdp, nation.id)
    }
  } catch {}

  // Migration: remove tax_rate from companies, add corporate_tax_level to nations
  try {
    const compCols = db.prepare("pragma table_info('companies')").all() as any[]
    if (compCols.find((c: any) => c.name === 'tax_rate')) {
      db.exec('BEGIN TRANSACTION')
      db.exec(`
        create table companies_new (
          id text primary key,
          name text not null,
          nation_id text not null references nations(id) on delete cascade,
          profit integer not null default 0,
          subsidies integer not null default 0
        )
      `)
      db.exec(`
        insert into companies_new (id, name, nation_id, profit, subsidies)
        select id, name, nation_id, profit, subsidies from companies
      `)
      db.exec('drop table companies')
      db.exec('alter table companies_new rename to companies')
      db.exec('COMMIT')
    }
    const natCols = db.prepare("pragma table_info('nations')").all() as any[]
    if (!natCols.find((c: any) => c.name === 'corporate_tax_level')) {
      db.exec("alter table nations add column corporate_tax_level integer not null default 2")
    }
  } catch {}

  // Migration: add sector column to companies
  try {
    const compCols2 = db.prepare("pragma table_info('companies')").all() as any[]
    if (!compCols2.find((c: any) => c.name === 'sector')) {
      db.exec("alter table companies add column sector text not null default ''")
    }
  } catch {}
}

export default db
