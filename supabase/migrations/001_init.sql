-- Nations
create table nations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  player_id uuid references auth.users(id) unique,
  gdp bigint not null default 100000,
  production_units int not null default 100,
  flag_url text not null default '',
  leader_name text not null default '',
  leader_picture text not null default '',
  population bigint not null default 100000000,
  qol int not null default 50,
  created_at timestamptz not null default now()
);

-- Companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nation_id uuid not null references nations(id) on delete cascade,
  profit bigint not null default 0,
  subsidies bigint not null default 0,
  tax_rate int not null default 0 check (tax_rate >= 0 and tax_rate <= 100)
);

-- Turns
create table turns (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  status text not null default 'open' check (status in ('open', 'done')),
  deadline timestamptz not null,
  processed_at timestamptz
);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references turns(id) on delete cascade,
  nation_id uuid not null references nations(id) on delete cascade,
  type text not null,
  target_id uuid,
  payload text
);

-- Economic history
create table eco_history (
  id bigint primary key generated always as identity,
  nation_id uuid not null references nations(id) on delete cascade,
  turn_number int not null,
  gdp bigint not null default 0,
  inflation real not null default 0,
  treasury bigint not null default 0
);

-- Indexes
create index idx_orders_turn on orders(turn_id);
create index idx_orders_nation on orders(nation_id);
create index idx_companies_nation on companies(nation_id);
create index idx_eco_history_nation on eco_history(nation_id);

-- Pins
create table pins (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid references nations(id) on delete cascade,
  x real not null,
  y real not null,
  label text not null,
  description text not null default '',
  type text not null check (type in ('admin', 'player')),
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index idx_pins_created_by on pins(created_by);
create index idx_pins_type on pins(type);
alter table pins enable row level security;

create policy "read_pins" on pins for select using (
  type = 'admin' or created_by = auth.uid() or visibility = 'shared'
);
create policy "insert_own_pins" on pins for insert with check (created_by = auth.uid());
create policy "update_own_pins" on pins for update using (created_by = auth.uid());
create policy "delete_own_pins" on pins for delete using (created_by = auth.uid());

-- Intel Shares
create table intel_shares (
  id uuid primary key default gen_random_uuid(),
  sharer_nation_id uuid not null references nations(id) on delete cascade,
  target_nation_id uuid not null references nations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(sharer_nation_id, target_nation_id)
);

create index idx_intel_shares_sharer on intel_shares(sharer_nation_id);
create index idx_intel_shares_target on intel_shares(target_nation_id);
alter table intel_shares enable row level security;

create policy "read_intel_shares" on intel_shares for select using (
  sharer_nation_id in (select id from nations where player_id = auth.uid())
  or target_nation_id in (select id from nations where player_id = auth.uid())
);
create policy "insert_intel_shares" on intel_shares for insert with check (
  sharer_nation_id in (select id from nations where player_id = auth.uid())
);
create policy "delete_intel_shares" on intel_shares for delete using (
  sharer_nation_id in (select id from nations where player_id = auth.uid())
);

-- Unit Templates
create table unit_templates (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references nations(id) on delete cascade,
  name text not null,
  branch text not null check (branch in ('army', 'navy', 'airforce')),
  armor text not null check (armor in ('Low', 'Medium', 'High')),
  firepower text not null check (firepower in ('Low', 'Medium', 'High')),
  speed text not null check (speed in ('Low', 'Medium', 'High')),
  created_at timestamptz not null default now()
);

-- Formations
create table formations (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references nations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('division', 'fleet', 'airgroup')),
  branch text not null check (branch in ('army', 'navy', 'airforce')),
  created_at timestamptz not null default now()
);

-- Units
create table units (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references unit_templates(id) on delete set null,
  formation_id uuid references formations(id) on delete cascade,
  nation_id uuid not null references nations(id) on delete cascade,
  name text not null,
  armor text not null check (armor in ('Low', 'Medium', 'High')),
  firepower text not null check (firepower in ('Low', 'Medium', 'High')),
  speed text not null check (speed in ('Low', 'Medium', 'High')),
  strength integer not null default 100,
  status text not null default 'active' check (status in ('active', 'damaged', 'destroyed')),
  created_at timestamptz not null default now()
);

create index idx_unit_templates_nation on unit_templates(nation_id);
create index idx_formations_nation on formations(nation_id);
create index idx_units_nation on units(nation_id);
create index idx_units_formation on units(formation_id);
alter table unit_templates enable row level security;
alter table formations enable row level security;
alter table units enable row level security;

create policy "read_own_military" on unit_templates for select using (nation_id in (select id from nations where player_id = auth.uid()));
create policy "read_own_formations" on formations for select using (nation_id in (select id from nations where player_id = auth.uid()));
create policy "read_own_units" on units for select using (nation_id in (select id from nations where player_id = auth.uid()));

-- RLS
alter table nations enable row level security;
alter table companies enable row level security;
alter table turns enable row level security;
alter table orders enable row level security;
alter table eco_history enable row level security;

-- All authenticated users can read game data
create policy "read_all" on nations for select using (true);
create policy "read_all" on companies for select using (true);
create policy "read_all" on turns for select using (true);
create policy "read_all" on orders for select using (true);
create policy "read_all" on eco_history for select using (true);

-- Players can update their own nation
create policy "update_own_nation" on nations for update using (player_id = auth.uid());

-- Players can insert/update orders for their nation
create policy "insert_own_orders" on orders for insert with check (
  nation_id in (select id from nations where player_id = auth.uid())
);
