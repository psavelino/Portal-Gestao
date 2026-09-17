import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageKanban } from "@/lib/access";
import { reorderColumn } from "@/lib/cards";
import { CARD_STATUSES } from "@/lib/kanban-types";

// Reescreve status + ordem de todos os cards de uma coluna de uma vez —
// chamado depois de um drag-and-drop (arrastar entre colunas ou reordenar
// dentro da mesma coluna).
const bodySchema = z.object({
  status: z.enum(CARD_STATUSES),
  cardIds: z.array(z.string().uuid()),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para mover cards." }, { status: 403 });
  }
  const { id } = await ctx.params;

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

  await reorderColumn(id, parsed.data.status, parsed.data.cardIds);
  return NextResponse.json({ ok: true });
}
