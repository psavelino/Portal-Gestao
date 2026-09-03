"use client";

import { useState } from "react";
import type { TeamMember, Client, Project, ContractType, ProjectStatus } from "@/lib/forecast-types";
import { CONTRACT_TYPE_META } from "@/lib/forecast-types";

const CONTRACT_TYPES: ContractType[] = ["pacote_horas", "cmc", "outsourcing"];
const PROJECT_STATUSES: ProjectStatus[] = ["ativo", "pausado", "encerrado"];

export default function ManagePanel({
  teamMembers,
  clients,
  projects,
  setTeamMembers,
  setClients,
  setProjects,
}: {
  teamMembers: TeamMember[];
  clients: Client[];
  projects: Project[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}) {
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberCapacity, setNewMemberCapacity] = useState("40");
  const [newClientName, setNewClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectClientId, setProjectClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ContractType>("pacote_horas");
  const [packageHours, setPackageHours] = useState("");
  const [cmcMonthlyHours, setCmcMonthlyHours] = useState("");
  const [cmcStartMonth, setCmcStartMonth] = useState("");
  const [outsourcingPeople, setOutsourcingPeople] = useState("");

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberName.trim(),
          role: newMemberRole.trim() || undefined,
          weeklyCapacity: Number(newMemberCapacity) || 40,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar consultor.");
      setTeamMembers((prev) => [...prev, data]);
      setNewMemberName("");
      setNewMemberRole("");
      setNewMemberCapacity("40");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar consultor.");
    } finally {
      setBusy(false);
    }
  }

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar cliente.");
      setClients((prev) => [...prev, data]);
      setNewClientName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar cliente.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMemberActive(m: TeamMember) {
    setBusy(true);
    try {
      const res = await fetch(`/api/team-members/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !m.active }),
      });
      const data = await res.json();
      if (res.ok) {
        setTeamMembers((prev) => prev.map((x) => (x.id === m.id ? data : x)));
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleClientActive(c: Client) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json();
      if (res.ok) {
        setClients((prev) => prev.map((x) => (x.id === c.id ? data : x)));
      }
    } finally {
      setBusy(false);
    }
  }

  function resetProjectForm() {
    setProjectName("");
    setPackageHours("");
    setCmcMonthlyHours("");
    setCmcStartMonth("");
    setOutsourcingPeople("");
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectClientId || !projectName.trim()) {
      setError("Escolha o cliente e informe o nome do projeto.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        clientId: projectClientId,
        name: projectName.trim(),
        contractType: projectType,
      };
      if (projectType === "pacote_horas") body.packageHours = Number(packageHours);
      if (projectType === "cmc") {
        body.cmcMonthlyHours = Number(cmcMonthlyHours);
        body.cmcStartMonth = cmcStartMonth ? `${cmcStartMonth}-01` : undefined;
      }
      if (projectType === "outsourcing") body.outsourcingPeople = Number(outsourcingPeople);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar projeto.");
      setProjects((prev) => [...prev, data]);
      resetProjectForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar projeto.");
    } finally {
      setBusy(false);
    }
  }

  async function updateProjectStatus(p: Project, status: ProjectStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setProjects((prev) => prev.map((x) => (x.id === p.id ? data : x)));
      }
    } finally {
      setBusy(false);
    }
  }

  const clientById = new Map(clients.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-3">
            Equipe
          </h3>
          <form onSubmit={addMember} className="flex flex-wrap gap-2 mb-3">
            <input
              placeholder="Nome"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white flex-1 min-w-[140px]"
            />
            <input
              placeholder="Função (opcional)"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-36"
            />
            <input
              type="number"
              min={1}
              max={168}
              title="Capacidade semanal (h)"
              value={newMemberCapacity}
              onChange={(e) => setNewMemberCapacity(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-20 mono"
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
            >
              + Adicionar
            </button>
          </form>
          <ul className="flex flex-col gap-1.5">
            {teamMembers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 text-sm bg-surface-alt rounded-md px-3 py-1.5"
              >
                <span className={m.active ? "text-ink" : "text-ink-faint line-through"}>
                  {m.name}
                  {m.role ? ` · ${m.role}` : ""} · {m.weeklyCapacity}h/sem
                </span>
                <button
                  type="button"
                  onClick={() => toggleMemberActive(m)}
                  className="text-xs font-semibold text-ink-secondary hover:text-verde"
                >
                  {m.active ? "Arquivar" : "Reativar"}
                </button>
              </li>
            ))}
            {teamMembers.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhum consultor cadastrado ainda.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-3">
            Clientes
          </h3>
          <form onSubmit={addClient} className="flex flex-wrap gap-2 mb-3">
            <input
              placeholder="Nome do cliente"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white flex-1 min-w-[140px]"
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
            >
              + Adicionar
            </button>
          </form>
          <ul className="flex flex-col gap-1.5">
            {clients.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 text-sm bg-surface-alt rounded-md px-3 py-1.5"
              >
                <span className={`flex items-center gap-2 ${c.active ? "text-ink" : "text-ink-faint line-through"}`}>
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
                <button
                  type="button"
                  onClick={() => toggleClientActive(c)}
                  className="text-xs font-semibold text-ink-secondary hover:text-verde"
                >
                  {c.active ? "Arquivar" : "Reativar"}
                </button>
              </li>
            ))}
            {clients.length === 0 && (
              <li className="text-sm text-ink-faint">Nenhum cliente cadastrado ainda.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-3">
          Projetos (contratos por cliente)
        </h3>
        <form onSubmit={addProject} className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-ink-faint">Cliente</label>
            <select
              value={projectClientId}
              onChange={(e) => setProjectClientId(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-40"
            >
              <option value="">Selecione…</option>
              {clients
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-ink-faint">Nome do projeto</label>
            <input
              placeholder="ex: Retenção Q3"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-ink-faint">Tipo de contrato</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ContractType)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-44"
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>

          {projectType === "pacote_horas" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Horas contratadas
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={packageHours}
                onChange={(e) => setPackageHours(e.target.value)}
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-28 mono"
              />
            </div>
          )}

          {projectType === "cmc" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Crédito mensal (h)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cmcMonthlyHours}
                  onChange={(e) => setCmcMonthlyHours(e.target.value)}
                  className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-28 mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Mês de início
                </label>
                <input
                  type="month"
                  value={cmcStartMonth}
                  onChange={(e) => setCmcStartMonth(e.target.value)}
                  className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-36 mono"
                />
              </div>
            </>
          )}

          {projectType === "outsourcing" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Pessoas dedicadas
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={outsourcingPeople}
                onChange={(e) => setOutsourcingPeople(e.target.value)}
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white w-24 mono"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            + Adicionar
          </button>
        </form>

        <ul className="flex flex-col gap-1.5">
          {projects.map((p) => {
            const client = clientById.get(p.clientId);
            const meta = CONTRACT_TYPE_META[p.contractType];
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm bg-surface-alt rounded-md px-3 py-1.5"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: client?.color ?? "#999" }}
                  />
                  <span className={p.status === "encerrado" ? "text-ink-faint line-through" : "text-ink"}>
                    {client?.name ?? "Cliente removido"} · {p.name}
                  </span>
                  <span
                    className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint border border-border-strong rounded px-1 py-0.5 shrink-0"
                    title={meta.hint}
                  >
                    {meta.tag}
                  </span>
                </span>
                <select
                  value={p.status}
                  onChange={(e) => updateProjectStatus(p, e.target.value as ProjectStatus)}
                  className="text-xs border border-border-strong rounded-md px-1.5 py-1 bg-white shrink-0"
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
          {projects.length === 0 && (
            <li className="text-sm text-ink-faint">Nenhum projeto cadastrado ainda.</li>
          )}
        </ul>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}
    </div>
  );
}
