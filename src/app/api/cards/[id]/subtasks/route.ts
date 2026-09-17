import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageKanban } from "@/lib/access";
import { addSubtask } from "@/lib/cards";

const bodySchema = z.object({
  title: z.string().trim().min(1, "Informe o texto da subtarefa."),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para adicionar subtarefas." }, { status: 403 });
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

  const subtask = await addSubtask(id, parsed.data.title);
  return NextResponse.json(subtask, { status: 201 });
}
