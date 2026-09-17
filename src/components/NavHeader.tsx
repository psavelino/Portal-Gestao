import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { MODULES, type ModuleKey } from "@/lib/modules";

export default function NavHeader({
  userName,
  userEmail,
  isAdmin,
  isClient,
  permittedModules,
}: {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin?: boolean;
  isClient?: boolean;
  permittedModules?: ModuleKey[] | "all";
}) {
  const canSee = (key: ModuleKey) =>
    permittedModules === "all" || (permittedModules ?? []).includes(key);

  // Usuário externo (role 'client'): navegação mínima, direto para o quadro
  // liberado — sem acesso ao resto do portal.
  const navLinks = isClient
    ? [{ href: "/kanban", label: "Meu quadro" }]
    : [
        { href: "/", label: "Início" },
        ...MODULES.filter((m) => canSee(m.key)).map((m) => ({
          href: m.href,
          label: m.label,
        })),
        ...(isAdmin ? [{ href: "/usuarios", label: "Usuários" }] : []),
      ];

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-[1180px] mx-auto px-7 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-verde" />
            <span className="font-condensed font-bold text-[13px] tracking-[0.14em] uppercase text-ink-secondary">
              Join4 &middot; PMO
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-ink-secondary hover:text-ink hover:bg-surface-alt transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-right">
          {(userName || userEmail) && (
            <div className="leading-tight hidden sm:block">
              <div className="text-sm font-medium text-ink">{userName}</div>
              <div className="text-xs text-ink-faint">{userEmail}</div>
            </div>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
