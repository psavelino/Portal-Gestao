import { auth } from "@/auth";
import { getUserModuleKeys } from "@/lib/users";
import type { ModuleKey } from "@/lib/modules";

// Checagem "ao vivo" (consulta o banco a cada carregamento de página) em vez
// de gravar os módulos liberados no JWT — assim, quando um admin muda a
// permissão de alguém, o efeito aparece no próximo carregamento de página,
// sem precisar esperar o usuário deslogar e logar de novo.
export async function hasModuleAccess(moduleKey: ModuleKey): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;
  const keys = await getUserModuleKeys(session.user.id);
  return keys.includes(moduleKey);
}

export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "admin";
}
