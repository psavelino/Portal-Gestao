"use client";

import { useState } from "react";
import type { Client, Project } from "@/lib/forecast-types";
import { CONTRACT_TYPE_META } from "@/lib/forecast-types";
import type { ProjectBalance } from "@/lib/project-balance";

type BalanceState = { status: "loading" } | { status: "error" } | { status: "ok"; data: ProjectBalance };

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`;
}

function weekLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function ProjectBalancePanel({
  clients,
  projects,
}: {
  clients: Client[];
  projects: Project[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [balances, setBalances] = useState<Record<string, BalanceState>>({});

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const visibleProjects = projects.filter((p) => p.status !== "encerrado");
  const byClient = new Map<string, Project[]>();
  for (const p of visibleProjects) {
    if (!byClient.has(p.clientId)) byClient.set(p.clientId, []);
    byClient.get(p.clientId)!.push(p);
  }

  async function toggle(p: Project) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
    if (!balances[p.id]) {
      setBalances((prev) => ({ ...prev, [p.id]: { status: "loading" } }));
      try {
        const res = await fetch(`/api/projects/${p.id}/balance`);
        if (!res.ok) throw new Error();
        const data: ProjectBalance = await res.json();
        setBalances((prev) => ({ ...prev, [p.id]: { status: "ok", data } }));
      } catch {
        setBalances((prev) => ({ ...prev, [p.id]: { status: "error" } }));
      }
    }
  }

  if (visibleProjects.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        Nenhum projeto ativo cadastrado ainda. Cadastre projetos em &quot;Gerenciar
        equipe e clientes&quot;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byClient.entries()).map(([clientId, clientProjects]) => {
        const client = clientById.get(clientId);
        return (
          <div key={clientId}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: client?.color ?? "#999" }}
              />
              <h4 className="text-sm font-semibold text-ink">{client?.name ?? "Cliente removido"}</h4>
            </div>
            <div className="flex flex-col gap-2 pl-4">
              {clientProjects.map((p) => {
                const meta = CONTRACT_TYPE_META[p.contractType];
                const isOpen = expanded.has(p.id);
                const b = balances[p.id];
                return (
                  <div key={p.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-alt"
                    >
                      <span className="flex items-center gap-2 text-sm text-ink">
                        {p.name}
                        <span
                          className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint border border-border-strong rounded px-1 py-0.5"
                          title={meta.hint}
                        >
                          {meta.tag}
                        </span>
                        {p.status === "pausado" && (
                          <span className="text-[10px] text-ink-faint uppercase">pausado</span>
                        )}
                      </span>
                      <span className="text-ink-faint text-xs">{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        {!b || b.status === "loading" ? (
                          <p className="text-xs text-ink-faint">Carregando saldo…</p>
                        ) : b.status === "error" ? (
                          <p className="text-xs text-critical">Não foi possível carregar o saldo.</p>
                        ) : (
                          <BalanceView balance={b.data} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BalanceView({ balance }: { balance: ProjectBalance }) {
  if (balance.type === "pacote_horas") {
    const pct = Math.min(100, Math.max(0, balance.pctUsed));
    const barColor =
      balance.pctUsed > 100 ? "bg-critical" : balance.pctUsed >= 80 ? "bg-laranja" : "bg-verde";
    return (
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-ink-secondary">
            {balance.consumed.toFixed(1)}h consumidas de {balance.contracted.toFixed(1)}h
          </span>
          <span
            className={`text-sm font-semibold mono ${
              balance.remaining < 0 ? "text-critical" : "text-ink"
            }`}
          >
            {balance.remaining.toFixed(1)}h restantes
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (balance.type === "cmc") {
    return (
      <div>
        <p className="text-xs text-ink-secondary mb-2">
          Crédito mensal: <span className="mono">{balance.monthlyCredit.toFixed(1)}h</span> · Saldo
          atual:{" "}
          <span
            className={`mono font-semibold ${balance.currentBalance < 0 ? "text-critical" : "text-verde"}`}
          >
            {balance.currentBalance.toFixed(1)}h
          </span>
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="text-ink-faint text-left">
                <th className="pr-3 py-1 font-medium">Mês</th>
                <th className="pr-3 py-1 font-medium text-right">Crédito</th>
                <th className="pr-3 py-1 font-medium text-right">Consumido</th>
                <th className="py-1 font-medium text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {balance.months.map((m) => (
                <tr key={m.month} className="border-t border-border/60">
                  <td className="pr-3 py-1 mono">{monthLabel(m.month)}</td>
                  <td className="pr-3 py-1 mono text-right">{m.credit.toFixed(1)}</td>
                  <td className="pr-3 py-1 mono text-right">{m.consumed.toFixed(1)}</td>
                  <td
                    className={`py-1 mono text-right font-semibold ${
                      m.balance < 0 ? "text-critical" : "text-ink"
                    }`}
                  >
                    {m.balance.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // outsourcing
  const currentPct =
    balance.contractedWeeklyHours > 0
      ? (balance.currentWeekAllocated / balance.contractedWeeklyHours) * 100
      : 0;
  const statusLabel =
    currentPct < 90 ? "Ociosidade" : currentPct > 110 ? "Sobre-alocado" : "Dentro do contrato";
  const statusColor = currentPct < 90 || currentPct > 110 ? "text-critical" : "text-verde";
  return (
    <div>
      <p className="text-xs text-ink-secondary mb-2">
        Contratado: <span className="mono">{balance.contractedPeople}</span> pessoa(s) ·{" "}
        <span className="mono">{balance.contractedWeeklyHours.toFixed(0)}h/semana</span>
      </p>
      <p className="text-sm mb-2">
        Semana atual: <span className="mono font-semibold">{balance.currentWeekAllocated.toFixed(1)}h</span>{" "}
        <span className={`text-xs font-semibold ${statusColor}`}>({statusLabel})</span>
      </p>
      {balance.weeks.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="text-ink-faint text-left">
                <th className="pr-3 py-1 font-medium">Semana</th>
                <th className="py-1 font-medium text-right">Alocado</th>
              </tr>
            </thead>
            <tbody>
              {balance.weeks.slice(-8).map((w) => (
                <tr key={w.week} className="border-t border-border/60">
                  <td className="pr-3 py-1 mono">{weekLabel(w.week)}</td>
                  <td className="py-1 mono text-right">{w.allocated.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
