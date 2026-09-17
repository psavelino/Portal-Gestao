import { sql } from "@/lib/db";
import type {
  CardAssignee,
  CardAttachment,
  CardComment,
  CardDetail,
  CardPriority,
  CardStatus,
  CardSubtask,
  CardSummary,
} from "@/lib/kanban-types";

type CardRow = {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  status: CardStatus;
  priority: CardPriority;
  dueDate: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

async function fetchCardRow(id: string): Promise<CardRow | null> {
  const rows = await sql`
    select id, board_id as "boardId", title, description, status, priority,
           due_date as "dueDate", sort_order as "sortOrder", archived,
           created_at as "createdAt", updated_at as "updatedAt"
    from cards where id = ${id} limit 1
  `;
  return (rows[0] as CardRow | undefined) ?? null;
}

async function attachAggregates(cards: CardRow[]): Promise<CardSummary[]> {
  if (cards.length === 0) return [];
  const ids = cards.map((c) => c.id);

  const [assigneeRows, subtaskRows, commentRows, attachmentRows] = await Promise.all([
    sql`
      select ca.card_id as "cardId", u.id, u.name
      from card_assignees ca
      join users u on u.id = ca.user_id
      where ca.card_id = any(${ids})
    `,
    sql`
      select card_id as "cardId", count(*)::int as total, count(*) filter (where done)::int as done
      from card_subtasks
      where card_id = any(${ids})
      group by card_id
    `,
    sql`
      select card_id as "cardId", count(*)::int as total
      from card_comments
      where card_id = any(${ids})
      group by card_id
    `,
    sql`
      select card_id as "cardId", count(*)::int as total
      from card_attachments
      where card_id = any(${ids})
      group by card_id
    `,
  ]);

  const assigneesByCard = new Map<string, CardAssignee[]>();
  for (const row of assigneeRows as { cardId: string; id: string; name: string }[]) {
    const list = assigneesByCard.get(row.cardId) ?? [];
    list.push({ id: row.id, name: row.name });
    assigneesByCard.set(row.cardId, list);
  }
  const subtasksByCard = new Map<string, { total: number; done: number }>();
  for (const row of subtaskRows as { cardId: string; total: number; done: number }[]) {
    subtasksByCard.set(row.cardId, { total: row.total, done: row.done });
  }
  const commentsByCard = new Map<string, number>();
  for (const row of commentRows as { cardId: string; total: number }[]) {
    commentsByCard.set(row.cardId, row.total);
  }
  const attachmentsByCard = new Map<string, number>();
  for (const row of attachmentRows as { cardId: string; total: number }[]) {
    attachmentsByCard.set(row.cardId, row.total);
  }

  return cards.map((c) => ({
    ...c,
    assignees: assigneesByCard.get(c.id) ?? [],
    subtaskTotal: subtasksByCard.get(c.id)?.total ?? 0,
    subtaskDone: subtasksByCard.get(c.id)?.done ?? 0,
    commentCount: commentsByCard.get(c.id) ?? 0,
    attachmentCount: attachmentsByCard.get(c.id) ?? 0,
  }));
}

export async function listCardsForBoard(boardId: string): Promise<CardSummary[]> {
  const rows = await sql`
    select id, board_id as "boardId", title, description, status, priority,
           due_date as "dueDate", sort_order as "sortOrder", archived,
           created_at as "createdAt", updated_at as "updatedAt"
    from cards
    where board_id = ${boardId} and archived = false
    order by status asc, sort_order asc, created_at asc
  `;
  return attachAggregates(rows as CardRow[]);
}

export async function getCardBoardId(cardId: string): Promise<string | null> {
  const rows = await sql`select board_id as "boardId" from cards where id = ${cardId} limit 1`;
  return (rows[0] as { boardId: string } | undefined)?.boardId ?? null;
}

export async function getCardSummary(id: string): Promise<CardSummary | null> {
  const row = await fetchCardRow(id);
  if (!row) return null;
  const [summary] = await attachAggregates([row]);
  return summary;
}

export async function getCardDetail(id: string): Promise<CardDetail | null> {
  const row = await fetchCardRow(id);
  if (!row) return null;

  const [summary] = await attachAggregates([row]);
  const [subtaskRows, commentRows, attachmentRows] = await Promise.all([
    sql`
      select id, title, done, sort_order as "sortOrder"
      from card_subtasks where card_id = ${id}
      order by sort_order asc, created_at asc
    `,
    sql`
      select cc.id, cc.user_id as "userId", coalesce(u.name, 'Usuário removido') as "userName",
             cc.body, cc.created_at as "createdAt"
      from card_comments cc
      left join users u on u.id = cc.user_id
      where cc.card_id = ${id}
      order by cc.created_at asc
    `,
    sql`
      select ca.id, ca.user_id as "userId", coalesce(u.name, 'Usuário removido') as "userName",
             ca.file_name as "fileName", ca.file_url as "fileUrl", ca.content_type as "contentType",
             ca.size_bytes as "sizeBytes", ca.created_at as "createdAt"
      from card_attachments ca
      left join users u on u.id = ca.user_id
      where ca.card_id = ${id}
      order by ca.created_at asc
    `,
  ]);

  return {
    ...summary,
    subtasks: subtaskRows as CardSubtask[],
    comments: commentRows as CardComment[],
    attachments: attachmentRows as CardAttachment[],
  };
}

export async function createCard(params: {
  boardId: string;
  title: string;
  description?: string | null;
  priority?: CardPriority;
  dueDate?: string | null;
  status?: CardStatus;
  createdBy: string | null;
}): Promise<CardSummary> {
  const status = params.status ?? "a_fazer";
  const maxRows = await sql`
    select coalesce(max(sort_order), -1) + 1 as next
    from cards where board_id = ${params.boardId} and status = ${status}
  `;
  const nextOrder = (maxRows[0] as { next: number }).next;
  const rows = await sql`
    insert into cards (board_id, title, description, priority, due_date, status, created_by, sort_order)
    values (
      ${params.boardId}, ${params.title}, ${params.description ?? null},
      ${params.priority ?? "media"}, ${params.dueDate ?? null}, ${status}, ${params.createdBy}, ${nextOrder}
    )
    returning id
  `;
  const summary = await getCardSummary(rows[0].id as string);
  if (!summary) throw new Error("Falha ao criar card.");
  return summary;
}

export async function updateCard(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    status?: CardStatus;
    priority?: CardPriority;
    dueDate?: string | null;
    sortOrder?: number;
    archived?: boolean;
  }
): Promise<CardSummary | null> {
  const rows = await sql`
    select title, description, status, priority, due_date as "dueDate",
           sort_order as "sortOrder", archived
    from cards where id = ${id} limit 1
  `;
  const cur = rows[0] as
    | {
        title: string;
        description: string | null;
        status: CardStatus;
        priority: CardPriority;
        dueDate: string | null;
        sortOrder: number;
        archived: boolean;
      }
    | undefined;
  if (!cur) return null;

  const next = {
    title: data.title ?? cur.title,
    description: "description" in data ? data.description ?? null : cur.description,
    status: data.status ?? cur.status,
    priority: data.priority ?? cur.priority,
    dueDate: "dueDate" in data ? data.dueDate ?? null : cur.dueDate,
    sortOrder: data.sortOrder ?? cur.sortOrder,
    archived: data.archived ?? cur.archived,
  };

  await sql`
    update cards set
      title = ${next.title},
      description = ${next.description},
      status = ${next.status},
      priority = ${next.priority},
      due_date = ${next.dueDate},
      sort_order = ${next.sortOrder},
      archived = ${next.archived},
      updated_at = now()
    where id = ${id}
  `;
  return getCardSummary(id);
}

export async function deleteCard(id: string): Promise<boolean> {
  const rows = await sql`delete from cards where id = ${id} returning id`;
  return rows.length > 0;
}

export async function reorderColumn(
  boardId: string,
  status: CardStatus,
  cardIds: string[]
): Promise<void> {
  for (let i = 0; i < cardIds.length; i++) {
    await sql`
      update cards set status = ${status}, sort_order = ${i}, updated_at = now()
      where id = ${cardIds[i]} and board_id = ${boardId}
    `;
  }
}

export async function setCardAssignees(cardId: string, userIds: string[]): Promise<void> {
  await sql`delete from card_assignees where card_id = ${cardId}`;
  for (const userId of userIds) {
    await sql`
      insert into card_assignees (card_id, user_id) values (${cardId}, ${userId})
      on conflict do nothing
    `;
  }
}

export async function addSubtask(cardId: string, title: string): Promise<CardSubtask> {
  const maxRows = await sql`
    select coalesce(max(sort_order), -1) + 1 as next from card_subtasks where card_id = ${cardId}
  `;
  const next = (maxRows[0] as { next: number }).next;
  const rows = await sql`
    insert into card_subtasks (card_id, title, sort_order)
    values (${cardId}, ${title}, ${next})
    returning id, title, done, sort_order as "sortOrder"
  `;
  return rows[0] as CardSubtask;
}

export async function updateSubtask(
  id: string,
  data: { title?: string; done?: boolean }
): Promise<CardSubtask | null> {
  const rows = await sql`
    update card_subtasks set
      title = coalesce(${data.title ?? null}, title),
      done = coalesce(${data.done ?? null}, done)
    where id = ${id}
    returning id, title, done, sort_order as "sortOrder"
  `;
  return (rows[0] as CardSubtask | undefined) ?? null;
}

export async function deleteSubtask(id: string): Promise<boolean> {
  const rows = await sql`delete from card_subtasks where id = ${id} returning id`;
  return rows.length > 0;
}

export async function getSubtaskCardId(id: string): Promise<string | null> {
  const rows = await sql`select card_id as "cardId" from card_subtasks where id = ${id} limit 1`;
  return (rows[0] as { cardId: string } | undefined)?.cardId ?? null;
}

export async function addComment(
  cardId: string,
  userId: string | null,
  body: string
): Promise<CardComment> {
  const rows = await sql`
    insert into card_comments (card_id, user_id, body) values (${cardId}, ${userId}, ${body})
    returning id
  `;
  const result = await sql`
    select cc.id, cc.user_id as "userId", coalesce(u.name, 'Usuário removido') as "userName",
           cc.body, cc.created_at as "createdAt"
    from card_comments cc left join users u on u.id = cc.user_id
    where cc.id = ${rows[0].id}
  `;
  return result[0] as CardComment;
}

export async function getCommentCardId(id: string): Promise<string | null> {
  const rows = await sql`select card_id as "cardId" from card_comments where id = ${id} limit 1`;
  return (rows[0] as { cardId: string } | undefined)?.cardId ?? null;
}

export async function getCommentAuthor(id: string): Promise<string | null> {
  const rows = await sql`select user_id as "userId" from card_comments where id = ${id} limit 1`;
  return (rows[0] as { userId: string | null } | undefined)?.userId ?? null;
}

export async function deleteComment(id: string): Promise<boolean> {
  const rows = await sql`delete from card_comments where id = ${id} returning id`;
  return rows.length > 0;
}

export async function addAttachment(params: {
  cardId: string;
  userId: string | null;
  fileName: string;
  fileUrl: string;
  contentType?: string | null;
  sizeBytes?: number | null;
}): Promise<CardAttachment> {
  const rows = await sql`
    insert into card_attachments (card_id, user_id, file_name, file_url, content_type, size_bytes)
    values (
      ${params.cardId}, ${params.userId}, ${params.fileName}, ${params.fileUrl},
      ${params.contentType ?? null}, ${params.sizeBytes ?? null}
    )
    returning id
  `;
  const result = await sql`
    select ca.id, ca.user_id as "userId", coalesce(u.name, 'Usuário removido') as "userName",
           ca.file_name as "fileName", ca.file_url as "fileUrl", ca.content_type as "contentType",
           ca.size_bytes as "sizeBytes", ca.created_at as "createdAt"
    from card_attachments ca left join users u on u.id = ca.user_id
    where ca.id = ${rows[0].id}
  `;
  return result[0] as CardAttachment;
}

export async function getAttachment(
  id: string
): Promise<{ cardId: string; fileUrl: string } | null> {
  const rows = await sql`
    select card_id as "cardId", file_url as "fileUrl" from card_attachments where id = ${id} limit 1
  `;
  return (rows[0] as { cardId: string; fileUrl: string } | undefined) ?? null;
}

export async function deleteAttachment(id: string): Promise<boolean> {
  const rows = await sql`delete from card_attachments where id = ${id} returning id`;
  return rows.length > 0;
}
