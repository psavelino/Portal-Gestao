import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

export async function GET() {
  const rows = await sql`
    select
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
    from projects
    order by sort_order asc, name asc
  `;
  return NextResponse.json(rows);
}

const createSchema = z
  .object({
    clientId: z.string().uuid("Selecione um cliente."),
    name: z.string().trim().min(2, "Informe o nome do projeto."),
    contractType: z.enum(["pacote_horas", "cmc", "outsourcing"]),
    packageHours: z.number().positive().max(1_000_000).optional(),
    cmcMonthlyHours: z.number().positive().max(1_000_000).optional(),
    cmcStartMonth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
      .optional(),
    outsourcingPeople: z.number().positive().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.contractType === "pacote_horas" && !data.packageHours) {
      ctx.addIssue({
        code: "custom",
        path: ["packageHours"],
        message: "Informe as horas contratadas do pacote.",
      });
    }
    if (data.contractType === "cmc" && (!data.cmcMonthlyHours || !data.cmcStartMonth)) {
      ctx.addIssue({
        code: "custom",
        path: ["cmcMonthlyHours"],
        message: "Informe o crédito mensal e o mês de início do CMC.",
      });
    }
    if (data.contractType === "outsourcing" && !data.outsourcingPeople) {
      ctx.addIssue({
        code: "custom",
        path: ["outsourcingPeople"],
        message: "Informe quantas pessoas dedicadas foram contratadas.",
      });
    }
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
  const d = parsed.data;

  const rows = await sql`
    insert into projects (
      client_id, name, contract_type,
      package_hours, cmc_monthly_hours, cmc_start_month, outsourcing_people
    )
    values (
      ${d.clientId}, ${d.name}, ${d.contractType},
      ${d.packageHours ?? null}, ${d.cmcMonthlyHours ?? null}, ${d.cmcStartMonth ?? null},
      ${d.outsourcingPeople ?? null}
    )
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
  return NextResponse.json(rows[0], { status: 201 });
}
