import "server-only";
import { getStore, type Order, type Request, type User } from "@/lib/db";
import {
  mergeRules,
  ruleDoesSomething,
  ruleProblem,
  type ProcessEventKey,
  type ProcessRule,
} from "@/lib/process-rules";
import {
  getSankhyaErpSettings,
  readSetting,
  saveSankhyaErpSettings,
  writeSetting,
  type SankhyaErpSettings,
} from "@/lib/integrations/sankhya-settings";
import { audit } from "./audit";

/*
 * Motor das regras de processo (Configurações → Processos; docs/PROCESSES.md).
 * Cada mudança de status do portal chama `emitProcessEvent`; a regra do
 * evento diz se movimenta o estoque (entrada/saída das quantidades do
 * pedido) e se escreve no Sankhya (inclui a nota com a TOP, fatura a nota
 * ligada para a TOP seguinte ou cancela). Com a execução no Sankhya
 * desligada, a ação fica registrada como "simulada". Nunca derruba o fluxo
 * que chamou: erro vira registro com status "error".
 */

const RULES_KEY = "process.rules";

export async function getProcessRules(): Promise<ProcessRule[]> {
  return mergeRules(await readSetting<ProcessRule[]>(RULES_KEY));
}

export async function saveProcessRules(user: User, rules: ProcessRule[]) {
  const before = await getProcessRules();
  await writeSetting(RULES_KEY, rules);
  // As TOPs da cotação e do pedido vêm das regras (Integração e pedido de
  // teste usam as mesmas): cotação = "aguardando sinal → incluir nota",
  // pedido = "assinado pelos dois".
  const by = new Map(rules.map((r) => [r.event, r]));
  const quote = by.get("request:WAITING_DOWN_PAYMENT");
  const signed = by.get("order:signed");
  const erp = await getSankhyaErpSettings();
  const { updatedAt: _u, updatedBy: _b, ...rest } = erp;
  void _u;
  void _b;
  await saveSankhyaErpSettings(
    {
      ...rest,
      topQuote:
        quote?.sankhya === "create_note" && quote.top
          ? quote.top
          : erp.topQuote,
      topOrder:
        signed && signed.sankhya !== "none" && signed.top
          ? signed.top
          : erp.topOrder,
    },
    user.id,
  );
  await audit(
    user,
    "process.rules",
    "settings",
    RULES_KEY,
    "Regras de processo (status → estoque e Sankhya)",
    before,
    rules,
  );
}

export interface ProcessRefs {
  requestId?: string | null;
  orderId?: string | null;
}

type Outcome = {
  status: "done" | "simulated" | "skipped" | "error";
  detail: string;
  nunotaBefore?: string | null;
  nunotaAfter?: string | null;
};

const errorText = (error: unknown) => {
  const e = error as { code?: string; detail?: string; message?: string };
  return `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`.slice(
    0,
    1500,
  );
};

/** Dispara as regras do evento. Nunca lança. */
export async function emitProcessEvent(
  user: User | null,
  event: ProcessEventKey,
  refs: ProcessRefs,
): Promise<void> {
  try {
    const rule = (await getProcessRules()).find((r) => r.event === event);
    if (!rule || !ruleDoesSomething(rule)) return;
    await runRule(user, rule, refs);
  } catch (error) {
    console.error("[process]", event, error);
  }
}

async function runRule(
  user: User | null,
  rule: ProcessRule,
  refs: ProcessRefs,
) {
  const store = getStore();
  const order = refs.orderId ? await store.get("orders", refs.orderId) : null;
  const requestId = refs.requestId ?? order?.requestId ?? null;
  const request = requestId ? await store.get("requests", requestId) : null;

  // Uma vez por evento e pedido/solicitação (a mesma etapa pode reabrir).
  const previous = await store.list("process_events", {
    filter: order
      ? { event: rule.event, orderId: order.id }
      : { event: rule.event, requestId: requestId ?? "-" },
    limit: 5,
  });
  if (previous.some((p) => p.status === "done" || p.status === "simulated"))
    return;

  const log = await store.create("process_events", {
    event: rule.event,
    requestId,
    orderId: order?.id ?? null,
    stockAction: rule.stock,
    sankhyaAction: rule.sankhya,
    top: rule.top,
    status: "skipped",
    detail: null,
    nunotaBefore: order?.sankhyaCode ?? request?.sankhyaCode ?? null,
    nunotaAfter: null,
    createdByUserId: user?.id ?? null,
  });

  const parts: Outcome[] = [];
  if (rule.stock !== "none")
    parts.push(await moveStock(user, rule, log.id, order, request));
  if (rule.sankhya !== "none") {
    const erp = await getSankhyaErpSettings();
    parts.push(await sankhyaAction(user, rule, erp, order, request));
  }
  const status = parts.some((p) => p.status === "error")
    ? "error"
    : parts.some((p) => p.status === "done")
      ? "done"
      : parts.some((p) => p.status === "simulated")
        ? "simulated"
        : "skipped";
  const sankhya = parts.find((p) => p.nunotaAfter !== undefined);
  await store.update("process_events", log.id, {
    status,
    detail:
      parts
        .map((p) => p.detail)
        .join(" · ")
        .slice(0, 3000) || null,
    nunotaAfter: sankhya?.nunotaAfter ?? null,
  });
}

/* ---- Estoque ---- */

async function moveStock(
  user: User | null,
  rule: ProcessRule,
  eventId: string,
  order: Order | null,
  request: Request | null,
): Promise<Outcome> {
  const store = getStore();
  const lines = order
    ? (await store.list("order_items", { filter: { orderId: order.id } })).map(
        (i) => ({ productId: i.productId, quantity: i.quantity, unit: i.unit }),
      )
    : request
      ? [
          {
            productId: request.productId,
            quantity: request.quantity,
            unit: request.unit,
          },
        ]
      : [];
  const usable = lines.filter((l) => l.productId && l.quantity > 0);
  if (!usable.length)
    return { status: "skipped", detail: "estoque: sem produto do catálogo" };
  const sign = rule.stock === "entry" ? 1 : -1;
  // Local de estoque da regra (CODLOCAL → stock_locations).
  const location =
    rule.location != null
      ? ((await store.list("stock_locations").catch(() => [])).find(
          (x) => x.code === rule.location,
        ) ?? null)
      : null;
  for (const l of usable)
    await store.create("stock_movements", {
      productId: l.productId!,
      kind: sign > 0 ? "process_in" : "process_out",
      quantity: sign * l.quantity,
      unit: l.unit,
      orderId: order?.id ?? null,
      countId: null,
      countItemId: null,
      note: `Regra de processo: ${rule.event}`,
      createdByUserId: user?.id ?? "system",
      processEventId: eventId,
      locationId: location?.id ?? null,
    });
  return {
    status: "done",
    detail: `estoque: ${sign > 0 ? "entrada" : "saída"} de ${usable.length} item(ns)`,
  };
}

/* ---- Sankhya ---- */

async function sankhyaAction(
  user: User | null,
  rule: ProcessRule,
  erp: SankhyaErpSettings,
  order: Order | null,
  request: Request | null,
): Promise<Outcome> {
  const nunota = order?.sankhyaCode ?? request?.sankhyaCode ?? null;
  const what =
    rule.sankhya === "create_note"
      ? `incluir nota TOP ${rule.top ?? "?"}`
      : rule.sankhya === "advance"
        ? `faturar ${nunota ?? "(sem nota)"} para TOP ${rule.top ?? "?"}`
        : `cancelar ${nunota ?? "(sem nota)"}`;
  const problem = ruleProblem(rule);
  if (problem)
    return { status: "skipped", detail: `Sankhya: ${what} (falta a TOP)` };
  if (!erp.ordersEnabled)
    return {
      status: "simulated",
      detail: `Sankhya (simulado, execução desligada): ${what}`,
    };
  try {
    if (rule.sankhya === "create_note") {
      if (nunota)
        return {
          status: "skipped",
          detail: `Sankhya: já tem a nota ${nunota}`,
        };
      const { buildPortalNote } =
        await import("@/lib/integrations/sankhya-orders");
      const built = await buildPortalNote(erp, rule.top!, order, request);
      if (!built.ok)
        return { status: "error", detail: `Sankhya: ${built.reason}` };
      const { createNote } = await import("@/lib/integrations/sankhya-client");
      const created = await createNote(built.note);
      await linkNunota(user, order, request, created.nunota, erp);
      return {
        status: "done",
        detail: `Sankhya: nota ${created.nunota} incluída (TOP ${rule.top})`,
        nunotaAfter: created.nunota,
      };
    }
    if (!nunota)
      return { status: "skipped", detail: `Sankhya: ${what}: sem nota ligada` };
    if (rule.sankhya === "advance") {
      const { invoiceNotes, executeQuery } =
        await import("@/lib/integrations/sankhya-client");
      // Nota já na TOP de destino (ex.: o pedido nasceu direto como 1101):
      // nada a faturar.
      if (/^\d+$/.test(nunota)) {
        const current = await executeQuery(
          `SELECT CODTIPOPER FROM TGFCAB WHERE NUNOTA = ${nunota}`,
        );
        if (Number(current.rows[0]?.CODTIPOPER) === rule.top)
          return {
            status: "skipped",
            detail: `Sankhya: ${nunota} já está na TOP ${rule.top}`,
            nunotaAfter: nunota,
          };
      }
      const response = await invoiceNotes([nunota], rule.top!);
      const next = newNunota(response, nunota);
      if (next) await linkNunota(user, order, request, next, erp);
      return {
        status: "done",
        detail: `Sankhya: ${nunota} faturada para TOP ${rule.top}${next ? ` → ${next}` : ""}`,
        nunotaAfter: next ?? nunota,
      };
    }
    const { cancelNotes } = await import("@/lib/integrations/sankhya-client");
    await cancelNotes([nunota], "Cancelado no portal Wellmix");
    return {
      status: "done",
      detail: `Sankhya: ${nunota} cancelada`,
      nunotaAfter: nunota,
    };
  } catch (error) {
    return { status: "error", detail: `Sankhya: ${what}: ${errorText(error)}` };
  }
}

/** NUNOTA gerado pelo faturamento (o primeiro número diferente do de origem). */
export function newNunota(response: unknown, origin: string): string | null {
  const found: string[] = [];
  const walk = (v: unknown, underNunota: boolean) => {
    if (v == null) return;
    if (typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>))
        walk(child, underNunota || /nunota/i.test(k));
      return;
    }
    if (underNunota && /^\d+$/.test(String(v))) found.push(String(v));
  };
  walk(response, false);
  return found.find((n) => n !== String(origin)) ?? null;
}

async function linkNunota(
  user: User | null,
  order: Order | null,
  request: Request | null,
  nunota: string | null,
  erp: SankhyaErpSettings,
) {
  if (!nunota) return;
  const store = getStore();
  if (order) {
    await store.update("orders", order.id, {
      sankhyaCode: nunota,
      erpNumber:
        erp.erpNumberField === "NUNOTA" ? nunota : (order.erpNumber ?? nunota),
      erpSyncStatus: "synced",
    });
    await audit(
      user,
      "order.erp_sync",
      "order",
      order.id,
      `Sankhya: nota ${nunota}`,
    );
  } else if (request) {
    await store.update("requests", request.id, { sankhyaCode: nunota });
  }
}
