"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { addWeeks } from "date-fns";
import { mondayOf, isoDate, shortLabel, weekRange } from "@/lib/weeks";
import type { TeamMember, Client, Project, Allocation, AllocationStatus } from "@/lib/forecast-types";
import { utilClass, CONTRACT_TYPE_META } from "@/lib/forecast-types";
import ManagePanel from "./ManagePanel";
import ProjectBalancePanel from "./ProjectBalancePanel";

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [anchor, setAnchor] = useState<Date>(() => mondayOf());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
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
        const [tmRes, clRes, prRes] = await Promise.all([
          fetch("/api/team-members"),
          fetch("/api/clients"),
          fetch("/api/projects"),
        ]);
        if (!tmRes.ok || !clRes.ok || !prRes.ok) throw new Error();
        setTeamMembers(await tmRes.json());
        setClients(await clRes.json());
        setProjects(await prRes.json());
      } catch {
        setError("Não foi possível carregar equipe, clientes e projetos.");
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
      const key = `${a.teamMemberId}|${a.projectId}`;
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

  const projectById = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  function getCell(memberId: string, projectId: string, weekIso: string): CellValue {
    return (
      allocByPair.get(`${memberId}|${projectId}`)?.get(weekIso) ?? {
        hours: 0,
        status: "confirmado",
      }
    );
  }

  function rowsForMember(memberId: string): string[] {
    const set = new Set<string>();
    for (const key of allocByPair.keys()) {
      const [mid, pid] = key.split("|");
      if (mid === memberId) set.add(pid);
    }
    for (const pid of extraRows[memberId] ?? []) set.add(pid);
    return Array.from(set)
      .filter((pid) => projectById.has(pid))
      .sort((a, b) => {
        const pa = projectById.get(a)!;
        const pb = projectById.get(b)!;
        const ca = clientById.get(pa.clientId);
        const cb = clientById.get(pb.clientId);
        return (
          (ca?.sortOrder ?? 0) - (cb?.sortOrder ?? 0) ||
          (ca?.name ?? "").localeCompare(cb?.name ?? "") ||
          pa.name.localeCompare(pb.name)
        );
      });
  }

  async function saveCell(
    memberId: string,
    projectId: string,
    weekIso: string,
    hours: number,
    status: AllocationStatus
  ) {
    const key = `${memberId}|${projectId}|${weekIso}`;
    setSavingKeys((s) => new Set(s).add(key));
    setError(null);
    try {
      const res = await fetch("/api/allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: memberId, projectId, weekStart: weekIso, hours, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar horas.");
      setAllocations((prev) => {
        const filtered = prev.filter(
          (a) => !(a.teamMemberId === memberId && a.projectId === projectId && a.weekStart === weekIso)
        );
        if (hours > 0) {
          filtered.push({
            id: data.id ?? key,
            teamMemberId: memberId,
            projectId,
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

  function openEditor(memberId: string, projectId: string, weekIso: string) {
    const key = `${memberId}|${projectId}|${weekIso}`;
    const current = getCell(memberId, projectId, weekIso);
    setDraftHours(current.hours > 0 ? String(current.hours) : "");
    setEditingKey(key);
  }

  function closeEditor() {
    setEditingKey(null);
    setDraftHours("");
  }

  function commit(memberId: string, projectId: string, weekIso: string, status: AllocationStatus) {
    const raw = draftHours.trim().replace(",", ".");
    const parsed = raw === "" ? 0 : Math.max(0, Number(raw));
    saveCell(memberId, projectId, weekIso, Number.isFinite(parsed) ? parsed : 0, status);
    closeEditor();
  }

  function addRow(memberId: string, projectId: string) {
    setExtraRows((prev) => {
      const next = { ...prev };
      const set = new Set(next[memberId] ?? []);
      set.add(projectId);
      next[memberId] = set;
      return next;
    });
    setPickerFor(null);
  }

  async function removeRow(memberId: string, projectId: string) {
    const memberName = teamMembers.find((m) => m.id === memberId)?.name ?? "";
    const project = projectById.get(projectId);
    const client = project ? clientById.get(project.clientId) : undefined;
    const label = project ? `${client?.name ?? ""} · ${project.name}` : "este projeto";
    const ok = window.confirm(
      `Zerar as horas de "${label}" para ${memberName} nas semanas visíveis? Isso não afeta semanas fora do período exibido.`
    );
    if (!ok) return;

    await Promise.all(weekIsos.map((w) => saveCell(memberId, projectId, w, 0, "confirmado")));
    setExtraRows((prev) => {
      const next = { ...prev };
      const set = new Set(next[memberId] ?? []);
      set.delete(projectId);
      next[memberId] = set;
      return next;
    });
  }

  const visibleMembers = teamMembers.filter((m) => showInactive || m.active);

  const activeClients = clients.filter((c) => c.active);

  return (
    <div className="max-w-[1180px] mx-auto px-7 py-10">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[26px] leading-tight text-ink mb-1">Forecast da operação</h1>
          <p className="text-sm text-ink-secondary max-w-[62ch]">
            Aloque cada pessoa por projeto, semana a semana. Clique numa célula
            para lançar horas e marcar se a alocação já está confirmada ou é
            apenas prevista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBalanceOpen((v) => !v)}
            className="text-sm font-semibold border border-border-strong rounded-md px-3.5 py-2 text-ink-secondary hover:border-verde hover:text-verde transition-colors"
          >
            {balanceOpen ? "Fechar saldo dos projetos" : "Saldo dos projetos"}
          </button>
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            className="text-sm font-semibold border border-border-strong rounded-md px-3.5 py-2 text-ink-secondary hover:border-verde hover:text-verde transition-colors"
          >
            {manageOpen ? "Fechar gerenciamento" : "Gerenciar equipe, clientes e projetos"}
          </button>
        </div>
      </div>

      {balanceOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] mb-6">
          <ProjectBalancePanel clients={clients} projects={projects} />
        </div>
      )}

      {manageOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] mb-6">
          <ManagePanel
            teamMembers={teamMembers}
            clients={clients}
            projects={projects}
            setTeamMembers={setTeamMembers}
            setClients={setClients}
            setProjects={setProjects}
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
              <th className="text-left font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-4 py-3 min-w-[240px]">
                Consultor / Cliente · Projeto
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
                    ? 'Nenhum consultor cadastrado. Clique em "Gerenciar equipe, clientes e projetos" para começar.'
                    : "Nenhum consultor ativo. Marque a opção acima para ver os arquivados."}
                </td>
              </tr>
            )}
            {visibleMembers.map((member) => {
              const rowProjectIds = rowsForMember(member.id);
              const weeklyTotals = weekIsos.map((w) =>
                rowProjectIds.reduce((s, pid) => s + getCell(member.id, pid, w).hours, 0)
              );
              const grandTotal = weeklyTotals.reduce((s, v) => s + v, 0);
              const availableProjects = projects.filter(
                (p) => p.status === "ativo" && !rowProjectIds.includes(p.id)
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

                  {rowProjectIds.map((pid) => {
                    const project = projectById.get(pid);
                    const client = project ? clientById.get(project.clientId) : undefined;
                    const meta = project ? CONTRACT_TYPE_META[project.contractType] : null;
                    const rowTotal = weekIsos.reduce((s, w) => s + getCell(member.id, pid, w).hours, 0);
                    return (
                      <tr key={pid} className="border-t border-border">
                        <td className="pl-8 pr-4 py-2 text-ink-secondary align-top">
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ background: client?.color ?? "#999" }}
                            />
                            <span className="text-ink-faint">{client?.name ?? "Cliente removido"}</span>
                            <span className="text-ink-faint">·</span>
                            {project?.name ?? "Projeto removido"}
                            {meta && (
                              <span
                                className="text-[9px] font-semibold uppercase tracking-wide text-ink-faint border border-border-strong rounded px-1 py-0.5"
                                title={meta.hint}
                              >
                                {meta.tag}
                              </span>
                            )}
                            {project?.status === "pausado" && (
                              <span className="text-[9px] uppercase text-ink-faint">pausado</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeRow(member.id, pid)}
                              className="text-ink-faint hover:text-critical text-xs"
                              aria-label="Zerar alocação"
                              title="Zerar horas nas semanas visíveis"
                            >
                              ✕
                            </button>
                          </span>
                        </td>
                        {weekIsos.map((w) => {
                          const cell = getCell(member.id, pid, w);
                          const key = `${member.id}|${pid}|${w}`;
                          const isSaving = savingKeys.has(key);
                          const isEditing = editingKey === key;
                          const statusMeta = STATUS_META[cell.status];

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
                                      if (e.key === "Enter") commit(member.id, pid, w, cell.status);
                                      if (e.key === "Escape") closeEditor();
                                    }}
                                    placeholder="0"
                                    className="w-full text-right border border-verde rounded px-1.5 py-1 text-sm mono outline-none bg-white"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => commit(member.id, pid, w, "confirmado")}
                                      className={`flex-1 text-[9.5px] font-semibold rounded border px-1 py-0.5 transition-colors ${STATUS_META.confirmado.pillIdle}`}
                                      title="Salvar como confirmado"
                                    >
                                      Conf.
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => commit(member.id, pid, w, "previsto")}
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
                                  onClick={() => openEditor(member.id, pid, w)}
                                  disabled={isSaving}
                                  title={cell.hours > 0 ? statusMeta.label : "Clique para alocar horas"}
                                  className={`ml-auto min-w-[54px] min-h-[26px] flex items-center justify-end rounded-md border px-2 py-1 text-sm mono font-semibold transition-colors disabled:opacity-50 ${
                                    cell.hours > 0
                                      ? statusMeta.badge
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
                              Escolher projeto…
                            </option>
                            {activeClients.map((c) => {
                              const opts = availableProjects.filter((p) => p.clientId === c.id);
                              if (opts.length === 0) return null;
                              return (
                                <optgroup key={c.id} label={c.name}>
                                  {opts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({CONTRACT_TYPE_META[p.contractType].tag})
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                          {availableProjects.length === 0 && (
                            <span className="text-xs text-ink-faint">
                              Todos os projetos ativos já estão alocados a este consultor. Cadastre
                              mais projetos em &quot;Gerenciar equipe, clientes e projetos&quot;.
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPickerFor(member.id)}
                          className="text-xs font-semibold text-verde hover:underline"
                        >
                          + Alocar projeto
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
