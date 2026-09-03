import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail, createUser } from "@/lib/users";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  accessCode: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 }
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { name, email, password, accessCode } = parsed.data;

  const requiredCode = process.env.SIGNUP_CODE;
  if (requiredCode && requiredCode.trim().length > 0) {
    if (accessCode !== requiredCode) {
      return NextResponse.json(
        { error: "Código de acesso inválido." },
        { status: 403 }
      );
    }
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma conta com esse email." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, passwordHash });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
