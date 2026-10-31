import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError, type z } from "zod";
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

/**
 * Fotos que o navegador já subiu direto ao armazenamento (lote grande demais
 * para a requisição): ids no formato do Appwrite, no máximo 12 por envio.
 */
export function uploadedPhotoKeys(form: FormData): string[] {
  return (
    form
      .getAll("uploadedPhotoId")
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      // Ids do Appwrite (ID.unique()): letras, números, "_" e "-"; nada de "." ou "/".
      .filter((v) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v))
      .slice(0, 12)
  );
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
            (/unknown attribute|missing required attribute/i.test(
              error.message,
            ) ||
              /^(table|collection) with the requested id\b.*could not be found/i.test(
                error.message,
              ) ||
              [
                "table_not_found",
                "collection_not_found",
                "column_not_found",
                "attribute_not_found",
              ].includes(String((error as { type?: unknown }).type ?? "")))
          ? // Coluna ou tabela nova ainda não publicada no Appwrite (esquema desatualizado).
            "schema_outdated"
          : "unexpected";
  if (code === "unexpected") console.error("[action]", back, error);
  return code.slice(0, 60);
}

/**
 * Nomes dos campos que a validação recusou, quando se sabe (objeto validado
 * com zod ou campo lido com `field()`): a tela aponta e leva até cada um, em
 * vez de só "algum campo tem valor inválido".
 */
export function invalidFieldNames(error: unknown): string[] {
  if (!(error instanceof ZodError)) return [];
  const names = error.issues
    .map((issue) => issue.path[0])
    .filter(
      (k): k is string =>
        typeof k === "string" && /^[A-Za-z][A-Za-z0-9_.]{0,59}$/.test(k),
    );
  return [...new Set(names)].slice(0, 20);
}

/**
 * Um campo do formulário validado com zod; a recusa leva o nome do campo
 * (a tela diz qual é), como a validação de um objeto.
 */
export function field<T>(form: FormData, key: string, schema: z.ZodType<T>): T {
  const result = schema.safeParse(str(form, key));
  if (result.success) return result.data;
  throw new ZodError(
    result.error.issues.map((issue) => ({
      ...issue,
      path: [key, ...issue.path],
    })),
  );
}

function withError(back: string, code: string, fields: string[] = []) {
  const url = new URL(back, "http://x");
  url.searchParams.set("error", code);
  if (fields.length) {
    url.searchParams.set("fields", fields.join(","));
    // Cada recusa remonta o aviso e leva de novo ao campo.
    url.searchParams.set("at", String(Date.now()));
  }
  // Mantém a âncora (ex.: #photos): o aviso aparece onde a pessoa está.
  return url.pathname + url.search + url.hash;
}

/** Executa a ação e volta para `back` com ?error=<código> em caso de falha. */
export async function run(back: string, fn: () => Promise<string | void>) {
  let target = back;
  try {
    const result = await fn();
    if (result) target = result;
  } catch (error) {
    target = withError(back, errorCode(back, error), invalidFieldNames(error));
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
    failed = withError(back, errorCode(back, error), invalidFieldNames(error));
  }
  revalidatePath("/app", "layout");
  if (failed) redirect(failed);
}

/** Acrescenta ?chave=valor a um caminho do portal, antes da âncora (#...). */
export function withQuery(target: string, key: string, value: string): string {
  const url = new URL(target, "http://x");
  url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}

/**
 * Campos da embalagem no formulário da RFQ (uma solicitação ou o lote): quem
 * faz a faca e a arte ("wellmix" = marketing da Wellmix; vazio = cadeia
 * padrão), se o briefing abre agora e as instruções à agência.
 */
export function packagingOptionsFrom(form: FormData): {
  agencyId?: string | null;
  enabled?: boolean;
  brief?: string | null;
} {
  if (!form.has("packagingForm")) return {};
  const owner = str(form, "packagingOwner");
  if (owner && owner !== "wellmix" && !/^[A-Za-z0-9_-]{1,64}$/.test(owner))
    throw new Error("no_agency");
  const brief = str(form, "packagingBrief");
  if (brief.length > 2000) throw new Error("invalid_input");
  return {
    agencyId: owner === "" ? undefined : owner === "wellmix" ? null : owner,
    enabled: form.get("packagingEnabled") === "on",
    brief: brief || null,
  };
}
