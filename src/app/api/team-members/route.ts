import { NextResponse } from "next/server";

// Endpoint desativado em 18/09: o cadastro próprio de equipe (team_members)
// foi removido — a "equipe" do Forecast passou a ser derivada direto dos
// usuários cadastrados (ver GET /api/forecast/roster e listForecastRoster()
// em src/lib/users.ts). Rota mantida como stub (em vez de apagada) só pra
// não devolver um 404 cru caso algo antigo ainda aponte pra cá — mesmo
// padrão já usado antes com /api/register.
function gone() {
  return NextResponse.json(
    {
      error:
        "Este endpoint foi desativado. A equipe do Forecast agora é derivada dos usuários cadastrados — veja /api/forecast/roster.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}
