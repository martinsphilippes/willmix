import "server-only";

import { getStore, type AckEvent, type User } from "@/lib/db";
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
