import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getBoardAccessUserIds, setBoardAccess } from "@/lib/boards";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const userIds = await getBoardAccessUserIds(id);
  return NextResponse.json({ userIds });
}

const bodySchema = z.object({
  userIds: z.array(z.string().uuid()),
});

export async function PUT(
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  await setBoardAccess(id, parsed.data.userIds);
  return NextResponse.json({ id, userIds: parsed.data.userIds });
}
