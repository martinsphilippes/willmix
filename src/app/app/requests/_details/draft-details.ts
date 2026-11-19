import "server-only";

import {
  getStore,
  type Party,
  type Product,
  type RequestDraft,
  type User,
} from "@/lib/db";
import type {
  RequestCompanyAllocation,
  VariantSnapshot,
} from "@/lib/db/schema";
import { isWellmix } from "@/lib/auth/permissions";
import {
  draftIsReplenishment,
  draftResumeHref,
  draftScreenOf,
} from "@/lib/request-screens";
import { canDraft, draftForm } from "@/lib/services/request-drafts";
import { getProductVariants } from "@/lib/services/product-variants";
import {
  requestProductName,
  variantSpecification,
} from "@/lib/services/variant-sales";
import { realName } from "@/lib/placeholder-name";
import { variantSnapshot } from "@/lib/variants";
import {
  scheduleTotal,
  type RequestSchedule,
} from "@/lib/workflow/request-schedule";
import {
  loadRequestPacking,
  packingRounds,
  packingTotalsLine,
  type RequestPacking,
} from "@/lib/services/request-packing";
import {
  encomendaTotals,
  type EncomendaTotals,
  type TotalsLine,
} from "@/lib/request-totals";
import type { RequestRounds } from "@/lib/request-rounds";
import { parseRequestItems } from "../../actions/request-items";

/*
 * Detalhes do rascunho, só para consulta (dono, 19/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 7): o rascunho da Nova solicitação aberto
 * na mesma tela da solicitação enviada.
 *
 * - Privacidade: só quem salvou o rascunho, da Wellmix, e só se ainda abre a
 *   tela de onde ele veio (a mesma regra de "Continuar": `canDraft`). Fica de
 *   fora o rascunho da entrada da Reposição (ele é da fila de Reposição, não
 *   de Encomendas). Fora disso, nulo: a página responde 404, sem dizer se o
 *   rascunho existe.
 * - Só leitura: lê o rascunho, o cliente, os produtos e as variações; não
 *   grava nada, não reserva número, não audita, não notifica e não envia.
 *   O número é o que o rascunho já tem (sem número, fica sem).
 * - Os produtos saem da mesma leitura tolerante do formulário
 *   (`parseRequestItems(..., { lenient: true })`): o que foi salvo, mesmo
 *   incompleto. A variação escolhida entra como no envio (o nome
 *   "Produto · Variação", a cópia dos valores e a especificação dela quando o
 *   rascunho não tem), para a embalagem bater com a que a solicitação terá.
 * - Quantidade em branco não vira zero: o produto sem quantidade (ou com a
 *   programação toda em branco) fica sem peças, caixas e cubagem ("—"), e os
 *   totais dizem que são parciais. Zero digitado continua zero.
 */

/** Um produto do rascunho, como foi salvo. */
export interface DraftProduct {
  /** Índice do campo no formulário (`p<índice>.`). */
  index: number;
  /** Posição na lista (1, 2, 3…): o endereço dos detalhes dele (`?item=`). */
  position: number;
  productId: string | null;
  variantId: string | null;
  /** O nome como a solicitação terá (com a variação); vazio quando falta. */
  productName: string;
  description: string;
  specification: string | null;
  /** Quantidade digitada; nula em branco (ou inválida). */
  quantity: number | null;
  unit: string;
  /** Fora do catálogo (produto escrito à mão). */
  outside: boolean;
  /** Programação das entregas (em branco conta zero, como no envio). */
  schedule: RequestSchedule | null;
  /** Em cada entrega: a quantidade foi digitada? (em branco: não). */
  scheduleTyped: boolean[] | null;
  /** A cópia da variação escolhida (como no envio); nula sem variação. */
  variant: VariantSnapshot | null;
  companyAllocations: RequestCompanyAllocation[] | null;
  /** Dá para contar as peças (quantidade ou alguma entrega digitada). */
  quantityKnown: boolean;
  /** Falta o produto, o nome ou a quantidade (a mesma ideia do "Incompleto" do formulário). */
  incomplete: boolean;
}

export interface DraftDetails {
  draft: RequestDraft;
  /** Número persistente reservado no rascunho (nulo nos antigos, sem número). */
  number: number | null;
  /** Continuar a edição: o formulário da tela de onde o rascunho veio. */
  resumeHref: string;
  canResume: boolean;
  customer: Pick<Party, "id" | "name"> | null;
  /** Nome do cliente para a tela (o atual do cadastro; senão o salvo). */
  customerName: string | null;
  products: DraftProduct[];
  /** Os produtos do catálogo escolhidos (código, foto). */
  catalog: Product[];
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** O rascunho que esta pessoa pode ver nos detalhes (nulo: 404). */
export async function getDraftForDetails(
  user: User,
  id: string,
): Promise<RequestDraft | null> {
  if (!isWellmix(user) || !ID.test(id)) return null;
  const draft = await getStore()
    .get("request_drafts", id)
    .catch(() => null);
  if (!draft || draft.userId !== user.id) return null;
  const screen = draftScreenOf(draft.payload);
  const replenish = screen === "sale" && draftIsReplenishment(draft.payload);
  // Encomendas lista os rascunhos da Nova solicitação, de TS e de Venda; o da
  // Reposição é da fila de Reposição (listDraftsForList).
  if (replenish) return null;
  return canDraft(user, screen, false) ? draft : null;
}

/** As entregas digitadas de cada produto (em branco = não digitada). */
function typedRounds(
  form: FormData,
  index: number,
  schedule: RequestSchedule | null,
): boolean[] | null {
  if (!schedule) return null;
  return schedule.items.map((item) => {
    const raw = form.get(`p${index}.schedule.qty.${item.index}`);
    return typeof raw === "string" && raw.trim() !== "";
  });
}

/** Os detalhes do rascunho para quem pode vê-lo (nulo: 404). Só leitura. */
export async function loadDraftDetails(
  user: User,
  id: string,
): Promise<DraftDetails | null> {
  const draft = await getDraftForDetails(user, id);
  if (!draft) return null;
  const store = getStore();
  const form = draftForm(draft);
  let items: ReturnType<typeof parseRequestItems> = [];
  try {
    items = parseRequestItems(form, { lenient: true });
  } catch {
    items = [];
  }
  const productIds = [
    ...new Set(items.map((i) => i.productId).filter((v): v is string => !!v)),
  ];
  const variantIds = [
    ...new Set(items.map((i) => i.variantId).filter((v): v is string => !!v)),
  ];
  const [customer, products, variants] = await Promise.all([
    draft.customerId
      ? store.get("parties", draft.customerId).catch(() => null)
      : Promise.resolve(null),
    productIds.length
      ? store.list("products", { filter: { id: productIds } })
      : Promise.resolve([]),
    variantIds.length ? getProductVariants(variantIds) : Promise.resolve([]),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const list: DraftProduct[] = items.map((item, i) => {
    const product = item.productId
      ? (productById.get(item.productId) ?? null)
      : null;
    // A variação vale só se for do produto (o envio recusa outra).
    const chosen = item.variantId ? variantById.get(item.variantId) : null;
    const variant =
      chosen && product && chosen.productId === product.id ? chosen : null;
    const typedName = item.productName.trim();
    const baseName = typedName || realName(product?.name) || "";
    const productName =
      variant && product
        ? requestProductName(
            typedName,
            realName(product.name) ?? typedName,
            variant.name,
          )
        : baseName;
    const specification =
      (item.specification ?? "").trim() ||
      (variant ? variantSpecification(variant) : "") ||
      null;
    const typed = typedRounds(form, item.index, item.schedule);
    const quantityKnown = item.schedule
      ? !!typed?.some(Boolean)
      : item.quantity !== null;
    const total = item.schedule
      ? scheduleTotal(item.schedule)
      : (item.quantity ?? 0);
    const outside = !item.productId;
    const incomplete =
      (!item.productId && !item.sourcingDemand) ||
      !productName ||
      !quantityKnown ||
      !(total > 0);
    return {
      index: item.index,
      position: i + 1,
      productId: item.productId,
      variantId: variant?.id ?? null,
      productName,
      description: item.description,
      specification,
      quantity: item.quantity,
      unit: item.unit,
      outside,
      schedule: item.schedule,
      scheduleTyped: typed,
      variant: variant ? variantSnapshot(variant) : null,
      companyAllocations: item.companyAllocations,
      quantityKnown,
      incomplete,
    };
  });
  const screen = draftScreenOf(draft.payload);
  return {
    draft,
    number: typeof draft.number === "number" ? draft.number : null,
    resumeHref: draftResumeHref(draft.id, draft.payload),
    canResume: canDraft(user, screen, false),
    customer: customer ? { id: customer.id, name: customer.name } : null,
    customerName: customer?.name ?? draft.customerName ?? null,
    products: list,
    catalog: products,
  };
}

/** Peças do produto que dá para contar (quantidade ou soma das entregas); nula sem. */
export function draftPieces(p: DraftProduct): number | null {
  if (!p.quantityKnown) return null;
  return p.schedule ? scheduleTotal(p.schedule) : p.quantity;
}

/** Um produto do rascunho com a embalagem e a linha dos totais. */
export interface DraftPackedProduct {
  product: DraftProduct;
  packing: RequestPacking | undefined;
  line: TotalsLine;
}

export interface DraftDetailsModel {
  rows: DraftPackedProduct[];
  totals: EncomendaTotals;
  rounds: RequestRounds;
  distinctProducts: number;
}

/**
 * A embalagem, os totais e as programações do rascunho pela mesma regra da
 * solicitação enviada (src/lib/services/request-packing.ts): cada produto
 * vira uma linha só na memória (nunca gravada). Sem quantidade, o produto
 * fica sem peças, caixas, inner e cubagem (o total diz que é parcial) e os
 * containers ficam "—" (a conta sairia menor do que é). A previsão de venda
 * só existe depois do envio (gravada nele): no rascunho, "—".
 */
export async function draftDetailsModel(
  details: Pick<DraftDetails, "draft" | "products">,
  input: { nameOf: (p: DraftProduct) => string; capacityCbm: number | null },
): Promise<DraftDetailsModel> {
  const virtual = details.products.map((p) => ({
    id: `draft-${details.draft.id}-${p.position}`,
    productId: p.productId,
    variantId: p.variantId,
    orderId: null,
    productName: p.productName,
    // A conta não lê a quantidade em branco (as linhas dela ficam "—").
    quantity: p.quantity ?? 0,
    unit: p.unit,
    schedule: p.schedule,
    variant: p.variant,
    specification: p.specification,
    priceForecast: null,
  }));
  const packing = await loadRequestPacking(virtual);
  const rows = details.products.map((product, i): DraftPackedProduct => {
    const pk = packing.get(virtual[i].id);
    const line = packingTotalsLine(virtual[i], pk, input.nameOf(product));
    return {
      product,
      packing: pk,
      line: product.quantityKnown
        ? line
        : { ...line, pieces: null, boxes: null, innerBoxes: null, cbm: null },
    };
  });
  const rounds = packingRounds(virtual, packing, input.capacityCbm);
  return {
    rows,
    totals: encomendaTotals(rows.map((r) => r.line)),
    rounds: details.products.every((p) => p.quantityKnown)
      ? rounds
      : { ...rounds, containers: null },
    distinctProducts: new Set(
      details.products.map((p) => p.productId ?? `n:${p.productName}`),
    ).size,
  };
}
