import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageKanban } from "@/lib/access";
import { deleteSubtask, updateSubtask } from "@/lib/cards";

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  done: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para editar subtarefas." }, { status: 403 });
  }
  const { subtaskId } = await ctx.params;

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

  const subtask = await updateSubtask(subtaskId, parsed.data);
  if (!subtask) {
    return NextResponse.json({ error: "Subtarefa não encontrada." }, { status: 404 });
  }
  return NextResponse.json(subtask);
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para excluir subtarefas." }, { status: 403 });
  }
  const { subtaskId } = await ctx.params;
  const ok = await deleteSubtask(subtaskId);
  if (!ok) {
    return NextResponse.json({ error: "Subtarefa não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
