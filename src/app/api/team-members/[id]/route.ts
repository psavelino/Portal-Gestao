import { NextResponse } from "next/server";

// Ver comentário em ../route.ts — cadastro próprio de equipe removido em
// 18/09, endpoint mantido como stub 410.
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "Este endpoint foi desativado. A equipe do Forecast agora é derivada dos usuários cadastrados — gerencie capacidade, cargo e líder direto em /usuarios.",
    },
    { status: 410 }
  );
}
