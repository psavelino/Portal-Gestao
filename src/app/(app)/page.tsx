import Link from "next/link";

const MODULES = [
  {
    href: "/forecast",
    title: "Forecast da operação",
    description:
      "Aloque cada pessoa da equipe por cliente, semana a semana, e acompanhe a capacidade utilizada.",
    tag: "Editável",
    accent: "var(--verde)",
  },
  {
    href: "/fechamento",
    title: "Fechamento de Horas",
    description:
      "Suba o export de apontamento do mês e veja o saldo de horas dos pacotes recorrentes por cliente.",
    tag: "Upload de planilha",
    accent: "var(--laranja)",
  },
];

const COMING_SOON = [
  "Painel de clientes e risco",
  "Indicadores de margem por projeto",
  "Capacidade e alocação da equipe",
];

export default function HomePage() {
  return (
    <div className="max-w-[1180px] mx-auto px-7 py-12">
      <div className="mb-10">
        <h1 className="text-[28px] leading-tight text-ink mb-2">
          Central do PMO
        </h1>
        <p className="text-[15px] text-ink-secondary max-w-[60ch]">
          Ponto de partida para a gestão de horas, fechamentos e forecast da
          operação Join4. Escolha um módulo abaixo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group relative overflow-hidden bg-surface border border-border rounded-xl p-6 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] hover:border-[var(--accent-hover)] transition-colors flex flex-col gap-3"
            style={{ ["--accent-hover" as string]: m.accent }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: m.accent }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-wide w-fit px-2 py-0.5 rounded-full"
              style={{ background: `${m.accent}1a`, color: m.accent }}
            >
              {m.tag}
            </span>
            <h2 className="text-lg font-condensed font-bold text-ink">
              {m.title}
            </h2>
            <p className="text-sm text-ink-secondary leading-relaxed">
              {m.description}
            </p>
            <span className="text-sm font-semibold text-verde mt-1 group-hover:underline">
              Abrir &rarr;
            </span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-3">
          Em breve
        </h2>
        <div className="flex flex-wrap gap-2">
          {COMING_SOON.map((label) => (
            <span
              key={label}
              className="text-xs font-medium text-ink-faint bg-surface-alt border border-border rounded-full px-3 py-1.5"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
