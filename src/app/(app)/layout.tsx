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

  // Admin não precisa de linhas em user_module_access — já enxerga tudo.
  // (Sem sessão não deveria acontecer aqui — o proxy já barra antes — mas
  // por segurança cai para "nenhum módulo" em vez de "todos".)
  let permittedModules: ModuleKey[] | "all" = [];
  if (isAdmin) {
    permittedModules = "all";
  } else if (session?.user?.id) {
    permittedModules = await getUserModuleKeys(session.user.id);
  }

  return (
    <div className="min-h-full flex flex-col">
      <NavHeader
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        isAdmin={isAdmin}
        permittedModules={permittedModules}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
