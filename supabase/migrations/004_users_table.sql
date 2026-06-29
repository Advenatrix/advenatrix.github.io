-- Create users table to replace Supabase Auth
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Allow edge functions to read users
alter table users enable row level security;
create policy "service_role_all" on users for all using (true) with check (true);

-- Seed admin user (password: admin) — bcrypt hash generated for 'admin'
-- The auth edge function will handle registration for other users
insert into users (username, password_hash)
values ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
on conflict (username) do nothing;

-- Update nations.player_id FK to point to users.id instead of auth.users.id
alter table nations drop constraint if exists nations_player_id_fkey;

-- First, clear any existing player_ids that reference auth.users (they won't match)
update nations set player_id = null;

alter table nations add constraint nations_player_id_fkey
  foreign key (player_id) references users(id) on delete set null;
