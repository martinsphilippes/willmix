import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSession, createSession } from "@/lib/auth/session";

const bodySchema = z.object({ idToken: z.string().min(1) });

/** Troca um idToken do Firebase Auth por um cookie de sessão HttpOnly. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "idToken obrigatório" }, { status: 400 });
  }
  try {
    await createSession(parsed.data.idToken);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}

/** Logout: remove o cookie de sessão. */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
