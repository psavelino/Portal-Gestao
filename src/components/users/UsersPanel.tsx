"use client";

import { useState } from "react";
import type { AppRole, AppUserWithAccess } from "@/lib/users";
import { MODULES, type ModuleKey } from "@/lib/modules";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  member: "Membro",
  client: "Cliente (externo)",
};

export default function UsersPanel({
  initialUsers,
}: {
  initialUsers: AppUserWithAccess[];
}) {
  const [users, setUsers] = useState<AppUserWithAccess[]>(initialUsers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<{
    name: string;
    password: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("member");
  const [moduleKeys, setModuleKeys] = useState<ModuleKey[]>([]);
  const [leaderId, setLeaderId] = useState("");

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("member");
    setModuleKeys([]);
    setLeaderId("");
  }

  // Pra cada usuário, quem ele lidera direta ou indiretamente — usado só
  // pra não deixar escolher, no select de "líder direto" de alguém, uma
  // pessoa que já está abaixo dela (isso criaria um ciclo no organograma).
  // O servidor também barra isso (ver /api/users/[id]), esse cálculo aqui
  // é só pra não deixar a opção nem aparecer no dropdown.
  function descendantIdsOf(userId: string): Set<string> {
    const childrenByLeader = new Map<string, string[]>();
    for (const u of users) {
      if (!u.leaderId) continue;
      const list = childrenByLeader.get(u.leaderId) ?? [];
      list.push(u.id);
      childrenByLeader.set(u.leaderId, list);
    }
    const seen = new Set<string>();
    const stack = [...(childrenByLeader.get(userId) ?? [])];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(childrenByLeader.get(cur) ?? []));
    }
    return seen;
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Preencha nome, email e uma senha com pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          moduleKeys: role === "member" ? moduleKeys : [],
          leaderId: leaderId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usuário.");
      setUsers((prev) => [...prev, data]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar usuário.");
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...data, moduleKeys: u.moduleKeys } : u))
      );
      if (data.tempPassword) {
        const target = users.find((u) => u.id === id);
        setTempPasswordNotice({
          name: target?.name ?? "usuário",
          password: data.tempPassword,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function setAccess(id: string, nextKeys: ModuleKey[]) {
    setBusy(true);
    setError(null);
    // Otimista: já reflete na tela antes da resposta, mais fluido para
    // marcar/desmarcar vários módulos em sequência.
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, moduleKeys: nextKeys } : u)));
    try {
      const res = await fetch(`/api/users/${id}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKeys: nextKeys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar permissões.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar permissões.");
    } finally {
      setBusy(false);
    }
  }

  function toggleModuleInForm(key: ModuleKey) {
    setModuleKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleModuleForUser(user: AppUserWithAccess, key: ModuleKey) {
    const next = user.moduleKeys.includes(key)
      ? user.moduleKeys.filter((k) => k !== key)
      : [...user.moduleKeys, key];
    setAccess(user.id, next);
  }

  return (
    <div className="flex flex-col gap-8">
      {tempPasswordNotice && (
        <div className="bg-warning-bg border border-[#F0C077] rounded-lg px-4 py-3 flex items-start justify-between gap-4">
          <p className="text-sm text-ink">
            Senha temporária para <strong>{tempPasswordNotice.name}</strong>:{" "}
            <span className="font-mono font-semibold tracking-wide">
              {tempPasswordNotice.password}
            </span>
            <br />
            <span className="text-ink-secondary">
              Copie agora e repasse por um canal seguro — ela não aparece de novo.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setTempPasswordNotice(null)}
            className="text-xs font-semibold text-ink-secondary hover:text-ink shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-critical bg-critical-bg border border-critical/30 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="bg-surface border border-border rounded-xl p-6 shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)]">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-4">
          Novo usuário
        </h2>
        <form onSubmit={createUser} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Nome completo
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Senha inicial
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mín. 8 caracteres"
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white font-mono"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Papel
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="member">Membro</option>
                <option value="admin">Admin</option>
                <option value="client">Cliente (externo)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[170px]">
              <label className="text-[10px] uppercase tracking-wide text-ink-faint">
                Líder direto (opcional)
              </label>
              <select
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                className="border border-border-strong rounded-md px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="">Sem líder (topo do squad)</option>
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({ROLE_LABELS[u.role]})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wide text-ink-faint block mb-1.5">
              {role === "admin"
                ? "Admin tem acesso a todos os módulos automaticamente"
                : role === "client"
                  ? "Cliente não navega pelos módulos — o acesso é por quadro, na tela Kanban > Gerenciar quadros"
                  : "Módulos liberados"}
            </span>
            {role === "member" && (
              <div className="flex flex-wrap gap-3">
                {MODULES.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-1.5 text-sm text-ink bg-surface-alt border border-border rounded-md px-2.5 py-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={moduleKeys.includes(m.key)}
                      onChange={() => toggleModuleInForm(m.key)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="self-start bg-verde text-white text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            + Criar usuário
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary mb-3">
          Usuários cadastrados
        </h2>
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-surface border border-border rounded-lg px-4 py-3 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${u.active ? "text-ink" : "text-ink-faint line-through"}`}>
                      {u.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-verde/10 text-verde"
                          : u.role === "client"
                            ? "bg-laranja/12 text-[#9A6300]"
                            : "bg-surface-alt text-ink-secondary"
                      }`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                    {!u.active && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-critical-bg text-critical">
                        Desativado
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-faint">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={u.role}
                    disabled={busy}
                    onChange={(e) => patchUser(u.id, { role: e.target.value as AppRole })}
                    className="text-xs font-medium border border-border-strong rounded-md px-1.5 py-1 bg-white disabled:opacity-50"
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                    <option value="client">Cliente (externo)</option>
                  </select>
                  <select
                    value={u.leaderId ?? ""}
                    disabled={busy}
                    title="Líder direto"
                    onChange={(e) => patchUser(u.id, { leaderId: e.target.value || null })}
                    className="text-xs font-medium border border-border-strong rounded-md px-1.5 py-1 bg-white disabled:opacity-50 max-w-[160px]"
                  >
                    <option value="">Sem líder direto</option>
                    {users
                      .filter((other) => other.id !== u.id && !descendantIdsOf(u.id).has(other.id))
                      .map((other) => (
                        <option key={other.id} value={other.id}>
                          {other.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patchUser(u.id, { active: !u.active })}
                    className="text-xs font-semibold text-ink-secondary hover:text-verde disabled:opacity-50"
                  >
                    {u.active ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Gerar uma senha temporária nova para ${u.name}? A senha atual deixa de funcionar.`
                        )
                      ) {
                        patchUser(u.id, { resetPassword: true });
                      }
                    }}
                    className="text-xs font-semibold text-ink-secondary hover:text-verde disabled:opacity-50"
                  >
                    Redefinir senha
                  </button>
                </div>
              </div>

              {u.role === "member" && (
                <div className="flex flex-wrap gap-2 pt-1.5 border-t border-border">
                  {MODULES.map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center gap-1.5 text-xs text-ink-secondary mt-1.5"
                    >
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={u.moduleKeys.includes(m.key)}
                        onChange={() => toggleModuleForUser(u, m.key)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-ink-faint">Nenhum usuário cadastrado ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
