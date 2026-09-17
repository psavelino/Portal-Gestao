import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteBoard, updateBoard } from "@/lib/boards";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
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

  const board = await updateBoard(id, parsed.data);
  if (!board) {
    return NextResponse.json({ error: "Quadro não encontrado." }, { status: 404 });
  }
  return NextResponse.json(board);
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteBoard(id);
  if (!ok) {
    return NextResponse.json({ error: "Quadro não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
