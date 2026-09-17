import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  countActiveAdmins,
  getUserById,
  resetUserPassword,
  updateUser,
} from "@/lib/users";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.enum(["admin", "member", "client"]).optional(),
  active: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const target = await getUserById(id);
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Trava de segurança: não deixa ninguém tirar o último admin ativo do ar
  // (nem rebaixando o papel, nem desativando a conta) — senão a própria
  // tela de gestão de usuários fica inacessível para todo mundo.
  const isDemotingOrDeactivatingAdmin =
    target.role === "admin" &&
    ((data.role && data.role !== "admin") || data.active === false);
  if (isDemotingOrDeactivatingAdmin) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "Não é possível remover o último administrador ativo." },
        { status: 400 }
      );
    }
  }

  if (data.resetPassword) {
    const tempPassword = await resetUserPassword(id);
    if (!tempPassword) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    const updated = await updateUser(id, {
      name: data.name,
      role: data.role,
      active: data.active,
    });
    return NextResponse.json({ ...updated, tempPassword });
  }

  const updated = await updateUser(id, {
    name: data.name,
    role: data.role,
    active: data.active,
  });
  if (!updated) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
  return NextResponse.json(updated);
}
