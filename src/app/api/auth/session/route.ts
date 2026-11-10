import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, signIn, signOut } from "@/lib/auth/session";
import {
  classifyLoginError,
  isProjectPaused,
  serviceErrorCode,
} from "@/lib/auth/login-errors";

// `email` leva o que a pessoa digitou: o e-mail ou o nome de usuário (login
// sem e-mail, src/lib/auth/login-id.ts). O formato é conferido no signIn.
const bodySchema = z.object({
  email: z.string().min(3).max(254),
  password: z.string().min(6),
});

/** Login por e-mail (ou nome de usuário) e senha. Grava cookie HttpOnly. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "E-mail e senha são obrigatórios" },
      { status: 400 },
    );
  }
  try {
    const user = await signIn(parsed.data.email, parsed.data.password);
    return NextResponse.json({ ok: true, userId: user.id, role: user.role });
  } catch (error) {
    if (error instanceof AuthError || classifyLoginError(error) === "invalid") {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 },
      );
    }
    // Banco fora (ex.: projeto Appwrite pausado): não é a senha da pessoa.
    console.error(
      "login: serviço indisponível",
      serviceErrorCode(error),
      error instanceof Error ? error.message.slice(0, 200) : "",
    );
    // "paused": a tela explica como reativar (não volta sozinho).
    return NextResponse.json(
      {
        error: "Serviço indisponível",
        code: isProjectPaused(error) ? "paused" : "unavailable",
      },
      { status: 503 },
    );
  }
}

/** Logout. */
export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
