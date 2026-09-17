import { sql } from "@/lib/db";
import type { BoardSummary } from "@/lib/kanban-types";

function mapBoard(row: Record<string, unknown>): BoardSummary {
  return row as unknown as BoardSummary;
}

// Admin: enxerga tudo (inclusive quadros desativados) — usado na tela de
// gestão de quadros (/kanban/quadros).
export async function listAllBoards(): Promise<BoardSummary[]> {
  const rows = await sql`
    select b.id, b.client_id as "clientId", c.name as "clientName", c.color as "clientColor",
           b.name, b.description, b.active, b.sort_order as "sortOrder", b.created_at as "createdAt"
    from boards b
    join clients c on c.id = b.client_id
    order by c.sort_order asc, c.name asc, b.sort_order asc, b.name asc
  `;
  return (rows as Record<string, unknown>[]).map(mapBoard);
}

// Membro interno (com módulo kanban liberado): vê todos os quadros ativos,
// igual à ferramenta externa atual — sem precisar de linha em board_access.
export async function listActiveBoards(): Promise<BoardSummary[]> {
  const rows = await sql`
    select b.id, b.client_id as "clientId", c.name as "clientName", c.color as "clientColor",
           b.name, b.description, b.active, b.sort_order as "sortOrder", b.created_at as "createdAt"
    from boards b
    join clients c on c.id = b.client_id
    where b.active = true
    order by c.sort_order asc, c.name asc, b.sort_order asc, b.name asc
  `;
  return (rows as Record<string, unknown>[]).map(mapBoard);
}

// Usuário externo (role 'client'): só os quadros liberados explicitamente.
export async function listBoardsForUser(userId: string): Promise<BoardSummary[]> {
  const rows = await sql`
    select b.id, b.client_id as "clientId", c.name as "clientName", c.color as "clientColor",
           b.name, b.description, b.active, b.sort_order as "sortOrder", b.created_at as "createdAt"
    from boards b
    join clients c on c.id = b.client_id
    join board_access ba on ba.board_id = b.id
    where ba.user_id = ${userId} and b.active = true
    order by c.name asc, b.name asc
  `;
  return (rows as Record<string, unknown>[]).map(mapBoard);
}

export async function getBoard(id: string): Promise<BoardSummary | null> {
  const rows = await sql`
    select b.id, b.client_id as "clientId", c.name as "clientName", c.color as "clientColor",
           b.name, b.description, b.active, b.sort_order as "sortOrder", b.created_at as "createdAt"
    from boards b
    join clients c on c.id = b.client_id
    where b.id = ${id}
    limit 1
  `;
  return rows[0] ? mapBoard(rows[0] as Record<string, unknown>) : null;
}

export async function createBoard(params: {
  clientId: string;
  name: string;
  description?: string | null;
}): Promise<BoardSummary> {
  const rows = await sql`
    insert into boards (client_id, name, description)
    values (${params.clientId}, ${params.name}, ${params.description ?? null})
    returning id
  `;
  const board = await getBoard(rows[0].id as string);
  if (!board) throw new Error("Falha ao criar quadro.");
  return board;
}

export async function updateBoard(
  id: string,
  data: { name?: string; description?: string; active?: boolean }
): Promise<BoardSummary | null> {
  await sql`
    update boards set
      name = coalesce(${data.name ?? null}, name),
      description = coalesce(${data.description ?? null}, description),
      active = coalesce(${data.active ?? null}, active)
    where id = ${id}
  `;
  return getBoard(id);
}

export async function deleteBoard(id: string): Promise<boolean> {
  const rows = await sql`delete from boards where id = ${id} returning id`;
  return rows.length > 0;
}

export async function getBoardAccessUserIds(boardId: string): Promise<string[]> {
  const rows = await sql`select user_id as "userId" from board_access where board_id = ${boardId}`;
  return (rows as { userId: string }[]).map((r) => r.userId);
}

export async function setBoardAccess(boardId: string, userIds: string[]): Promise<void> {
  await sql`delete from board_access where board_id = ${boardId}`;
  for (const userId of userIds) {
    await sql`
      insert into board_access (board_id, user_id) values (${boardId}, ${userId})
      on conflict do nothing
    `;
  }
}

export async function userHasBoardAccess(boardId: string, userId: string): Promise<boolean> {
  const rows = await sql`
    select 1 from board_access where board_id = ${boardId} and user_id = ${userId} limit 1
  `;
  return rows.length > 0;
}
