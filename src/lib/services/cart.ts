import "server-only";

import type { Translate } from "@/i18n";
import {
  getStore,
  type CartItem,
  type Product,
  type ProductVariant,
  type Request,
  type User,
} from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/permissions";
import { effectiveMoq } from "@/lib/moq";
import { audit } from "./audit";
import { getProductSheet } from "./product-sheet";
import type { CatalogEstimate } from "./catalog-price-calc";
import {
  canBuyOnStorefront,
  estimateForQuantities,
  lineKey,
  specificationLines,
  variantSpecificationLines,
} from "./catalog-explore";
import { catalogShowcasePhotos } from "./documents";
import {
  getProductVariant,
  listProductVariants,
  variantsByProduct,
} from "./product-variants";
import { createRequestBatch, type RequestBatchItem } from "./requests";

/*
 * Carrinho da vitrine: um item por produto (e por variação, no produto com
 * variações), por login do cliente. Só o cliente mexe no próprio carrinho (a
 * Wellmix vê a vitrine, mas não compra por ele aqui), e só com "Cliente pode
 * criar solicitação" ligado. Enviar o carrinho cria uma solicitação de
 * orçamento por item, todas no mesmo lote, pelo mesmo caminho da tela de
 * solicitação; os itens enviados saem do carrinho.
 *
 * Variações (docs/PRODUCT_VARIANTS.md, regra 1): produto com variações ativas
 * exige a variação (`cart_variant_required`), que tem de ser dele e estar
 * ativa (`cart_variant_invalid`); o mínimo é o da variação; a solicitação
 * nasce com "Produto · Variação" no nome e o `variantId`.
 */

/** Teto de unidades por item (evita número absurdo digitado por engano). */
export const CART_MAX_QUANTITY = 10_000_000;
/** Teto de itens no carrinho (um lote grande demais vira várias solicitações). */
export const CART_MAX_ITEMS = 50;
/** Observação de cada item (personalização) e do envio. */
export const CART_NOTES_MAX = 500;
export const CHECKOUT_NOTES_MAX = 2000;

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  category: string | null;
  photo: string | null;
  quantity: number;
  notes: string | null;
  moq: number | null;
  /**
   * Abaixo do pedido mínimo (item de antes da regra, ou mínimo aumentado
   * depois): a tela avisa e qualquer mudança de quantidade só vale a partir
   * do mínimo.
   */
  belowMoq: boolean;
  /** Preço estimado por unidade para esta quantidade. */
  estimate: CatalogEstimate;
  /** Valor estimado da quantidade inteira (null sem preço). */
  subtotal: number | null;
  /** Produto saiu do catálogo depois de entrar no carrinho. */
  unavailable: boolean;
  /** Variação escolhida (produto com variações); nula nas linhas sem variação. */
  variantId: string | null;
  variantName: string | null;
  /**
   * A variação saiu ou foi desativada (ou o produto ganhou variações depois
   * e a linha não tem uma): a tela avisa e o envio deixa a linha de fora.
   */
  variantUnavailable: boolean;
}

export interface CartView {
  lines: CartLine[];
  /** Soma dos subtotais com preço. */
  estimatedTotal: number;
  /** Todos os itens têm preço estimado (o total vale para o carrinho todo). */
  complete: boolean;
  /** Algum item tem preço (sem nenhum, não há total a mostrar). */
  anyPriced: boolean;
}

async function assertBuyer(user: User): Promise<string> {
  if (user.role !== "customer" || !user.partyId) throw new ForbiddenError();
  // Desligado nas Configurações: o cliente só vê o catálogo.
  if (!(await canBuyOnStorefront(user))) throw new Error("cart_disabled");
  return user.partyId;
}

function validQuantity(quantity: number): number {
  const q = Math.round(quantity);
  if (!Number.isFinite(q) || q < 1 || q > CART_MAX_QUANTITY)
    throw new Error("cart_quantity_invalid");
  return q;
}

/**
 * O pedido mínimo vale: abaixo dele, não entra (a tela já não deixa). É o
 * mesmo mínimo que a vitrine mostra: o da variação escolhida, senão o da
 * ficha mestre do produto, senão o do cadastro (`effectiveMoq`).
 */
async function assertMoq(
  product: Pick<Product, "id" | "moq">,
  quantity: number,
  variant: Pick<ProductVariant, "moq"> | null,
) {
  const sheet = await getProductSheet(product.id);
  const moq = effectiveMoq(variant?.moq, sheet?.moq, product.moq);
  if (moq !== null && quantity < moq) throw new Error("cart_below_moq");
}

/**
 * Variação escolhida para um produto: obrigatória quando ele tem variações
 * ativas, e tem de ser uma delas. Produto sem variações não aceita nenhuma.
 */
async function resolveVariant(
  productId: string,
  variantId: string | null | undefined,
): Promise<ProductVariant | null> {
  const variants = await listProductVariants(productId);
  if (!variantId) {
    if (variants.length) throw new Error("cart_variant_required");
    return null;
  }
  const variant = variants.find((v) => v.id === variantId);
  if (!variant) throw new Error("cart_variant_invalid");
  return variant;
}

/**
 * Variação de uma linha já no carrinho, entre as ativas do produto: `ok`
 * falso quando a linha precisa de variação e não tem uma válida (saiu, foi
 * desativada, ou o produto ganhou variações depois).
 */
function lineVariant(
  item: Pick<CartItem, "productId" | "variantId">,
  variants: Map<string, ProductVariant[]>,
): { ok: boolean; variant: ProductVariant | null } {
  const list = variants.get(item.productId) ?? [];
  if (!item.variantId) return { ok: list.length === 0, variant: null };
  const variant = list.find((v) => v.id === item.variantId) ?? null;
  return { ok: !!variant, variant };
}

const cleanText = (text: string | null | undefined, max: number) => {
  const v = (text ?? "").trim().slice(0, max);
  return v || null;
};

async function ownLines(user: User) {
  return getStore().list("cart_items", {
    filter: { userId: user.id },
    orderBy: "createdAt",
  });
}

/** Itens no carrinho (para o ícone no topo). Fora do cliente, zero. */
export async function cartCount(user: User): Promise<number> {
  if (user.role !== "customer") return 0;
  try {
    return (await ownLines(user)).length;
  } catch {
    // Carrinho indisponível (ex.: tabela ainda não publicada): a vitrine abre igual.
    return 0;
  }
}

export async function addToCart(
  user: User,
  productId: string,
  quantity: number,
  notes?: string | null,
  variantId?: string | null,
): Promise<void> {
  const customerId = await assertBuyer(user);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product?.active) throw new Error("cart_product_unavailable");
  const variant = await resolveVariant(productId, variantId);
  const q = validQuantity(quantity);
  await assertMoq(product, q, variant);
  const lines = await ownLines(user);
  // Junta pela regra produto + variação (não pelo índice do banco).
  const existing = lines.find(
    (l) =>
      l.productId === productId &&
      (l.variantId ?? null) === (variant?.id ?? null),
  );
  const note = cleanText(notes, CART_NOTES_MAX);
  if (existing) {
    // Adicionar de novo soma (como nas lojas); a observação nova substitui.
    await store.update("cart_items", existing.id, {
      quantity: Math.min(existing.quantity + q, CART_MAX_QUANTITY),
      ...(note ? { notes: note } : {}),
    });
    return;
  }
  if (lines.length >= CART_MAX_ITEMS) throw new Error("cart_full");
  await store.create("cart_items", {
    userId: user.id,
    customerId,
    productId,
    quantity: q,
    notes: note,
    // Coluna nova: só vai quando há variação (esquema antigo continua aceitando).
    ...(variant ? { variantId: variant.id } : {}),
  });
}

async function ownLine(user: User, itemId: string) {
  if (user.role !== "customer" || !user.partyId) throw new ForbiddenError();
  const line = await getStore().get("cart_items", itemId);
  // Item de outro login: como se não existisse.
  if (!line || line.userId !== user.id) throw new Error("cart_item_not_found");
  return line;
}

export async function updateCartItem(
  user: User,
  itemId: string,
  quantity: number,
  notes: string | null,
): Promise<void> {
  const line = await ownLine(user, itemId);
  const q = validQuantity(quantity);
  // Mudou a quantidade: respeita o mínimo (item antigo abaixo dele só sobe),
  // o da variação da linha quando ela ainda existe.
  if (q !== line.quantity) {
    const product = await getStore().get("products", line.productId);
    if (product) {
      const variant = line.variantId
        ? await getProductVariant(line.variantId)
        : null;
      await assertMoq(product, q, variant?.active ? variant : null);
    }
  }
  await getStore().update("cart_items", line.id, {
    quantity: q,
    notes: cleanText(notes, CART_NOTES_MAX),
  });
}

export async function removeCartItem(
  user: User,
  itemId: string,
): Promise<void> {
  const line = await ownLine(user, itemId);
  await getStore().remove("cart_items", line.id);
}

export async function cartView(user: User): Promise<CartView> {
  const empty: CartView = {
    lines: [],
    estimatedTotal: 0,
    complete: true,
    anyPriced: false,
  };
  if (user.role !== "customer") return empty;
  const store = getStore();
  const items = await ownLines(user);
  if (!items.length) return empty;
  const ids = [...new Set(items.map((i) => i.productId))];
  const [products, photos, variants, estimates] = await Promise.all([
    store.list("products", { filter: { id: ids } }),
    catalogShowcasePhotos(ids),
    variantsByProduct(ids),
    estimateForQuantities(
      user,
      items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
      })),
    ),
  ]);
  const lines: CartLine[] = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const unavailable = !product?.active;
    const { ok: variantOk, variant } = lineVariant(item, variants);
    const priced = estimates.get(lineKey(item.productId, item.variantId));
    const estimate: CatalogEstimate =
      unavailable || !variantOk || !priced
        ? { ok: false, missing: [] }
        : priced.estimate;
    // Pedido mínimo da mesma fonte da vitrine (variação, ficha mestre ou cadastro).
    const moq = priced?.moq ?? product?.moq ?? null;
    return {
      id: item.id,
      productId: item.productId,
      name: product?.name ?? "—",
      category: product?.category ?? null,
      // A foto da variação, quando tem; senão a principal do produto.
      photo: unavailable
        ? null
        : (variant?.photoDocumentId ??
          photos.get(item.productId)?.[0]?.documentId ??
          null),
      quantity: item.quantity,
      notes: item.notes,
      moq,
      belowMoq: moq !== null && moq > 0 && item.quantity < moq,
      estimate,
      // A conta da quantidade inteira (sem multiplicar o centavo arredondado).
      subtotal:
        estimate.ok && estimate.quantity === item.quantity
          ? estimate.totalBrl
          : null,
      unavailable,
      variantId: item.variantId ?? null,
      variantName: variant?.name ?? null,
      variantUnavailable: !unavailable && !variantOk,
    };
  });
  const estimatedTotal =
    Math.round(lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0) * 100) /
    100;
  return {
    lines,
    estimatedTotal,
    complete: lines.every((l) => l.subtotal !== null),
    anyPriced: lines.some((l) => l.subtotal !== null),
  };
}

/**
 * Solicitação de orçamento de um produto do catálogo (vitrine). Com variação,
 * o nome vira "Produto · Variação" (cortado em 160) e a especificação traz os
 * dados dela em vez dos do cadastro (que espelham a variação de referência);
 * o texto livre do cadastro, quando existe, continua.
 */
function requestItemFor(
  product: Product,
  variant: ProductVariant | null,
  quantity: number,
  notes: string | null,
  t: Translate,
): RequestBatchItem {
  const description = [
    `${product.name}${product.category ? ` — ${product.category}` : ""}`,
    notes ? `${t("explore.cart.notesLabel")}: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const spec = [
    product.category ? `${t("catalog.category")}: ${product.category}` : null,
    ...(variant
      ? [
          `${t("productVariants.col.name")}: ${variant.name}`,
          ...variantSpecificationLines(variant, t),
          ...(product.specification?.trim()
            ? specificationLines(product, t)
            : []),
        ]
      : specificationLines(product, t)),
  ].filter(Boolean);
  return {
    productId: product.id,
    productName: (variant
      ? `${product.name} · ${variant.name}`
      : product.name
    ).slice(0, 160),
    description,
    specification: spec.length ? spec.join("\n") : null,
    quantity,
    unit: "un",
    sourcingDemand: false,
    ...(variant ? { variantId: variant.id } : {}),
  };
}

/**
 * Observações do envio para a Wellmix: a data em que o cliente precisa (a
 * Wellmix usa para planejar; o prazo da proposta continua o das
 * Configurações) e o texto livre.
 */
function checkoutNotes(
  input: { deadline: string | null; notes: string | null },
  t: Translate,
): string | null {
  const needBy = input.deadline
    ? `${t("explore.cart.needBy")}: ${new Intl.DateTimeFormat(t.intl, {
        timeZone: "UTC",
      }).format(new Date(`${input.deadline}T00:00:00Z`))}`
    : null;
  const text = cleanText(input.notes, CHECKOUT_NOTES_MAX);
  return [needBy, text].filter(Boolean).join("\n") || null;
}

/**
 * Envia o carrinho: cada item (produto + variação) vira uma solicitação de
 * orçamento (lote com 2 ou mais), com a quantidade e a personalização do
 * item. Produtos que saíram do catálogo e itens cuja variação sumiu ficam de
 * fora (e continuam no carrinho, avisados).
 */
export async function checkoutCart(
  user: User,
  input: { deadline: string | null; notes: string | null },
  t: Translate,
): Promise<Request[]> {
  const customerId = await assertBuyer(user);
  const store = getStore();
  const items = await ownLines(user);
  if (!items.length) throw new Error("cart_empty");
  const ids = [...new Set(items.map((i) => i.productId))];
  const [products, variants] = await Promise.all([
    store.list("products", { filter: { id: ids } }),
    variantsByProduct(ids),
  ]);
  const sendable = items.filter(
    (i) =>
      products.find((p) => p.id === i.productId)?.active &&
      lineVariant(i, variants).ok,
  );
  if (!sendable.length) throw new Error("cart_product_unavailable");
  const created = await createRequestBatch(
    user,
    {
      customerId,
      // O prazo da proposta é o das Configurações; a data do cliente vai nas observações.
      deadline: null,
      notes: checkoutNotes(input, t),
      requestedForUserId: null,
    },
    sendable.map((item) =>
      requestItemFor(
        products.find((p) => p.id === item.productId)!,
        lineVariant(item, variants).variant,
        item.quantity,
        item.notes,
        t,
      ),
    ),
  );
  // Só depois de tudo criado: o que foi enviado sai do carrinho.
  for (const item of sendable) await store.remove("cart_items", item.id);
  await audit(
    user,
    "cart.checkout",
    "request",
    created[0].id,
    `Carrinho enviado: ${created.length} produto(s) para orçamento`,
    null,
    { requests: created.map((r) => r.id) },
  );
  return created;
}

/**
 * "Solicitar orçamento agora" na página do produto: só este produto (e a
 * variação escolhida), com a quantidade e a personalização da tela, sem
 * passar pelo carrinho (o que já estava no carrinho fica lá).
 */
export async function requestProductNow(
  user: User,
  productId: string,
  quantity: number,
  notes: string | null,
  t: Translate,
  variantId?: string | null,
): Promise<Request> {
  const customerId = await assertBuyer(user);
  const product = await getStore().get("products", productId);
  if (!product?.active) throw new Error("cart_product_unavailable");
  const variant = await resolveVariant(productId, variantId);
  await assertMoq(product, validQuantity(quantity), variant);
  const [created] = await createRequestBatch(
    user,
    { customerId, deadline: null, notes: null, requestedForUserId: null },
    [
      requestItemFor(
        product,
        variant,
        validQuantity(quantity),
        cleanText(notes, CART_NOTES_MAX),
        t,
      ),
    ],
  );
  await audit(
    user,
    "cart.request_now",
    "request",
    created.id,
    `Orçamento pedido direto da vitrine: ${product.name}${
      variant ? ` · ${variant.name}` : ""
    }`,
  );
  return created;
}
