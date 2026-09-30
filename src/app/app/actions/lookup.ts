"use server";

import { z } from "zod";
import { isWellmix } from "@/lib/auth/permissions";
import { runProductLookup } from "@/lib/services/product-lookup";
import { files, requireUser, run, str } from "./helpers";

/*
 * Nova solicitação: busca do produto por foto ou link. Cliente e Wellmix.
 * O resultado (produtos do catálogo e sugestões por campo) volta na própria
 * tela por ?lookup=<id>; nada é preenchido sem a escolha da pessoa.
 */
export async function lookupProductAction(form: FormData) {
  const user = await requireUser();
  const customerId = isWellmix(user) ? str(form, "customerId") : "";
  const back = `/app/requests/new${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ""}`;
  await run(back, async () => {
    if (!(isWellmix(user) || user.role === "customer"))
      throw new Error("forbidden");
    const url = str(form, "url");
    if (url && !z.string().url().max(2000).safeParse(url).success)
      throw new Error("lookup_invalid_url");
    const [photo] = files(form, "photo");
    const row = await runProductLookup(user, {
      file: photo ?? null,
      url: url || null,
      customerId: customerId || null,
    });
    const params = new URLSearchParams({ lookup: row.id });
    if (customerId) params.set("customerId", customerId);
    return `/app/requests/new?${params.toString()}#lookup`;
  });
}
