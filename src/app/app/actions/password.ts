"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  PasswordChangeError,
  changeOwnPassword,
  skipPasswordChange,
} from "@/lib/services/password-change";
import { requireUser } from "./helpers";

export interface PasswordFormState {
  /** Código do motivo da recusa (textos em password.error.*). */
  error: string | null;
  /** Trocou: a tela recarrega (o usuário desta resposta ainda é o de antes). */
  done?: boolean;
}

/** Troca a senha de quem está logado (primeiro acesso ou "Trocar senha"). */
export async function changePasswordAction(
  _prev: PasswordFormState,
  form: FormData,
): Promise<PasswordFormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      current: z.string().min(1).max(256),
      next: z.string().min(1).max(256),
      confirm: z.string().min(1).max(256),
    })
    .safeParse({
      current: form.get("current"),
      next: form.get("next"),
      confirm: form.get("confirm"),
    });
  if (!parsed.success) return { error: "password_short" };
  try {
    await changeOwnPassword(user, parsed.data);
  } catch (error) {
    if (error instanceof PasswordChangeError) return { error: error.code };
    console.error("[password] troca recusada", error);
    return { error: "failed" };
  }
  return { error: null, done: true };
}

/**
 * Primeiro acesso: seguir sem trocar a senha provisória (pedido do dono,
 * 14/11/2026). Só vale para o próprio login; a tela aberta recarrega já com
 * o portal (sem trocar de endereço).
 */
export async function skipPasswordChangeAction() {
  const user = await requireUser();
  await skipPasswordChange(user);
  revalidatePath("/app", "layout");
}
