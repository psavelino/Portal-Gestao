import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canManageKanban, canOpenBoard } from "@/lib/access";
import { createCard, listCardsForBoard } from "@/lib/cards";
import { CARD_PRIORITIES, CARD_STATUSES } from "@/lib/kanban-types";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");
  if (!boardId) {
    return NextResponse.json({ error: "Informe o quadro (boardId)." }, { status: 400 });
  }

  const allowed = await canOpenBoard(boardId);
  if (!allowed) {
    return NextResponse.json({ error: "Sem acesso a este quadro." }, { status: 403 });
  }

  const cards = await listCardsForBoard(boardId);
  return NextResponse.json(cards);
}

const createSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().trim().min(2, "Informe um título para o card."),
  description: z.string().trim().optional(),
  priority: z.enum(CARD_PRIORITIES).optional(),
  dueDate: z.string().trim().optional(),
  status: z.enum(CARD_STATUSES).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para criar cards." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const card = await createCard({
    boardId: parsed.data.boardId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    dueDate: parsed.data.dueDate || null,
    status: parsed.data.status,
    createdBy: session.user.id,
  });
  return NextResponse.json(card, { status: 201 });
}
