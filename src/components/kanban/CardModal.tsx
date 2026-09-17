"use client";

import { useEffect, useState } from "react";
import type {
  AssignableUser,
  CardDetail,
  CardPriority,
  CardStatus,
  CardSummary,
} from "@/lib/kanban-types";
import {
  CARD_PRIORITIES,
  CARD_PRIORITY_COLORS,
  CARD_PRIORITY_LABELS,
  CARD_STATUSES,
  CARD_STATUS_LABELS,
} from "@/lib/kanban-types";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CardModal({
  cardId,
  canManage,
  assignableUsers,
  currentUserId,
  isAdmin,
  onClose,
  onChanged,
  onDeleted,
}: {
  cardId: string;
  canManage: boolean;
  assignableUsers: AssignableUser[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: (card: CardSummary) => void;
  onDeleted: (cardId: string) => void;
}) {
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/cards/${cardId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: CardDetail) => {
        if (cancelled) return;
        setCard(data);
        setTitle(data.title);
        setDescription(data.description ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o card.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  function summaryOf(c: CardDetail): CardSummary {
    return {
      id: c.id,
      boardId: c.boardId,
      title: c.title,
      description: c.description,
      status: c.status,
      priority: c.priority,
      dueDate: c.dueDate,
      sortOrder: c.sortOrder,
      archived: c.archived,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      assignees: c.assignees,
      subtaskTotal: c.subtaskTotal,
      subtaskDone: c.subtaskDone,
      commentCount: c.commentCount,
      attachmentCount: c.attachmentCount,
    };
  }

  async function patchCard(body: Record<string, unknown>) {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      setCard((prev) => (prev ? { ...prev, ...data } : prev));
      onChanged(data as CardSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitleDescription() {
    if (!card) return;
    const body: Record<string, unknown> = {};
    if (title.trim() && title.trim() !== card.title) body.title = title.trim();
    if (description !== (card.description ?? "")) body.description = description;
    if (Object.keys(body).length > 0) await patchCard(body);
  }

  async function deleteCard() {
    if (!card) return;
    if (!confirm(`Excluir o card "${card.title}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir card.");
      }
      onDeleted(card.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir card.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAssignee(userId: string) {
    if (!card) return;
    const next = card.assignees.some((a) => a.id === userId)
      ? card.assignees.filter((a) => a.id !== userId).map((a) => a.id)
      : [...card.assignees.map((a) => a.id), userId];
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}/assignees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar responsáveis.");
      const nextAssignees = assignableUsers.filter((u) => next.includes(u.id));
      setCard((prev) => (prev ? { ...prev, assignees: nextAssignees } : prev));
      onChanged({ ...summaryOf(card), assignees: nextAssignees });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar responsáveis.");
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!card || !newSubtask.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtask.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar subtarefa.");
      setCard((prev) =>
        prev
          ? {
              ...prev,
              subtasks: [...prev.subtasks, data],
              subtaskTotal: prev.subtaskTotal + 1,
            }
          : prev
      );
      onChanged({ ...summaryOf(card), subtaskTotal: card.subtaskTotal + 1 });
      setNewSubtask("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar subtarefa.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    if (!card) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error();
      const subtasks = card.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s));
      const subtaskDone = subtasks.filter((s) => s.done).length;
      const next = { ...card, subtasks, subtaskDone };
      setCard(next);
      onChanged(summaryOf(next));
    } catch {
      setError("Erro ao atualizar subtarefa.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSubtask(subtaskId: string) {
    if (!card) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/subtasks/${subtaskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const subtasks = card.subtasks.filter((s) => s.id !== subtaskId);
      const subtaskDone = subtasks.filter((s) => s.done).length;
      const next = { ...card, subtasks, subtaskTotal: subtasks.length, subtaskDone };
      setCard(next);
      onChanged(summaryOf(next));
    } catch {
      setError("Erro ao remover subtarefa.");
    } finally {
      setBusy(false);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!card || !newComment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${card.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao comentar.");
      setCard((prev) =>
        prev
          ? { ...prev, comments: [...prev.comments, data], commentCount: prev.commentCount + 1 }
          : prev
      );
      onChanged({ ...summaryOf(card), commentCount: card.commentCount + 1 });
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao comentar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(commentId: string) {
    if (!card) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/comments/${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const comments = card.comments.filter((c) => c.id !== commentId);
      const next = { ...card, comments, commentCount: comments.length };
      setCard(next);
      onChanged(summaryOf(next));
    } catch {
      setError("Erro ao remover comentário.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/cards/${card.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar anexo.");
      setCard((prev) =>
        prev
          ? {
              ...prev,
              attachments: [...prev.attachments, data],
              attachmentCount: prev.attachmentCount + 1,
            }
          : prev
      );
      onChanged({ ...summaryOf(card), attachmentCount: card.attachmentCount + 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar anexo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!card) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      const attachments = card.attachments.filter((a) => a.id !== attachmentId);
      const next = { ...card, attachments, attachmentCount: attachments.length };
      setCard(next);
      onChanged(summaryOf(next));
    } catch {
      setError("Erro ao remover anexo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl w-full max-w-[720px] my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-8 text-sm text-ink-faint">Carregando card…</div>
        ) : !card ? (
          <div className="p-8 text-sm text-critical">{error ?? "Card não encontrado."}</div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-border">
              {canManage ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitleDescription}
                  className="flex-1 text-lg font-condensed font-bold text-ink bg-transparent border-none outline-none focus:bg-surface-alt rounded px-1 -mx-1"
                />
              ) : (
                <h2 className="flex-1 text-lg font-condensed font-bold text-ink">{card.title}</h2>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-ink-faint hover:text-ink text-xl leading-none px-1"
                aria-label="Fechar"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              {error && (
                <p className="text-sm text-critical bg-critical-bg border border-critical/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">Status</span>
                  <select
                    disabled={!canManage || busy}
                    value={card.status}
                    onChange={(e) => patchCard({ status: e.target.value as CardStatus })}
                    className="border border-border-strong rounded-md px-2 py-1 text-sm bg-white disabled:opacity-60"
                  >
                    {CARD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {CARD_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">Prioridade</span>
                  <select
                    disabled={!canManage || busy}
                    value={card.priority}
                    onChange={(e) => patchCard({ priority: e.target.value as CardPriority })}
                    className="border border-border-strong rounded-md px-2 py-1 text-sm bg-white disabled:opacity-60"
                    style={{ color: CARD_PRIORITY_COLORS[card.priority] }}
                  >
                    {CARD_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {CARD_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">Prazo</span>
                  <input
                    type="date"
                    disabled={!canManage || busy}
                    value={card.dueDate ?? ""}
                    onChange={(e) => patchCard({ dueDate: e.target.value || null })}
                    className="border border-border-strong rounded-md px-2 py-1 text-sm bg-white disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">Descrição</span>
                {canManage ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={saveTitleDescription}
                    rows={4}
                    placeholder="Detalhe o que precisa ser feito…"
                    className="border border-border-strong rounded-md px-2.5 py-2 text-sm bg-white resize-y"
                  />
                ) : (
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {card.description || "Sem descrição."}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">Responsáveis</span>
                <div className="flex flex-wrap gap-2">
                  {assignableUsers.map((u) => {
                    const active = card.assignees.some((a) => a.id === u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={!canManage || busy}
                        onClick={() => toggleAssignee(u.id)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:cursor-default ${
                          active
                            ? "bg-verde/10 border-verde/40 text-verde"
                            : "bg-surface-alt border-border text-ink-secondary hover:border-verde/40"
                        }`}
                      >
                        {u.name}
                      </button>
                    );
                  })}
                  {assignableUsers.length === 0 && (
                    <span className="text-xs text-ink-faint">Nenhum usuário disponível.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                    Subtarefas {card.subtasks.length > 0 && `(${card.subtaskDone}/${card.subtasks.length})`}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {card.subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={s.done}
                        disabled={!canManage || busy}
                        onChange={(e) => toggleSubtask(s.id, e.target.checked)}
                      />
                      <span
                        className={`text-sm flex-1 ${s.done ? "line-through text-ink-faint" : "text-ink"}`}
                      >
                        {s.title}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeSubtask(s.id)}
                          className="text-xs text-ink-faint hover:text-critical opacity-0 group-hover:opacity-100"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  {card.subtasks.length === 0 && (
                    <span className="text-xs text-ink-faint">Nenhuma subtarefa ainda.</span>
                  )}
                </div>
                {canManage && (
                  <form onSubmit={addSubtask} className="flex gap-2 mt-1">
                    <input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Nova subtarefa…"
                      className="flex-1 border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
                    />
                    <button
                      type="submit"
                      disabled={busy || !newSubtask.trim()}
                      className="text-xs font-semibold text-verde px-2 disabled:opacity-50"
                    >
                      + Adicionar
                    </button>
                  </form>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Anexos {card.attachments.length > 0 && `(${card.attachments.length})`}
                </span>
                <div className="flex flex-col gap-1.5">
                  {card.attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <a
                        href={a.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-verde hover:underline flex-1 truncate"
                      >
                        {a.fileName}
                      </a>
                      <span className="text-[10px] text-ink-faint">{a.userName}</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="text-xs text-ink-faint hover:text-critical opacity-0 group-hover:opacity-100"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  {card.attachments.length === 0 && (
                    <span className="text-xs text-ink-faint">Nenhum anexo ainda.</span>
                  )}
                </div>
                {canManage && (
                  <label className="text-xs font-semibold text-verde cursor-pointer w-fit mt-1">
                    &#8593; Enviar arquivo
                    <input
                      type="file"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadAttachment(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Comentários {card.comments.length > 0 && `(${card.comments.length})`}
                </span>
                <div className="flex flex-col gap-2.5">
                  {card.comments.map((c) => (
                    <div key={c.id} className="bg-surface-alt rounded-lg px-3 py-2 group">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-ink">{c.userName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-ink-faint">{formatDateTime(c.createdAt)}</span>
                          {(isAdmin || c.userId === currentUserId) && (
                            <button
                              type="button"
                              onClick={() => removeComment(c.id)}
                              className="text-[10px] text-ink-faint hover:text-critical opacity-0 group-hover:opacity-100"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-ink whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                  {card.comments.length === 0 && (
                    <span className="text-xs text-ink-faint">Nenhum comentário ainda.</span>
                  )}
                </div>
                <form onSubmit={addComment} className="flex gap-2 mt-1">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário…"
                    className="flex-1 border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
                  />
                  <button
                    type="submit"
                    disabled={busy || !newComment.trim()}
                    className="text-xs font-semibold text-verde px-2 disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>

            {canManage && (
              <div className="px-6 py-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={deleteCard}
                  disabled={busy}
                  className="text-xs font-semibold text-critical hover:underline disabled:opacity-50"
                >
                  Excluir card
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
