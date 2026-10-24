import "server-only";

import { getStore, type User } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Excluir produtos do cadastro em lote. "Excluir" desativa (active = false):
 * o produto some do cadastro, da vitrine e da nova solicitação, mas
 * solicitações, pedidos, fichas e fotos continuam como estão (histórico e
 * evolução aditiva). Restaurar volta a ativar.
 */

const MAX = 500;

export async function setProductsActive(
  user: User,
  ids: string[],
  active: boolean,
): Promise<{ changed: number; skipped: number }> {
  assertWellmix(user);
  const store = getStore();
  const unique = [...new Set(ids)].slice(0, MAX);
  const rows = unique.length
    ? await store.list("products", { filter: { id: unique } })
    : [];
  let changed = 0;
  for (const product of rows) {
    if (product.active === active) continue;
    await store.update("products", product.id, { active });
    await audit(
      user,
      active ? "product.restore" : "product.delete",
      "product",
      product.id,
      `${active ? "Produto restaurado" : "Produto excluído"}: ${product.name}`,
      { active: product.active },
      { active },
    );
    changed++;
  }
  return { changed, skipped: unique.length - changed };
}
