import { auth } from "@/auth";
import NavHeader from "@/components/NavHeader";
import { getUserModuleKeys } from "@/lib/users";
import type { ModuleKey } from "@/lib/modules";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const isClient = session?.user?.role === "client";

  // Admin não precisa de linhas em user_module_access — já enxerga tudo.
  // Usuário 'client' não navega pelos módulos do portal (só pelo(s) quadro(s)
  // liberados em board_access), então não precisamos consultar módulos dele.
  // (Sem sessão não deveria acontecer aqui — o proxy já barra antes — mas
  // por segurança cai para "nenhum módulo" em vez de "todos".)
  let permittedModules: ModuleKey[] | "all" = [];
  if (isAdmin) {
    permittedModules = "all";
  } else if (session?.user?.id && !isClient) {
    permittedModules = await getUserModuleKeys(session.user.id);
  }

  return (
    <div className="min-h-full flex flex-col">
      <NavHeader
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        isAdmin={isAdmin}
        isClient={isClient}
        permittedModules={permittedModules}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
