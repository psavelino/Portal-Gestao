import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { adminCreateUser, getUserByEmail, listUsersWithAccess } from "@/lib/users";
import { MODULE_KEYS } from "@/lib/modules";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  const users = await listUsersWithAccess();
  return NextResponse.json(users);
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  role: z.enum(["admin", "member", "client"]).default("member"),
  moduleKeys: z.array(z.enum(MODULE_KEYS)).default([]),
});

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com esse email." }, { status: 409 });
  }

  const user = await adminCreateUser(parsed.data);
  return NextResponse.json(user, { status: 201 });
}
