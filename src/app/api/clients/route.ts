import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { CLIENT_PALETTE } from "@/lib/forecast-types";

export async function GET() {
  const rows = await sql`
    select id, name, color, active, sort_order as "sortOrder"
    from clients
    order by sort_order asc, name asc
  `;
  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  color: z.string().trim().optional(),
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
  const { name } = parsed.data;
  const countRows = await sql`select count(*)::int as n from clients`;
  const n = (countRows[0]?.n as number) ?? 0;
  const color = parsed.data.color || CLIENT_PALETTE[n % CLIENT_PALETTE.length];

  const rows = await sql`
    insert into clients (name, color)
    values (${name}, ${color})
    returning id, name, color, active, sort_order as "sortOrder"
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
