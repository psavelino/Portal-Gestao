// Tipos compartilhados do módulo Kanban (front + back).

export const CARD_STATUSES = [
  "backlog",
  "a_fazer",
  "em_andamento",
  "em_revisao",
  "concluido",
] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  backlog: "Backlog",
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  em_revisao: "Em revisão",
  concluido: "Concluído",
};

export const CARD_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
export type CardPriority = (typeof CARD_PRIORITIES)[number];

export const CARD_PRIORITY_LABELS: Record<CardPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

// Cores da paleta Join4 por prioridade (verde/laranja) + duas variações para
// baixa/urgente, mantendo a paleta oficial como base.
export const CARD_PRIORITY_COLORS: Record<CardPriority, string> = {
  baixa: "#666666",
  media: "#009999",
  alta: "#FF9B00",
  urgente: "#C6383D",
};

export type BoardSummary = {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

export type AssignableUser = { id: string; name: string; role: "admin" | "member" };

export type CardAssignee = { id: string; name: string };
export type CardSubtask = { id: string; title: string; done: boolean; sortOrder: number };
export type CardComment = {
  id: string;
  userId: string | null;
  userName: string;
  body: string;
  createdAt: string;
};
export type CardAttachment = {
  id: string;
  userId: string | null;
  userName: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type CardSummary = {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  status: CardStatus;
  priority: CardPriority;
  dueDate: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  assignees: CardAssignee[];
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
  attachmentCount: number;
};

export type CardDetail = CardSummary & {
  subtasks: CardSubtask[];
  comments: CardComment[];
  attachments: CardAttachment[];
};
