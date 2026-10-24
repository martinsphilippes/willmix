"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { num, requireUser, run, str } from "./helpers";

/*
 * Variações de produto (seção "Variações" do cadastro). Tudo só Wellmix; o
 * serviço (services/product-variants.ts) confere de novo e, depois de cada
 * gravação, o produto e a ficha mestre passam a espelhar a variação de
 * referência (`syncProductFromVariants`).
 */

const ID = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().max(max).nullable();
const optionalNumber = z.number().finite().nonnegative().nullable();
const optionalInt = z.number().int().nonnegative().nullable();

const variantSchema = z.object({
  name: z.string().min(1).max(160),
  factoryItemCode: optionalText(60),
  sizeText: optionalText(60),
  price: optionalNumber,
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .nullable(),
  moq: optionalInt,
  masterBoxQty: optionalInt,
  innerBoxQty: optionalInt,
  netWeightKg: optionalNumber,
  grossWeightKg: optionalNumber,
  lengthCm: optionalNumber,
  widthCm: optionalNumber,
  heightCm: optionalNumber,
  cbm: optionalNumber,
  colorAssortment: optionalText(200),
  material: optionalText(200),
  packageType: optionalText(120),
  capacityMl: optionalNumber,
  notes: optionalText(4000),
  sortOrder: optionalInt,
});

function variantFrom(form: FormData) {
  const text = (key: string) => str(form, key) || null;
  return variantSchema.parse({
    name: str(form, "name"),
    factoryItemCode: text("factoryItemCode"),
    sizeText: text("sizeText"),
    price: num(form, "price"),
    currency: text("currency"),
    moq: num(form, "moq"),
    masterBoxQty: num(form, "masterBoxQty"),
    innerBoxQty: num(form, "innerBoxQty"),
    netWeightKg: num(form, "netWeightKg"),
    grossWeightKg: num(form, "grossWeightKg"),
    lengthCm: num(form, "lengthCm"),
    widthCm: num(form, "widthCm"),
    heightCm: num(form, "heightCm"),
    cbm: num(form, "cbm"),
    colorAssortment: text("colorAssortment"),
    material: text("material"),
    packageType: text("packageType"),
    capacityMl: num(form, "capacityMl"),
    notes: text("notes"),
    sortOrder: num(form, "sortOrder"),
  });
}

const back = (productId: string) =>
  `/app/products/${encodeURIComponent(productId)}`;
/** Erro volta para a seção Variações (from=variants), onde a pessoa está. */
const backError = (productId: string) =>
  `${back(productId)}?from=variants#variants`;

/** Cria (sem `variantId`) ou edita (com `variantId`) uma variação do produto. */
export async function saveProductVariantAction(form: FormData) {
  const user = await requireUser();
  const productId = ID.parse(str(form, "productId"));
  await run(backError(productId), async () => {
    assertWellmix(user);
    const variantId = str(form, "variantId") || null;
    const input = variantFrom(form);
    const svc = await import("@/lib/services/product-variants");
    if (variantId) {
      const current = await svc.getProductVariant(ID.parse(variantId));
      if (!current || current.productId !== productId)
        throw new Error("variant_not_found");
      await svc.updateProductVariant(user, current.id, input);
    } else {
      await svc.upsertProductVariant(user, productId, input);
    }
    await svc.syncProductFromVariants(productId, user);
    return `${back(productId)}?variants=${variantId ? "saved" : "added"}#variants`;
  });
}

/** Desativa ou reativa a variação (nunca apaga). */
export async function toggleProductVariantAction(form: FormData) {
  const user = await requireUser();
  const productId = ID.parse(str(form, "productId"));
  await run(backError(productId), async () => {
    assertWellmix(user);
    const variantId = ID.parse(str(form, "variantId"));
    const active = str(form, "active") === "1";
    const svc = await import("@/lib/services/product-variants");
    const current = await svc.getProductVariant(variantId);
    if (!current || current.productId !== productId)
      throw new Error("variant_not_found");
    await svc.setProductVariantActive(user, variantId, active);
    await svc.syncProductFromVariants(productId, user);
    return `${back(productId)}?variants=toggled#variants`;
  });
}
