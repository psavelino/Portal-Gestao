import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireForecastAdmin } from "@/lib/access";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.string().trim().optional(),
  weeklyCapacity: z.number().positive().max(168).optional(),
  active: z.boolean().optional(),
  userId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = await requireForecastAdmin();
  if (denied) return denied;

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

  // userId é tri-state (undefined = não mexe, null = desvincula, string =
  // vincula) — coalesce() não limpa pra null, por isso é uma query separada
  // quando a chave veio no payload (mesmo padrão usado em updateUser).
  try {
    const rows =
      data.userId !== undefined
        ? await sql`
            update team_members set
              name = coalesce(${data.name ?? null}, name),
              role = coalesce(${data.role ?? null}, role),
              weekly_capacity = coalesce(${data.weeklyCapacity ?? null}, weekly_capacity),
              active = coalesce(${data.active ?? null}, active),
              user_id = ${data.userId}
            where id = ${id}
            returning id, name, role, weekly_capacity::float as "weeklyCapacity", active, sort_order as "sortOrder", user_id as "userId"
          `
        : await sql`
            update team_members set
              name = coalesce(${data.name ?? null}, name),
              role = coalesce(${data.role ?? null}, role),
              weekly_capacity = coalesce(${data.weeklyCapacity ?? null}, weekly_capacity),
              active = coalesce(${data.active ?? null}, active)
            where id = ${id}
            returning id, name, role, weekly_capacity::float as "weeklyCapacity", active, sort_order as "sortOrder", user_id as "userId"
          `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return NextResponse.json(
        { error: "Essa conta de usuário já está vinculada a outro consultor." },
        { status: 409 }
      );
    }
    throw err;
  }
}
