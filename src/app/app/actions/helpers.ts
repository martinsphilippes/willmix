import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/db";

/*
 * Utilitários compartilhados pelas Server Actions (src/app/app/actions.ts e
 * src/app/app/actions/*.ts). Este arquivo NÃO é "use server": só ajuda.
 */

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function num(form: FormData, key: string) {
  const v = str(form, key).replace(",", ".");
  return v === "" ? null : Number(v);
}

/** Arquivos enviados num campo (ignora vazios). */
export function files(form: FormData, key: string): File[] {
  return form
    .getAll(key)
    .filter((f): f is File => f instanceof File && f.size > 0);
}

const ERROR_CODE = /^[a-z][a-z0-9_]{1,59}$/;

/** Executa a ação e volta para `back` com ?error=<código> em caso de falha. */
export async function run(back: string, fn: () => Promise<string | void>) {
  let target = back;
  try {
    const result = await fn();
    if (result) target = result;
  } catch (error) {
    // Só códigos (snake_case) vão para a tela; falha técnica vira "unexpected"
    // e o detalhe fica no log do servidor.
    const code =
      error instanceof ZodError
        ? "invalid_input"
        : error instanceof Error && ERROR_CODE.test(error.message)
          ? error.message
          : "unexpected";
    if (code === "unexpected") console.error("[action]", back, error);
    const url = new URL(back, "http://x");
    url.searchParams.set("error", code.slice(0, 60));
    target = url.pathname + url.search;
  }
  revalidatePath("/app", "layout");
  redirect(target);
}
