import "server-only";
import { z } from "zod";
import {
  ENABLED_OPERATION_TYPES,
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
  CARRIER_CALLERS,
  countryAllowed,
  parseCarrierValue,
  type OrderTerms,
} from "@/lib/order-terms";
import { resolveCarrier } from "./delivery-carriers";
import {
  originCountryName,
  originFamily,
  productOrigin,
} from "./product-origin";

/*
 * Condições do pedido da Nova solicitação, no servidor (docs/ORDER_TERMS.md):
 * confere o que veio do formulário e se todos os produtos do catálogo são do
 * país e da família escolhidos.
 */

export class OrderTermsError extends Error {}

const RAW = z.object({
  operationType: z.enum(OPERATION_TYPES, { error: "order_terms_operation" }),
  saleFormat: z.enum(SALE_FORMATS, { error: "order_terms_format" }),
  wellmixTier: z.enum(WELLMIX_TIERS).nullable(),
  carrierCaller: z.enum(CARRIER_CALLERS, {
    error: "order_terms_carrier_caller",
  }),
  carrier: z.string().max(80).nullable(),
  redispatchCarrier: z.string().max(80).nullable(),
  redispatch: z.enum(["yes", "no"], { error: "order_terms_redispatch" }),
  originCountry: z.string().min(1, { error: "order_terms_origin" }).max(80),
  productFamily: z
    .string()
    .regex(/^(fm|sk|ln):[A-Za-z0-9_-]{1,64}$/, { error: "order_terms_origin" }),
});

export type OrderTermsInput = z.input<typeof RAW>;

/** Confere e completa (nomes) as condições vindas do formulário. */
export async function resolveOrderTerms(
  input: Record<string, string | null>,
): Promise<OrderTerms> {
  const parsed = RAW.safeParse({
    ...input,
    wellmixTier: input.wellmixTier || null,
    carrier: input.carrier || null,
    redispatchCarrier: input.redispatchCarrier || null,
  });
  if (!parsed.success)
    throw new OrderTermsError(
      parsed.error.issues[0]?.message?.startsWith("order_terms_")
        ? parsed.error.issues[0].message
        : "order_terms_invalid",
    );
  const raw = parsed.data;
  // Hoje só TS (dono, 15/11/2026): Venda aparece desabilitada.
  if (!ENABLED_OPERATION_TYPES.includes(raw.operationType))
    throw new OrderTermsError("order_terms_operation_disabled");
  if (raw.saleFormat === "wellmix" && !raw.wellmixTier)
    throw new OrderTermsError("order_terms_tier");
  // TS é importação: BRASIL não vale como país de origem.
  if (!countryAllowed(raw.operationType, raw.originCountry))
    throw new OrderTermsError("order_terms_country_disabled");
  // Quem chama o transportador (dono, 16/11/2026): a Wellmix escolhe aqui
  // a transportadora (e a do re-despacho, com Sim); o cliente informa as
  // dele na confirmação do pedido.
  const wellmixCalls = raw.carrierCaller === "wellmix";
  const redispatchRequired = raw.redispatch === "yes";
  if (wellmixCalls && !raw.carrier)
    throw new OrderTermsError("order_terms_carrier_required");
  if (wellmixCalls && redispatchRequired && !raw.redispatchCarrier)
    throw new OrderTermsError("order_terms_redispatch_carrier_required");
  const [carrier, redispatchCarrier, family, countryName] = await Promise.all([
    wellmixCalls && raw.carrier
      ? resolveCarrier(parseCarrierValue(raw.carrier))
      : null,
    wellmixCalls && redispatchRequired && raw.redispatchCarrier
      ? resolveCarrier(parseCarrierValue(raw.redispatchCarrier))
      : null,
    originFamily(raw.productFamily),
    originCountryName(raw.originCountry),
  ]);
  if (wellmixCalls && !carrier)
    throw new OrderTermsError("order_terms_carrier");
  if (wellmixCalls && redispatchRequired && !redispatchCarrier)
    throw new OrderTermsError("order_terms_carrier");
  if (!family) throw new OrderTermsError("order_terms_origin");
  return {
    operationType: raw.operationType,
    saleFormat: raw.saleFormat,
    wellmixTier: raw.saleFormat === "wellmix" ? raw.wellmixTier : null,
    carrierCaller: raw.carrierCaller,
    carrier: carrier ?? null,
    redispatch: redispatchCarrier ?? null,
    redispatchRequired,
    originCountry: raw.originCountry,
    originCountryName: countryName,
    productFamily: raw.productFamily,
    productFamilyName: family.name,
    noReturnsNotice: true,
    confirmation: null,
  };
}

/**
 * Todo produto do catálogo do pedido é do país e da família escolhidos
 * (dono, 15/11/2026: um pedido não mistura país nem família de produtos).
 * Produto fora do catálogo (sourcing) não tem cadastro para conferir.
 */
export async function assertProductsMatchOrigin(
  productIds: Array<string | null>,
  terms: Pick<OrderTerms, "originCountry" | "productFamily">,
): Promise<void> {
  for (const id of productIds) {
    if (!id) continue;
    const origin = await productOrigin(id);
    if (
      !origin ||
      origin.family !== terms.productFamily ||
      origin.country !== terms.originCountry
    )
      throw new OrderTermsError("order_terms_mismatch");
  }
}
