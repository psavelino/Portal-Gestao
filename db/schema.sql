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
-- Clientes — agrupador comercial. Cada cliente pode ter vários projetos.
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#009999',  -- cor da paleta estendida (ver CLIENT_PALETTE no app)
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Projetos — a unidade real de contrato/saldo. Um cliente pode ter N
-- projetos ativos ao mesmo tempo, cada um com seu próprio tipo de contrato
-- e sua própria mecânica de saldo.
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  name                text not null,
  contract_type       text not null check (contract_type in ('pacote_horas', 'cmc', 'outsourcing')),
  status              text not null default 'ativo' check (status in ('ativo', 'pausado', 'encerrado')),
  -- Config específica por tipo (só a coluna do tipo relevante é preenchida):
  package_hours       numeric(8,2),   -- pacote_horas: total de horas contratadas (bloco fechado)
  cmc_monthly_hours   numeric(8,2),   -- cmc: crédito fixo que entra todo mês
  cmc_start_month     date,           -- cmc: primeiro mês do contrato (dia 1), base do extrato mês a mês
  outsourcing_people  numeric(5,2),   -- outsourcing: nº de pessoas dedicadas full-time contratadas
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists idx_projects_client on projects (client_id);

-- ---------------------------------------------------------------------------
-- Alocações do forecast: pessoa x projeto x semana (semana = segunda-feira).
-- O cliente é derivado via projeto — não é mais referenciado diretamente
-- aqui, para não misturar o consumo de projetos diferentes do mesmo cliente.
-- ---------------------------------------------------------------------------
create table if not exists allocations (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  project_id     uuid not null references projects(id) on delete cascade,
  week_start     date not null,                 -- sempre uma segunda-feira
  hours          numeric(6,2) not null default 0,
  status         text not null default 'confirmado' check (status in ('confirmado', 'previsto')),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (team_member_id, project_id, week_start)
);

create index if not exists idx_allocations_week on allocations (week_start);
create index if not exists idx_allocations_member on allocations (team_member_id);
create index if not exists idx_allocations_project on allocations (project_id);
