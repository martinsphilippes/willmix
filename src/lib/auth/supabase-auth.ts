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

/**
 * Troca da própria senha: a senha atual é conferida pelo login (o token dele
 * autoriza a gravação da nova). Devolve "wrong" (senha atual errada), "weak"
 * (o Supabase recusou a nova) ou "ok".
 */
export async function supabaseChangePassword(
  email: string,
  current: string,
  next: string,
): Promise<"ok" | "wrong" | "weak"> {
  const { anon } = env();
  const refused = (error: unknown) =>
    error instanceof SupabaseAuthError &&
    (error.status === 400 || error.status === 401 || error.status === 422);
  let token: string;
  try {
    const session = await call("token?grant_type=password", {
      method: "POST",
      key: anon,
      body: JSON.stringify({ email, password: current }),
    });
    token = String(session.access_token ?? "");
  } catch (error) {
    if (refused(error)) return "wrong";
    throw error;
  }
  if (!token) return "wrong";
  try {
    await supabaseSetPassword(token, next);
  } catch (error) {
    if (refused(error)) return "weak";
    throw error;
  }
  return "ok";
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

/**
 * Conta sem senha (cópia dos usuários na virada): a pessoa define a senha
 * pelo link. Já existe = nada a fazer.
 */
export async function supabaseEnsureUser(
  email: string,
  name: string,
): Promise<"created" | "existing"> {
  const { service } = env();
  try {
    await call("admin/users", {
      method: "POST",
      key: service,
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: { name },
      }),
    });
    return "created";
  } catch (error) {
    if (
      error instanceof SupabaseAuthError &&
      (error.status === 422 || error.code === "email_exists")
    )
      return "existing";
    throw error;
  }
}

/**
 * A conta do Auth pelo e-mail (exato). A ligação entre o login do portal e
 * a conta é o e-mail: a lista do Auth é filtrada por ele (`filter`) e, se o
 * filtro não existir na versão do Auth, percorrida por páginas.
 */
export async function supabaseUserIdByEmail(
  email: string,
): Promise<string | null> {
  const { service } = env();
  const target = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const body = await call(
      `admin/users?page=${page}&per_page=${perPage}&filter=${encodeURIComponent(target)}`,
      { method: "GET", key: service },
    );
    const users = Array.isArray(body.users)
      ? (body.users as Array<{ id?: unknown; email?: unknown }>)
      : [];
    const hit = users.find(
      (u) => String(u.email ?? "").toLowerCase() === target,
    );
    if (hit?.id) return String(hit.id);
    if (users.length < perPage) return null;
  }
  return null;
}

/**
 * Troca o e-mail da conta (dono, 20/11/2026; docs/EQUIPE_ACESSOS.md,
 * "Alterar e-mail do login"): a senha continua a mesma e o novo e-mail já
 * nasce confirmado. "missing": não há conta com o e-mail antigo (login que
 * nunca definiu senha); quem chama decide o que fazer.
 */
export async function supabaseChangeEmail(
  oldEmail: string,
  newEmail: string,
): Promise<"ok" | "missing"> {
  const { service } = env();
  const id = await supabaseUserIdByEmail(oldEmail);
  if (!id) return "missing";
  try {
    await call(`admin/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      key: service,
      body: JSON.stringify({ email: newEmail, email_confirm: true }),
    });
  } catch (error) {
    if (
      error instanceof SupabaseAuthError &&
      (error.status === 422 || error.code === "email_exists")
    )
      throw new Error("user_email_taken");
    throw error;
  }
  return "ok";
}
