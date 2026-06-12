-- 002_full_schema.sql
-- Adds all missing tables and columns from the evolved SQLite schema.
-- Runs after 001_init.sql.

-- ── Nations: add policy slider columns ──
alter table nations add column if not exists tax_level int not null default 2;
alter table nations add column if not exists corporate_tax_level int not null default 2;
alter table nations add column if not exists civil_level int not null default 2;
alter table nations add column if not exists army_level int not null default 1;
alter table nations add column if not exists airforce_level int not null default 1;
alter table nations add column if not exists naval_level int not null default 1;

-- ── Companies: drop tax_rate, add sector ──
alter table companies drop column if exists tax_rate;
alter table companies add column if not exists sector text not null default '';

-- ── Eco history: drop inflation, add qol ──
alter table eco_history drop column if exists inflation;
alter table eco_history add column if not exists qol int not null default 50;

-- ── Sector modifiers ──
create table if not exists sector_modifiers (
  nation_id uuid not null references nations(id) on delete cascade,
  sector text not null,
  mod_mult real not null default 1.0,
  primary key (nation_id, sector)
);

alter table sector_modifiers enable row level security;
create policy "read_all" on sector_modifiers for select using (true);

-- ── Game settings ──
create table if not exists game_settings (
  id text primary key,
  turn_duration_hours int not null default 48,
  starting_gdp bigint not null default 500000,
  starting_population bigint not null default 100000000,
  starting_qol int not null default 50,
  base_income_multiplier real not null default 1.0
);

alter table game_settings enable row level security;
create policy "read_all" on game_settings for select using (true);

-- ── Unit templates: add missing columns ──
alter table unit_templates add column if not exists unit_type text not null default 'Infantry Battalion';
alter table unit_templates add column if not exists build_cost bigint not null default 0;
alter table unit_templates add column if not exists build_time int not null default 1;
alter table unit_templates add column if not exists upkeep bigint not null default 0;

-- ── Units: add missing columns ──
alter table units add column if not exists unit_type text not null default 'Infantry Battalion';
alter table units add column if not exists build_cost bigint not null default 0;
alter table units add column if not exists build_time int not null default 0;
alter table units add column if not exists upkeep bigint not null default 0;
alter table units add column if not exists ready_turn int;

-- Drop and recreate units table status check constraint to include 'building'
-- (Supabase doesn't support ALTER CONSTRAINT, so we use a workaround)
alter table units drop constraint if exists units_status_check;
alter table units add constraint units_status_check
  check (status in ('active', 'damaged', 'destroyed', 'building'));

-- ── Fronts ──
create table if not exists fronts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  attacker_nation_id uuid not null references nations(id) on delete cascade,
  defender_nation_id uuid references nations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'resolved')),
  progress int not null default 0,
  max_progress int not null default 10,
  front_width int not null default 1,
  retreating_by text,
  war_name text not null default '',
  created_at timestamptz not null default now()
);

alter table fronts enable row level security;

-- ── Front participants ──
create table if not exists front_participants (
  id uuid primary key default gen_random_uuid(),
  front_id uuid not null references fronts(id) on delete cascade,
  nation_id uuid not null references nations(id) on delete cascade,
  side text not null check (side in ('attacker', 'defender')),
  unique (front_id, nation_id)
);

alter table front_participants enable row level security;

-- ── Front assignments ──
create table if not exists front_assignments (
  id uuid primary key default gen_random_uuid(),
  front_id uuid not null references fronts(id) on delete cascade,
  formation_id uuid not null references formations(id) on delete cascade,
  unique (front_id, formation_id)
);

alter table front_assignments enable row level security;

-- ── Battles ──
create table if not exists battles (
  id uuid primary key default gen_random_uuid(),
  front_id uuid not null references fronts(id) on delete cascade,
  attacker_nation_id uuid not null,
  defender_nation_id uuid not null,
  turn_number int not null,
  result text not null check (result in ('attacker_win', 'defender_win', 'stalemate')),
  attacker_losses int not null default 0,
  defender_losses int not null default 0,
  log text not null default '[]',
  battle_type text not null default 'frontline',
  progress_before int,
  progress_after int,
  created_at timestamptz not null default now()
);

alter table battles enable row level security;

-- ── Indexes for new tables ──
create index if not exists idx_fronts_attacker on fronts(attacker_nation_id);
create index if not exists idx_fronts_defender on fronts(defender_nation_id);
create index if not exists idx_front_participants_front on front_participants(front_id);
create index if not exists idx_front_participants_nation on front_participants(nation_id);
create index if not exists idx_front_assignments_front on front_assignments(front_id);
create index if not exists idx_battles_front on battles(front_id);

-- ── RLS policies for military game tables ──
create policy "read_fronts" on fronts for select using (true);
create policy "read_front_participants" on front_participants for select using (true);
create policy "read_front_assignments" on front_assignments for select using (true);
create policy "read_battles" on battles for select using (true);

-- ── RLS policies for own-nation writes ──
create policy "insert_own_front_participants" on front_participants
  for insert with check (nation_id in (select id from nations where player_id = auth.uid()));
create policy "delete_own_front_participants" on front_participants
  for delete using (nation_id in (select id from nations where player_id = auth.uid()));

-- ── Helper: deduct from nation treasury (for service_role transactions) ──
create or replace function deduct_treasury(p_nation_id uuid, p_amount bigint)
returns void
language plpgsql security definer
as $$
begin
  update nations set gdp = coalesce(gdp, 0) - p_amount where id = p_nation_id;
end;
$$;
