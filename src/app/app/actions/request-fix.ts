"use server";

import { z } from "zod";
import { getT } from "@/i18n/server";
import { errorTextFor } from "@/i18n/error-text";
import { loginLabel } from "@/lib/auth/login-id";
import { errorCode, requireUser, str } from "./helpers";

/*
 * Resolver pelo balão "Quem pode agir" (dono, 20/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 10): o administrador cria o login do
 * cliente que confirma a venda ali mesmo. A resposta volta para o
 * formulário (login e senha provisória para passar ao cliente): nada vai no
 * endereço da página nem fica gravado além da conta.
 */

export interface CustomerLoginFixState {
  ok: boolean;
  error: string | null;
  message: string | null;
  /** O login criado, como a pessoa digita (nome de usuário ou e-mail). */
  login: string | null;
  /** A senha provisória que o administrador confirmou no formulário. */
  password: string | null;
  /** Encomendas do lote que passaram a ter o login novo como login com acesso. */
  reassigned: number;
  /** No erro: o que foi digitado, para o formulário não voltar à sugestão. */
  values: { login: string; name: string; password: string } | null;
}

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);

export async function createRequestCustomerLoginAction(
  _prev: CustomerLoginFixState,
  form: FormData,
): Promise<CustomerLoginFixState> {
  const user = await requireUser();
  try {
    const { PORTAL_MIN_PASSWORD } =
      await import("@/lib/services/portal-access");
    // Senha curta: recusa com o motivo certo (não "confira os campos").
    if (str(form, "password").length < PORTAL_MIN_PASSWORD)
      throw new Error("user_password_short");
    const parsed = z
      .object({
        requestId: ID,
        login: z.string().trim().min(3).max(254),
        name: z.string().trim().min(2).max(120),
        password: z.string().min(PORTAL_MIN_PASSWORD).max(128),
      })
      .parse({
        requestId: str(form, "requestId"),
        login: str(form, "login"),
        name: str(form, "name"),
        password: str(form, "password"),
      });
    const { createCustomerLoginForRequest } =
      await import("@/lib/services/request-fix");
    const { user: created, reassigned } = await createCustomerLoginForRequest(
      user,
      parsed.requestId,
      parsed,
    );
    return {
      ok: true,
      error: null,
      message: null,
      login: loginLabel(created.email),
      password: parsed.password,
      reassigned,
      values: null,
    };
  } catch (error) {
    const code = errorCode("/app/requests", error);
    return {
      ok: false,
      error: code,
      message: errorTextFor(await getT(), code, [
        "reqFix.error",
        "catalog.error",
      ]),
      login: null,
      password: null,
      reassigned: 0,
      values: {
        login: str(form, "login"),
        name: str(form, "name"),
        password: str(form, "password"),
      },
    };
  }
}
