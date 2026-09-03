-- Join4 PMO — schema do banco (Postgres / Neon)
-- Como aplicar: cole este arquivo inteiro no SQL Editor do console da Neon
-- (console.neon.tech > seu projeto > SQL Editor) e clique em "Run".
-- Alternativa: rode `npm run db:migrate` localmente com DATABASE_URL configurada em .env.local

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Usuários (autenticação da própria ferramenta — você e seu delivery manager)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Equipe (consultores que entram no forecast)
-- ---------------------------------------------------------------------------
create table if not exists team_members (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  role             text,                          -- ex: "Consultor", "Dev", "Delivery Manager"
  weekly_capacity  numeric(6,2) not null default 40,
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clientes / projetos aos quais as horas do forecast podem ser alocadas
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#009999',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alocações do forecast: pessoa x cliente x semana (semana = segunda-feira)
-- ---------------------------------------------------------------------------
create table if not exists allocations (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete cascade,
  week_start     date not null,                 -- sempre uma segunda-feira
  hours          numeric(6,2) not null default 0,
  status         text not null default 'confirmado' check (status in ('confirmado', 'previsto')),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (team_member_id, client_id, week_start)
);

create index if not exists idx_allocations_week on allocations (week_start);
create index if not exists idx_allocations_member on allocations (team_member_id);
