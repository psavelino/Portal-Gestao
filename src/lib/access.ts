import { NextResponse } from "next/server";
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

// Pode editar o Forecast (lançar/alterar horas, gerenciar equipe, clientes
// e projetos). Decisão do Paulo (18/09): só admin edita — member com o
// módulo forecast liberado passa a ter acesso de LEITURA (visualiza a
// grade inteira, sem poder mexer). Usada na página pra controlar a UI e
// nas rotas de API abaixo pra bloquear a escrita de verdade (não só
// esconder botão).
export async function canEditForecast(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "admin";
}

// Mesma regra que canEditForecast, mas pronta pra usar em rota de API:
// devolve uma resposta 403 se não for admin, ou null se pode seguir.
export async function requireForecastAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem editar o forecast." },
      { status: 403 }
    );
  }
  return null;
}
