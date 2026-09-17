import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Cadastro fechado · Join4 PMO" };

// O cadastro público foi fechado — contas agora são criadas só por um
// administrador, pela tela /usuarios. Mantivemos a rota (em vez de apagar)
// para quem ainda tiver o link antigo salvo.
export default function SignupPage() {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] p-7 text-center">
      <h1 className="text-xl font-condensed font-bold text-ink mb-2">
        Cadastro fechado
      </h1>
      <p className="text-sm text-ink-secondary mb-6">
        A criação de conta não é mais autoatendida. Peça para um
        administrador do Join4 PMO criar seu usuário e liberar os módulos
        que você vai usar.
      </p>
      <Link href="/login" className="text-sm font-semibold text-verde hover:underline">
        &larr; Voltar para o login
      </Link>
    </div>
  );
}
