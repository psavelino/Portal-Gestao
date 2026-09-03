"use client";

import { useState } from "react";
import type { TeamMember, Client } from "@/lib/forecast-types";

export default function ManagePanel({
  teamMembers,
  clients,
  setTeamMembers,
  setClients,
}: {
  teamMembers: TeamMember[];
  clients: Client[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}) {
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberCapacity, setNewMemberCapacity] = useState("40");
  const [newClientName, setNewClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
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

      {error && <p className="md:col-span-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
