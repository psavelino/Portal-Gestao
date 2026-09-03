export type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  weeklyCapacity: number;
  active: boolean;
  sortOrder: number;
};

export type Client = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  sortOrder: number;
};

export type ContractType = "pacote_horas" | "cmc" | "outsourcing";
export type ProjectStatus = "ativo" | "pausado" | "encerrado";

export type Project = {
  id: string;
  clientId: string;
  name: string;
  contractType: ContractType;
  status: ProjectStatus;
  packageHours: number | null;
  cmcMonthlyHours: number | null;
  cmcStartMonth: string | null; // YYYY-MM-DD (dia 1)
  outsourcingPeople: number | null;
  sortOrder: number;
};

export type AllocationStatus = "confirmado" | "previsto";

export type Allocation = {
  id: string;
  teamMemberId: string;
  projectId: string;
  weekStart: string; // YYYY-MM-DD
  hours: number;
  status: AllocationStatus;
};

export function cellKey(teamMemberId: string, projectId: string, weekStart: string) {
  return `${teamMemberId}|${projectId}|${weekStart}`;
}

export function utilClass(pct: number): "good" | "warn" | "bad" {
  if (pct <= 100) return "good";
  if (pct <= 115) return "warn";
  return "bad";
}

/**
 * Paleta estendida só para cor-cliente na grade do forecast. A paleta
 * oficial Join4 (teal/laranja/cinza) tem só 4 cores e fica reservada para
 * status, KPIs e identidade visual do resto do app — aqui usamos tons
 * derivados/adjacentes, com teal e laranja como as duas primeiras opções.
 */
export const CLIENT_PALETTE = [
  "#009999", // teal Join4
  "#FF9B00", // laranja Join4
  "#4A3AA7", // índigo
  "#1F8F5C", // verde
  "#C6383D", // vermelho/tijolo
  "#2E6F9E", // azul
  "#B8860B", // mostarda
  "#7A4FA3", // violeta
  "#3D8B85", // verde-azulado
  "#A0522D", // terracota
  "#5C7A89", // azul-acinzentado
  "#8C6D1F", // oliva
  "#C25B9E", // malva
  "#4F6D7A", // azul-aço
] as const;

export const CONTRACT_TYPE_META: Record<
  ContractType,
  { label: string; tag: string; hint: string }
> = {
  pacote_horas: {
    label: "Pacote de horas",
    tag: "PH",
    hint: "Bloco fechado de horas, consumido até acabar (sem reset mensal).",
  },
  cmc: {
    label: "CMC (Contrato de Melhoria Contínua)",
    tag: "CMC",
    hint: "Crédito mensal recorrente — acumula se sobrar, pode ficar negativo.",
  },
  outsourcing: {
    label: "Outsourcing",
    tag: "OUT",
    hint: "Pessoas dedicadas full-time — compara alocado x contratado.",
  },
};
