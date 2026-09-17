import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canManageKanban, canOpenBoard } from "@/lib/access";
import { deleteCard, getCardDetail, updateCard } from "@/lib/cards";
import { CARD_PRIORITIES, CARD_STATUSES } from "@/lib/kanban-types";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const card = await getCardDetail(id);
  if (!card) {
    return NextResponse.json({ error: "Card não encontrado." }, { status: 404 });
  }
  const allowed = await canOpenBoard(card.boardId);
  if (!allowed) {
    return NextResponse.json({ error: "Sem acesso a este quadro." }, { status: 403 });
  }
  return NextResponse.json(card);
}

const updateSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  status: z.enum(CARD_STATUSES).optional(),
  priority: z.enum(CARD_PRIORITIES).optional(),
  dueDate: z.string().trim().nullable().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para editar cards." }, { status: 403 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const patch: Parameters<typeof updateCard>[1] = {
    title: parsed.data.title,
    status: parsed.data.status,
    priority: parsed.data.priority,
    archived: parsed.data.archived,
  };
  if ("description" in parsed.data) patch.description = parsed.data.description || null;
  if ("dueDate" in parsed.data) patch.dueDate = parsed.data.dueDate || null;

  const card = await updateCard(id, patch);
  if (!card) {
    return NextResponse.json({ error: "Card não encontrado." }, { status: 404 });
  }
  return NextResponse.json(card);
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para excluir cards." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteCard(id);
  if (!ok) {
    return NextResponse.json({ error: "Card não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
