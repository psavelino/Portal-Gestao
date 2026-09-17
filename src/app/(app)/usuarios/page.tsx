import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import UsersPanel from "@/components/users/UsersPanel";
import { isAdmin } from "@/lib/access";
import { listUsersWithAccess } from "@/lib/users";

export const metadata: Metadata = { title: "Usuários · Join4 PMO" };

export default async function UsuariosPage() {
  const admin = await isAdmin();
  if (!admin) return <NoAccess moduleLabel="Usuários" />;

  const users = await listUsersWithAccess();

  return (
    <div className="max-w-[1180px] mx-auto px-7 py-10">
      <div className="mb-8">
        <h1 className="text-[24px] leading-tight text-ink mb-1">
          Usuários e permissões
        </h1>
        <p className="text-sm text-ink-secondary max-w-[70ch]">
          Crie contas e escolha quais módulos cada pessoa pode acessar. O
          cadastro público está fechado — toda conta nova nasce aqui.
        </p>
      </div>
      <UsersPanel initialUsers={users} />
    </div>
  );
}
