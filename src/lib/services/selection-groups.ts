import "server-only";

import { assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { GROUP_MAX } from "@/lib/booking-selection";
import {
  getStore,
  type AiReferencePrompts,
  type BookingItem,
  type BookingLot,
  type SelectionGroup,
  type SelectionPacking,
  type SupplierRequest,
  type SupplierRequestItem,
  type SupplierRequestVariant,
  type User,
} from "@/lib/db";
import type { PackingInput } from "@/lib/selection-packing";
import { listColumns } from "@/lib/db/lookup";
import { groupRequests, sheetQuantity } from "@/lib/supplier-requests";
import {
  scheduleTotal,
  type RequestSchedule,
} from "@/lib/workflow/request-schedule";
import { audit } from "./audit";
import {
  SupplierRequestError,
  openSupplierRequest,
  type SupplierRequestBatch,
} from "./supplier-requests";

/*
 * Escolha por grupo (docs/SUPPLIER_REQUESTS.md, "Escolha por grupo"): na
 * seleção de itens a Wellmix compara um grupo, grava o item que ganhou com a
 * quantidade e, depois, abre de uma vez a solicitação ao fornecedor dos
 * grupos resolvidos (só do ganhador de cada um). Nada chega ao fornecedor
 * antes de a solicitação abrir.
 */

/** Booking em que o item pode ganhar (o rascunho não: a solicitação pede o booking fechado). */
const CHOOSABLE_LOTS = ["closed", "in_progress", "done"];

async function schemaSafe<T>(fn: () => Promise<T>, missing: () => T) {
  try {
    return await fn();
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return missing();
    throw error;
  }
}
const outdated = (): never => {
  throw new SupplierRequestError("schema_outdated");
};

export interface SaveSelectionGroupInput {
  /** Itens do grupo comparado. */
  itemIds: string[];
  chosenItemId: string;
  /** Vazio: a quantidade da planilha do item escolhido. */
  quantity: number | null;
  needs: string | null;
  /** Programação de compra (rodadas); com ela, a quantidade é a soma. */
  schedule?: RequestSchedule | null;
  /**
   * Cores incluídas na compra (card "Variações" do vencedor). undefined =
   * não vieram no formulário: todas as cores do Book do item escolhido.
   */
  colors?: string[] | null;
  /**
   * Caixas de cada cor digitadas no card "Variações" (dono, 14/11/2026). Nulo
   * ou ausente: a divisão igual entre as cores.
   */
  colorCartons?: Record<string, number> | null;
  /**
   * Prompts de IA digitados (undefined = não veio no formulário, fica o que
   * estava; null = os padrão das Configurações).
   */
  aiPrompts?: AiReferencePrompts | null;
  /**
   * Embalagens e variações do vencedor (dono, 26/11/2026): a caixa
   * alterada, as embalagens novas, as variações e o Mix de cores. Com elas,
   * as cores (`colors`, `colorCartons`) não valem: as caixas são de cada
   * combinação (`packCartons`).
   */
  packing?: PackingInput | null;
  /** Caixas digitadas por combinação (`comboKey`); nulo = divisão igual. */
  packCartons?: Record<string, number> | null;
  /** Artes de exemplo por chave (`artKey`): arquivo novo, já subido ou mantido. */
  arts?: PackingArts | null;
}

/** As imagens das combinações que vieram no formulário. */
export interface PackingArts {
  files: Record<string, File>;
  /** Já subidas direto ao armazenamento (a chave do arquivo). */
  uploaded: Record<string, string>;
  /** A gravada antes (documento), quando não veio outra. */
  keep: Record<string, string>;
}

/**
 * O plano das embalagens e variações: confere (caixa, embalagens,
 * variações), divide as peças de cada data entre as combinações e guarda as
 * imagens de exemplo (documentos internos até a cotação abrir).
 */
async function packingPlan(
  user: User,
  chosen: BookingItem,
  input: PackingInput,
  rounds: number[],
  extra: {
    cartons: Record<string, number> | null;
    arts: PackingArts | null;
    splitError: (error: string) => Error;
  },
): Promise<SelectionPacking> {
  const rules = await import("@/lib/selection-packing");
  const { colorsOf } = await import("@/lib/color-split");
  const book = new Map(
    colorsOf(chosen.colorAssortment).map(
      (c) => [c.toLocaleLowerCase("pt-BR"), c] as const,
    ),
  );
  // Cor do Book pelo nome dela no Book; o que não é do Book é texto livre.
  const variations = input.variations
    .map((v) => {
      const label = rules.cleanVariation(v.label);
      const fromBook = book.get(label.toLocaleLowerCase("pt-BR"));
      return !v.custom && fromBook
        ? { label: fromBook, custom: false }
        : { label, custom: true };
    })
    .filter((v) => v.label);
  const clean = { ...input, variations };
  const check = rules.checkPacking(clean, chosen.masterCartonQty);
  if (!check.ok) throw new SupplierRequestError(check.error);
  const combos = rules.packCombos(variations, rules.packOptions(clean));
  if (!combos.length) throw new SupplierRequestError("selection_colors_none");
  const split = rules.splitPacking({
    rounds,
    combos,
    carton: check.carton,
    cartons: extra.cartons,
  });
  if (!split.ok) throw extra.splitError(split.error);
  const { cbmFromDimensions } = await import("@/lib/logistics/cbm");
  const baseCbm =
    chosen.cbmPerCarton ??
    cbmFromDimensions(chosen.lengthCm, chosen.widthCm, chosen.heightCm);
  // As imagens: uma por combinação ou, com o Mix de cores, uma por embalagem.
  const arts = new Map<string, string>();
  const wanted = [
    ...new Set(
      combos.map((c) => rules.artKey(input.mix, c.variation, c.units)),
    ),
  ];
  if (extra.arts) {
    const { registerUploadedPhoto, uploadDocument } =
      await import("./documents");
    const target = { type: "photo" as const, visibility: "internal" as const };
    for (const key of wanted) {
      const file = extra.arts.files[key];
      const uploaded = extra.arts.uploaded[key];
      const kept = extra.arts.keep[key];
      if (file) {
        if (!(file.type ?? "").startsWith("image/"))
          throw new SupplierRequestError("mime");
        arts.set(key, (await uploadDocument(user, file, target)).id);
      } else if (uploaded)
        arts.set(key, (await registerUploadedPhoto(user, uploaded, target)).id);
      else if (kept) arts.set(key, kept);
    }
  }
  return {
    carton: input.carton,
    cbm: input.carton
      ? rules.alteredCbm(baseCbm, chosen.masterCartonQty, input.carton)
      : null,
    packs: clean.packs,
    parentOption: clean.parentOption,
    mix: input.mix,
    variations,
    lines: combos.map((c, i) => ({
      key: c.key,
      variation: c.variation,
      units: c.units,
      quantity: split.rows[i].quantity,
      rounds: split.rows[i].rounds,
      artDocumentId:
        arts.get(rules.artKey(input.mix, c.variation, c.units)) ?? null,
    })),
    ...(extra.cartons ? { custom: true } : {}),
  };
}

/**
 * Grava a escolha do grupo. A escolha ainda não enviada de um grupo com
 * algum item em comum é trocada por esta (um item não fica em duas escolhas
 * esperando).
 */
export async function saveSelectionGroup(
  user: User,
  input: SaveSelectionGroupInput,
): Promise<SelectionGroup> {
  assertWellmix(user);
  assertScreen(user, "booking");
  // O escolhido é um item do grupo comparado (o rádio "Escolher" da tabela):
  // sem ele não se grava escolha nem programação de compra, que é calculada
  // com a caixa dele (pedido do dono, 13/11/2026).
  if (!input.chosenItemId || !input.itemIds.includes(input.chosenItemId))
    throw new SupplierRequestError("supplier_request_choose");
  const store = getStore();
  const ids = [...new Set([input.chosenItemId, ...input.itemIds])].slice(
    0,
    GROUP_MAX,
  );
  const items = await schemaSafe(
    () => store.list("booking_items", { filter: { id: ids } }),
    outdated,
  );
  const chosen = items.find((i) => i.id === input.chosenItemId);
  if (!chosen) throw new SupplierRequestError("not_found");
  const lot = await store.get("booking_lots", chosen.lotId);
  if (!lot || !CHOOSABLE_LOTS.includes(lot.status))
    throw new SupplierRequestError("supplier_request_lot_not_closed");
  // Só itens de books travados para quem grava (dono, 25/11/2026).
  const { assertLotsWorkable } = await import("./booking-lots");
  await assertLotsWorkable(
    user,
    items.map((i) => i.lotId),
  );
  const schedule = input.schedule?.items.length ? input.schedule : null;
  const quantity = schedule
    ? scheduleTotal(schedule)
    : (input.quantity ?? sheetQuantity(chosen));
  if (
    quantity === null ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 1e9
  )
    throw new SupplierRequestError("supplier_request_qty_required");
  const itemIds = items.map((i) => i.id);
  const needs = (input.needs ?? "").trim().slice(0, 4000) || null;
  const rounds = schedule
    ? schedule.items.map((i) => i.quantity)
    : [Math.round(quantity)];
  const splitError = (error: string) =>
    new SupplierRequestError(
      error === "colors_none"
        ? "selection_colors_none"
        : error === "colors_total"
          ? "selection_colors_total"
          : "selection_colors_cartons",
    );
  // Embalagens e variações (dono, 26/11/2026): cada combinação variação ×
  // embalagem fica com as suas caixas master inteiras da caixa final.
  const packing = input.packing
    ? await packingPlan(user, chosen, input.packing, rounds, {
        cartons: input.packCartons ?? null,
        arts: input.arts ?? null,
        splitError,
      })
    : null;
  // Variações de cor do vencedor (docs/PURCHASE_SCHEDULE.md, "Cores"): as
  // peças de cada data divididas entre as cores incluídas, em caixas master
  // inteiras. Não fecha: recusa (a tela mostra o ajuste antes de gravar).
  // Com as embalagens, as cores são variações delas (sem plano de cores).
  const { buildColorPlan } = await import("@/lib/color-split");
  const colored = packing
    ? { plan: null }
    : buildColorPlan({
        assortment: chosen.colorAssortment,
        included: input.colors ?? null,
        rounds,
        carton: chosen.masterCartonQty,
        cartons: input.colorCartons ?? null,
      });
  if ("error" in colored) throw splitError(colored.error.error);
  const colorPlan = colored.plan;

  const waiting = await schemaSafe(
    () => store.list("selection_groups", { filter: { status: "saved" } }),
    outdated,
  );
  const mine = new Set(itemIds);
  const overlapping = waiting.filter((g) => g.itemIds.some((i) => mine.has(i)));
  const values = {
    status: "saved" as const,
    itemIds,
    chosenItemId: chosen.id,
    quantity: Math.round(quantity),
    needs,
    supplierRequestId: null,
    requestedAt: null,
    updatedByUserId: user.id,
    // Sem programação grava nulo só quando a escolha já tinha uma (o esquema
    // antigo, sem a coluna, continua gravando a escolha simples).
    ...(schedule ? { schedule } : {}),
    // Cores: o mesmo cuidado (só grava quando o item tem variações).
    ...(colorPlan ? { colorPlan } : {}),
    // Prompts de IA: o mesmo cuidado (só grava quando há prompt próprio).
    ...(input.aiPrompts ? { aiPrompts: input.aiPrompts } : {}),
    // Embalagens e variações: o mesmo cuidado.
    ...(packing ? { packing } : {}),
  };
  const [reuse, ...rest] = overlapping;
  const group = reuse
    ? await store.update("selection_groups", reuse.id, {
        ...values,
        ...(!schedule && reuse.schedule ? { schedule: null } : {}),
        ...(!colorPlan && reuse.colorPlan ? { colorPlan: null } : {}),
        ...(!packing && reuse.packing ? { packing: null } : {}),
        ...(reuse.supplierRequestIds?.length
          ? { supplierRequestIds: null }
          : {}),
        ...(input.aiPrompts === null && reuse.aiPrompts
          ? { aiPrompts: null }
          : {}),
        // Outro ganhador: as imagens e a ficha eram do anterior.
        ...(reuse.chosenItemId !== chosen.id && reuse.aiAssets?.length
          ? { aiAssets: null }
          : {}),
      })
    : await store.create("selection_groups", {
        ...values,
        createdByUserId: user.id,
      });
  for (const old of rest)
    await store.update("selection_groups", old.id, {
      status: "replaced",
      updatedByUserId: user.id,
    });
  // Os itens do grupo comparado ficam marcados no book de origem como
  // trabalhados (dono, 23/11/2026; docs/BOOKING.md, "Itens trabalhados").
  const { markItemsWorked } = await import("./booking-lots");
  await markItemsWorked(user, items);
  await audit(
    user,
    "selection_group.save",
    "selection_group",
    group.id,
    `Escolha do grupo: ${chosen.description ?? chosen.productName ?? chosen.factoryItemCode ?? chosen.id}, ${group.quantity} pcs${schedule ? ` em ${schedule.items.length} programações (${schedule.items.map((i) => i.quantity).join(" + ")}), a cada ${schedule.intervalDays} dias desde ${schedule.firstDate}` : ""}${colorPlan ? `; cores: ${colorPlan.rows.map((r) => `${r.color} ${r.quantity}`).join(", ")}${colorPlan.included.length < colorPlan.colors.length ? ` (fora: ${colorPlan.colors.filter((c) => !colorPlan.included.includes(c)).join(", ")})` : ""}` : ""}${packing ? `; ${packing.lines.length} combinação(ões) variação × embalagem: ${packing.lines.map((l) => `${l.variation ?? "—"} × ${l.units === 1 ? "unitária" : `${l.units} pç`} ${l.quantity}`).join(", ")}${packing.carton ? `; caixa alterada para ${packing.carton} pç` : ""}${packing.mix ? "; mix de cores" : ""}` : ""} (${itemIds.length} itens comparados)`,
  );
  return group;
}

export interface SelectionGroupEntry {
  group: SelectionGroup;
  chosen: BookingItem | null;
  /** A solicitação aberta desta escolha. */
  request: SupplierRequest | null;
  /** O pedido de compra em que a solicitação entrou (fase 4b), se já entrou. */
  order?: { id: string; number: number } | null;
}

/** As escolhas gravadas e as que já viraram solicitação (as trocadas ficam fora). */
export async function listSelectionGroups(
  user: User,
): Promise<SelectionGroupEntry[]> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const store = getStore();
  const groups = await schemaSafe(
    () =>
      store.list("selection_groups", {
        filter: { status: ["saved", "requested"] },
      }),
    () => [] as SelectionGroup[],
  );
  if (!groups.length) return [];
  const requestIds = groups
    .map((g) => g.supplierRequestId)
    .filter((id): id is string => !!id);
  const [items, requests] = await Promise.all([
    store.list("booking_items", {
      filter: { id: [...new Set(groups.map((g) => g.chosenItemId))] },
    }),
    requestIds.length
      ? store.list("supplier_requests", { filter: { id: requestIds } })
      : Promise.resolve([] as SupplierRequest[]),
  ]);
  // Pedido de compra das solicitações (só o número, para o link; fase 4b).
  const orderIds = [
    ...new Set(requests.map((r) => r.orderId).filter((v): v is string => !!v)),
  ];
  const orders = orderIds.length
    ? await listColumns(store, "orders", ["number"], {
        filter: { id: orderIds },
      })
    : [];
  return groups
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((group) => {
      const request =
        requests.find((r) => r.id === group.supplierRequestId) ?? null;
      const order = request?.orderId
        ? orders.find((o) => o.id === request.orderId)
        : null;
      return {
        group,
        chosen: items.find((i) => i.id === group.chosenItemId) ?? null,
        request,
        order: order ? { id: order.id, number: order.number } : null,
      };
    });
}

export interface OpenGroupRequestsResult {
  opened: SupplierRequest[];
  /** Grupos que não abriram, com o motivo (o código do erro). */
  failed: Array<{ groupId: string; error: string }>;
  /**
   * Book enviado pelo parceiro (dono, 26/11/2026): as escolhas que foram
   * para a Estratégia de compra, com as demandas de cada uma.
   */
  strategy: Array<{ groupId: string; demandIds: string[] }>;
}

/** Um SKU da escolha: a quantidade, a programação e a cópia do item. */
interface GroupSku {
  /** Em embalagens (peças ÷ N). */
  quantity: number;
  schedule: RequestSchedule | null;
  /** Nulo: o item como veio do Book (o fluxo de sempre). */
  snapshot: SupplierRequestItem | null;
  variant: SupplierRequestVariant | null;
  colorPlan: SelectionGroup["colorPlan"];
}

/**
 * Os SKUs da escolha: com embalagens e variações, um por combinação com
 * peças (dono, 26/11/2026); sem elas, ou na combinação trivial, o item como
 * veio do Book, com a quantidade, a programação e as cores gravadas.
 */
async function groupSkus(
  group: SelectionGroup,
  chosen: BookingItem,
): Promise<GroupSku[]> {
  const packing = group.packing ?? null;
  const { colorsOf } = await import("@/lib/color-split");
  const rules = await import("@/lib/selection-packing");
  if (
    !packing ||
    rules.trivialPacking(packing, colorsOf(chosen.colorAssortment).length)
  )
    return [
      {
        quantity: group.quantity,
        schedule: group.schedule ?? null,
        snapshot: null,
        variant: null,
        colorPlan: group.colorPlan ?? null,
      },
    ];
  const { supplierRequestItemOf } = await import("@/lib/supplier-requests");
  const item = supplierRequestItemOf(chosen);
  return packing.lines
    .filter((line) => line.quantity > 0)
    .map((line) => {
      const items = group.schedule
        ? group.schedule.items
            .map((it, i) => ({
              ...it,
              quantity: rules.piecesToPacks(line.rounds[i] ?? 0, line.units),
            }))
            .filter((it) => it.quantity > 0)
            .map((it, i) => ({ ...it, index: i + 1 }))
        : [];
      return {
        quantity: rules.piecesToPacks(line.quantity, line.units),
        schedule:
          group.schedule && items.length ? { ...group.schedule, items } : null,
        snapshot: rules.skuItemOf(item, packing, line),
        variant: {
          key: line.key,
          variation: line.variation,
          units: line.units,
          pieceCarton: packing.carton ?? chosen.masterCartonQty,
          mix: packing.mix,
          artDocumentId: line.artDocumentId,
          selectionGroupId: group.id,
        },
        colorPlan: null,
      };
    });
}

/**
 * As cotações de um grupo gravado: a do ganhador (o fluxo de sempre) ou,
 * com embalagens e variações, uma por combinação variação × embalagem
 * (dono, 26/11/2026), cada uma com o próprio número, a cópia do item já em
 * embalagens e a imagem de exemplo. A combinação sem peças não abre.
 */
async function openGroup(
  user: User,
  group: SelectionGroup,
  batches: Map<string, SupplierRequestBatch>,
): Promise<SupplierRequest[]> {
  const base = {
    itemId: group.chosenItemId,
    alternativeIds: group.itemIds.filter((i) => i !== group.chosenItemId),
    needs: group.needs,
    searchQuery: null,
  };
  const store = getStore();
  const chosen = await store.get("booking_items", group.chosenItemId);
  if (!chosen) throw new SupplierRequestError("not_found");
  const skus = await groupSkus(group, chosen);
  // O item como veio do Book: o fluxo de sempre (no lote do fornecedor).
  if (skus.length === 1 && !skus[0].variant)
    return [
      await openSupplierRequest(
        user,
        {
          ...base,
          quantity: skus[0].quantity,
          schedule: skus[0].schedule,
          colorPlan: skus[0].colorPlan,
        },
        batches,
      ),
    ];
  const opened: SupplierRequest[] = [];
  const linked = new Set<string>();
  for (const sku of skus) {
    // Uma cotação separada por combinação (número próprio): um lote de
    // solicitações novo para cada uma.
    const request = await openSupplierRequest(
      user,
      {
        ...base,
        quantity: sku.quantity,
        schedule: sku.schedule,
        colorPlan: null,
        snapshot: sku.snapshot,
        variant: sku.variant,
      },
      new Map(),
    );
    // A arte passa a abrir para o fornecedor da cotação (com o Mix, a mesma
    // imagem serve às cotações da embalagem: fica ligada à primeira).
    const art = sku.variant?.artDocumentId;
    if (art && !linked.has(art)) {
      linked.add(art);
      await store
        .update("documents", art, { supplierRequestId: request.id })
        .catch((error: unknown) =>
          console.error("openGroup: arte da combinação", error),
        );
    }
    opened.push(request);
  }
  if (!opened.length)
    throw new SupplierRequestError("supplier_request_qty_required");
  return opened;
}

/**
 * Book enviado pelo parceiro (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Book enviado pelo parceiro"): a escolha vira demanda de compra para
 * estoque ("Estoque Wellmix"), uma por variação × embalagem, sem produto do
 * cadastro e num lote só (uma solicitação na Estratégia), com a ligação ao
 * item do book. A Estratégia de compra decide a quem cotar (o parceiro que
 * mandou o book já vem marcado).
 */
async function groupToStrategy(
  user: User,
  group: SelectionGroup,
): Promise<string[]> {
  const store = getStore();
  const chosen = await store.get("booking_items", group.chosenItemId);
  if (!chosen) throw new SupplierRequestError("not_found");
  const lot = await store.get("booking_lots", chosen.lotId);
  if (!lot) throw new SupplierRequestError("not_found");
  const skus = await groupSkus(group, chosen);
  if (!skus.length)
    throw new SupplierRequestError("supplier_request_qty_required");
  const { supplierRequestItemOf } = await import("@/lib/supplier-requests");
  const { bookingRecipientId } = await import("./booking-lots");
  const { ensureStockParty } = await import("./stock-party");
  const { createRequestBatch } = await import("./requests");
  const { variantLabel } = await import("@/lib/selection-packing");
  const stock = await ensureStockParty(user);
  const name =
    chosen.description ??
    chosen.productName ??
    chosen.factoryItemCode ??
    chosen.id;
  const created = await createRequestBatch(
    user,
    {
      customerId: stock.id,
      deadline: null,
      notes: `Book nº ${lot.number}, item ${chosen.factoryItemCode ?? chosen.itemNumber ?? name} (Seleção de itens).`,
      desiredAt: null,
    },
    skus.map((sku) => {
      const label = variantLabel(sku.variant);
      return {
        productId: null,
        productName: label ? `${name} · ${label}` : name,
        description: name,
        specification:
          [label, group.needs].filter(Boolean).join(" · ").slice(0, 2000) ||
          null,
        quantity: sku.quantity,
        unit: "pcs",
        sourcingDemand: false,
        schedule: sku.schedule,
        bookingSource: {
          bookingItemId: chosen.id,
          bookingLotId: lot.id,
          partnerId: bookingRecipientId(lot),
          snapshot: sku.snapshot ?? supplierRequestItemOf(chosen),
          variant: sku.variant,
          selectionGroupId: group.id,
        },
      };
    }),
    { origin: "replenishment" },
  );
  return created.map((r) => r.id);
}

/**
 * O book foi subido pela Wellmix? Então a escolha vira cotação na hora,
 * direto com o Supplier do book (dono, 26/11/2026). O book que o parceiro
 * subiu pelo portal vai para a Estratégia de compra (`groupToStrategy`).
 */
export async function lotUploadedByWellmix(
  lot: Pick<BookingLot, "createdByUserId">,
): Promise<boolean> {
  const creator = lot.createdByUserId
    ? await getStore().get("users", lot.createdByUserId)
    : null;
  // Sem o login de quem subiu (apagado), vale o book da Wellmix.
  return !creator || isWellmix(creator);
}

/**
 * "Gravar escolha" (dono, 26/11/2026): grava e, na hora, no book subido
 * pela Wellmix abre as cotações (uma por combinação, direto com o Supplier
 * do book) e no book enviado pelo parceiro manda as demandas para a
 * Estratégia de compra. Devolve a escolha e o resultado.
 */
export async function saveAndOpenSelectionGroup(
  user: User,
  input: SaveSelectionGroupInput,
): Promise<{ group: SelectionGroup; opened: OpenGroupRequestsResult }> {
  const group = await saveSelectionGroup(user, input);
  return { group, opened: await openGroupRequests(user, [group.id]) };
}

/**
 * Abre a solicitação ao fornecedor do ganhador de cada grupo gravado (os
 * marcados, ou todos). Os outros itens do grupo vão como alternativas (só a
 * Wellmix vê). Um grupo que não abre não segura os demais.
 */
export async function openGroupRequests(
  user: User,
  groupIds: string[] | "all",
): Promise<OpenGroupRequestsResult> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const store = getStore();
  const saved = await schemaSafe(
    () => store.list("selection_groups", { filter: { status: "saved" } }),
    outdated,
  );
  const wanted =
    groupIds === "all" ? saved : saved.filter((g) => groupIds.includes(g.id));
  if (!wanted.length) throw new SupplierRequestError("selection_group_none");
  const result: OpenGroupRequestsResult = {
    opened: [],
    failed: [],
    strategy: [],
  };
  // Uma solicitação por fornecedor: os produtos abertos juntos entram nela.
  const batches = new Map<string, SupplierRequestBatch>();
  for (const group of wanted.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    try {
      // Book enviado pelo parceiro: vai para a Estratégia de compra (dono,
      // 26/11/2026), também quando aberto pelos Blocos Sugeridos.
      const chosen = await store.get("booking_items", group.chosenItemId);
      const lot = chosen ? await store.get("booking_lots", chosen.lotId) : null;
      if (lot && !(await lotUploadedByWellmix(lot))) {
        const demandIds = await groupToStrategy(user, group);
        await store.update("selection_groups", group.id, {
          status: "requested",
          supplierRequestId: null,
          demandIds,
          requestedAt: new Date().toISOString(),
          updatedByUserId: user.id,
        });
        result.strategy.push({ groupId: group.id, demandIds });
        continue;
      }
      const opened = await openGroup(user, group, batches);
      // Imagens e ficha geradas por IA: vão para a solicitação (o fornecedor vê).
      const { attachReferencesToRequest } = await import("./ai-references");
      for (const request of opened)
        await attachReferencesToRequest(group, request.id);
      await store.update("selection_groups", group.id, {
        status: "requested",
        supplierRequestId: opened[0].id,
        ...(opened.length > 1
          ? { supplierRequestIds: opened.map((r) => r.id) }
          : {}),
        requestedAt: new Date().toISOString(),
        updatedByUserId: user.id,
      });
      result.opened.push(...opened);
    } catch (error) {
      const { RequestError } = await import("./requests");
      if (
        !(error instanceof SupplierRequestError) &&
        !(error instanceof RequestError)
      )
        throw error;
      result.failed.push({ groupId: group.id, error: error.message });
    }
  }
  // Um aviso por fornecedor, com todos os produtos da solicitação dele.
  const { notify } = await import("./notifications");
  for (const products of groupRequests(result.opened)) {
    const [first] = products;
    const pieces = products.reduce((sum, r) => sum + r.quantity, 0);
    await notify(
      { role: "supplier", partyId: first.supplierId },
      {
        link: `/app/supplier-requests/${first.id}`,
        kind: "action",
        text: (t) => ({
          subject: t("supplierRequests.notify.open.subject", {
            n: first.number,
          }),
          body:
            products.length === 1
              ? t("supplierRequests.notify.open.body", {
                  n: first.number,
                  code:
                    first.item.factoryItemCode ?? first.item.description ?? "",
                  qty: first.quantity,
                })
              : t("supplierRequests.notify.open.bodyMany", {
                  n: first.number,
                  products: products.length,
                  qty: pieces,
                }),
        }),
      },
    ).catch((error) => console.error("notify(supplier_request.open)", error));
  }
  return result;
}
