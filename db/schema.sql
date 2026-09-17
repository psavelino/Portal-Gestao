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
  role          text not null default 'member' check (role in ('admin', 'member', 'client')),
  active        boolean not null default true,   -- desativado = não consegue mais logar
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Permissão de acesso a módulos: quais módulos do portal cada usuário pode
-- abrir. Admin (users.role = 'admin') sempre tem acesso a tudo e não precisa
-- de linha aqui — esta tabela só vale para usuários 'member'. Usuários
-- 'client' não usam esta tabela: eles não navegam pelos módulos do portal,
-- só enxergam o(s) quadro(s) liberados em board_access. Ao adicionar um
-- módulo novo no portal, inclua a chave dele no check abaixo.
-- ---------------------------------------------------------------------------
create table if not exists user_module_access (
  user_id     uuid not null references users(id) on delete cascade,
  module_key  text not null check (module_key in ('forecast', 'fechamento', 'kanban')),
  created_at  timestamptz not null default now(),
  primary key (user_id, module_key)
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

-- ---------------------------------------------------------------------------
-- Kanban — um quadro por cliente (às vezes mais de um). Visibilidade:
--   admin           -> vê todos os quadros;
--   member (equipe) -> vê todos os quadros por padrão (não precisa de linha
--                       em board_access), igual à ferramenta externa atual;
--   client (externo)-> só vê o(s) quadro(s) explicitamente liberados em
--                       board_access. Nunca vê os módulos internos do portal.
-- ---------------------------------------------------------------------------
create table if not exists boards (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  description text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_boards_client on boards (client_id);

-- Liberação explícita de um quadro para um usuário. Usado sobretudo para
-- usuários 'client' (acesso a 1 quadro específico), mas também serve para
-- restringir um 'member' a um quadro específico se um dia for necessário.
create table if not exists board_access (
  board_id    uuid not null references boards(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists idx_board_access_user on board_access (user_id);

-- Cards do kanban. status = coluna atual do quadro.
create table if not exists cards (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references boards(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'a_fazer'
                 check (status in ('backlog', 'a_fazer', 'em_andamento', 'em_revisao', 'concluido')),
  priority     text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  due_date     date,
  sort_order   integer not null default 0,      -- ordenação dentro da coluna
  created_by   uuid references users(id) on delete set null,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_cards_board on cards (board_id);
create index if not exists idx_cards_status on cards (board_id, status);

-- Responsáveis pelo card (N:N — pode ter mais de um responsável).
create table if not exists card_assignees (
  card_id     uuid not null references cards(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (card_id, user_id)
);

-- Subtarefas (checklist) dentro do card.
create table if not exists card_subtasks (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references cards(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_card_subtasks_card on card_subtasks (card_id);

-- Comentários do card.
create table if not exists card_comments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references cards(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_card_comments_card on card_comments (card_id);

-- Anexos do card. Arquivo fica no Vercel Blob — aqui guardamos só a
-- referência (url pública assinada pelo @vercel/blob).
create table if not exists card_attachments (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references cards(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  file_name     text not null,
  file_url      text not null,
  content_type  text,
  size_bytes    integer,
  created_at    timestamptz not null default now()
);

create index if not exists idx_card_attachments_card on card_attachments (card_id);
