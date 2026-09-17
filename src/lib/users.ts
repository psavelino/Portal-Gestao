import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { ModuleKey } from "@/lib/modules";

export type AppRole = "admin" | "member" | "client";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AppRole;
  active: boolean;
};

export type AppUserWithAccess = Omit<AppUser, "passwordHash"> & {
  createdAt: string;
  moduleKeys: ModuleKey[];
  leaderId: string | null;
};

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const rows = await sql`
    select id, name, email, password_hash as "passwordHash", role, active
    from users
    where email = ${email.toLowerCase().trim()}
    limit 1
  `;
  return (rows[0] as AppUser | undefined) ?? null;
}

// Cadastro público (self-signup) — mantido só para o histórico de quem já
// usava. O endpoint /api/register está fechado (ver route.ts); a criação de
// conta nova passou a ser sempre via adminCreateUser, pela tela /usuarios.
export async function createUser(params: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AppUser> {
  const rows = await sql`
    insert into users (name, email, password_hash)
    values (${params.name}, ${params.email.toLowerCase().trim()}, ${params.passwordHash})
    returning id, name, email, password_hash as "passwordHash", role, active
  `;
  return rows[0] as AppUser;
}

export async function getUserById(
  id: string
): Promise<Omit<AppUser, "passwordHash"> | null> {
  const rows = await sql`
    select id, name, email, role, active from users where id = ${id} limit 1
  `;
  return (rows[0] as Omit<AppUser, "passwordHash"> | undefined) ?? null;
}

export async function listUsersWithAccess(): Promise<AppUserWithAccess[]> {
  const users = await sql`
    select id, name, email, role, active, leader_id as "leaderId", created_at as "createdAt"
    from users
    order by created_at asc
  `;
  const access = await sql`select user_id as "userId", module_key as "moduleKey" from user_module_access`;

  const byUser = new Map<string, ModuleKey[]>();
  for (const row of access as { userId: string; moduleKey: ModuleKey }[]) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row.moduleKey);
    byUser.set(row.userId, list);
  }

  return (users as Omit<AppUserWithAccess, "moduleKeys">[]).map((u) => ({
    ...u,
    moduleKeys: byUser.get(u.id) ?? [],
  }));
}

export async function getUserModuleKeys(userId: string): Promise<ModuleKey[]> {
  const rows = await sql`
    select module_key as "moduleKey" from user_module_access where user_id = ${userId}
  `;
  return (rows as { moduleKey: ModuleKey }[]).map((r) => r.moduleKey);
}

export async function adminCreateUser(params: {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  moduleKeys: ModuleKey[];
  leaderId?: string | null;
}): Promise<AppUserWithAccess> {
  const passwordHash = await hashPassword(params.password);
  const rows = await sql`
    insert into users (name, email, password_hash, role, leader_id)
    values (${params.name}, ${params.email.toLowerCase().trim()}, ${passwordHash}, ${params.role}, ${params.leaderId ?? null})
    returning id, name, email, role, active, leader_id as "leaderId", created_at as "createdAt"
  `;
  const user = rows[0] as Omit<AppUserWithAccess, "moduleKeys">;

  for (const key of params.moduleKeys) {
    await sql`
      insert into user_module_access (user_id, module_key)
      values (${user.id}, ${key})
      on conflict do nothing
    `;
  }

  return { ...user, moduleKeys: params.moduleKeys };
}

export async function countActiveAdmins(): Promise<number> {
  const rows = await sql`
    select count(*)::int as count from users where role = 'admin' and active = true
  `;
  return (rows[0] as { count: number }).count;
}

export async function updateUser(
  id: string,
  data: { name?: string; role?: AppRole; active?: boolean; leaderId?: string | null }
): Promise<Omit<AppUserWithAccess, "moduleKeys"> | null> {
  // leaderId é tri-state (undefined = não mexe, null = remove o líder,
  // string = define) — coalesce() não dá pra limpar um campo pra null, por
  // isso o update de leader_id é uma atribuição direta numa query separada
  // quando a chave veio no payload (mesmo padrão usado em team-members).
  const rows =
    data.leaderId !== undefined
      ? await sql`
          update users set
            name = coalesce(${data.name ?? null}, name),
            role = coalesce(${data.role ?? null}, role),
            active = coalesce(${data.active ?? null}, active),
            leader_id = ${data.leaderId}
          where id = ${id}
          returning id, name, email, role, active, leader_id as "leaderId", created_at as "createdAt"
        `
      : await sql`
          update users set
            name = coalesce(${data.name ?? null}, name),
            role = coalesce(${data.role ?? null}, role),
            active = coalesce(${data.active ?? null}, active)
          where id = ${id}
          returning id, name, email, role, active, leader_id as "leaderId", created_at as "createdAt"
        `;
  return (rows[0] as Omit<AppUserWithAccess, "moduleKeys"> | undefined) ?? null;
}

// Todos os usuários liderados por `userId`, direta ou indiretamente
// (recursivo — squad leader → techleads → consultores dos techleads, etc).
// Usado pro filtro "minha equipe" no Kanban/Forecast e pra bloquear ciclos
// de liderança ao trocar o líder de alguém.
export async function getDescendantUserIds(userId: string): Promise<string[]> {
  const rows = await sql`
    with recursive descendants as (
      select id from users where leader_id = ${userId}
      union all
      select u.id from users u join descendants d on u.leader_id = d.id
    )
    select id from descendants
  `;
  return (rows as { id: string }[]).map((r) => r.id);
}

// Substitui todo o conjunto de módulos liberados para o usuário pelo
// conjunto novo (delete + insert) — mais simples que calcular o diff, e o
// volume de módulos é pequeno o bastante para isso não pesar.
export async function setUserModuleAccess(
  userId: string,
  moduleKeys: ModuleKey[]
): Promise<void> {
  await sql`delete from user_module_access where user_id = ${userId}`;
  for (const key of moduleKeys) {
    await sql`insert into user_module_access (user_id, module_key) values (${userId}, ${key})`;
  }
}

function generateTempPassword(): string {
  // 10 caracteres alfanuméricos, fáceis de ditar por telefone/WhatsApp —
  // não usa caracteres ambíguos (0/O, 1/l/I).
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// Gera uma senha temporária nova, salva o hash e devolve a senha em texto
// puro só nesta chamada (o admin repassa manualmente — não há envio de
// email configurado). Nada em texto puro é persistido.
export async function resetUserPassword(id: string): Promise<string | null> {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const rows = await sql`
    update users set password_hash = ${passwordHash} where id = ${id} returning id
  `;
  if (rows.length === 0) return null;
  return tempPassword;
}

// Usuários da equipe interna (admin + member) que podem ser marcados como
// responsáveis por um card do Kanban. Não inclui usuários 'client' — eles
// são espectadores/externos, não recebem tarefas.
export async function listAssignableUsers(): Promise<
  { id: string; name: string; role: "admin" | "member" }[]
> {
  const rows = await sql`
    select id, name, role from users
    where active = true and role in ('admin', 'member')
    order by name asc
  `;
  return rows as { id: string; name: string; role: "admin" | "member" }[];
}

// Usuários 'client' ativos — candidatos a receber acesso a um quadro em
// board_access, listados na tela de gestão de quadros (/kanban/quadros).
export async function listClientRoleUsers(): Promise<{ id: string; name: string; email: string }[]> {
  const rows = await sql`
    select id, name, email from users
    where active = true and role = 'client'
    order by name asc
  `;
  return rows as { id: string; name: string; email: string }[];
}
