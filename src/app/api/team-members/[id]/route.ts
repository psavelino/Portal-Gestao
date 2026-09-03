import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.string().trim().optional(),
  weeklyCapacity: z.number().positive().max(168).optional(),
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
    update team_members set
      name = coalesce(${data.name ?? null}, name),
      role = coalesce(${data.role ?? null}, role),
      weekly_capacity = coalesce(${data.weeklyCapacity ?? null}, weekly_capacity),
      active = coalesce(${data.active ?? null}, active)
    where id = ${id}
    returning id, name, role, weekly_capacity::float as "weeklyCapacity", active, sort_order as "sortOrder"
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
