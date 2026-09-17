"use client";

import { useEffect, useMemo, useState } from "react";
import { addWeeks } from "date-fns";
import { mondayOf, isoDate, shortLabel, weekRange } from "@/lib/weeks";
import type { ForecastPerson, Client, Project, Allocation, AllocationStatus } from "@/lib/forecast-types";
import { utilClass, CONTRACT_TYPE_META } from "@/lib/forecast-types";
import ManagePanel from "./ManagePanel";
import ProjectBalancePanel from "./ProjectBalancePanel";

const WEEK_COUNT = 6;

const STATUS_META: Record<AllocationStatus, { label: string; pillIdle: string }> = {
  confirmado: {
    label: "Confirmado",
    pillIdle: "border-verde/40 text-verde hover:bg-verde/10",
  },
  previsto: {
    label: "Previsto",
    pillIdle: "border-laranja/45 text-[#9A6300] hover:bg-laranja/10",
  },
};

type WeekEntry = { projectId: string; hours: number; status: AllocationStatus };

/** Texto legível (branco ou escuro) em cima de uma cor de fundo qualquer. */
function textColorFor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#FFFFFF";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#303030" : "#FFFFFF";
}

function borderColorFor(textColor: string): string {
  return textColor === "#FFFFFF" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)";
}

export default function ForecastBoard({
  canEdit,
  myTeamUserIds,
}: {
  canEdit: boolean;
  // IDs (users) de quem o usuário logado lidera, direta ou indiretamente —
  // vem do organograma de squad (users.leader_id), não tem nada a ver com
  // permissão. Vazio pra quem não lidera ninguém (a maioria dos
  // consultores) — nesse caso o filtro "minha equipe" nem aparece.
  myTeamUserIds: string[];
}) {
  const [people, setPeople] = useState<ForecastPerson[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [anchor, setAnchor] = useState<Date>(() => mondayOf());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [myTeamOnly, setMyTeamOnly] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  // Chave do picker "escolher projeto" aberto: `${memberId}|${weekIso}` (célula), ou null.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // Chave do editor de horas aberto: `${memberId}|${projectId}|${weekIso}`, ou null.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftHours, setDraftHours] = useState("");

  const weeks = useMemo(() => weekRange(anchor, WEEK_COUNT), [anchor]);
  const weekIsos = useMemo(() => weeks.map(isoDate), [weeks]);

  useEffect(() => {
    (async () => {
      try {
        const [peopleRes, clRes, prRes] = await Promise.all([
          fetch("/api/forecast/roster"),
          fetch("/api/clients"),
          fetch("/api/projects"),
        ]);
        if (!peopleRes.ok || !clRes.ok || !prRes.ok) throw new Error();
        setPeople(await peopleRes.json());
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

  function compareProjects(aId: string, bId: string): number {
    const pa = projectById.get(aId);
    const pb = projectById.get(bId);
    const ca = pa ? clientById.get(pa.clientId) : undefined;
    const cb = pb ? clientById.get(pb.clientId) : undefined;
    return (
      (ca?.sortOrder ?? 0) - (cb?.sortOrder ?? 0) ||
      (ca?.name ?? "").localeCompare(cb?.name ?? "") ||
      (pa?.name ?? "").localeCompare(pb?.name ?? "")
    );
  }

  // Agrupa as alocações por consultor → semana, já sem entradas zeradas —
  // é o que cada célula (pessoa × semana) renderiza como pilha de chips.
  const allocByMemberWeek = useMemo(() => {
    const map = new Map<string, Map<string, WeekEntry[]>>();
    for (const a of allocations) {
      if (a.hours <= 0) continue;
      if (!map.has(a.userId)) map.set(a.userId, new Map());
      const wmap = map.get(a.userId)!;
      if (!wmap.has(a.weekStart)) wmap.set(a.weekStart, []);
      wmap.get(a.weekStart)!.push({ projectId: a.projectId, hours: a.hours, status: a.status });
    }
    for (const wmap of map.values()) {
      for (const list of wmap.values()) {
        list.sort((x, y) => compareProjects(x.projectId, y.projectId));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocations, projects, clients]);

  function entriesFor(memberId: string, weekIso: string): WeekEntry[] {
    return allocByMemberWeek.get(memberId)?.get(weekIso) ?? [];
  }

  function hoursFor(memberId: string, projectId: string, weekIso: string): number {
    return entriesFor(memberId, weekIso).find((e) => e.projectId === projectId)?.hours ?? 0;
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
        body: JSON.stringify({ userId: memberId, projectId, weekStart: weekIso, hours, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar horas.");
      setAllocations((prev) => {
        const filtered = prev.filter(
          (a) => !(a.userId === memberId && a.projectId === projectId && a.weekStart === weekIso)
        );
        if (hours > 0) {
          filtered.push({
            id: data.id ?? key,
            userId: memberId,
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
    if (!canEdit) return;
    const current = hoursFor(memberId, projectId, weekIso);
    setDraftHours(current > 0 ? String(current) : "");
    setEditingKey(`${memberId}|${projectId}|${weekIso}`);
    setPickerFor(null);
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

  const visibleMembers = people.filter(
    (p) => (showInactive || p.active) && (!myTeamOnly || myTeamUserIds.includes(p.id))
  );
  const activeClients = clients.filter((c) => c.active);

  return (
    <div className="max-w-[1180px] mx-auto px-7 py-10">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[26px] leading-tight text-ink mb-1">Forecast da operação</h1>
          <p className="text-sm text-ink-secondary max-w-[62ch]">
            {canEdit
              ? "Aloque cada pessoa por projeto, semana a semana. Clique numa célula para lançar horas e marcar se a alocação já está confirmada ou é apenas prevista."
              : "Acompanhe a alocação de cada pessoa por projeto, semana a semana. Você está no modo de visualização — apenas administradores podem editar o forecast."}
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
          {canEdit && (
            <button
              type="button"
              onClick={() => setManageOpen((v) => !v)}
              className="text-sm font-semibold border border-border-strong rounded-md px-3.5 py-2 text-ink-secondary hover:border-verde hover:text-verde transition-colors"
            >
              {manageOpen ? "Fechar gerenciamento" : "Gerenciar equipe, clientes e projetos"}
            </button>
          )}
        </div>
      </div>

      {balanceOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] mb-6">
          <ProjectBalancePanel clients={clients} projects={projects} />
        </div>
      )}

      {canEdit && manageOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] mb-6">
          <ManagePanel
            clients={clients}
            projects={projects}
            setClients={setClients}
            setProjects={setProjects}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
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
              <span className="w-2.5 h-2.5 rounded-sm border-2 border-ink-secondary" />
              Confirmado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-ink-secondary" />
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
          {myTeamUserIds.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={myTeamOnly}
                onChange={(e) => setMyTeamOnly(e.target.checked)}
              />
              Minha equipe
            </label>
          )}
        </div>
      </div>

      {activeClients.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 px-1">
          {activeClients.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-critical bg-critical-bg border border-critical/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="bg-surface border border-border rounded-xl shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[980px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-4 py-3 min-w-[210px]">
                Consultor
              </th>
              {weeks.map((w) => (
                <th
                  key={isoDate(w)}
                  className="text-center font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-1.5 py-3 mono min-w-[132px]"
                >
                  {shortLabel(w)}
                </th>
              ))}
              <th className="text-right font-semibold text-[10.5px] uppercase tracking-wide text-ink-faint px-4 py-3 min-w-[84px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.length === 0 && (
              <tr>
                <td colSpan={weeks.length + 2} className="px-4 py-8 text-center text-sm text-ink-faint">
                  {people.length === 0
                    ? 'Nenhum consultor com acesso ao Forecast ainda. Cadastre a pessoa em "Usuários" como Membro, ou defina um líder direto para ela — a partir daí entra aqui automaticamente.'
                    : "Nenhum consultor ativo. Marque a opção acima para ver os arquivados."}
                </td>
              </tr>
            )}
            {visibleMembers.map((member) => {
              const grandTotal = weekIsos.reduce(
                (s, w) => s + entriesFor(member.id, w).reduce((s2, e) => s2 + e.hours, 0),
                0
              );

              return (
                <tr key={member.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-semibold text-ink">
                    {member.name}
                    {member.jobTitle && (
                      <span className="block font-normal text-ink-faint text-xs mt-0.5">{member.jobTitle}</span>
                    )}
                    {!member.active && (
                      <span className="block mt-0.5 text-[10px] uppercase tracking-wide text-ink-faint">
                        arquivado
                      </span>
                    )}
                  </td>

                  {weekIsos.map((w) => {
                    const entries = entriesFor(member.id, w);
                    const weeklyTotal = entries.reduce((s, e) => s + e.hours, 0);
                    const pct = member.weeklyCapacity > 0 ? (weeklyTotal / member.weeklyCapacity) * 100 : 0;
                    const cellKeyBase = `${member.id}|${w}`;
                    const isPicking = pickerFor === cellKeyBase;

                    const editingProjectId =
                      editingKey && editingKey.startsWith(`${member.id}|`) && editingKey.endsWith(`|${w}`)
                        ? editingKey.slice(member.id.length + 1, editingKey.length - w.length - 1)
                        : null;
                    const isEditingNew =
                      editingProjectId !== null && !entries.some((e) => e.projectId === editingProjectId);

                    const availableProjects = projects.filter(
                      (p) => p.status === "ativo" && !entries.some((e) => e.projectId === p.id)
                    );

                    return (
                      <td key={w} className="px-1.5 py-2 align-top">
                        <div className="flex flex-col gap-1 min-h-[38px]">
                          {weeklyTotal > 0 &&
                            (() => {
                              const cls = utilClass(pct);
                              return (
                                <span
                                  className={`self-end text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full mono ${
                                    cls === "good"
                                      ? "bg-good-bg text-good"
                                      : cls === "warn"
                                      ? "bg-warning-bg text-[#9A6300]"
                                      : "bg-critical-bg text-critical"
                                  }`}
                                >
                                  {weeklyTotal.toFixed(1)}h
                                </span>
                              );
                            })()}

                          {entries.map((entry) => {
                            const project = projectById.get(entry.projectId);
                            const client = project ? clientById.get(project.clientId) : undefined;
                            const meta = project ? CONTRACT_TYPE_META[project.contractType] : null;
                            const key = `${member.id}|${entry.projectId}|${w}`;
                            const isSaving = savingKeys.has(key);
                            const isEditing = editingKey === key;
                            const color = client?.color ?? "#999999";
                            const textColor = textColorFor(color);

                            if (isEditing) {
                              return (
                                <CellEditor
                                  key={entry.projectId}
                                  label={`${client?.name ?? "Cliente removido"} · ${project?.name ?? "Projeto removido"}`}
                                  draftHours={draftHours}
                                  setDraftHours={setDraftHours}
                                  onCommit={(status) => commit(member.id, entry.projectId, w, status)}
                                  onCancel={closeEditor}
                                  onRemove={() => {
                                    saveCell(member.id, entry.projectId, w, 0, entry.status);
                                    closeEditor();
                                  }}
                                />
                              );
                            }

                            return (
                              <button
                                key={entry.projectId}
                                type="button"
                                onClick={() => openEditor(member.id, entry.projectId, w)}
                                disabled={!canEdit || isSaving}
                                title={`${client?.name ?? "Cliente removido"} · ${project?.name ?? "Projeto removido"}${
                                  meta ? ` (${meta.tag})` : ""
                                } · ${entry.hours}h · ${STATUS_META[entry.status].label}`}
                                style={{
                                  background: color,
                                  color: textColor,
                                  borderStyle: entry.status === "confirmado" ? "solid" : "dashed",
                                  borderColor: borderColorFor(textColor),
                                }}
                                className="w-full flex items-center justify-between gap-1 rounded-md border-2 px-2 py-1 text-[11px] font-semibold text-left transition-opacity hover:opacity-90 disabled:cursor-default disabled:hover:opacity-100"
                              >
                                <span className="truncate">{client?.name ?? "Cliente removido"}</span>
                                <span className="mono shrink-0">{entry.hours}h</span>
                              </button>
                            );
                          })}

                          {isEditingNew && editingProjectId && (
                            <CellEditor
                              label={(() => {
                                const project = projectById.get(editingProjectId);
                                const client = project ? clientById.get(project.clientId) : undefined;
                                return `${client?.name ?? "Cliente removido"} · ${project?.name ?? "Projeto removido"}`;
                              })()}
                              draftHours={draftHours}
                              setDraftHours={setDraftHours}
                              onCommit={(status) => commit(member.id, editingProjectId, w, status)}
                              onCancel={closeEditor}
                            />
                          )}

                          {canEdit && isPicking && (
                            <div className="flex flex-col gap-1">
                              <select
                                autoFocus
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) openEditor(member.id, e.target.value, w);
                                }}
                                onBlur={() => setPickerFor(null)}
                                className="border border-border-strong rounded-md px-1.5 py-1 text-[11px] bg-white w-full"
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
                                <span className="text-[10px] text-ink-faint">
                                  Sem projetos ativos disponíveis pra alocar.
                                </span>
                              )}
                            </div>
                          )}

                          {canEdit && !isPicking && !isEditingNew && entries.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setPickerFor(cellKeyBase)}
                              className="w-full min-h-[30px] rounded-md border border-dashed border-border-strong/70 text-[10px] text-ink-faint hover:border-verde/50 hover:text-verde transition-colors"
                            >
                              Sem aloc.
                            </button>
                          )}
                          {canEdit && !isPicking && !isEditingNew && entries.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPickerFor(cellKeyBase)}
                              className="text-[9.5px] font-medium text-ink-faint hover:text-verde text-left"
                            >
                              + outro projeto
                            </button>
                          )}
                          {!canEdit && entries.length === 0 && (
                            <div className="w-full min-h-[30px] rounded-md border border-dashed border-border-strong/50 text-[10px] text-ink-faint/70 flex items-center justify-center">
                              Sem aloc.
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-4 py-3 text-right mono text-ink align-top">
                    <span className="font-semibold">{grandTotal.toFixed(1)}h</span>
                    <span className="block text-[10.5px] font-normal text-ink-faint">
                      /{member.weeklyCapacity * WEEK_COUNT}h
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-xs text-ink-faint mt-3">Carregando alocações…</p>}
    </div>
  );
}

function CellEditor({
  label,
  draftHours,
  setDraftHours,
  onCommit,
  onCancel,
  onRemove,
}: {
  label: string;
  draftHours: string;
  setDraftHours: (v: string) => void;
  onCommit: (status: AllocationStatus) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-1 w-full">
      <div className="text-[9.5px] text-ink-faint truncate" title={label}>
        {label}
      </div>
      <input
        type="number"
        min={0}
        step={0.25}
        autoFocus
        value={draftHours}
        onChange={(e) => setDraftHours(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit("confirmado");
          if (e.key === "Escape") onCancel();
        }}
        placeholder="0"
        className="w-full text-right border border-verde rounded px-1.5 py-1 text-sm mono outline-none bg-white"
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onCommit("confirmado")}
          className={`flex-1 text-[9.5px] font-semibold rounded border px-1 py-0.5 transition-colors ${STATUS_META.confirmado.pillIdle}`}
          title="Salvar como confirmado"
        >
          Conf.
        </button>
        <button
          type="button"
          onClick={() => onCommit("previsto")}
          className={`flex-1 text-[9.5px] font-semibold rounded border px-1 py-0.5 transition-colors ${STATUS_META.previsto.pillIdle}`}
          title="Salvar como previsto"
        >
          Prev.
        </button>
      </div>
      <div className="flex items-center justify-between">
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-[9.5px] text-critical hover:underline">
            Remover
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onCancel} className="text-[9.5px] text-ink-faint hover:text-ink-secondary">
          cancelar
        </button>
      </div>
    </div>
  );
}
