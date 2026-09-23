import { NextResponse } from "next/server";
import { z } from "zod";
import { signInWithPassword, signOut } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** Login por e-mail e senha. Cria sessão Appwrite e grava cookie HttpOnly. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "E-mail e senha (mínimo 8 caracteres) são obrigatórios" },
      { status: 400 },
    );
  }
  try {
    const session = await signInWithPassword(
      parsed.data.email,
      parsed.data.password,
    );
    return NextResponse.json({ ok: true, userId: session.userId });
  } catch {
    return NextResponse.json(
      { error: "Credenciais inválidas" },
      { status: 401 },
    );
  }
}

/** Logout: encerra a sessão no Appwrite e remove o cookie. */
export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
