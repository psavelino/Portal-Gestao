import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageKanban } from "@/lib/access";
import { setCardAssignees } from "@/lib/cards";

const bodySchema = z.object({
  userIds: z.array(z.string().uuid()),
});

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para definir responsáveis." }, { status: 403 });
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

  await setCardAssignees(id, parsed.data.userIds);
  return NextResponse.json({ id, userIds: parsed.data.userIds });
}
