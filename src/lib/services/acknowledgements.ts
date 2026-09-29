import "server-only";

import { getStore, type AckEvent, type User } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { submitRequirement } from "@/lib/workflow/engine";
import { audit } from "./audit";

/**
 * Rastro de "enviado → disponibilizado → visualizado → confirmado" para
 * documentos e pagamentos. Visualizar é registrado automaticamente no acesso;
 * confirmar é um ato explícito do usuário. Um evento nunca substitui o outro.
 */
export type AckEntity = "document" | "payment";

export async function recordAck(
  user: User,
  entity: AckEntity,
  entityId: string,
  event: AckEvent,
  note: string | null = null,
) {
  const store = getStore();
  // "viewed" é registrado uma vez por usuário; "confirmed" também.
  const existing = await store.list("acknowledgements", {
    filter: { entity, entityId, userId: user.id, event },
    limit: 1,
  });
  if (existing[0]) return existing[0];
  const ack = await store.create("acknowledgements", {
    entity,
    entityId,
    userId: user.id,
    partyId: user.partyId,
    event,
    at: new Date().toISOString(),
    note,
  });
  if (event === "confirmed")
    await audit(
      user,
      `${entity}.confirm`,
      entity,
      entityId,
      note ?? "Confirmado",
    );
  return ack;
}

export interface AckSummary {
  sentAt: string;
  viewedAt: string | null;
  viewedBy: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

/** Resumo por entidade para exibir a trilha (primeira visualização e confirmação de outro parceiro). */
export async function ackSummaries(
  entity: AckEntity,
  rows: Array<{ id: string; createdAt: string }>,
  options: { excludeUserId?: string } = {},
): Promise<Record<string, AckSummary>> {
  if (rows.length === 0) return {};
  const store = getStore();
  const acks = await store.list("acknowledgements", {
    filter: { entity, entityId: rows.map((r) => r.id) },
    orderBy: "at",
  });
  const users = await store.list("users");
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
  const out: Record<string, AckSummary> = {};
  for (const row of rows) {
    const mine = acks.filter(
      (a) => a.entityId === row.id && a.userId !== options.excludeUserId,
    );
    const viewed = mine.find((a) => a.event === "viewed");
    const confirmed = mine.find((a) => a.event === "confirmed");
    out[row.id] = {
      sentAt: row.createdAt,
      viewedAt: viewed?.at ?? null,
      viewedBy: viewed ? nameOf(viewed.userId) : null,
      confirmedAt: confirmed?.at ?? null,
      confirmedBy: confirmed ? nameOf(confirmed.userId) : null,
    };
  }
  return out;
}

/**
 * Trilha por linha quando cada linha tem o seu próprio "registrador" (quem
 * enviou o pagamento ou o documento): agrupa por registrador para excluí-lo
 * da contagem de visualização/confirmação.
 */
export async function ackTrails<T extends { id: string; createdAt: string }>(
  entity: AckEntity,
  rows: T[],
  registrarOf: (row: T) => string | null,
): Promise<Record<string, AckSummary>> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = registrarOf(row) ?? "";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const out: Record<string, AckSummary> = {};
  for (const [registrar, group] of groups) {
    Object.assign(
      out,
      await ackSummaries(entity, group, {
        excludeUserId: registrar || undefined,
      }),
    );
  }
  return out;
}

/** IDs das entidades em que este usuário já registrou o evento (ex.: documentos que ele confirmou). */
export async function ackedByUser(
  userId: string,
  entity: AckEntity,
  entityIds: string[],
  event: AckEvent,
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();
  const acks = await getStore().list("acknowledgements", {
    filter: { entity, entityId: entityIds, userId, event },
  });
  return new Set(acks.map((a) => a.entityId));
}

/**
 * Confirmação de recebimento de um pagamento ao fornecedor: o mesmo efeito da
 * ação existente `confirmSupplierPaymentAction` (pagamento "received", auditoria e
 * conclusão do requisito `payment_received`), mais o registro do evento
 * "confirmed" na trilha. Idempotente: pagamento já recebido só ganha o ack.
 */
export async function confirmSupplierPaymentReceipt(
  user: User,
  paymentId: string,
) {
  const store = getStore();
  const payment = await store.get("payments", paymentId);
  if (!payment || payment.direction !== "supplier_out" || !payment.orderId)
    throw new Error("not_found");
  const order = await store.get("orders", payment.orderId);
  if (!order) throw new Error("not_found");
  if (!(
    isWellmix(user) ||
    (user.role === "supplier" && order.supplierId === user.partyId)
  ))
    throw new ForbiddenError();
  if (payment.status !== "received") {
    await store.update("payments", paymentId, {
      status: "received",
      confirmedByUserId: user.id,
      confirmedAt: new Date().toISOString(),
    });
    await audit(
      user,
      "payment.received",
      "payment",
      paymentId,
      "Recebimento confirmado pelo fornecedor",
    );
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    if (stage && stage.status === "active") {
      const [req] = await store.list("requirements", {
        filter: {
          stageId: stage.id,
          key: "payment_received",
          status: "pending",
        },
      });
      if (req) await submitRequirement(user, req.id, { value: paymentId });
    }
  }
  await recordAck(user, "payment", paymentId, "confirmed");
  return payment;
}
