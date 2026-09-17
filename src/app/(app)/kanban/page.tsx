import type { Metadata } from "next";
import { auth } from "@/auth";
import KanbanApp from "@/components/kanban/KanbanApp";
import NoAccess from "@/components/NoAccess";
import { canManageKanban, canUseKanban, getMyTeamUserIds } from "@/lib/access";

export const metadata: Metadata = { title: "Kanban · Join4 PMO" };

export default async function KanbanPage() {
  const [allowed, session] = await Promise.all([canUseKanban(), auth()]);
  if (!allowed || !session?.user?.id) return <NoAccess moduleLabel="Kanban" />;

  const [canManage, myTeamUserIds] = await Promise.all([canManageKanban(), getMyTeamUserIds()]);

  return (
    <KanbanApp
      canManage={canManage}
      isAdmin={session.user.role === "admin"}
      isClient={session.user.role === "client"}
      currentUserId={session.user.id}
      myTeamUserIds={myTeamUserIds}
    />
  );
}
