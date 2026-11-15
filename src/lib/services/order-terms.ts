import "server-only";
import { z } from "zod";
import { getStore } from "@/lib/db";
import {
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
  parseCarrierValue,
  type OrderTerms,
} from "@/lib/order-terms";
import { resolveCarrier } from "./delivery-carriers";
import { originCountryName, productOrigin } from "./product-origin";

/*
 * Condições do pedido da Nova solicitação, no servidor (docs/ORDER_TERMS.md):
 * confere o que veio do formulário e se todos os produtos do catálogo são do
 * país e do grupo escolhidos.
 */

export class OrderTermsError extends Error {}

const RAW = z.object({
  operationType: z.enum(OPERATION_TYPES, { error: "order_terms_operation" }),
  saleFormat: z.enum(SALE_FORMATS, { error: "order_terms_format" }),
  wellmixTier: z.enum(WELLMIX_TIERS).nullable(),
  carrier: z.string().max(80),
  redispatch: z.string().max(80),
  originSet: z.literal("1", { error: "order_terms_origin" }),
  originCountry: z.string().max(80),
  productLineId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, { error: "order_terms_origin" }),
});

export type OrderTermsInput = z.input<typeof RAW>;

/** Confere e completa (nomes) as condições vindas do formulário. */
export async function resolveOrderTerms(
  input: Record<string, string | null>,
): Promise<OrderTerms> {
  const parsed = RAW.safeParse({
    ...input,
    wellmixTier: input.wellmixTier || null,
  });
  if (!parsed.success)
    throw new OrderTermsError(
      parsed.error.issues[0]?.message?.startsWith("order_terms_")
        ? parsed.error.issues[0].message
        : "order_terms_invalid",
    );
  const raw = parsed.data;
  if (raw.saleFormat === "wellmix" && !raw.wellmixTier)
    throw new OrderTermsError("order_terms_tier");
  const pick = async (value: string) => {
    if (!value) return null;
    const choice = await resolveCarrier(parseCarrierValue(value));
    if (!choice) throw new OrderTermsError("order_terms_carrier");
    return choice;
  };
  const [carrier, redispatch, line, countryName] = await Promise.all([
    pick(raw.carrier),
    pick(raw.redispatch),
    getStore().get("product_lines", raw.productLineId),
    originCountryName(raw.originCountry),
  ]);
  if (!line) throw new OrderTermsError("order_terms_origin");
  return {
    operationType: raw.operationType,
    saleFormat: raw.saleFormat,
    wellmixTier: raw.saleFormat === "wellmix" ? raw.wellmixTier : null,
    carrier,
    redispatch,
    originCountry: raw.originCountry,
    originCountryName: countryName,
    productLineId: line.id,
    productLineName: line.name,
    noReturnsNotice: true,
  };
}

/**
 * Todo produto do catálogo do pedido é do país e do grupo escolhidos (dono,
 * 15/11/2026: um pedido não mistura país nem família de produtos). Produto
 * fora do catálogo (sourcing) não tem cadastro para conferir.
 */
export async function assertProductsMatchOrigin(
  productIds: Array<string | null>,
  terms: Pick<OrderTerms, "originCountry" | "productLineId">,
): Promise<void> {
  for (const id of productIds) {
    if (!id) continue;
    const origin = await productOrigin(id);
    if (
      !origin ||
      origin.lineId !== terms.productLineId ||
      origin.country !== terms.originCountry
    )
      throw new OrderTermsError("order_terms_mismatch");
  }
}
