import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireForecastAdmin } from "@/lib/access";

export async function GET() {
  const rows = await sql`
    select
      id, name, role, weekly_capacity::float as "weeklyCapacity",
      active, sort_order as "sortOrder", user_id as "userId"
    from team_members
    order by sort_order asc, name asc
  `;
  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do consultor."),
  role: z.string().trim().optional(),
  weeklyCapacity: z.number().positive().max(168).default(40),
  userId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const denied = await requireForecastAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }
  const { name, role, weeklyCapacity, userId } = parsed.data;

  try {
    const rows = await sql`
      insert into team_members (name, role, weekly_capacity, user_id)
      values (${name}, ${role || null}, ${weeklyCapacity}, ${userId ?? null})
      returning id, name, role, weekly_capacity::float as "weeklyCapacity", active, sort_order as "sortOrder", user_id as "userId"
    `;
    return NextResponse.json(rows[0], { status: 201 });
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
