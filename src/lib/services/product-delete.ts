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

/* ---- Excluir definitivamente ---- */

/** Tabelas em que o produto é histórico: com qualquer linha, ele não sai de vez. */
const HISTORY_TABLES = [
  "requests",
  "order_items",
  "purchase_snapshots",
  "container_items",
  "packaging_briefs",
] as const;

/** O que é só do cadastro do produto e sai junto com ele. */
const OWNED_TABLES = [
  "product_variants",
  "product_suppliers",
  "manufacturer_cards",
  "purchase_schedules",
  "tax_classifications",
  "marketing_kits",
  "cart_items",
] as const;

async function safeList<
  K extends Parameters<ReturnType<typeof getStore>["list"]>[0],
>(table: K, filter: Record<string, unknown>, limit?: number) {
  try {
    return await getStore().list(table, {
      filter,
      ...(limit ? { limit } : {}),
    } as never);
  } catch (error) {
    const { isSchemaMissing } = await import("./packaging-brief");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Por que o produto não pode sair de vez (nulo = pode). */
export async function purgeBlocker(productId: string): Promise<string | null> {
  for (const table of HISTORY_TABLES) {
    if ((await safeList(table, { productId }, 1)).length) return table;
  }
  // Fichas de cotação/pedido do produto (a ficha mestre tem orderId = productId).
  const sheets = await safeList("purchase_sheets", { productId });
  if (sheets.some((s) => (s as { orderId: string }).orderId !== productId))
    return "purchase_sheets";
  return null;
}

/**
 * Apaga de vez produtos já excluídos (inativos) que nunca entraram em
 * solicitação, pedido, estoque ou embalagem: o produto, as variações, a ficha
 * mestre, fotos e documentos do cadastro (com os arquivos), fornecedores,
 * cartões, programações, NCM, kits e itens de carrinho. Com histórico, o
 * produto fica (excluído) e conta como pulado. Só admin.
 */
export async function purgeProducts(
  user: User,
  ids: string[],
): Promise<{ purged: number; blocked: number; skipped: number }> {
  const { isAdmin } = await import("@/lib/auth/permissions");
  const { ForbiddenError } = await import("@/lib/auth/permissions");
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const unique = [...new Set(ids)].slice(0, MAX);
  const rows = unique.length
    ? await store.list("products", { filter: { id: unique } })
    : [];
  let purged = 0;
  let blocked = 0;
  for (const product of rows) {
    if (product.active) continue;
    if (await purgeBlocker(product.id)) {
      blocked++;
      continue;
    }
    // Documentos (fotos e anexos do cadastro) com os arquivos.
    const photos = await safeList("product_photos", { productId: product.id });
    const docs = await safeList("documents", { productId: product.id });
    const docIds = new Set<string>([
      ...docs.map((d) => (d as { id: string }).id),
      ...photos.map((p) => (p as { documentId: string }).documentId),
    ]);
    for (const p of photos)
      await store.remove("product_photos", (p as { id: string }).id);
    for (const id of docIds) {
      const doc = await store.get("documents", id);
      if (!doc) continue;
      await store.remove("documents", doc.id);
      await store.removeFile(doc.storageKey).catch(() => undefined);
    }
    for (const table of OWNED_TABLES) {
      for (const row of await safeList(table, { productId: product.id }))
        await store.remove(table, (row as { id: string }).id);
    }
    for (const sheet of await safeList("purchase_sheets", {
      orderId: product.id,
    }))
      await store.remove("purchase_sheets", (sheet as { id: string }).id);
    // Item de sourcing que virou este produto: fica, sem o vínculo.
    for (const item of await safeList("sourcing_items", {
      productId: product.id,
    }))
      await store.update("sourcing_items", (item as { id: string }).id, {
        productId: null,
      });
    await store.remove("products", product.id);
    await audit(
      user,
      "product.purge",
      "product",
      product.id,
      `Produto excluído definitivamente: ${product.name}`,
      { name: product.name, sku: product.sku, lineId: product.lineId },
      null,
    );
    purged++;
  }
  return { purged, blocked, skipped: unique.length - purged - blocked };
}
