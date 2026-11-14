import "server-only";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { GROUP_MAX } from "@/lib/booking-selection";
import {
  getStore,
  type AiReferencePrompts,
  type BookingItem,
  type SelectionGroup,
  type SupplierRequest,
  type User,
} from "@/lib/db";
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
  // Variações de cor do vencedor (docs/PURCHASE_SCHEDULE.md, "Cores"): as
  // peças de cada data divididas entre as cores incluídas, em caixas master
  // inteiras. Não fecha: recusa (a tela mostra o ajuste antes de gravar).
  const { buildColorPlan } = await import("@/lib/color-split");
  const colored = buildColorPlan({
    assortment: chosen.colorAssortment,
    included: input.colors ?? null,
    rounds: schedule
      ? schedule.items.map((i) => i.quantity)
      : [Math.round(quantity)],
    carton: chosen.masterCartonQty,
    cartons: input.colorCartons ?? null,
  });
  if ("error" in colored)
    throw new SupplierRequestError(
      colored.error.error === "colors_none"
        ? "selection_colors_none"
        : colored.error.error === "colors_total"
          ? "selection_colors_total"
          : "selection_colors_cartons",
    );
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
  };
  const [reuse, ...rest] = overlapping;
  const group = reuse
    ? await store.update("selection_groups", reuse.id, {
        ...values,
        ...(!schedule && reuse.schedule ? { schedule: null } : {}),
        ...(!colorPlan && reuse.colorPlan ? { colorPlan: null } : {}),
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
  await audit(
    user,
    "selection_group.save",
    "selection_group",
    group.id,
    `Escolha do grupo: ${chosen.description ?? chosen.productName ?? chosen.factoryItemCode ?? chosen.id}, ${group.quantity} pcs${schedule ? ` em ${schedule.items.length} programações (${schedule.items.map((i) => i.quantity).join(" + ")}), a cada ${schedule.intervalDays} dias desde ${schedule.firstDate}` : ""}${colorPlan ? `; cores: ${colorPlan.rows.map((r) => `${r.color} ${r.quantity}`).join(", ")}${colorPlan.included.length < colorPlan.colors.length ? ` (fora: ${colorPlan.colors.filter((c) => !colorPlan.included.includes(c)).join(", ")})` : ""}` : ""} (${itemIds.length} itens comparados)`,
  );
  return group;
}

export interface SelectionGroupEntry {
  group: SelectionGroup;
  chosen: BookingItem | null;
  /** A solicitação aberta desta escolha. */
  request: SupplierRequest | null;
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
  return groups
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((group) => ({
      group,
      chosen: items.find((i) => i.id === group.chosenItemId) ?? null,
      request: requests.find((r) => r.id === group.supplierRequestId) ?? null,
    }));
}

export interface OpenGroupRequestsResult {
  opened: SupplierRequest[];
  /** Grupos que não abriram, com o motivo (o código do erro). */
  failed: Array<{ groupId: string; error: string }>;
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
  const result: OpenGroupRequestsResult = { opened: [], failed: [] };
  // Uma solicitação por fornecedor: os produtos abertos juntos entram nela.
  const batches = new Map<string, SupplierRequestBatch>();
  for (const group of wanted.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    try {
      const request = await openSupplierRequest(
        user,
        {
          itemId: group.chosenItemId,
          alternativeIds: group.itemIds.filter((i) => i !== group.chosenItemId),
          quantity: group.quantity,
          needs: group.needs,
          searchQuery: null,
          schedule: group.schedule ?? null,
          colorPlan: group.colorPlan ?? null,
        },
        batches,
      );
      // Imagens e ficha geradas por IA: vão para a solicitação (o fornecedor vê).
      const { attachReferencesToRequest } = await import("./ai-references");
      await attachReferencesToRequest(group, request.id);
      await store.update("selection_groups", group.id, {
        status: "requested",
        supplierRequestId: request.id,
        requestedAt: new Date().toISOString(),
        updatedByUserId: user.id,
      });
      result.opened.push(request);
    } catch (error) {
      if (!(error instanceof SupplierRequestError)) throw error;
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
