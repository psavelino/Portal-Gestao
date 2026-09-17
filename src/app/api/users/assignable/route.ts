import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAssignableUsers } from "@/lib/users";

// Lista de possíveis responsáveis por card (equipe interna: admin + member).
// Qualquer usuário autenticado com acesso ao Kanban pode consultar — não é
// informação sensível dentro da própria organização.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const users = await listAssignableUsers();
  return NextResponse.json(users);
}
