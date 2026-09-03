import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { mondayOf, isoDate } from "@/lib/weeks";
import {
  computeCmcBalance,
  computeOutsourcingBalance,
  computePacoteBalance,
  type AllocRow,
} from "@/lib/project-balance";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const projectRows = await sql`
    select
      id,
      contract_type as "contractType",
      package_hours::float as "packageHours",
      cmc_monthly_hours::float as "cmcMonthlyHours",
      to_char(cmc_start_month, 'YYYY-MM-DD') as "cmcStartMonth",
      outsourcing_people::float as "outsourcingPeople"
    from projects
    where id = ${id}
  `;
  if (projectRows.length === 0) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  const project = projectRows[0] as {
    contractType: "pacote_horas" | "cmc" | "outsourcing";
    packageHours: number | null;
    cmcMonthlyHours: number | null;
    cmcStartMonth: string | null;
    outsourcingPeople: number | null;
  };

  const allocRows = (await sql`
    select
      to_char(week_start, 'YYYY-MM-DD') as "weekStart",
      hours::float as hours,
      status
    from allocations
    where project_id = ${id}
  `) as AllocRow[];

  const todayIso = isoDate(mondayOf());
  const currentMonth = todayIso.slice(0, 7);

  if (project.contractType === "pacote_horas") {
    return NextResponse.json(computePacoteBalance(project.packageHours ?? 0, allocRows));
  }
  if (project.contractType === "cmc") {
    return NextResponse.json(
      computeCmcBalance(
        project.cmcMonthlyHours ?? 0,
        project.cmcStartMonth ?? todayIso,
        allocRows,
        currentMonth
      )
    );
  }
  return NextResponse.json(
    computeOutsourcingBalance(project.outsourcingPeople ?? 0, allocRows, todayIso)
  );
}
