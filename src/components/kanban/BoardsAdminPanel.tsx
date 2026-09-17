"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/lib/forecast-types";
import type { BoardSummary } from "@/lib/kanban-types";
import type { AppUserWithAccess } from "@/lib/users";

export default function BoardsAdminPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [clientUsers, setClientUsers] = useState<AppUserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newClientId, setNewClientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [expandedBoardId, setExpandedBoardId] = useState<string | null>(null);
  const [accessByBoard, setAccessByBoard] = useState<Record<string, string[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const [clientsRes, boardsRes, usersRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/boards"),
          fetch("/api/users"),
        ]);
        if (!clientsRes.ok || !boardsRes.ok || !usersRes.ok) throw new Error();
        setClients(await clientsRes.json());
        setBoards(await boardsRes.json());
        const users: AppUserWithAccess[] = await usersRes.json();
        setClientUsers(users.filter((u) => u.role === "client"));
      } catch {
        setError("Não foi possível carregar quadros, clientes ou usuários.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientId || !newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: newClientId,
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar quadro.");
      setBoards((prev) => [...prev, data]);
      setNewName("");
      setNewDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar quadro.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(board: BoardSummary) {
    setBusy(true);
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !board.active }),
      });
      const data = await res.json();
      if (res.ok) setBoards((prev) => prev.map((b) => (b.id === board.id ? data : b)));
    } finally {
      setBusy(false);
    }
  }

  async function openAccess(boardId: string) {
    if (expandedBoardId === boardId) {
      setExpandedBoardId(null);
      return;
    }
    setExpandedBoardId(boardId);
    if (!accessByBoard[boardId]) {
      const res = await fetch(`/api/boards/${boardId}/access`);
      if (res.ok) {
        const data = await res.json();
        setAccessByBoard((prev) => ({ ...prev, [boardId]: data.userIds }));
      }
    }
  }

  async function toggleAccess(boardId: string, userId: string) {
    const current = accessByBoard[boardId] ?? [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    setAccessByBoard((prev) => ({ ...prev, [boardId]: next }));
    setBusy(true);
    try {
      await fetch(`/api/boards/${boardId}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: next }),
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-faint">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="text-sm text-critical bg-critical-bg border border-critical/30 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="bg-surface border border-border rounded-xl p-6 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)]">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-4">
          Novo quadro
        </h2>
        <form onSubmit={createBoard} className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wide text-ink-faint">Cliente</label>
            <select
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-wide text-ink-faint">
              Nome do quadro
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Operação, Projeto X…"
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-[10px] uppercase tracking-wide text-ink-faint">
              Descrição (opcional)
            </label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !newClientId || !newName.trim()}
            className="bg-verde text-white text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            + Criar quadro
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-3">
          Quadros e acesso externo
        </h2>
        <p className="text-xs text-ink-faint mb-3 max-w-[70ch]">
          Equipe interna (papel &quot;Membro&quot; com o módulo Kanban liberado) vê todos os
          quadros ativos automaticamente. Aqui você libera um quadro específico para um usuário
          externo (papel &quot;Cliente&quot;) — ele só enxerga o(s) quadro(s) marcados abaixo.
        </p>
        <div className="flex flex-col gap-2">
          {boards.map((b) => (
            <div key={b.id} className="bg-surface border border-border rounded-lg px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.clientColor }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${b.active ? "text-ink" : "text-ink-faint line-through"}`}>
                        {b.clientName}
                        {b.name !== b.clientName && ` · ${b.name}`}
                      </span>
                      {!b.active && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-critical-bg text-critical">
                          Desativado
                        </span>
                      )}
                    </div>
                    {b.description && <div className="text-xs text-ink-faint">{b.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openAccess(b.id)}
                    className="text-xs font-semibold text-verde hover:underline disabled:opacity-50"
                  >
                    {expandedBoardId === b.id ? "Fechar acesso externo" : "Gerenciar acesso externo"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(b)}
                    className="text-xs font-semibold text-ink-secondary hover:text-verde disabled:opacity-50"
                  >
                    {b.active ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </div>

              {expandedBoardId === b.id && (
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                  {clientUsers.length === 0 && (
                    <span className="text-xs text-ink-faint">
                      Nenhum usuário com papel &quot;Cliente&quot; cadastrado ainda — crie um na
                      tela de Usuários.
                    </span>
                  )}
                  {clientUsers.map((u) => {
                    const active = (accessByBoard[b.id] ?? []).includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleAccess(b.id, u.id)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                          active
                            ? "bg-verde/10 border-verde/40 text-verde"
                            : "bg-surface-alt border-border text-ink-secondary hover:border-verde/40"
                        }`}
                      >
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {boards.length === 0 && (
            <p className="text-sm text-ink-faint">Nenhum quadro criado ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
