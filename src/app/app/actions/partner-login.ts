"use server";

import { z } from "zod";
import { getT } from "@/i18n/server";
import { errorTextFor } from "@/i18n/error-text";
import { loginLabel } from "@/lib/auth/login-id";
import { LOCALES } from "@/lib/db/schema";
import { errorCode, requireUser, str } from "./helpers";

/*
 * Gerar o login do parceiro na tela da Estratégia de compra (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Login do parceiro na Estratégia"):
 * a sugestão (ao tocar em "Gerar o login aqui") e a criação. Só o
 * administrador (o serviço confere). A senha volta só para quem criou, na
 * resposta; não vai no endereço nem fica gravada além da conta.
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const ERROR_PREFIXES = ["partnerLogin.error", "reqFix.error", "catalog.error"];

export interface PartnerLoginSuggestionState {
  ok: boolean;
  message: string | null;
  login: string;
  name: string;
  password: string;
  locale: (typeof LOCALES)[number];
}

/** O formulário já preenchido: login, nome, senha provisória e idioma. */
export async function suggestPartnerLoginAction(
  partyId: string,
): Promise<PartnerLoginSuggestionState> {
  const user = await requireUser();
  try {
    const { partnerLoginSuggestion } =
      await import("@/lib/services/partner-login");
    const s = await partnerLoginSuggestion(user, ID.parse(partyId));
    return { ok: true, message: null, ...s };
  } catch (error) {
    const code = errorCode("/app/purchase-strategy", error);
    return {
      ok: false,
      message: errorTextFor(await getT(), code, ERROR_PREFIXES),
      login: "",
      name: "",
      password: "",
      locale: "pt",
    };
  }
}

export interface PartnerLoginState {
  ok: boolean;
  error: string | null;
  message: string | null;
  /** O login criado, como a pessoa digita. */
  login: string | null;
  /** A senha provisória confirmada no formulário. */
  password: string | null;
  /** No erro: o que foi digitado, para o formulário não voltar à sugestão. */
  values: {
    login: string;
    name: string;
    password: string;
    locale: string;
  } | null;
}

export async function createPartnerLoginAction(
  _prev: PartnerLoginState,
  form: FormData,
): Promise<PartnerLoginState> {
  const user = await requireUser();
  try {
    const { PORTAL_MIN_PASSWORD } =
      await import("@/lib/services/portal-access");
    if (str(form, "password").length < PORTAL_MIN_PASSWORD)
      throw new Error("user_password_short");
    const parsed = z
      .object({
        partyId: ID,
        login: z.string().trim().min(3).max(254),
        name: z.string().trim().min(2).max(120),
        password: z.string().min(PORTAL_MIN_PASSWORD).max(128),
        locale: z.enum(LOCALES),
      })
      .parse({
        partyId: str(form, "partyId"),
        login: str(form, "login"),
        name: str(form, "name"),
        password: str(form, "password"),
        locale: str(form, "locale"),
      });
    const { createPartnerLogin } = await import("@/lib/services/partner-login");
    const created = await createPartnerLogin(user, parsed.partyId, parsed);
    return {
      ok: true,
      error: null,
      message: null,
      login: loginLabel(created.email),
      password: parsed.password,
      values: null,
    };
  } catch (error) {
    const code = errorCode("/app/purchase-strategy", error);
    return {
      ok: false,
      error: code,
      message: errorTextFor(await getT(), code, ERROR_PREFIXES),
      login: null,
      password: null,
      values: {
        login: str(form, "login"),
        name: str(form, "name"),
        password: str(form, "password"),
        locale: str(form, "locale"),
      },
    };
  }
}
