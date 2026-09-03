// Cálculo de saldo por projeto. Puro (sem acesso a banco) para ficar fácil
// de testar/ajustar — quem busca as linhas de alocação é a rota de API.

export type AllocRow = { weekStart: string; hours: number; status: "confirmado" | "previsto" };

/** Horas semanais padrão usadas para converter "pessoas dedicadas" em horas
 * contratadas no outsourcing. Ajuste aqui se a Join4 usar outro padrão. */
export const STANDARD_WEEKLY_HOURS = 40;

export type PacoteBalance = {
  type: "pacote_horas";
  contracted: number;
  consumed: number;
  remaining: number;
  pctUsed: number;
};

export function computePacoteBalance(contracted: number, rows: AllocRow[]): PacoteBalance {
  const consumed = rows
    .filter((r) => r.status === "confirmado")
    .reduce((s, r) => s + r.hours, 0);
  const remaining = contracted - consumed;
  const pctUsed = contracted > 0 ? (consumed / contracted) * 100 : 0;
  return { type: "pacote_horas", contracted, consumed, remaining, pctUsed };
}

export type CmcMonth = { month: string; credit: number; consumed: number; balance: number };
export type CmcBalance = {
  type: "cmc";
  monthlyCredit: number;
  months: CmcMonth[];
  currentBalance: number;
};

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m já é 1-indexado -> avança pro próximo mês
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function computeCmcBalance(
  monthlyCredit: number,
  startMonth: string,
  rows: AllocRow[],
  currentMonth: string
): CmcBalance {
  const consumedByMonth = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "confirmado") continue;
    const month = r.weekStart.slice(0, 7);
    consumedByMonth.set(month, (consumedByMonth.get(month) ?? 0) + r.hours);
  }

  const start = startMonth.slice(0, 7);
  const monthsWithData = Array.from(consumedByMonth.keys());
  const latestDataMonth = monthsWithData.length ? monthsWithData.sort().at(-1)! : start;
  const endMonth = [currentMonth, latestDataMonth, start].sort().at(-1)!;

  const months: CmcMonth[] = [];
  let balance = 0;
  let cursor = start;
  let guard = 0;
  while (cursor <= endMonth && guard < 600) {
    const consumed = consumedByMonth.get(cursor) ?? 0;
    balance = balance + monthlyCredit - consumed;
    months.push({ month: cursor, credit: monthlyCredit, consumed, balance });
    cursor = nextMonth(cursor);
    guard += 1;
  }
  return { type: "cmc", monthlyCredit, months, currentBalance: months.at(-1)?.balance ?? 0 };
}

export type OutsourcingWeek = { week: string; allocated: number };
export type OutsourcingBalance = {
  type: "outsourcing";
  contractedPeople: number;
  contractedWeeklyHours: number;
  weeks: OutsourcingWeek[];
  currentWeekAllocated: number;
};

export function computeOutsourcingBalance(
  people: number,
  rows: AllocRow[],
  currentWeekIso: string
): OutsourcingBalance {
  const contractedWeeklyHours = people * STANDARD_WEEKLY_HOURS;
  const byWeek = new Map<string, number>();
  for (const r of rows) {
    byWeek.set(r.weekStart, (byWeek.get(r.weekStart) ?? 0) + r.hours);
  }
  const weeks = Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, allocated]) => ({ week, allocated }));
  return {
    type: "outsourcing",
    contractedPeople: people,
    contractedWeeklyHours,
    weeks,
    currentWeekAllocated: byWeek.get(currentWeekIso) ?? 0,
  };
}

export type ProjectBalance = PacoteBalance | CmcBalance | OutsourcingBalance;
