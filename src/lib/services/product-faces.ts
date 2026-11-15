import "server-only";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";

/**
 * Código Wellmix (SKU) e foto principal de cada produto, para listas que
 * mostram o produto em miniatura (histórico de compras do cliente na Nova
 * solicitação; docs/ORDER_TERMS.md seção 12).
 */
export async function productFaces(
  ids: string[],
): Promise<Map<string, { sku: string | null; photoId: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, { sku: string | null; photoId: string | null }>();
  for (let i = 0; i < unique.length; i += 200) {
    const rows = await listColumns(
      getStore(),
      "products",
      ["sku", "primaryPhotoDocumentId"],
      { filter: { id: unique.slice(i, i + 200) } },
    );
    for (const p of rows)
      out.set(p.id, {
        sku: p.sku ?? null,
        photoId: p.primaryPhotoDocumentId ?? null,
      });
  }
  return out;
}
