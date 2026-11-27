"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorCode, invalidFieldNames, requireUser, run, str } from "./helpers";

/*
 * Cadastrar produto (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md): gravar
 * o rascunho, cadastrar o produto no portal (e enviar ao Sankhya) e reenviar
 * ao Sankhya. As regras ficam no serviço (src/lib/services/product-registration.ts).
 *
 * O rascunho é gravado antes de tudo: com qualquer recusa, o que foi
 * digitado volta na tela (o formulário é grande demais para se perder).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const LIST = "/app/product-registration";

/** Os campos do formulário (nome "f.<campo>"). */
function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries())
    if (key.startsWith("f.") && typeof value === "string")
      out[key.slice(2)] = value;
  return out;
}

function itemIds(form: FormData): string[] {
  return z
    .array(ID)
    .max(60)
    .parse(
      form.getAll("itemIds").filter((v): v is string => typeof v === "string"),
    );
}

const withParams = (target: string, params: Record<string, string>) => {
  const url = new URL(target, "http://x");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.pathname + url.search + url.hash;
};

export async function registrationAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success ? `${LIST}/${raw}` : LIST;
  const intent = z
    .enum(["draft", "register", "send", "similarPick", "similarApply"])
    .catch("draft")
    .parse(str(form, "intent"));
  let target = back;
  let anchor = "#cadastro";
  try {
    const id = ID.parse(raw);
    const svc = await import("@/lib/services/product-registration");
    const values = formValues(form);
    await svc.saveRegistrationDraft(user, id, values);
    if (intent === "draft")
      target = withParams(back, { registration: "saved" });
    else if (intent === "similarPick") {
      // "É semelhante a algum do catálogo?" (dono, 27/11/2026): com o
      // rascunho gravado, abre o quadro dos campos a trazer.
      const similar = ID.parse(str(form, "similarId"));
      target = withParams(back, { similar });
      anchor = "#semelhante";
    } else if (intent === "similarApply") {
      const similar = ID.parse(str(form, "similarId"));
      const fields = z
        .array(z.string().regex(/^[A-Za-z]{1,40}$/))
        .max(120)
        .parse(
          form
            .getAll("similarField")
            .filter((v): v is string => typeof v === "string"),
        );
      const n = await svc.applySimilarProduct(
        user,
        id,
        values,
        similar,
        fields,
      );
      target = withParams(back, { similarApplied: String(n) });
    } else if (intent === "register") {
      const result = await svc.registerProduct(user, id, values, itemIds(form));
      target = withParams(back, { product: "created", erp: result.send });
    } else {
      const sent = await svc.sendRegistration(user, id, values);
      target = withParams(back, { erp: sent });
    }
  } catch (error) {
    const { ProductRegistrationError } =
      await import("@/lib/services/product-registration");
    const fields =
      error instanceof ProductRegistrationError
        ? error.fields
        : invalidFieldNames(error);
    target = withParams(back, {
      error: errorCode(back, error),
      ...(fields.length
        ? { fields: fields.slice(0, 20).join(","), at: String(Date.now()) }
        : {}),
    });
  }
  revalidatePath("/app", "layout");
  redirect(`${target}${target.includes("error=") ? "#cadastro" : anchor}`);
}

/** Lê de novo as listas do Sankhya (grupos, linha, embalagem, unidades...). */
export async function refreshRegistrationListsAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success ? `${LIST}/${raw}` : LIST;
  await run(`${back}#campos-sankhya`, async () => {
    const svc = await import("@/lib/services/product-registration");
    svc.assertRegistration(user);
    const { registrationLookups } =
      await import("@/lib/services/sankhya-lookups");
    await registrationLookups({ refresh: true });
    return withParams(back, { lists: "1" }) + "#campos-sankhya";
  });
}

/** Tabela de cada lista ("TABELA.CODIGO.NOME"), escolhida pelo administrador. */
export async function saveRegistrationListSourcesAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success ? `${LIST}/${raw}` : LIST;
  await run(`${back}#campos-sankhya`, async () => {
    const svc = await import("@/lib/services/product-registration");
    svc.assertRegistration(user);
    const sources: Record<string, string> = {};
    for (const [key, value] of form.entries())
      if (key.startsWith("source.") && typeof value === "string")
        sources[key.slice(7)] = value;
    const lookups = await import("@/lib/services/sankhya-lookups");
    await lookups.saveLookupSources(user, sources);
    await lookups.registrationLookups({ refresh: true });
    return withParams(back, { lists: "1" }) + "#campos-sankhya";
  });
}

/** Lê de novo os campos da TGFPRO no dicionário do Sankhya. */
export async function loadRegistrationDictionaryAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success ? `${LIST}/${raw}` : LIST;
  await run(`${back}#campos-sankhya`, async () => {
    const svc = await import("@/lib/services/product-registration");
    const dictionary = await svc.loadProductDictionary(user);
    return (
      withParams(back, { dictionary: String(dictionary.fields.length) }) +
      "#campos-sankhya"
    );
  });
}

/** De-para escolhido pelo administrador (coluna da TGFPRO por campo). */
export async function saveRegistrationFieldMapAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success ? `${LIST}/${raw}` : LIST;
  await run(`${back}#campos-sankhya`, async () => {
    const map: Record<string, string> = {};
    for (const [key, value] of form.entries())
      if (key.startsWith("map.") && typeof value === "string")
        map[key.slice(4)] = value;
    const svc = await import("@/lib/services/product-registration");
    await svc.saveFieldOverrides(user, map);
    return withParams(back, { map: "saved" }) + "#campos-sankhya";
  });
}
