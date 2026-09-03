"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupForm({
  requiresAccessCode,
}: {
  requiresAccessCode: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, accessCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar a conta.");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Conta criada, mas não foi possível entrar automaticamente. Tente fazer login.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Não foi possível criar a conta. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] p-7">
      <h1 className="text-xl font-condensed font-bold text-ink mb-1">Criar conta</h1>
      <p className="text-sm text-ink-secondary mb-6">
        Acesso da equipe interna Join4 para o PMO.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Nome completo
          </span>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-border-strong rounded-md px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-border-strong rounded-md px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Senha
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-border-strong rounded-md px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Confirmar senha
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="border border-border-strong rounded-md px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-verde"
          />
        </label>
        {requiresAccessCode && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Código de acesso
            </span>
            <input
              type="text"
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              className="border border-border-strong rounded-md px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-verde"
            />
            <span className="text-xs text-ink-faint">
              Peça o código a quem já tem acesso à ferramenta.
            </span>
          </label>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-verde text-white font-semibold text-sm rounded-md py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Criando conta…" : "Criar conta"}
        </button>
      </form>

      <p className="text-sm text-ink-secondary mt-5 text-center">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-verde">
          Entrar
        </Link>
      </p>
    </div>
  );
}
