import type { Metadata } from "next";
import BoardsAdminPanel from "@/components/kanban/BoardsAdminPanel";
import NoAccess from "@/components/NoAccess";
import { isAdmin } from "@/lib/access";

export const metadata: Metadata = { title: "Quadros · Kanban · Join4 PMO" };

export default async function KanbanQuadrosPage() {
  const admin = await isAdmin();
  if (!admin) return <NoAccess moduleLabel="Gestão de quadros" />;

  return (
    <div className="max-w-[1180px] mx-auto px-7 py-10">
      <div className="mb-8">
        <h1 className="text-[24px] leading-tight text-ink mb-1">Quadros do Kanban</h1>
        <p className="text-sm text-ink-secondary max-w-[70ch]">
          Crie um quadro por cliente (ou mais de um, se precisar separar frentes) e libere acesso
          externo por usuário.
        </p>
      </div>
      <BoardsAdminPanel />
    </div>
  );
}
