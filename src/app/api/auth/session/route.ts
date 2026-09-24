import { NextResponse } from "next/server";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** Login por e-mail e senha. Grava cookie HttpOnly. */
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
  } catch {
    return NextResponse.json(
      { error: "Credenciais inválidas" },
      { status: 401 },
    );
  }
}

/** Logout. */
export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
