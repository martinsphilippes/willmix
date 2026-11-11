"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { requireUser, str } from "./helpers";

const BACK = "/app/settings/supabase";

/**
 * Cópia Appwrite → Supabase: um lote de ~40 s (ou "até o fim": a tela
 * reenvia sozinha enquanto faltar). Só o administrador.
 */
export async function runSupabaseCopyAction(form: FormData) {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  const auto = str(form, "auto") === "1";
  let target: string;
  try {
    const { runCopy } = await import("@/lib/services/supabase-copy");
    const progress = await runCopy(user);
    const done = progress.phase === "done";
    target = `${BACK}?ran=${done ? "done" : "partial"}${auto && !done ? "&auto=1" : ""}`;
  } catch (error) {
    console.error("[supabase-copy]", error);
    target = `${BACK}?error=${encodeURIComponent(
      String((error as Error).message ?? error).slice(0, 300),
    )}`;
  }
  redirect(target);
}

/** Recomeça do zero (esvazia as tabelas do Supabase), com a palavra. */
export async function resetSupabaseCopyAction(form: FormData) {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  const confirm = z.string().max(20).parse(str(form, "confirm"));
  let target = `${BACK}?reset=1`;
  try {
    const { resetCopy } = await import("@/lib/services/supabase-copy");
    await resetCopy(user, confirm);
  } catch (error) {
    target = `${BACK}?error=${encodeURIComponent(
      String((error as Error).message ?? error).slice(0, 300),
    )}`;
  }
  redirect(target);
}
