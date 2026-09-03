"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Email ou senha incorretos.");
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-[0_1px_2px_rgba(48,48,48,0.06),0_8px_24px_-12px_rgba(48,48,48,0.18)] p-7">
      <h1 className="text-xl font-condensed font-bold text-ink mb-1">Entrar</h1>
      <p className="text-sm text-ink-secondary mb-6">
        Acesse a gestão de horas e forecast da Join4.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-border-strong rounded-md px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-verde"
          />
        </label>

        {error && <p className="text-sm text-critical">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-verde text-white font-semibold text-sm rounded-md py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="text-sm text-ink-secondary mt-5 text-center">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="font-semibold text-verde">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
