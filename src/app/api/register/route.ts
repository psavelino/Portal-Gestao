import { NextResponse } from "next/server";

// Cadastro público desativado — a criação de conta agora é sempre feita por
// um administrador, pela tela /usuarios (veja src/app/api/users/route.ts).
// Mantido como rota fechada (em vez de removida) para não devolver 404 cru
// a quem ainda tenha o link antigo salvo.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Cadastro fechado. Peça para um administrador do Join4 PMO criar sua conta.",
    },
    { status: 403 }
  );
}
