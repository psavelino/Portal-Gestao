import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const startParsed = dateSchema.safeParse(start);
  const endParsed = dateSchema.safeParse(end);
  if (!startParsed.success || !endParsed.success) {
    return NextResponse.json(
      { error: "Informe start e end no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const rows = await sql`
    select
      id,
      team_member_id as "teamMemberId",
      project_id as "projectId",
      to_char(week_start, 'YYYY-MM-DD') as "weekStart",
      hours::float as hours,
      status
    from allocations
    where week_start between ${startParsed.data} and ${endParsed.data}
  `;
  return NextResponse.json(rows);
}

const putSchema = z.object({
  teamMemberId: z.string().uuid(),
  projectId: z.string().uuid(),
  weekStart: dateSchema,
  hours: z.number().min(0).max(168),
  status: z.enum(["confirmado", "previsto"]).default("confirmado"),
});

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }
  const { teamMemberId, projectId, weekStart, hours, status } = parsed.data;

  if (hours <= 0) {
    await sql`
      delete from allocations
      where team_member_id = ${teamMemberId}
        and project_id = ${projectId}
        and week_start = ${weekStart}
    `;
    return NextResponse.json({ deleted: true });
  }

  const rows = await sql`
    insert into allocations (team_member_id, project_id, week_start, hours, status)
    values (${teamMemberId}, ${projectId}, ${weekStart}, ${hours}, ${status})
    on conflict (team_member_id, project_id, week_start)
    do update set hours = excluded.hours, status = excluded.status, updated_at = now()
    returning
      id,
      team_member_id as "teamMemberId",
      project_id as "projectId",
      to_char(week_start, 'YYYY-MM-DD') as "weekStart",
      hours::float as hours,
      status
  `;
  return NextResponse.json(rows[0]);
}
