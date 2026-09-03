"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { addWeeks } from "date-fns";
import { mondayOf, isoDate, shortLabel, weekRange } from "@/lib/weeks";
import type { TeamMember, Client, Allocation, AllocationStatus } from "@/lib/forecast-types";
import { utilClass } from "@/lib/forecast-types";
import ManagePanel from "./ManagePanel";

const WEEK_COUNT = 6;

const STATUS_META: Record<AllocationStatus, { label: string; badge: string; pillIdle: string }> = {
  confirmado: {
    label: "Confirmado",
    badge: "bg-verde/10 border-verde/35 text-verde",
    pillIdle: "border-verde/40 text-verde hover:bg-verde/10",
  },
  previsto: {
    label: "Previsto",
    badge: "bg-laranja/12 border-laranja/40 text-[#9A6300]",
    pillIdle: "border-laranja/45 text-[#9A6300] hover:bg-laranja/10",
  },
};

type CellValue = { hours: number; status: AllocationStatus };

export default function ForecastBoard() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [anchor, setAnchor] = useState<Date>(() => mondayOf());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [extraRows, setExtraRows] = useState<Record<string, Set<string>>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftHours, setDraftHours] = useState("");

  const weeks = useMemo(() => weekRange(anchor, WEEK_COUNT), [anchor]);
  const weekIsos = useMemo(() => weeks.map(isoDate), [weeks]);

  useEffect(() => {
    (async () => {
      try {
        const [tmRes, clRes] = await Promise.all([
          fetch("/api/team-members"),
          fetch("/api/clients"),
        ]);
        if (!tmRes.ok || !clRes.ok) throw new Error();
        setTeamMembers(await tmRes.json());
        setClients(await clRes.json());
      } catch {
        setError("Não foi possível carregar a equipe e os clientes.");
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Sinaliza carregamento antes de buscar as alocações da janela de semanas atual.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const start = weekIsos[0];
    const end = weekIsos[weekIsos.length - 1];
    fetch(`/api/allocations?start=${start}&end=${end}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: Allocation[]) => {
        if (!cancelled) setAllocations(data);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar as alocações do período.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekIsos]);

  const allocByPair = useMemo(() => {
    const map = new Map<string, Map<string, CellValue>>();
    for (const a of allocations) {
      const key = `${a.teamMemberId}|${a.clientId}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(a.weekStart, { hours: a.hours, status: a.status });
    }
    return map;
  }, [allocations]);

  const clientById = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  function getCell(memberId: string, clientId: string, weekIso: string): CellValue {
    return (
      allocByPair.get(`${memberId}|${clientId}`)?.get(weekIso) ?? {
        hours: 0,
        status: "confirmado",
      }
    );
  }

  function rowsForMember(memberId: string): string[] {
    const set = new Set<string>();
    for (const key of allocByPair.keys()) {
      const [mid, cid] = key.split("|");
      if (mid === memberId) set.add(cid);
    }
    for (const cid of extraRows[memberId] ?? []) set.add(cid);
    return Array.from(set)
      .filter((cid) => clientById.has(cid))
      .sort((a, b) => {
        const ca = clientById.get(a)!;
        const cb = clientById.get(b)!;
        return ca.sortOrder - cb.sortOrder || ca.name.localeCompare(cb.name);
      });
  }

  async function saveCell(
    memberId: string,
    clientId: string,
    weekIso: string,
    hours: number,
    status: AllocationStatus
  ) {
    const key = `${memberId}|${clientId}|${weekIso}`;
    setSavingKeys((s) => new Set(s).add(key));
    setError(null);
    try {
      const res = await fetch("/api/allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: memberId, clientId, weekStart: weekIso, hours, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar horas.");
      setAllocations((prev) => {
        const filtered = prev.filter(
          (a) => !(a.teamMemberId === memberId && a.clientId === clientId && a.weekStart === weekIso)
        );
        if (hours > 0) {
          filtered.push({
            id: data.id ?? key,
            teamMemberId: memberId,
            clientId,
            weekStart: weekIso,
            hours,
            status,
          });
        }
        return filtered;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar horas.");
    } finally {
      setSavingKeys((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  }

  function openEditor(memberId: string, clientId: string, weekIso: string) {
    const key = `${memberId}|${clientId}|${weekIso}`;
    const current = getCell(memberId, clientId, weekIso);
    setDraftHours(current.hours > 0 ? String(current.hours) : "");
    setEditingKey(key);
  }

  function closeEditor() {
    setEditingKey(null);
    setDraftHours("");
  }

  function commit(memberId: string, clientId: string, weekIso: string, status: AllocationStatus) {
    const raw = draftHours.trim().replace(",", ".");
    const parsed = raw === "" ? 0 : Math.max(0, Number(raw));
    saveCell(memberId, clientId, weekIso, Number.isFinite(parsed) ? parsed : 0, status);
    closeEditor();
  }

  function addRow(memberId: string, clientId: string) {
    setExtraRows((prev) => {
      const next = { ...prev };
      const set = new Set(next[memberId] ?? []);
      set.add(clientId);
      next[memberId] = set;
      return next;
    });
    setPickerFor(null);
  }

  async function removeRow(memberId: string, clientId: string) {
    const memberName = teamMembers.find((m) => m.id === memberId)?.name ?? "";
    const clientName = clientById.get(clientId)?.name ?? "";
    const ok = window.confirm(
      `Zerar as horas de "${clientName}" para ${memberName} nas semanas visíveis? Isso não afeta semanas fora do período exibido.`
    );
    if (!ok) return;

    await Promise.all(weekIsos.map((w) => saveCell(memberId, clientId, w, 0, "confirmado")));
    setExtraRows((prev) => {
      const next = { ...prev };
      const set = new Set(next[memberId] ?? []);
      set.delete(clientId);
      next[memberId] = set;
      return next;
    });
  }

  const visibleMembers = teamMembers.filter((m) => showInactive || m.active);

  return (
    <div className="max-w-[1180px] mx-auto px-7 py-10">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[26px] leading-tight text-ink mb-1">Forecast da operação</h1>
          <p className="text-sm text-ink-secondary max-w-[62ch]">
            Aloque cada pessoa por cliente, semana a semana. Clique numa célula
            para lançar horas e marcar se a alocação já está confirmada ou é
            apenas prevista.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setManageOpen((v) => !v)}
          className="text-sm font-semibold border border-border-strong rounded-md px-3.5 py-2 text-ink-secondary hover:border-verde hover:text-verde transition-colors"
        >
          {manageOpen ? "Fechar gerenciamento" : "Gerenciar equipe e clientes"}
        </button>
      </div>

      {manageOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] mb-6">
          <ManagePanel
            teamMembers={teamMembers}
            clients={clients}
            setTeamMembers={setTeamMembers}
            setClients={setClients}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor((d) => addWeeks(d, -WEEK_COUNT))}
            className="text-sm font-semibold border border-border-strong rounded-md w-8 h-8 flex items-center justify-center text-ink-secondary hover:border-verde hover:text-verde"
            aria-label="Semanas anteriores"
          >
            &larr;
          </button>
          <button
            type="button"
            onClick={() => setAnchor(mondayOf())}
            className="text-sm font-semibold border border-border-strong rounded-md px-3 h-8 text-ink-secondary hover:border-verde hover:text-verde"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setAnchor((d) => addWeeks(d, WEEK_COUNT))}
            className="text-sm font-semibold border border-border-strong rounded-md w-8 h-8 flex items-center justify-center text-ink-secondary hover:border-verde hover:text-verde"
            aria-label="Próximas semanas"
          >
            &rarr;
          </button>
          <span className="text-sm text-ink-faint ml-2">
            {shortLabel(weeks[0])} &ndash; {shortLabel(weeks[weeks.length - 1])}
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-verde" />
              Confirmado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-laranja" />
              Previsto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-border-strong" />
              Livre
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar consultores arquivados
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-critical bg-critical-bg border border-critical/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="bg-surface border border-border rounded-xl shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-4 py-3 min-w-[220px]">
                Consultor / Cliente
              </th>
              {weeks.map((w) => (
                <th
                  key={isoDate(w)}
                  className="text-right font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-2 py-3 mono"
                >
                  {shortLabel(w)}
                </th>
              ))}
              <th className="text-right font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-4 py-3">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.length === 0 && (
              <tr>
                <td colSpan={weeks.length + 2} className="px-4 py-8 text-center text-sm text-ink-faint">
                  {teamMembers.length === 0
                    ? 'Nenhum consultor cadastrado. Clique em "Gerenciar equipe e clientes" para começar.'
                    : "Nenhum consultor ativo. Marque a opção acima para ver os arquivados."}
                </td>
              </tr>
            )}
            {visibleMembers.map((member) => {
              const rowClientIds = rowsForMember(member.id);
              const weeklyTotals = weekIsos.map((w) =>
                rowClientIds.reduce((s, cid) => s + getCell(member.id, cid, w).hours, 0)
              );
              const grandTotal = weeklyTotals.reduce((s, v) => s + v, 0);
              const availableClients = clients.filter(
                (c) => c.active && !rowClientIds.includes(c.id)
              );

              return (
                <Fragment key={member.id}>
                  <tr className="bg-surface-alt border-t border-border">
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {member.name}
                      {member.role && (
                        <span className="font-normal text-ink-faint"> &middot; {member.role}</span>
                      )}
                      {!member.active && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-faint">
                          arquivado
                        </span>
                      )}
                    </td>
                    {weeklyTotals.map((total, i) => {
                      const pct = member.weeklyCapacity > 0 ? (total / member.weeklyCapacity) * 100 : 0;
                      const cls = utilClass(pct);
                      return (
                        <td key={weekIsos[i]} className="px-2 py-2.5 text-right">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-semibold mono ${
                              cls === "good"
                                ? "bg-good-bg text-good"
                                : cls === "warn"
                                ? "bg-warning-bg text-[#9A6300]"
                                : "bg-critical-bg text-critical"
                            }`}
                          >
                            {total.toFixed(1)}h
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-semibold mono text-ink">
                      {grandTotal.toFixed(1)}h
                      <span className="block text-[10.5px] font-normal text-ink-faint">
                        /{member.weeklyCapacity * WEEK_COUNT}h
                      </span>
                    </td>
                  </tr>

                  {rowClientIds.map((cid) => {
                    const client = clientById.get(cid);
                    const rowTotal = weekIsos.reduce((s, w) => s + getCell(member.id, cid, w).hours, 0);
                    return (
                      <tr key={cid} className="border-t border-border">
                        <td className="pl-8 pr-4 py-2 text-ink-secondary align-top">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ background: client?.color ?? "#999" }}
                            />
                            {client?.name ?? "Cliente removido"}
                            <button
                              type="button"
                              onClick={() => removeRow(member.id, cid)}
                              className="text-ink-faint hover:text-critical text-xs ml-1"
                              aria-label="Zerar alocação"
                              title="Zerar horas nas semanas visíveis"
                            >
                              ✕
                            </button>
                          </span>
                        </td>
                        {weekIsos.map((w) => {
                          const cell = getCell(member.id, cid, w);
                          const key = `${member.id}|${cid}|${w}`;
                          const isSaving = savingKeys.has(key);
                          const isEditing = editingKey === key;
                          const meta = STATUS_META[cell.status];

                          return (
                            <td key={w} className="px-1.5 py-1.5 text-right align-top">
                              {isEditing ? (
                                <div className="flex flex-col items-stretch gap-1 w-[78px] ml-auto">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.25}
                                    autoFocus
                                    value={draftHours}
                                    onChange={(e) => setDraftHours(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commit(member.id, cid, w, cell.status);
                                      if (e.key === "Escape") closeEditor();
                                    }}
                                    placeholder="0"
                                    className="w-full text-right border border-verde rounded px-1.5 py-1 text-sm mono outline-none bg-white"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => commit(member.id, cid, w, "confirmado")}
                                      className={`flex-1 text-[9.5px] font-semibold rounded border px-1 py-0.5 transition-colors ${STATUS_META.confirmado.pillIdle}`}
                                      title="Salvar como confirmado"
                                    >
                                      Conf.
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => commit(member.id, cid, w, "previsto")}
                                      className={`flex-1 text-[9.5px] font-semibold rounded border px-1 py-0.5 transition-colors ${STATUS_META.previsto.pillIdle}`}
                                      title="Salvar como previsto"
                                    >
                                      Prev.
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={closeEditor}
                                    className="text-[9.5px] text-ink-faint hover:text-ink-secondary"
                                  >
                                    cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEditor(member.id, cid, w)}
                                  disabled={isSaving}
                                  title={cell.hours > 0 ? meta.label : "Clique para alocar horas"}
                                  className={`ml-auto min-w-[54px] min-h-[26px] flex items-center justify-end rounded-md border px-2 py-1 text-sm mono font-semibold transition-colors disabled:opacity-50 ${
                                    cell.hours > 0
                                      ? meta.badge
                                      : "border-dashed border-border-strong/70 hover:border-verde/50"
                                  }`}
                                >
                                  {cell.hours > 0 ? `${cell.hours}h` : ""}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-1.5 text-right mono text-ink-secondary">
                          {rowTotal.toFixed(1)}h
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="border-t border-border/60">
                    <td colSpan={weeks.length + 2} className="pl-8 pr-4 py-1.5">
                      {pickerFor === member.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) addRow(member.id, e.target.value);
                            }}
                            onBlur={() => setPickerFor(null)}
                            className="border border-border-strong rounded-md px-2 py-1 text-xs bg-white"
                          >
                            <option value="" disabled>
                              Escolher cliente…
                            </option>
                            {availableClients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          {availableClients.length === 0 && (
                            <span className="text-xs text-ink-faint">
                              Todos os clientes ativos já estão alocados a este consultor.
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPickerFor(member.id)}
                          className="text-xs font-semibold text-verde hover:underline"
                        >
                          + Alocar cliente
                        </button>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-xs text-ink-faint mt-3">Carregando alocações…</p>}
    </div>
  );
}
