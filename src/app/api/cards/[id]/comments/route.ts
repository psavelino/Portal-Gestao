import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canOpenBoard } from "@/lib/access";
import { addComment, getCardBoardId } from "@/lib/cards";

const bodySchema = z.object({
  body: z.string().trim().min(1, "Escreva um comentário."),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;

  const boardId = await getCardBoardId(id);
  if (!boardId) {
    return NextResponse.json({ error: "Card não encontrado." }, { status: 404 });
  }
  const allowed = await canOpenBoard(boardId);
  if (!allowed) {
    return NextResponse.json({ error: "Sem acesso a este quadro." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const comment = await addComment(id, session.user.id, parsed.data.body);
  return NextResponse.json(comment, { status: 201 });
}
