"use server";

import { z } from "zod";
import { requireUser, run } from "./helpers";

/*
 * Cadastros → Produtos: excluir (desativar) e restaurar vários de uma vez.
 * Só a Wellmix (o serviço confere).
 */

const idsSchema = z
  .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
  .min(1)
  .max(500);

function ids(form: FormData) {
  return idsSchema.parse(
    form.getAll("ids").filter((v): v is string => typeof v === "string"),
  );
}

export async function deleteProductsAction(form: FormData) {
  const user = await requireUser();
  await run("/app/products", async () => {
    const { setProductsActive } = await import("@/lib/services/product-delete");
    const { changed } = await setProductsActive(user, ids(form), false);
    if (changed === 0) throw new Error("nothing_deleted");
    return `/app/products?deleted=${changed}`;
  });
}

export async function restoreProductsAction(form: FormData) {
  const user = await requireUser();
  await run("/app/products?view=deleted", async () => {
    const { setProductsActive } = await import("@/lib/services/product-delete");
    const { changed } = await setProductsActive(user, ids(form), true);
    if (changed === 0) throw new Error("nothing_restored");
    return `/app/products?restored=${changed}`;
  });
}

export async function purgeProductsAction(form: FormData) {
  const user = await requireUser();
  await run("/app/products?view=deleted", async () => {
    const { purgeProducts } = await import("@/lib/services/product-delete");
    const { purged, blocked } = await purgeProducts(user, ids(form));
    if (purged === 0 && blocked > 0) throw new Error("purge_blocked");
    if (purged === 0) throw new Error("nothing_purged");
    return `/app/products?view=deleted&purged=${purged}${blocked ? `&blocked=${blocked}` : ""}`;
  });
}
