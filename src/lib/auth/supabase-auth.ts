import "server-only";

import { supabaseEnv } from "@/lib/env";

/*
 * Supabase Auth (docs/SUPABASE.md, etapa 3). O Supabase guarda e confere a
 * senha e manda o e-mail de "definir/trocar senha"; a sessão do portal
 * continua sendo o cookie assinado do próprio portal (como no modo memória),
 * então nada de token para renovar a cada página. Papel, parceiro e conta
 * ativa seguem na tabela `users`.
 */

export class SupabaseAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`supabase auth ${status}: ${code}`);
  }
}

function env() {
  const e = supabaseEnv();
  if (!e) throw new Error("supabase_not_configured");
  // Chamadas públicas (login, recuperar senha) usam a chave anon quando há;
  // a service_role também é aceita pelo Auth.
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    e.key;
  return { url: e.url.replace(/\/$/, ""), service: e.key, anon };
}

async function call(
  path: string,
  init: RequestInit & { key: string; bearer?: string },
) {
  const { url } = env();
  const res = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: init.key,
      Authorization: `Bearer ${init.bearer ?? init.key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok)
    throw new SupabaseAuthError(
      res.status,
      String(body.error_code ?? body.code ?? body.error ?? "error"),
    );
  return body;
}

/** Senha certa? (400 de credencial = não; o resto é erro do serviço). */
export async function supabasePasswordOk(
  email: string,
  password: string,
): Promise<boolean> {
  const { anon } = env();
  try {
    await call("token?grant_type=password", {
      method: "POST",
      key: anon,
      body: JSON.stringify({ email, password }),
    });
    return true;
  } catch (error) {
    if (
      error instanceof SupabaseAuthError &&
      (error.status === 400 || error.status === 401 || error.status === 422)
    )
      return false;
    throw error;
  }
}

/** Conta nova já confirmada (o admin criou o acesso com a senha). */
export async function supabaseCreateUser(
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const { service } = env();
  try {
    const user = await call("admin/users", {
      method: "POST",
      key: service,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      }),
    });
    return String(user.id);
  } catch (error) {
    if (
      error instanceof SupabaseAuthError &&
      (error.status === 422 || error.code === "email_exists")
    )
      throw new Error("user_email_taken");
    throw error;
  }
}

export async function supabaseDeleteUser(id: string) {
  const { service } = env();
  await call(`admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    key: service,
  });
}

/**
 * E-mail com o link para definir/trocar a senha (enviado pelo Supabase). Não
 * diz se o e-mail existe: a tela responde igual nos dois casos.
 */
export async function supabaseSendRecovery(email: string, redirectTo: string) {
  const { anon } = env();
  await call(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    key: anon,
    body: JSON.stringify({ email }),
  });
}

/** Nova senha com o token do link de recuperação; devolve o e-mail da conta. */
export async function supabaseSetPassword(
  accessToken: string,
  password: string,
): Promise<string> {
  const { anon } = env();
  const user = await call("user", {
    method: "PUT",
    key: anon,
    bearer: accessToken,
    body: JSON.stringify({ password }),
  });
  return String(user.email ?? "");
}
