"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dataMode } from "@/lib/env";
import { loginToEmail } from "@/lib/auth/login-id";

/*
 * Esqueci minha senha (Supabase Auth; docs/SUPABASE.md). Públicas: a pessoa
 * ainda não entrou. O Supabase manda o e-mail com o link e limita os pedidos;
 * a resposta é a mesma exista o e-mail ou não.
 */

const MIN_PASSWORD = 8;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function requestPasswordResetAction(form: FormData) {
  if (dataMode() !== "supabase") redirect("/login/forgot?error=unavailable");
  const raw = z.string().trim().min(3).max(254).safeParse(form.get("email"));
  const email = raw.success ? loginToEmail(raw.data) : null;
  if (!email) redirect("/login/forgot?error=invalid");
  let target = "/login/forgot?sent=1";
  try {
    const { supabaseSendRecovery } = await import("@/lib/auth/supabase-auth");
    await supabaseSendRecovery(email, `${await origin()}/login/reset`);
  } catch (error) {
    const status = (error as { status?: number }).status;
    // Muitos pedidos seguidos: o Supabase segura (e não é a senha da pessoa).
    if (status === 429) target = "/login/forgot?error=rate";
    else console.error("[password-reset] recover", status ?? error);
  }
  redirect(target);
}

const setSchema = z
  .object({
    token: z.string().min(20).max(4000),
    password: z.string().min(MIN_PASSWORD).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

/** Nova senha com o token do link do e-mail (lido no navegador). */
export async function setNewPasswordAction(input: {
  token: string;
  password: string;
  confirm: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (dataMode() !== "supabase") return { ok: false, error: "unavailable" };
  const parsed = setSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.path[0] === "confirm" ? "mismatch" : "short",
    };
  try {
    const { supabaseSetPassword } = await import("@/lib/auth/supabase-auth");
    await supabaseSetPassword(parsed.data.token, parsed.data.password);
    return { ok: true };
  } catch (error) {
    const status = (error as { status?: number }).status;
    return {
      ok: false,
      error: status === 401 || status === 403 ? "expired" : "failed",
    };
  }
}
