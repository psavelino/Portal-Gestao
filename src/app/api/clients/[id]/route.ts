import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  color: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
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
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const rows = await sql`
    update clients set
      name = coalesce(${data.name ?? null}, name),
      color = coalesce(${data.color ?? null}, color),
      active = coalesce(${data.active ?? null}, active)
    where id = ${id}
    returning id, name, color, active, sort_order as "sortOrder"
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
