import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  status: z.enum(["ativo", "pausado", "encerrado"]).optional(),
  packageHours: z.number().positive().max(1_000_000).optional(),
  cmcMonthlyHours: z.number().positive().max(1_000_000).optional(),
  cmcStartMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional(),
  outsourcingPeople: z.number().positive().max(1000).optional(),
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
    update projects set
      name = coalesce(${data.name ?? null}, name),
      status = coalesce(${data.status ?? null}, status),
      package_hours = coalesce(${data.packageHours ?? null}, package_hours),
      cmc_monthly_hours = coalesce(${data.cmcMonthlyHours ?? null}, cmc_monthly_hours),
      cmc_start_month = coalesce(${data.cmcStartMonth ?? null}, cmc_start_month),
      outsourcing_people = coalesce(${data.outsourcingPeople ?? null}, outsourcing_people)
    where id = ${id}
    returning
      id,
      client_id as "clientId",
      name,
      contract_type as "contractType",
      status,
      package_hours::float as "packageHours",
      cmc_monthly_hours::float as "cmcMonthlyHours",
      to_char(cmc_start_month, 'YYYY-MM-DD') as "cmcStartMonth",
      outsourcing_people::float as "outsourcingPeople",
      sort_order as "sortOrder"
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
