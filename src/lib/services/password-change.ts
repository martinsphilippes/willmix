import "server-only";

import { getStore, type User } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { forgetCurrentSession } from "@/lib/auth/session";
import { newPasswordError, type PasswordError } from "@/lib/password-rules";
import { audit } from "./audit";

/*
 * Troca da própria senha. Serve ao primeiro acesso de um login criado com
 * senha provisória (`users.mustChangePassword`): enquanto a marca existir, o
 * portal só mostra esta troca (src/app/app/layout.tsx). Também é a tela
 * "Trocar senha" de qualquer login (/app/password).
 *
 * A senha nunca é registrada: a auditoria guarda só que houve troca.
 */

export class PasswordChangeError extends Error {
  constructor(public code: PasswordError) {
    super(code);
  }
}

export async function changeOwnPassword(
  user: User,
  input: { current: string; next: string; confirm: string },
): Promise<void> {
  const invalid = newPasswordError(input);
  if (invalid) throw new PasswordChangeError(invalid);
  const store = getStore();

  if (store.mode === "memory") {
    if (!verifyPassword(input.current, user.passwordHash))
      throw new PasswordChangeError("password_wrong");
    await store.update("users", user.id, {
      passwordHash: hashPassword(input.next),
      ...(user.mustChangePassword ? { mustChangePassword: false } : {}),
    });
  } else if (store.mode === "appwrite") {
    // Na identidade de quem está logado: o Appwrite confere a senha atual.
    const { createSessionClient } = await import("@/lib/appwrite/server");
    const session = await createSessionClient();
    if (!session) throw new Error("forbidden");
    try {
      await session.account.updatePassword({
        password: input.next,
        oldPassword: input.current,
      });
    } catch (error) {
      const failure = error as { code?: unknown; type?: unknown };
      const type = String(failure.type ?? "");
      if (failure.code === 401 || type.includes("invalid_credentials"))
        throw new PasswordChangeError("password_wrong");
      // Senha recusada pelo Appwrite (curta, comum demais, igual a recente).
      if (failure.code === 400 || type.includes("password"))
        throw new PasswordChangeError("password_short");
      throw error;
    }
    if (user.mustChangePassword)
      await store.update("users", user.id, { mustChangePassword: false });
    await forgetCurrentSession();
  } else {
    // Supabase: o login pelo Supabase Auth ainda não existe (docs/SUPABASE.md,
    // etapa 3). A troca de senha entra junto com ele.
    throw new Error("password_change_unavailable");
  }
  await audit(user, "user.password_change", "user", user.id, user.email);
}
