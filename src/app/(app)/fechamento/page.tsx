import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Fechamento de Horas · Join4 PMO" };

export default function FechamentoPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <div className="border-b border-border bg-surface px-7 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/"
          className="text-sm font-semibold text-ink-secondary hover:text-verde transition-colors"
        >
          &larr; Início
        </Link>
        <p className="text-xs text-ink-faint">
          Suba o export (.xlsx) da plataforma de apontamento para recalcular o saldo do pacote recorrente do cliente. Nada é salvo no servidor — cada upload vale para a sessão atual do navegador.
        </p>
      </div>
      <iframe
        title="Saldo de Horas: Pacotes Recorrentes"
        src="/fechamento-horas.html"
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
