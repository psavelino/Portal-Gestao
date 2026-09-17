import Link from "next/link";

export default function NoAccess({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div className="max-w-[1180px] mx-auto px-7 py-16 flex justify-center">
      <div className="max-w-[440px] text-center bg-surface border border-border rounded-xl p-8 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)]">
        <h1 className="text-lg font-condensed font-bold text-ink mb-2">
          Sem acesso a {moduleLabel}
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          Seu usuário ainda não tem permissão para este módulo. Peça para um
          administrador liberar o acesso na tela de Usuários.
        </p>
        <Link
          href="/"
          className="text-sm font-semibold text-verde hover:underline"
        >
          &larr; Voltar para o início
        </Link>
      </div>
    </div>
  );
}
