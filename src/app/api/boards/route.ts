import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  createBoard,
  listActiveBoards,
  listAllBoards,
  listBoardsForUser,
} from "@/lib/boards";
import { getUserModuleKeys } from "@/lib/users";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.user.role === "admin") {
    // Admin vê tudo, inclusive quadros desativados (tela de gestão).
    return NextResponse.json(await listAllBoards());
  }

  if (session.user.role === "client") {
    return NextResponse.json(await listBoardsForUser(session.user.id));
  }

  // member — precisa do módulo kanban liberado.
  const keys = await getUserModuleKeys(session.user.id);
  if (!keys.includes("kanban")) {
    return NextResponse.json({ error: "Sem acesso ao Kanban." }, { status: 403 });
  }
  return NextResponse.json(await listActiveBoards());
}

const createSchema = z.object({
  clientId: z.string().uuid("Selecione um cliente."),
  name: z.string().trim().min(2, "Informe o nome do quadro."),
  description: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }

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

  const board = await createBoard(parsed.data);
  return NextResponse.json(board, { status: 201 });
}
