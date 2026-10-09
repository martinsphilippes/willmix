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

/**
 * Só códigos (snake_case) vão para a tela; falha técnica vira "unexpected" e o
 * detalhe fica no log do servidor.
 */
export function errorCode(back: string, error: unknown) {
  const code =
    error instanceof ZodError
      ? "invalid_input"
      : error instanceof Error && ERROR_CODE.test(error.message)
        ? error.message
        : error instanceof Error &&
            (/unknown attribute/i.test(error.message) ||
              /^(table|collection) with the requested id\b.*could not be found/i.test(
                error.message,
              ) ||
              ["table_not_found", "collection_not_found"].includes(
                String((error as { type?: unknown }).type ?? ""),
              ))
          ? // Coluna ou tabela nova ainda não publicada no Appwrite (esquema desatualizado).
            "schema_outdated"
          : "unexpected";
  if (code === "unexpected") console.error("[action]", back, error);
  return code.slice(0, 60);
}

function withError(back: string, code: string) {
  const url = new URL(back, "http://x");
  url.searchParams.set("error", code);
  return url.pathname + url.search;
}

/** Executa a ação e volta para `back` com ?error=<código> em caso de falha. */
export async function run(back: string, fn: () => Promise<string | void>) {
  let target = back;
  try {
    const result = await fn();
    if (result) target = result;
  } catch (error) {
    target = withError(back, errorCode(back, error));
  }
  revalidatePath("/app", "layout");
  redirect(target);
}

/**
 * Executa a ação e fica na mesma tela: a página é atualizada no lugar, sem
 * navegar, e o que o usuário digitou em outros formulários não se perde (ex.:
 * foto da ficha enquanto os campos ainda não foram salvos). Só o erro volta
 * para `back` com ?error=<código>.
 */
export async function runInPlace(back: string, fn: () => Promise<void>) {
  let failed: string | null = null;
  try {
    await fn();
  } catch (error) {
    failed = withError(back, errorCode(back, error));
  }
  revalidatePath("/app", "layout");
  if (failed) redirect(failed);
}
