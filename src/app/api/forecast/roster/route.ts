import { NextResponse } from "next/server";
import { listForecastRoster } from "@/lib/users";

// "Equipe" do Forecast — não existe mais cadastro próprio (team_members foi
// removido em 18/09). A lista vem direto de users: entra quem é 'member',
// ou quem é liderado por alguém (leaderId preenchido); quem não tem líder e
// não é 'member' (o squad leader raiz) fica de fora — só gerencia. Mesmo
// padrão de acesso das outras rotas GET do Forecast (clients, projects):
// qualquer usuário autenticado pode ler, a página é quem checa o módulo
// liberado antes de montar a UI.
export async function GET() {
  const roster = await listForecastRoster();
  return NextResponse.json(roster);
}
