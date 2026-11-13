/*
 * Pedido de compra (docs/PURCHASE_ORDER.md, "Sequência e dependências"): o
 * contrato só começa com o NCM validado e a ficha mestre completa de cada
 * produto. Nos testes que seguem até o contrato, o cadastro e fiscal faz a
 * parte dele como nas telas: valida o NCM, preenche a ficha e sobe as cinco
 * fotos obrigatórias.
 *
 * Importe depois de `withTempStore()`.
 */
import type { User } from "@/lib/db";

const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "foto.png", {
    type: "image/png",
  });

export const SHEET_PHOTO_KINDS_REQUIRED = [
  "weight_scale",
  "dimension_scale",
  "dimension_side",
  "angle",
  "original",
] as const;

/** NCM validado na tela fiscal (a classificação vira a do produto). */
export async function validateNcm(admin: User, productId: string) {
  const { getStore } = await import("@/lib/db");
  const taxes = await import("@/lib/services/taxes");
  const product = (await getStore().get("products", productId))!;
  const row = await taxes.addTaxCandidate(admin, productId, {
    ncm: product.ncm ?? "7013.37.00",
    source: "manual",
  });
  await taxes.validateTaxClassification(admin, row.id);
}

/** Ficha mestre completa: os campos obrigatórios e as cinco fotos. */
export async function completeSheet(admin: User, productId: string) {
  const { saveProductSheet } = await import("@/lib/services/product-sheet");
  const { addPhotos } = await import("@/lib/services/sourcing");
  for (const kind of SHEET_PHOTO_KINDS_REQUIRED)
    await addPhotos(admin, { productId }, [png()], kind);
  await saveProductSheet(admin, productId, {
    supplierName: "Shenzhen Supplier A",
    incoterm: "FOB",
    currency: "USD",
    price: 1.25,
    moq: 1000,
    masterCartonQty: 48,
    netWeightPcKg: 0.3,
    grossWeightPcKg: 0.35,
    cbmPerCarton: 0.12,
    packageType: "color box",
    colorAssortment: "transparente",
    material: "vidro",
  });
}

/** NCM e ficha de uma vez (o produto pronto para o contrato). */
export async function readyProduct(admin: User, productId: string) {
  await validateNcm(admin, productId);
  await completeSheet(admin, productId);
  const { refreshGatesForProduct } =
    await import("@/lib/services/purchase-gates");
  await refreshGatesForProduct(productId, admin);
}

/** Todos os produtos de um pedido prontos para o contrato. */
export async function readyOrderProducts(admin: User, orderId: string) {
  const { getStore } = await import("@/lib/db");
  const items = await getStore().list("order_items", { filter: { orderId } });
  for (const id of new Set(items.map((i) => i.productId).filter(Boolean)))
    await readyProduct(admin, id!);
}
