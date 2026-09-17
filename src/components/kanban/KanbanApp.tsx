"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AssignableUser,
  BoardSummary,
  CardPriority,
  CardStatus,
  CardSummary,
} from "@/lib/kanban-types";
import {
  CARD_PRIORITY_COLORS,
  CARD_PRIORITY_LABELS,
  CARD_STATUSES,
  CARD_STATUS_LABELS,
} from "@/lib/kanban-types";
import CardModal from "./CardModal";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function formatDueDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function isOverdue(iso: string): boolean {
  const due = new Date(`${iso}T23:59:59`);
  return due.getTime() < Date.now();
}

export default function KanbanApp({
  canManage,
  isAdmin,
  isClient,
  currentUserId,
}: {
  canManage: boolean;
  isAdmin: boolean;
  isClient: boolean;
  currentUserId: string;
}) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<CardPriority | "">("");
  // Quando ligado, ignora a aba selecionada e traz os cards de TODOS os
  // quadros visíveis pro usuário, agrupados nas mesmas caixas de status.
  // Usuário 'client' nunca vê essa opção (nem o checkbox, ver abaixo) — a
  // checagem `&& !isClient` aqui é defesa em profundidade, pra garantir que
  // mesmo que o estado seja forçado true por algum jeito, o comportamento
  // efetivo do componente continua sendo "só o quadro liberado pra ele".
  const [showAllBoards, setShowAllBoards] = useState(false);
  const effectiveShowAllBoards = showAllBoards && !isClient;

  const [quickAddFor, setQuickAddFor] = useState<CardStatus | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  const boardsById = useMemo(() => {
    const map = new Map<string, BoardSummary>();
    for (const b of boards) map.set(b.id, b);
    return map;
  }, [boards]);

  useEffect(() => {
    (async () => {
      try {
        const [boardsRes, usersRes] = await Promise.all([
          fetch("/api/boards"),
          fetch("/api/users/assignable"),
        ]);
        if (!boardsRes.ok) throw new Error();
        const boardsData: BoardSummary[] = await boardsRes.json();
        setBoards(boardsData);
        if (boardsData.length > 0) setActiveBoardId(boardsData[0].id);
        if (usersRes.ok) setAssignableUsers(await usersRes.json());
      } catch {
        setError("Não foi possível carregar os quadros.");
      } finally {
        setLoadingBoards(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (effectiveShowAllBoards) {
      if (boards.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCards([]);
        return;
      }
      let cancelled = false;
      setLoadingCards(true);
      Promise.all(
        boards.map((b) =>
          fetch(`/api/cards?boardId=${b.id}`).then((r) => (r.ok ? r.json() : []))
        )
      )
        .then((lists: CardSummary[][]) => {
          if (!cancelled) setCards(lists.flat());
        })
        .catch(() => {
          if (!cancelled) setError("Não foi possível carregar os cards de todos os quadros.");
        })
        .finally(() => {
          if (!cancelled) setLoadingCards(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!activeBoardId) {
      setCards([]);
      return;
    }
    let cancelled = false;
    setLoadingCards(true);
    fetch(`/api/cards?boardId=${activeBoardId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: CardSummary[]) => {
        if (!cancelled) setCards(data);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os cards deste quadro.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeBoardId, effectiveShowAllBoards, boards]);

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null;

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (assigneeFilter && !c.assignees.some((a) => a.id === assigneeFilter)) return false;
      if (priorityFilter && c.priority !== priorityFilter) return false;
      if (search.trim() && !c.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [cards, assigneeFilter, priorityFilter, search]);

  function columnCards(status: CardStatus): CardSummary[] {
    return filteredCards.filter((c) => c.status === status);
  }

  async function persistReorder(status: CardStatus, cardIds: string[]) {
    if (!activeBoardId) return;
    try {
      await fetch(`/api/boards/${activeBoardId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cardIds }),
      });
    } catch {
      setError("Não foi possível salvar a nova ordem — recarregue a página.");
    }
  }

  // Modo "todos os quadros": os cards arrastados podem ser de quadros
  // diferentes, então não dá pra reescrever um `sort_order` único pra
  // coluna (ele é por quadro). Aqui só muda o status do card arrastado e
  // salva via PATCH simples — sem reordenação fina entre quadros.
  async function moveCardCrossBoard(cardId: string, targetStatus: CardStatus) {
    const dragged = cards.find((c) => c.id === cardId);
    if (!dragged || dragged.status === targetStatus) return;
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: targetStatus } : c)));
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Não foi possível mover o card — recarregue a página.");
    }
  }

  function moveCard(cardId: string, targetStatus: CardStatus, beforeCardId: string | null) {
    if (effectiveShowAllBoards) {
      void moveCardCrossBoard(cardId, targetStatus);
      return;
    }

    const dragged = cards.find((c) => c.id === cardId);
    if (!dragged || (dragged.status === targetStatus && beforeCardId === cardId)) return;

    const rest = cards.filter((c) => c.id !== cardId);
    const columnCardsCurrent = rest.filter((c) => c.status === targetStatus);
    const others = rest.filter((c) => c.status !== targetStatus);

    let insertAt = columnCardsCurrent.length;
    if (beforeCardId) {
      const idx = columnCardsCurrent.findIndex((c) => c.id === beforeCardId);
      if (idx !== -1) insertAt = idx;
    }
    const newColumn = [...columnCardsCurrent];
    const movedCard = { ...dragged, status: targetStatus };
    newColumn.splice(insertAt, 0, movedCard);

    setCards([...others, ...newColumn]);
    void persistReorder(
      targetStatus,
      newColumn.map((c) => c.id)
    );
  }

  async function createCard(status: CardStatus, title: string) {
    if (!activeBoardId || !title.trim()) return;
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: activeBoardId, title: title.trim(), status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar card.");
      setCards((prev) => [...prev, data]);
      setQuickAddTitle("");
      setQuickAddFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar card.");
    }
  }

  function handleCardChanged(updated: CardSummary) {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  function handleCardDeleted(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  if (loadingBoards) {
    return <div className="max-w-[1400px] mx-auto px-7 py-10 text-sm text-ink-faint">Carregando quadros…</div>;
  }

  if (boards.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto px-7 py-10 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-[24px] leading-tight text-ink">Kanban</h1>
          {isAdmin && (
            <a
              href="/kanban/quadros"
              className="text-sm font-semibold text-verde hover:underline"
            >
              Gerenciar quadros &rarr;
            </a>
          )}
        </div>
        <div className="bg-surface-alt border border-border rounded-xl p-6 text-sm text-ink-secondary">
          {isAdmin ? (
            <>
              Nenhum quadro criado ainda.{" "}
              <a href="/kanban/quadros" className="font-semibold text-verde hover:underline">
                Crie o primeiro na tela de Quadros &rarr;
              </a>
            </>
          ) : canManage ? (
            "Nenhum quadro criado ainda. Peça para um admin criar o primeiro na tela de Quadros."
          ) : (
            "Você ainda não tem nenhum quadro liberado. Peça para a Join4 liberar o acesso."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-7 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-[24px] leading-tight text-ink">Kanban</h1>
        {isAdmin && (
          <a
            href="/kanban/quadros"
            className="text-sm font-semibold text-verde hover:underline"
          >
            Gerenciar quadros &rarr;
          </a>
        )}
      </div>

      {error && (
        <p className="text-sm text-critical bg-critical-bg border border-critical/30 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setActiveBoardId(b.id);
              setShowAllBoards(false);
            }}
            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              !effectiveShowAllBoards && b.id === activeBoardId
                ? "border-verde text-ink"
                : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.clientColor }} />
            {b.clientName}
            {b.name !== b.clientName && (
              <span className="text-ink-faint font-normal">· {b.name}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título…"
          className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white min-w-[200px]"
        />
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Todos os responsáveis</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as CardPriority | "")}
          className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Todas as prioridades</option>
          {(Object.keys(CARD_PRIORITY_LABELS) as CardPriority[]).map((p) => (
            <option key={p} value={p}>
              {CARD_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        {!isClient && (
          <label className="flex items-center gap-1.5 text-sm text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showAllBoards}
              onChange={(e) => setShowAllBoards(e.target.checked)}
            />
            Buscar em todos os quadros
          </label>
        )}
        {(search || assigneeFilter || priorityFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setAssigneeFilter("");
              setPriorityFilter("");
            }}
            className="text-xs font-semibold text-ink-secondary hover:text-verde"
          >
            Limpar filtros
          </button>
        )}
        {!effectiveShowAllBoards && activeBoard?.description && (
          <span className="text-xs text-ink-faint ml-auto">{activeBoard.description}</span>
        )}
      </div>

      {loadingCards ? (
        <div className="text-sm text-ink-faint py-10 text-center">Carregando cards…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {CARD_STATUSES.map((status) => {
            const list = columnCards(status);
            return (
              <div
                key={status}
                data-status={status}
                className="bg-surface-alt border border-border rounded-xl p-3 flex flex-col gap-2.5 min-h-[200px] w-[260px] shrink-0"
                onDragOver={(e) => {
                  if (canManage) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId) moveCard(draggedId, status, null);
                  setDraggingId(null);
                }}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                    {CARD_STATUS_LABELS[status]}
                  </span>
                  <span className="text-[11px] text-ink-faint tabular">{list.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {list.map((card) => (
                    <div
                      key={card.id}
                      data-card-id={card.id}
                      draggable={canManage}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", card.id);
                        setDraggingId(card.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(e) => {
                        if (canManage) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const draggedId = e.dataTransfer.getData("text/plain");
                        if (draggedId && draggedId !== card.id) moveCard(draggedId, status, card.id);
                        setDraggingId(null);
                      }}
                      onClick={() => setModalCardId(card.id)}
                      className={`bg-surface border border-border rounded-lg p-3 flex flex-col gap-2 cursor-pointer shadow-[0_1px_2px_rgba(48,48,48,0.06)] hover:border-verde/40 transition-colors ${
                        draggingId === card.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink leading-snug">{card.title}</span>
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: `${CARD_PRIORITY_COLORS[card.priority]}1a`,
                            color: CARD_PRIORITY_COLORS[card.priority],
                          }}
                        >
                          {CARD_PRIORITY_LABELS[card.priority]}
                        </span>
                      </div>

                      {effectiveShowAllBoards && boardsById.get(card.boardId) && (
                        <div className="flex items-center gap-1.5 -mt-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: boardsById.get(card.boardId)!.clientColor }}
                          />
                          <span className="text-[10px] text-ink-faint truncate">
                            {boardsById.get(card.boardId)!.clientName}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {card.dueDate && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                isOverdue(card.dueDate)
                                  ? "bg-critical-bg text-critical"
                                  : "bg-surface-alt text-ink-secondary"
                              }`}
                            >
                              {formatDueDate(card.dueDate)}
                            </span>
                          )}
                          {card.subtaskTotal > 0 && (
                            <span className="text-[10px] text-ink-faint">
                              &#9745; {card.subtaskDone}/{card.subtaskTotal}
                            </span>
                          )}
                          {card.commentCount > 0 && (
                            <span className="text-[10px] text-ink-faint">&#128172; {card.commentCount}</span>
                          )}
                          {card.attachmentCount > 0 && (
                            <span className="text-[10px] text-ink-faint">&#128206; {card.attachmentCount}</span>
                          )}
                        </div>
                        {card.assignees.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {card.assignees.slice(0, 3).map((a) => (
                              <span
                                key={a.id}
                                title={a.name}
                                className="w-5 h-5 rounded-full bg-verde text-white text-[9px] font-semibold flex items-center justify-center border border-surface"
                              >
                                {initials(a.name)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {canManage && effectiveShowAllBoards && (
                  <span className="text-[11px] text-ink-faint px-1">
                    Desmarque &quot;todos os quadros&quot; pra criar um card
                  </span>
                )}

                {canManage &&
                  !effectiveShowAllBoards &&
                  (quickAddFor === status ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createCard(status, quickAddTitle);
                      }}
                      className="flex flex-col gap-1.5"
                    >
                      <input
                        autoFocus
                        value={quickAddTitle}
                        onChange={(e) => setQuickAddTitle(e.target.value)}
                        onBlur={() => {
                          if (!quickAddTitle.trim()) setQuickAddFor(null);
                        }}
                        placeholder="Título do card…"
                        className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!quickAddTitle.trim()}
                          className="text-xs font-semibold text-verde disabled:opacity-50"
                        >
                          + Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAddFor(null);
                            setQuickAddTitle("");
                          }}
                          className="text-xs text-ink-faint"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQuickAddFor(status)}
                      className="text-xs font-medium text-ink-secondary hover:text-verde text-left px-1"
                    >
                      + Novo card
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {modalCardId && (
        <CardModal
          cardId={modalCardId}
          canManage={canManage}
          assignableUsers={assignableUsers}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setModalCardId(null)}
          onChanged={handleCardChanged}
          onDeleted={handleCardDeleted}
        />
      )}
    </div>
  );
}
