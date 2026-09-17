import { auth } from "@/auth";
import { getUserModuleKeys } from "@/lib/users";
import type { ModuleKey } from "@/lib/modules";
import { userHasBoardAccess } from "@/lib/boards";

// Checagem "ao vivo" (consulta o banco a cada carregamento de página) em vez
// de gravar os módulos liberados no JWT — assim, quando um admin muda a
// permissão de alguém, o efeito aparece no próximo carregamento de página,
// sem precisar esperar o usuário deslogar e logar de novo.
export async function hasModuleAccess(moduleKey: ModuleKey): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;
  if (session.user.role === "client") return false; // client só entra via /kanban + board_access
  const keys = await getUserModuleKeys(session.user.id);
  return keys.includes(moduleKey);
}

export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function isClientRole(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "client";
}

// Pode abrir o módulo Kanban (a tela /kanban em si — o quadro específico que
// ela mostra depende do papel: admin e member veem todos, client só os
// liberados em board_access).
export async function canUseKanban(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;
  if (session.user.role === "client") return true;
  const keys = await getUserModuleKeys(session.user.id);
  return keys.includes("kanban");
}

// Pode criar/editar/mover cards (equipe interna). Usuários 'client' têm
// acesso de leitura + comentário, nunca de escrita estrutural do quadro —
// decisão registrada no doc do projeto (claude/join4-pmo-app.md).
export async function canManageKanban(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;
  if (session.user.role !== "member") return false;
  const keys = await getUserModuleKeys(session.user.id);
  return keys.includes("kanban");
}

export async function canOpenBoard(boardId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;
  if (session.user.role === "member") {
    const keys = await getUserModuleKeys(session.user.id);
    return keys.includes("kanban");
  }
  if (session.user.role === "client") {
    return userHasBoardAccess(boardId, session.user.id);
  }
  return false;
}
