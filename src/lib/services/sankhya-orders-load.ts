import "server-only";
import {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  type Order,
  type Party,
  type Store,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { listByIds, listColumns } from "@/lib/db/lookup";
import { readSetting, writeSetting } from "@/lib/integrations/sankhya-settings";
import {
  containerStatusOf,
  doneMilestones,
  itemFieldsOf,
  milestoneOf,
  orderFieldsOf,
  sankhyaContainerId,
  sankhyaContainerItemId,
  sankhyaIso,
  sankhyaTrackItemId,
  mainKeyOf,
  orderNumberOf,
  sankhyaOrderId,
  shipmentLines,
  isReplenishmentTrack,
  sankhyaReplenishmentId,
  sankhyaReplenishmentGroupId,
  trackMilestone,
  trackSituation,
  type TrackShipment,
  type ProjectionOrder,
  type ProjectionShipment,
} from "@/lib/integrations/sankhya-orders-plan";
import { milestoneOfItem } from "@/lib/milestone-release";

/*
 * Carga real dos pedidos de compra do Sankhya (docs/SANKHYA_INTEGRACAO.md,
 * seção 9, etapa 5). Lê o ensaio já conferido (sankhya_projection) e a cópia
 * dos cabeçalhos (sankhya_stage_rows, para a empresa compradora), sem chamar
 * o Sankhya, e grava:
 *
 * - um pedido por cadeia 1100 → 1104 (id `snk-<NUNOTA da ponta>`), sem
 *   solicitação de cliente (D1), cliente = a empresa Wellmix que compra
 *   (`EMP-<CODEMP>`), fornecedor pelo código do Sankhya;
 * - os itens com o embarcado, o recebido e o saldo;
 * - nos em andamento, os itens do portal (pendências) com os marcos
 *   anteriores feitos (seção 5.1) e o canal Vermelho ou Cinza pausando (D8);
 *   encerrados, interrompidos e "Aguardando definição" entram sem pendências;
 * - um embarque (container) por documento 35, com o que cada pedido leva.
 *
 * Roda em partes (o administrador aperta "Carregar" e a tela repete até o
 * fim); o andamento fica em `sankhya.ordersLoad`. Rodar de novo atualiza.
 */

export const ORDERS_LOAD_KEY = "sankhya.ordersLoad";
const ORDER_CHUNK = 10;
const SHIPMENT_CHUNK = 50;
/** Tempo de cada passo: a página tem 60 s (maxDuration); sobra folga. */
const STEP_BUDGET_MS = 35_000;
const MAX_SKIPPED = 50;

export interface OrdersLoadProgress {
  phase: "idle" | "orders" | "shipments" | "done";
  done: number;
  total: number;
  created: number;
  updated: number;
  withPending: number;
  containers: number;
  /** Itens de 1100 que viraram reposição (abertas e encerradas). */
  replenishments?: number;
  /** Pre-orders (1100) sem pendência: reprovadas, fora do portal. */
  rejectedPreOrders?: number;
  /** Pedidos de 1100 de cargas anteriores que saíram de Pedidos. */
  removedOrders?: number;
  skipped: Array<{ key: string; reason: string }>;
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * Trava da rodada em andamento (duas abas, ou a aba fechada com a rodada
   * ainda no servidor, 21/11/2026): outra rodada antes desta hora não faz nada.
   */
  lockUntil?: string | null;
}

const EMPTY: OrdersLoadProgress = {
  phase: "idle",
  done: 0,
  total: 0,
  created: 0,
  updated: 0,
  withPending: 0,
  containers: 0,
  replenishments: 0,
  removedOrders: 0,
  skipped: [],
  startedAt: null,
  finishedAt: null,
};

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

export async function ordersLoadProgress(
  user: User,
): Promise<OrdersLoadProgress> {
  assertAdmin(user);
  return {
    ...EMPTY,
    ...((await readSetting<OrdersLoadProgress>(ORDERS_LOAD_KEY)) ?? {}),
  };
}

/** Chaves do ensaio de um tipo, em ordem (a carga anda por elas). */
async function projectionKeys(store: Store, kind: "order" | "shipment") {
  const rows = await listColumns(store, "sankhya_projection", ["kind", "key"]);
  return rows
    .filter((r) => r.kind === kind)
    .map((r) => r.key)
    .sort((a, b) => Number(a) - Number(b));
}

async function chunkRows<T>(store: Store, ids: string[]) {
  const rows = await store.list("sankhya_projection", {
    filter: { id: ids } as never,
  });
  return rows as unknown as T[];
}

/** Empresa compradora de cada pedido (CODEMP do cabeçalho da ponta). */
async function companiesOf(store: Store, keys: string[]) {
  const heads = await store.list("sankhya_stage_rows", {
    filter: {
      dataset: "purchaseHeaders",
      nunota: keys.map(Number),
    } as never,
  });
  const out = new Map<string, string>();
  for (const h of heads) {
    const emp = (h.row as Record<string, unknown> | null)?.CODEMP;
    if (h.nunota !== null && emp !== null && emp !== undefined)
      out.set(String(h.nunota), String(emp));
  }
  return out;
}

/** Cadastro da empresa Wellmix (cliente do pedido de compra), criado se falta. */
async function companyParty(
  store: Store,
  cache: Map<string, Party>,
  emp: string,
) {
  const code = `EMP-${emp}`;
  const hit = cache.get(code);
  if (hit) return hit;
  const [found] = await store.list("parties", {
    filter: { sankhyaCode: code, type: "customer" } as never,
    limit: 1,
  });
  const party =
    found ??
    (await store.create("parties", {
      type: "customer",
      name: `Empresa ${emp} (Sankhya)`,
      taxId: null,
      active: true,
      sankhyaCode: code,
    } as never));
  cache.set(code, party);
  return party;
}

async function holdState() {
  const { historyHoldActive } = await import("@/lib/services/go-live");
  return historyHoldActive();
}

/** Pendências do pedido em andamento: cria os itens e dá os marcos anteriores como feitos. */
async function openRequirements(
  store: Store,
  order: Order,
  row: ProjectionOrder,
  held: boolean,
  options: { create: boolean },
) {
  // Pedido novo: cria os itens. Já carregado: só avança o que o Sankhya
  // mostra que passou (nunca reabre nem desfaz o que o portal fez).
  if (options.create) {
    const { createOrderRequirements } = await import("@/lib/workflow/engine");
    await createOrderRequirements(order, undefined, { shadow: true });
  }
  const current = milestoneOf(row.milestone);
  const inspected =
    /^inspecionado$/i.test((row.data?.quality ?? "").trim()) ||
    !!sankhyaIso(row.data?.inspectedAt);
  const done = current
    ? doneMilestones(current, inspected ? "Inspecionado" : row.data?.quality)
    : new Set<string>();
  const at = sankhyaIso(row.data?.changedAt) ?? new Date().toISOString();
  const requirements = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  const writes: Array<() => Promise<unknown>> = [];
  for (const req of requirements) {
    const key = milestoneOfItem(req);
    const patch = {
      ...(req.status === "pending" && key && done.has(key)
        ? {
            status: "done" as const,
            note: "Marco concluído no Sankhya (carga dos pedidos)",
            submittedAt: at,
          }
        : {}),
      ...(held ? { held: true } : {}),
    };
    if (Object.keys(patch).length)
      writes.push(() => store.update("requirements", req.id, patch));
  }
  for (let i = 0; i < writes.length; i += 8)
    await Promise.all(writes.slice(i, i + 8).map((w) => w()));
  await closeImportSteps(store, order.id, done, at);
  try {
    const { syncMilestones } = await import("@/lib/services/order-milestones");
    await syncMilestones(order.id, { shadow: true });
  } catch (error) {
    console.error("[sankhya-orders] marcos", order.id, error);
  }
}

/**
 * Passos do embarque e do desembaraço (`import_steps`: booking, documentos de
 * carga, presença de carga, canal, DI, nota…) dos marcos que o Sankhya mostra
 * que já passaram: gravados como validados, só os que ainda não existem (o
 * que o portal já gravou fica). Certificação, amostras e divergência seguem
 * as regras do portal.
 */
async function closeImportSteps(
  store: Store,
  orderId: string,
  done: ReadonlySet<string>,
  at: string,
) {
  if (!done.size) return;
  const [
    { IMPORT_STEPS },
    { flowStepOfImportKey, stepId },
    { milestoneOfStep },
  ] = await Promise.all([
    import("@/lib/services/import-flow"),
    import("@/lib/flow"),
    import("@/lib/milestones"),
  ]);
  const keys = IMPORT_STEPS.map((t) => t.key).filter((key) => {
    if (/^(cert_|samples_|divergence_)/.test(key)) return false;
    const step = flowStepOfImportKey(key);
    const milestone = step ? milestoneOfStep(stepId(step)) : null;
    return !!milestone && done.has(milestone);
  });
  if (!keys.length) return;
  const have = new Set(
    (await store.list("import_steps", { filter: { orderId } })).map(
      (s) => s.key,
    ),
  );
  for (const key of keys) {
    if (have.has(key)) continue;
    await store.create("import_steps", {
      orderId,
      key,
      status: "validated",
      value: "Concluído no Sankhya (carga dos pedidos)",
      amount: null,
      currency: null,
      documentId: null,
      submittedByUserId: null,
      submittedAt: at,
      validatedByUserId: null,
      validatedAt: at,
      rejectReason: null,
    } as never);
  }
}

async function upsertRows<K extends "order_items" | "container_items">(
  store: Store,
  table: K,
  rows: Array<Record<string, unknown> & { id: string }>,
) {
  if (!rows.length) return;
  if (store.upsertMany) {
    await store.upsertMany(table, rows as never);
    return;
  }
  for (const r of rows) {
    const { id, ...rest } = r;
    if (await store.get(table, id))
      await store.update(table, id, rest as never);
    else await store.create(table, r as never);
  }
}

/** Embarques (35) de cada track do bloco, pelo ensaio dos embarques. */
async function trackShipments(store: Store, rows: ProjectionOrder[]) {
  const keys = [
    ...new Set(
      rows.flatMap((r) =>
        (Array.isArray(r.data?.shipments) ? r.data!.shipments : []).map(String),
      ),
    ),
  ];
  const found = keys.length
    ? await chunkRows<ProjectionShipment>(
        store,
        keys.map((k) => `shipment:${k}`),
      )
    : [];
  const byKey = new Map<string, TrackShipment>(
    found.map((s) => [
      s.key,
      {
        open: s.situation === "in_progress",
        customs: s.milestone === "customs",
        prenota: !!s.data?.prenota,
        eta: sankhyaIso(s.data?.eta),
        channel: s.data?.customsChannel ?? null,
      },
    ]),
  );
  return new Map(
    rows.map((r) => [
      r.key,
      (Array.isArray(r.data?.shipments) ? r.data!.shipments : [])
        .map((n) => byKey.get(String(n)))
        .filter((s): s is TrackShipment => !!s),
    ]),
  );
}

/** A linha do ensaio com a situação e o marco do de-para (seção 9.4). */
function effectiveRow(
  row: ProjectionOrder,
  ships: Map<string, TrackShipment[]>,
): ProjectionOrder {
  if (isReplenishmentTrack(row)) return row;
  const situation = trackSituation(row);
  if (situation !== "in_progress") return { ...row, situation };
  return {
    ...row,
    situation,
    milestone: trackMilestone(row, ships.get(row.key) ?? []),
  };
}

/**
 * Track que parou na 1100 (Pre-order): uma reposição por item, para o
 * estoque Wellmix, com o número = TRACK_ID. Pendente no Sankhya: aberta
 * (REQUESTED) em /app/replenishment; sem pendência é Pre-order reprovada e
 * não entra (dono, 22/11/2026). Rodar de novo atualiza a quantidade.
 */
async function loadReplenishment(
  user: User,
  store: Store,
  row: ProjectionOrder,
  productByCode: Map<string | null | undefined, { id: string }>,
  progress: OrdersLoadProgress,
) {
  const open = row.situation === "in_progress";
  const items = row.data?.items ?? [];
  const ids = items.map((i) =>
    sankhyaReplenishmentId(row.key, i.doc ?? mainKeyOf(row), i.seq),
  );
  const have = new Map(
    (await listByIds(store, "requests", ids)).map((r) => [r.id, r]),
  );
  if (!open) {
    // Pre-order sem pendência = reprovada: não entra no portal (dono,
    // 22/11/2026). A que uma carga anterior gravou sai, se não andou no portal.
    const stale = [...have.values()].filter(
      (r) => r.status === "REQUESTED" || r.status === "CANCELLED",
    );
    for (let i = 0; i < stale.length; i += 20)
      await Promise.all(
        stale.slice(i, i + 20).map((r) => store.remove("requests", r.id)),
      );
    progress.rejectedPreOrders = (progress.rejectedPreOrders ?? 0) + 1;
    return;
  }
  const { ensureStockParty } = await import("@/lib/services/stock-party");
  const stock = await ensureStockParty(user);
  const number = orderNumberOf(row);
  const desiredAt = sankhyaIso(row.data?.orderedAt);
  // Em lote (22/11/2026): uma 1100 chega a 919 itens, e gravar um a um passava
  // dos 60 s da página. Novas vão juntas; as que existem só mudam se o
  // Sankhya mudou (a situação segue o Sankhya enquanto não andou no portal).
  const fresh: Array<Record<string, unknown> & { id: string }> = [];
  const changed: Array<{ id: string; patch: Record<string, unknown> }> = [];
  for (const [n, item] of items.entries()) {
    const id = ids[n];
    const name = item.name?.trim() || `Produto ${item.codprod ?? "—"}`;
    const fields = {
      productId: productByCode.get(item.codprod ?? "")?.id ?? null,
      productName: name.slice(0, 160),
      quantity: Number(item.qty) || 0,
      unit: (item.unit?.trim() || "UN").slice(0, 20),
      sankhyaCode: `${item.doc ?? mainKeyOf(row)}-${item.seq}`,
      desiredAt,
      // Uma solicitação por track, com os produtos dentro (dono, 22/11/2026):
      // o mesmo lote de /app/requests/batch/<groupId>.
      groupId: sankhyaReplenishmentGroupId(row.key),
    };
    const before = have.get(id);
    if (before) {
      const status =
        before.status === "REQUESTED" || before.status === "CANCELLED"
          ? open
            ? "REQUESTED"
            : "CANCELLED"
          : before.status;
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries({ ...fields, status }))
        if ((before as unknown as Record<string, unknown>)[k] !== v)
          patch[k] = v;
      if (Object.keys(patch).length) changed.push({ id, patch });
    } else {
      fresh.push({
        id,
        ...fields,
        number,
        customerId: stock.id,
        createdByUserId: user.id,
        requestedForUserId: null,
        description: name,
        specification: item.ref ? `Ref. fornecedor: ${item.ref}` : null,
        deadline: null,
        status: open ? "REQUESTED" : "CANCELLED",
        orderId: null,
        sellPrice: null,
        sellCurrency: null,
        downPaymentAmount: null,
        origin: "replenishment",
        sourceOrderId: null,
        notes: `Importada do Sankhya (Pre-order 1100): TRACK_ID ${row.data?.track ?? "—"}, NUNOTA ${item.doc ?? mainKeyOf(row)}, item ${item.seq}${row.supplierName ? `, fornecedor ${row.supplierName}` : ""}`,
      });
    }
  }
  if (fresh.length) {
    if (store.upsertMany) await store.upsertMany("requests", fresh as never);
    else for (const r of fresh) await store.create("requests", r as never);
  }
  for (let i = 0; i < changed.length; i += 20)
    await Promise.all(
      changed
        .slice(i, i + 20)
        .map((c) => store.update("requests", c.id, c.patch as never)),
    );
  progress.replenishments = (progress.replenishments ?? 0) + items.length;
}

/** Tabelas que a carga grava por pedido (o pedido de 1100 sai com elas). */
const LOADED_ORDER_TABLES = [
  "order_items",
  "requirements",
  "order_milestones",
  "import_steps",
  "order_summaries",
  "stages",
  "process_events",
  "container_items",
] as const;

/** Tira um pedido gravado por carga anterior (track que é reposição). */
async function removeLoadedOrder(store: Store, orderId: string) {
  // Em paralelo (22/11/2026: um a um, o bloco de 10 pedidos passava dos 60 s).
  await Promise.all(
    LOADED_ORDER_TABLES.map(async (table) => {
      const rows = await store.list(table, { filter: { orderId } as never });
      for (let i = 0; i < rows.length; i += 20)
        await Promise.all(
          rows.slice(i, i + 20).map((r) => store.remove(table, r.id)),
        );
    }),
  );
  await store.remove("orders", orderId);
}

/**
 * Grava um bloco de pedidos e devolve quantas chaves do bloco ficaram prontas.
 * Passado o prazo do passo, para no pedido seguinte (22/11/2026: 10 pedidos
 * em andamento, cada um com as pendências a criar, passavam dos 60 s da
 * página, e o bloco inteiro era refeito a cada "Continuar").
 */
async function loadOrdersChunk(
  user: User,
  store: Store,
  keys: string[],
  progress: OrdersLoadProgress,
  deadline = Number.POSITIVE_INFINITY,
): Promise<number> {
  const loaded = await chunkRows<ProjectionOrder>(
    store,
    keys.map((k) => `order:${k}`),
  );
  const ships = await trackShipments(store, loaded);
  const rows = loaded.map((r) => effectiveRow(r, ships));
  const [emps, existing, suppliers, products] = await Promise.all([
    companiesOf(store, rows.map(mainKeyOf)),
    listByIds(store, "orders", keys.map(sankhyaOrderId)),
    store.list("parties", {
      filter: {
        type: "supplier",
        sankhyaCode: [
          ...new Set(rows.map((r) => r.supplierCode).filter(Boolean)),
        ],
      } as never,
    }),
    store.list("products", {
      filter: {
        sankhyaCode: [
          ...new Set(
            rows.flatMap((r) =>
              (r.data?.items ?? []).map((i) => i.codprod).filter(Boolean),
            ),
          ),
        ],
      } as never,
    }),
  ]);
  const existingById = new Map(existing.map((o) => [o.id, o]));
  const supplierByCode = new Map(suppliers.map((p) => [p.sankhyaCode, p]));
  const productByCode = new Map(products.map((p) => [p.sankhyaCode, p]));
  const companies = new Map<string, Party>();
  const held = await holdState();
  const { lineAgencyOf } = await import("@/lib/services/line-agency");
  const now = new Date().toISOString();
  let handled = 0;
  for (const row of rows.sort((a, b) => Number(a.key) - Number(b.key))) {
    if (handled > 0 && Date.now() >= deadline) {
      const at = keys.indexOf(row.key);
      return at >= 0 ? at : keys.length;
    }
    handled++;
    const skip = (reason: string) => {
      if (progress.skipped.length < MAX_SKIPPED)
        progress.skipped.push({ key: row.key, reason });
    };
    if (isReplenishmentTrack(row)) {
      // 1100 não é pedido: vira reposição (aberta se pendente no Sankhya,
      // encerrada como histórico se não) e sai de Pedidos.
      await loadReplenishment(user, store, row, productByCode, progress);
      const old = existingById.get(sankhyaOrderId(row.key));
      if (old) {
        await removeLoadedOrder(store, old.id);
        progress.removedOrders = (progress.removedOrders ?? 0) + 1;
      }
      continue;
    }
    const supplier = supplierByCode.get(row.supplierCode ?? "");
    if (!supplier) {
      skip(`fornecedor ${row.supplierCode ?? "—"} não cadastrado`);
      continue;
    }
    const emp = emps.get(mainKeyOf(row));
    if (!emp) {
      skip("empresa compradora (CODEMP) ausente na cópia");
      continue;
    }
    const customer = await companyParty(store, companies, emp);
    const items = row.data?.items ?? [];
    const first = productByCode.get(items[0]?.codprod ?? "") ?? null;
    const id = sankhyaOrderId(row.key);
    const before = existingById.get(id);
    const fields = {
      ...orderFieldsOf(row, now),
      requestId: null,
      customerId: customer.id,
      supplierId: supplier.id,
      lineId: first?.lineId ?? null,
      sankhyaSyncedAt: now,
      sankhyaRefs: {
        CODEMP: emp,
        TOP: row.top ?? "",
        ...(row.data?.reason ? { MOTIVO: row.data.reason } : {}),
        // ETA da 1104 = chegada no destino final (depósito; dono, 21/11/2026):
        // a previsão de entrega na Nota fiscal e transporte.
        ...(sankhyaIso(row.data?.eta)
          ? { ETA_FINAL: sankhyaIso(row.data?.eta)! }
          : {}),
        ...(row.milestone ? { MARCO: row.milestone } : {}),
      },
      // O pedido aparece nas listas na situação real; só as pendências ficam
      // em espera até o go-live, sem avisos (docs/SANKHYA_INTEGRACAO.md, 5.2;
      // 21/11/2026: com o pedido em espera ele sumia de Pedidos e dos Overviews).
      held: null,
    };
    let order: Order | null = null;
    if (!before) {
      try {
        order = await store.create("orders", {
          ...ORDER_EXTRA_DEFAULTS,
          id,
          number:
            orderNumberOf(row) ?? (await store.nextNumber("order_number")),
          currentStageId: null,
          sellPrice: null,
          sellCurrency: null,
          agencyId: await lineAgencyOf(first?.lineId),
          brokerId: null,
          shippingLineId: null,
          carrierId: null,
          notes: `Importado do Sankhya (carga dos pedidos, ${now.slice(0, 10)}): TRACK_ID ${row.data?.track ?? "—"}, NUNOTA ${mainKeyOf(row)}, TOP ${row.top ?? "—"}`,
          ...fields,
        } as never);
        progress.created++;
      } catch (error) {
        // Já gravado por outra rodada ao mesmo tempo: segue como atualização.
        if (!/duplicate|23505|duplicado|already exists/i.test(String(error)))
          throw error;
      }
    }
    if (!order) {
      // Pedido já carregado: o Sankhya manda nos campos dele; a situação no
      // portal (marcos e itens) segue a do portal.
      const { status: _s, closedAt: _c, ...rest } = fields;
      void _s;
      void _c;
      const current = before ?? (await store.get("orders", id));
      // O número segue o do Sankhya (o track), também nos pedidos já gravados.
      const number = orderNumberOf(row);
      if (number !== null && current && current.number !== number)
        Object.assign(rest, { number });
      order = await store.update(
        "orders",
        id,
        (current?.status === "ORDER_CREATED" && fields.status === "CLOSED"
          ? fields
          : rest) as never,
      );
      progress.updated++;
    }
    await upsertRows(
      store,
      "order_items",
      items.map((item) => ({
        ...itemFieldsOf(row, item),
        orderId: id,
        productId: productByCode.get(item.codprod ?? "")?.id ?? null,
      })),
    );
    if (row.situation === "in_progress") {
      // Novo, ou antes sem pendências ("Aguardando definição" que entrou no
      // de-para): cria os itens do portal.
      const create = !before || before.sankhyaSituation !== "in_progress";
      await openRequirements(store, order, row, held, { create });
      if (create) progress.withPending++;
    }
  }
  return keys.length;
}

/**
 * NUNOTA de cada documento das cadeias → NUNOTA da ponta (o pedido). No
 * "Caminho antigo" (1103 → 30), o 30 que saiu da ponta também leva ao
 * pedido: é dele que o embarque (35) sai.
 */
async function chainLeaves(store: Store) {
  const rows = await listColumns(
    store,
    "sankhya_projection",
    ["kind", "key", "situation", "data"],
    { jsonKeys: { data: ["chain", "shipments"] } },
  );
  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.kind !== "order") continue;
    const data = r.data as {
      chain?: Array<{ nunota?: unknown }>;
      shipments?: unknown[];
    } | null;
    const docs = [
      ...(Array.isArray(data?.chain) ? data!.chain.map((d) => d?.nunota) : []),
      ...(r.situation === "legacy_path" && Array.isArray(data?.shipments)
        ? data!.shipments
        : []),
    ];
    for (const n of docs)
      if (n !== undefined && n !== null && String(n) !== r.key)
        out.set(String(n), r.key);
  }
  return out;
}

async function loadShipmentsChunk(
  user: User,
  store: Store,
  keys: string[],
  progress: OrdersLoadProgress,
) {
  const rows = await chunkRows<ProjectionShipment>(
    store,
    keys.map((k) => `shipment:${k}`),
  );
  // Cada linha do 35 sai de um documento (a 1104, ou o 30 no caminho
  // antigo); o pedido é o track que contém esse documento (docs/SANKHYA_TRACK_ID.md).
  const trackOf = await chainLeaves(store);
  const linesOf = (r: ProjectionShipment) =>
    shipmentLines(r.data?.orders).map((o) => ({
      ...o,
      doc: o.order,
      track: trackOf.get(String(o.order)) ?? String(o.order),
    }));
  const orderIds = [
    ...new Set(
      rows.flatMap((r) => linesOf(r).map((o) => sankhyaOrderId(o.track))),
    ),
  ];
  const [orders, items, suppliers] = await Promise.all([
    listByIds(store, "orders", orderIds),
    orderIds.length
      ? store.list("order_items", { filter: { orderId: orderIds } as never })
      : Promise.resolve([]),
    store.list("parties", {
      filter: {
        type: "supplier",
        sankhyaCode: [
          ...new Set(rows.map((r) => r.supplierCode).filter(Boolean)),
        ],
      } as never,
    }),
  ]);
  const loaded = new Set(orders.map((o) => o.id));
  const mainOf = new Map(orders.map((o) => [o.id, o.sankhyaCode ?? ""]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const supplierByCode = new Map(suppliers.map((p) => [p.sankhyaCode, p]));
  const containers = await listByIds(
    store,
    "containers",
    rows.map((r) => sankhyaContainerId(r.key)),
  );
  const have = new Set(containers.map((c) => c.id));
  for (const row of rows) {
    const d = row.data ?? {};
    const id = sankhyaContainerId(row.key);
    const numnota = (d.numnota ?? "").trim();
    const fields = {
      code: numnota && numnota !== "0" ? numnota : row.key,
      status: containerStatusOf(row),
      etd: sankhyaIso(d.etd),
      eta: sankhyaIso(d.eta),
      sankhyaCode: row.key,
      sankhyaChain: [
        {
          nunota: Number(row.key),
          top: 35,
          pending: row.situation === "in_progress",
          date: sankhyaIso(d.orderedAt),
        },
      ],
      supplierId: supplierByCode.get(row.supplierCode ?? "")?.id ?? null,
    };
    if (have.has(id)) await store.update("containers", id, fields as never);
    else
      await store.create("containers", {
        id,
        type: "—",
        capacityCbm: 0,
        maxWeightKg: null,
        customerId: null,
        notes: `Embarque do Sankhya (documento 35, NUNOTA ${row.key})`,
        createdByUserId: user.id,
        ...fields,
      } as never);
    progress.containers++;
    const lines = linesOf(row).flatMap((o) => {
      const orderId = sankhyaOrderId(o.track);
      if (!loaded.has(orderId)) return [];
      // O item do próprio documento; senão, o da ponta principal com a mesma
      // sequência (o 35 que saiu de um documento do meio da cadeia).
      const item =
        itemById.get(sankhyaTrackItemId(o.track, o.doc, o.seq)) ??
        itemById.get(
          sankhyaTrackItemId(o.track, mainOf.get(orderId) ?? o.doc, o.seq),
        );
      if (!item) return [];
      const qty = Number(o.qty) || 0;
      const boxes = Number(item.sankhyaRefs?.QTD_CAIXAS ?? 0);
      const perBox = boxes > 0 && item.quantity > 0 ? item.quantity / boxes : 0;
      return [
        {
          id: sankhyaContainerItemId(row.key, o.doc, o.seq),
          containerId: id,
          orderId,
          orderItemId: item.id,
          productId: item.productId,
          name: item.name,
          quantity: qty,
          unit: item.unit,
          unitsPerBox: perBox > 0 ? Math.round(perBox) : null,
          boxCount: perBox > 0 ? Math.round(qty / perBox) : 0,
          cbmPerBox: 0,
          weightPerBoxKg: null,
        },
      ];
    });
    await upsertRows(store, "container_items", lines);
  }
}

/**
 * Um passo da carga: começa (`restart`), segue de onde parou e devolve o
 * andamento. A tela repete até `phase` = "done".
 */
export async function runOrdersLoadStep(
  user: User,
  options: { restart?: boolean; budgetMs?: number } = {},
): Promise<OrdersLoadProgress> {
  assertAdmin(user);
  const store = getStore();
  let progress = await ordersLoadProgress(user);
  const lockMs = (options.budgetMs ?? STEP_BUDGET_MS) + 30_000;
  if (progress.lockUntil && Date.parse(progress.lockUntil) > Date.now())
    return progress;
  if (
    options.restart ||
    progress.phase === "idle" ||
    progress.phase === "done"
  ) {
    const keys = await projectionKeys(store, "order");
    progress = {
      ...EMPTY,
      phase: "orders",
      total: keys.length,
      startedAt: new Date().toISOString(),
    };
    if (!keys.length) {
      progress.phase = "done";
      progress.finishedAt = progress.startedAt;
    }
    await writeSetting(ORDERS_LOAD_KEY, progress);
    return progress;
  }
  const began = Date.now();
  const deadline = began + (options.budgetMs ?? STEP_BUDGET_MS);
  progress.lockUntil = new Date(began + lockMs).toISOString();
  await writeSetting(ORDERS_LOAD_KEY, progress);
  if (progress.phase === "orders") {
    const keys = await projectionKeys(store, "order");
    do {
      const slice = keys.slice(progress.done, progress.done + ORDER_CHUNK);
      if (!slice.length) break;
      progress.done += await loadOrdersChunk(
        user,
        store,
        slice,
        progress,
        deadline,
      );
      await writeSetting(ORDERS_LOAD_KEY, progress);
    } while (Date.now() < deadline);
    if (progress.done >= keys.length) {
      const ships = await projectionKeys(store, "shipment");
      progress.phase = "shipments";
      progress.done = 0;
      progress.total = ships.length;
    }
  } else if (progress.phase === "shipments") {
    const keys = await projectionKeys(store, "shipment");
    do {
      const slice = keys.slice(progress.done, progress.done + SHIPMENT_CHUNK);
      if (!slice.length) break;
      await loadShipmentsChunk(user, store, slice, progress);
      progress.done += slice.length;
      await writeSetting(ORDERS_LOAD_KEY, progress);
    } while (Date.now() < deadline);
    if (progress.done >= keys.length) {
      progress.phase = "done";
      progress.finishedAt = new Date().toISOString();
      // Resumos e indicadores dos pedidos novos (docs/RESUMOS.md): começa a
      // reconstrução em partes; o job da madrugada termina o que faltar.
      try {
        const { rebuildOrderSummariesStep } =
          await import("@/lib/services/order-summary");
        await rebuildOrderSummariesStep({ budgetMs: 5_000, start: true });
      } catch (error) {
        console.error("[sankhya-orders] resumos", error);
      }
    }
  }
  progress.lockUntil = null;
  await writeSetting(ORDERS_LOAD_KEY, progress);
  return progress;
}
