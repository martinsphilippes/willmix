import "server-only";
import {
  getStore,
  type Order,
  type Party,
  type Product,
  type ProductLine,
  type User,
} from "@/lib/db";
import {
  datasetSave,
  loadRecords,
  upsertNoteItems,
  type NoteInput,
  executeQuery,
} from "./sankhya-client";
import { sqlTerm } from "./sankhya-dictionary";
import {
  getSankhyaErpSettings,
  type SankhyaErpSettings,
} from "./sankhya-settings";

/*
 * Sincronização portal → Sankhya (fase 3; docs/SANKHYA.md, decisões 8 e 14):
 * fornecedor, cliente e produto novos no portal são incluídos no Sankhya;
 * alterações vão para lá; itens do pedido ligado (quantidade, preço, item
 * novo) também. Pedido novo e cancelamento seguem as regras de processo
 * (docs/PROCESSES.md).
 *
 * Pendente = criado a partir de `syncSince` (gravado ao ligar a execução) e
 * sem código do Sankhya, ou alterado depois da última sincronização
 * (`sankhyaSyncedAt`). O que veio da carga já nasce sincronizado e nunca volta
 * duplicado; antes de incluir, procura no Sankhya pelo CNPJ/nome ou pelo SKU
 * (REFFORN) e só vincula quando já existe.
 *
 * Roda: logo depois das telas principais de cadastro gravarem, no job diário
 * (/api/jobs/reminders), em /api/jobs/sankhya-sync e no botão "Sincronizar
 * agora" (Configurações → Processos). Com a execução desligada, não escreve
 * nada. Cada envio fica em process_events (evento sync:*).
 */

export type SyncEntity = "party" | "product" | "order";
export type SyncKind = "create" | "update";

/** Carimbo de sincronizado: 10 s à frente, para a própria gravação não virar pendência. */
export const syncedStamp = () => new Date(Date.now() + 10_000).toISOString();

const later = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "") > (b ?? "") ? (a ?? "") : (b ?? "");

/** Puro: o que falta sincronizar num cadastro (fornecedor/cliente ou produto). */
export function pendingKind(
  row: {
    createdAt: string;
    updatedAt: string;
    sankhyaCode?: string | null;
    sankhyaSyncedAt?: string | null;
  },
  since: string | null | undefined,
): SyncKind | null {
  if (!since) return null;
  if (!row.sankhyaCode) return row.createdAt >= since ? "create" : null;
  return row.updatedAt > later(since, row.sankhyaSyncedAt) ? "update" : null;
}

const SYNC_PARTY_TYPES = new Set<Party["type"]>(["supplier", "customer"]);

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Colunas de endereço do Parceiro guardadas nos códigos (sankhyaRefs). */
const ADDRESS_REFS = [
  "CODCID",
  "CODEND",
  "CODBAI",
  "NUMEND",
  "COMPLEMENTO",
  "CEP",
] as const;

/** Puro: campos do Parceiro (TGFPAR) a partir do cadastro do portal. */
export function partnerValues(
  party: Party,
  erp: SankhyaErpSettings,
  kind: SyncKind,
  /** Códigos achados no Sankhya na hora (ex.: CODCID pela cidade). */
  resolved: Record<string, string | number> = {},
): Record<string, string | number | null> {
  const doc = digits(party.taxId);
  // Endereço: os códigos que vieram do Sankhya (carga) ou achados agora.
  const refs = party.sankhyaRefs ?? {};
  const address = Object.fromEntries(
    ADDRESS_REFS.filter((k) => refs[k] != null || resolved[k] != null).map(
      (k) => [k, resolved[k] ?? refs[k]],
    ),
  );
  return {
    ...(kind === "create" ? (erp.partnerDefaults ?? {}) : {}),
    ...(kind === "create" ? address : {}),
    NOMEPARC: party.name,
    ...(kind === "create" || party.legalName
      ? { RAZAOSOCIAL: party.legalName || party.name }
      : {}),
    TIPPESSOA:
      party.personType === "F" || party.personType === "J"
        ? party.personType
        : doc.length === 11
          ? "F"
          : "J",
    ...(party.stateRegistration
      ? { IDENTINSCESTAD: party.stateRegistration }
      : {}),
    CGC_CPF: doc || null,
    EMAIL: party.email,
    TELEFONE: party.phone,
    ATIVO: party.active ? "S" : "N",
    ...(party.type === "supplier" ? { FORNECEDOR: "S" } : { CLIENTE: "S" }),
  };
}

const meters = (cm: number | null | undefined) =>
  cm == null ? null : Math.round((cm / 100) * 10000) / 10000;

/** Puro: campos do Produto (TGFPRO) a partir do cadastro do portal. */
export function productValues(
  product: Product,
  line: ProductLine | null,
  erp: SankhyaErpSettings,
  kind: SyncKind,
): Record<string, string | number | null> {
  return {
    ...(kind === "create" ? (erp.productDefaults ?? {}) : {}),
    DESCRPROD: product.name,
    REFFORN: product.sku,
    REFERENCIA: product.ean ?? null,
    NCM: digits(product.ncm) || null,
    CODVOL: erp.codVol || "UN",
    CODGRUPOPROD: line?.sankhyaCode ?? null,
    PESOBRUTO: product.grossWeightKg,
    PESOLIQ: product.netWeightKg,
    ALTURA: meters(product.heightCm),
    LARGURA: meters(product.widthCm),
    ESPESSURA: meters(product.lengthCm),
    ...(product.brand ? { MARCA: product.brand } : {}),
    ATIVO: product.active ? "S" : "N",
  };
}

type Logged = {
  status: "done" | "skipped" | "error";
  detail: string;
  code?: string | null;
};

const errorText = (error: unknown) => {
  const e = error as { code?: string; detail?: string; message?: string };
  return `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`.slice(
    0,
    1500,
  );
};

async function log(
  user: User | null,
  entity: SyncEntity,
  id: string,
  kind: SyncKind,
  result: Logged,
  extra: { orderId?: string | null; nunota?: string | null } = {},
) {
  try {
    await getStore().create("process_events", {
      event: `sync:${entity}:${kind}`,
      requestId: null,
      orderId: extra.orderId ?? null,
      stockAction: "none",
      sankhyaAction: kind,
      top: null,
      status: result.status,
      detail: result.detail,
      nunotaBefore: extra.nunota ?? null,
      nunotaAfter: extra.nunota ?? null,
      createdByUserId: user?.id ?? null,
      entity,
      entityId: id,
    });
  } catch (error) {
    console.error("[sankhya-sync] log", error);
  }
}

async function findPartner(party: Party): Promise<string | null> {
  const doc = digits(party.taxId);
  const where = doc ? "CGC_CPF = ?" : "NOMEPARC = ?";
  const value = doc || party.name;
  const found = await loadRecords({
    entity: "Parceiro",
    fields: "CODPARC",
    where,
    params: [{ type: "S", value }],
  });
  const code = found.rows[0]?.CODPARC;
  return code == null ? null : String(code);
}

async function findProduct(product: Product): Promise<string | null> {
  if (!product.sku) return null;
  const found = await loadRecords({
    entity: "Produto",
    fields: "CODPROD",
    where: "REFFORN = ?",
    params: [{ type: "S", value: product.sku }],
  });
  const code = found.rows[0]?.CODPROD;
  return code == null ? null : String(code);
}

/** Fornecedor ou cliente → Parceiro no Sankhya (inclui, vincula ou altera). */
export async function syncParty(
  user: User | null,
  party: Party,
  erp: SankhyaErpSettings,
  kind: SyncKind,
): Promise<Logged> {
  const store = getStore();
  let result: Logged;
  try {
    let code = party.sankhyaCode ?? null;
    if (kind === "create") {
      code = await findPartner(party);
      if (!code) {
        // Cadastro nascido no portal: acha o CODCID pela cidade "Nome - UF".
        const resolved = party.sankhyaRefs?.CODCID
          ? {}
          : await cityCode(party.city);
        await datasetSave({
          entity: "Parceiro",
          values: partnerValues(party, erp, "create", resolved),
        });
        code = await findPartner(party);
        if (!code) throw new Error("incluído, mas não achei o CODPARC");
        result = {
          status: "done",
          detail: `Sankhya: parceiro ${code} incluído`,
          code,
        };
      } else {
        // Já existe lá: vincula e manda o que o portal tem.
        await datasetSave({
          entity: "Parceiro",
          pk: { CODPARC: code },
          values: partnerValues(party, erp, "update"),
        });
        result = {
          status: "done",
          detail: `Sankhya: vinculado ao parceiro ${code}`,
          code,
        };
      }
    } else {
      await datasetSave({
        entity: "Parceiro",
        pk: { CODPARC: code! },
        values: partnerValues(party, erp, "update"),
      });
      result = {
        status: "done",
        detail: `Sankhya: parceiro ${code} alterado`,
        code,
      };
    }
    await store.update("parties", party.id, {
      sankhyaCode: code,
      sankhyaSyncedAt: syncedStamp(),
    });
  } catch (error) {
    result = {
      status: "error",
      detail: `Sankhya: ${party.name}: ${errorText(error)}`,
    };
  }
  await log(user, "party", party.id, kind, result);
  return result;
}

/**
 * CODCID da cidade do portal ("Itajaí - SC" ou só "Itajaí") no Sankhya
 * (TSICID + TSIUFS). Nada achado (ou consulta recusada) = vazio.
 */
export async function cityCode(
  city: string | null | undefined,
): Promise<Record<string, number>> {
  const [name, uf] = (city ?? "").split(/\s+-\s+/);
  const n = sqlTerm(name ?? "");
  const u = sqlTerm(uf ?? "").slice(0, 2);
  if (!n) return {};
  try {
    const table = await executeQuery(
      `SELECT C.CODCID FROM TSICID C${u ? " JOIN TSIUFS U ON U.CODUF = C.UF" : ""} WHERE UPPER(C.NOMECID) = '${n}'${u ? ` AND U.UF = '${u}'` : ""}`,
    );
    const code = Number(table.rows[0]?.CODCID);
    return Number.isInteger(code) && code > 0 ? { CODCID: code } : {};
  } catch {
    return {};
  }
}

/** Produto → Produto no Sankhya (inclui, vincula pelo REFFORN ou altera). */
export async function syncProduct(
  user: User | null,
  product: Product,
  erp: SankhyaErpSettings,
  kind: SyncKind,
): Promise<Logged> {
  const store = getStore();
  let result: Logged;
  try {
    const line = await store.get("product_lines", product.lineId);
    let code = product.sankhyaCode ?? null;
    if (kind === "create") code = await findProduct(product);
    const values = productValues(
      product,
      line,
      erp,
      code ? "update" : "create",
    );
    if (!code && values.CODGRUPOPROD == null)
      throw new Error(
        `a linha ${line?.name ?? "?"} não tem grupo do Sankhya (CODGRUPOPROD)`,
      );
    if (!code) {
      await datasetSave({ entity: "Produto", values });
      code = await findProduct(product);
      if (!code)
        throw new Error(
          "incluído, mas não achei o CODPROD (o produto tem SKU?)",
        );
      result = {
        status: "done",
        detail: `Sankhya: produto ${code} incluído`,
        code,
      };
    } else {
      if (values.CODGRUPOPROD == null) delete values.CODGRUPOPROD;
      await datasetSave({ entity: "Produto", pk: { CODPROD: code }, values });
      result = {
        status: "done",
        detail:
          kind === "create"
            ? `Sankhya: vinculado ao produto ${code}`
            : `Sankhya: produto ${code} alterado`,
        code,
      };
    }
    await store.update("products", product.id, {
      sankhyaCode: code,
      sankhyaSyncedAt: syncedStamp(),
    });
  } catch (error) {
    result = {
      status: "error",
      detail: `Sankhya: ${product.name}: ${errorText(error)}`,
    };
  }
  await log(user, "product", product.id, kind, result);
  return result;
}

/**
 * Itens do pedido ligado → itens da nota no Sankhya: quantidade e preço que
 * mudaram e itens novos (CACSP.incluirAlterarItemNota). Item que saiu do
 * pedido não é apagado lá: o registro avisa.
 */
export async function syncOrderItems(
  user: User | null,
  order: Order,
  erp: SankhyaErpSettings,
): Promise<Logged> {
  const store = getStore();
  const nunota = order.sankhyaCode!;
  let result: Logged;
  try {
    const [items, remote] = await Promise.all([
      store.list("order_items", { filter: { orderId: order.id } }),
      loadRecords({
        entity: "ItemNota",
        fields: "SEQUENCIA, CODPROD, QTDNEG, VLRUNIT",
        where: "NUNOTA = ?",
        params: [{ type: "I", value: nunota }],
      }),
    ]);
    const used = new Set<number>();
    const changes: NoteInput["items"] = [];
    const missing: string[] = [];
    for (const item of items) {
      const product = item.productId
        ? await store.get("products", item.productId)
        : null;
      if (!product?.sankhyaCode) {
        missing.push(item.name);
        continue;
      }
      const index = remote.rows.findIndex(
        (r, i) => !used.has(i) && String(r.CODPROD) === product.sankhyaCode,
      );
      if (index >= 0) {
        used.add(index);
        const r = remote.rows[index];
        const sameQty = Number(r.QTDNEG) === item.quantity;
        const samePrice =
          item.unitPrice == null || Number(r.VLRUNIT) === item.unitPrice;
        if (!sameQty || !samePrice)
          changes.push({
            SEQUENCIA: String(r.SEQUENCIA),
            CODPROD: product.sankhyaCode,
            QTDNEG: item.quantity,
            VLRUNIT: item.unitPrice ?? Number(r.VLRUNIT),
            CODVOL: erp.codVol || "UN",
            CODEMP: erp.codEmp,
          });
      } else {
        changes.push({
          CODPROD: product.sankhyaCode,
          QTDNEG: item.quantity,
          VLRUNIT: item.unitPrice ?? 0,
          CODVOL: erp.codVol || "UN",
          CODEMP: erp.codEmp,
        });
      }
    }
    const extra = remote.rows.filter((_, i) => !used.has(i)).length;
    if (changes.length) await upsertNoteItems(nunota, changes, true);
    await store.update("orders", order.id, { sankhyaSyncedAt: syncedStamp() });
    result = {
      status: missing.length ? "error" : changes.length ? "done" : "skipped",
      detail: [
        changes.length
          ? `Sankhya: nota ${nunota}, ${changes.length} item(ns) incluído(s)/alterado(s)`
          : `Sankhya: nota ${nunota} já igual ao portal`,
        missing.length && `sem código do Sankhya: ${missing.join(", ")}`,
        extra &&
          `${extra} item(ns) só no Sankhya (remova lá se saiu do pedido)`,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  } catch (error) {
    result = {
      status: "error",
      detail: `Sankhya: nota ${nunota}: ${errorText(error)}`,
    };
  }
  await log(user, "order", order.id, "update", result, {
    orderId: order.id,
    nunota,
  });
  return result;
}

/* ---- Pendências e execução ---- */

export interface SyncPending {
  parties: Array<{ row: Party; kind: SyncKind }>;
  products: Array<{ row: Product; kind: SyncKind }>;
  orders: Order[];
}

export async function listPendingSync(
  erp?: SankhyaErpSettings,
): Promise<SyncPending> {
  const settings = erp ?? (await getSankhyaErpSettings());
  const since = settings.syncSince ?? null;
  const empty: SyncPending = { parties: [], products: [], orders: [] };
  if (!since) return empty;
  const store = getStore();
  const [parties, products, orders, items] = await Promise.all([
    store.list("parties"),
    store.list("products"),
    store.list("orders"),
    store.list("order_items"),
  ]);
  const itemChange = new Map<string, string>();
  for (const i of items)
    itemChange.set(i.orderId, later(itemChange.get(i.orderId), i.updatedAt));
  return {
    parties: parties
      .filter(
        (p) =>
          SYNC_PARTY_TYPES.has(p.type) && !p.sankhyaCode?.startsWith("EMP-"),
      )
      .map((row) => ({ row, kind: pendingKind(row, since) }))
      .filter((p): p is { row: Party; kind: SyncKind } => p.kind !== null),
    products: products
      .map((row) => ({ row, kind: pendingKind(row, since) }))
      .filter((p): p is { row: Product; kind: SyncKind } => p.kind !== null),
    orders: orders.filter(
      (o) =>
        !!o.sankhyaCode &&
        /^\d+$/.test(o.sankhyaCode) &&
        o.status !== "CANCELLED" &&
        (itemChange.get(o.id) ?? "") > later(since, o.sankhyaSyncedAt),
    ),
  };
}

export interface SyncRun {
  enabled: boolean;
  done: number;
  errors: number;
  remaining: number;
}

/** Envia as pendências até acabar o tempo (fornecedores/clientes, produtos, pedidos). */
export async function runSankhyaSync(
  user: User | null,
  budgetMs = 40_000,
): Promise<SyncRun> {
  const erp = await getSankhyaErpSettings();
  if (!erp.ordersEnabled || !erp.syncSince)
    return { enabled: false, done: 0, errors: 0, remaining: 0 };
  const started = Date.now();
  const pending = await listPendingSync(erp);
  const jobs: Array<() => Promise<Logged>> = [
    ...pending.parties.map((p) => () => syncParty(user, p.row, erp, p.kind)),
    ...pending.products.map((p) => () => syncProduct(user, p.row, erp, p.kind)),
    ...pending.orders.map((o) => () => syncOrderItems(user, o, erp)),
  ];
  let done = 0;
  let errors = 0;
  let index = 0;
  for (; index < jobs.length && Date.now() - started < budgetMs; index++) {
    const result = await jobs[index]();
    if (result.status === "error") errors++;
    else done++;
  }
  return { enabled: true, done, errors, remaining: jobs.length - index };
}

/** Logo depois de uma tela gravar: sincroniza aquele registro. Nunca lança. */
export async function syncSoon(
  user: User | null,
  entity: "party" | "product",
  id: string,
) {
  try {
    const erp = await getSankhyaErpSettings();
    if (!erp.ordersEnabled || !erp.syncSince) return;
    const store = getStore();
    if (entity === "party") {
      const row = await store.get("parties", id);
      if (!row || !SYNC_PARTY_TYPES.has(row.type)) return;
      const kind = pendingKind(row, erp.syncSince);
      if (kind) await syncParty(user, row, erp, kind);
    } else {
      const row = await store.get("products", id);
      if (!row) return;
      const kind = pendingKind(row, erp.syncSince);
      if (kind) await syncProduct(user, row, erp, kind);
    }
  } catch (error) {
    console.error("[sankhya-sync] syncSoon", entity, id, error);
  }
}
