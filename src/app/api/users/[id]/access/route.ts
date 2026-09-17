import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserById, getUserModuleKeys, setUserModuleAccess } from "@/lib/users";
import { MODULE_KEYS } from "@/lib/modules";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

const bodySchema = z.object({
  moduleKeys: z.array(z.enum(MODULE_KEYS)),
});

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const { id } = await ctx.params;

  const target = await getUserById(id);
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  await setUserModuleAccess(id, parsed.data.moduleKeys);
  const moduleKeys = await getUserModuleKeys(id);
  return NextResponse.json({ id, moduleKeys });
}
