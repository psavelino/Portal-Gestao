import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

export async function GET() {
  const rows = await sql`
    select
      id, name, role, weekly_capacity::float as "weeklyCapacity",
      active, sort_order as "sortOrder"
    from team_members
    order by sort_order asc, name asc
  `;
  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do consultor."),
  role: z.string().trim().optional(),
  weeklyCapacity: z.number().positive().max(168).default(40),
});

export async function POST(request: Request) {
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
  const { name, role, weeklyCapacity } = parsed.data;

  const rows = await sql`
    insert into team_members (name, role, weekly_capacity)
    values (${name}, ${role || null}, ${weeklyCapacity})
    returning id, name, role, weekly_capacity::float as "weeklyCapacity", active, sort_order as "sortOrder"
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
