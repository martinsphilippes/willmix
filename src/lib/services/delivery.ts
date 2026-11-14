import "server-only";

import { isAdmin, isWellmix, ForbiddenError } from "@/lib/auth/permissions";
import { getStore, type Order, type Party, type User } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Entrega (mapa E7? a E16; docs/DELIVERY.md). Decisões do dono (14/11/2026):
 *
 * - canal cinza ou vermelho: o pedido pausa por tempo indeterminado e os
 *   administradores da plataforma são alertados; só um administrador retoma;
 * - transportadora pelo porto de chegada: Itapoá → West Log, os demais →
 *   Edual, como padrão de Configurações; basta contratar no pedido;
 * - NF da mercadoria nacionalizada: o financeiro emite no Sankhya e o portal
 *   registra o número e o arquivo (passo "DANFE", do financeiro).
 */

export class DeliveryError extends Error {}

/** Portos de chegada (códigos do tarifário de frete) e "outro". */
export const ARRIVAL_PORTS = ["IOA", "ITJ", "NVT", "OTHER"] as const;
export type ArrivalPort = (typeof ARRIVAL_PORTS)[number];

export const isPaused = (order: Pick<Order, "pausedAt">) => !!order.pausedAt;

/** Pedido pausado: nada anda (itens de etapa e passos) até um administrador retomar. */
export function assertNotPaused(order: Pick<Order, "pausedAt">) {
  if (isPaused(order)) throw new DeliveryError("order_paused");
}

async function admins() {
  const team = await getStore().list("users", {
    filter: { role: "admin", active: true },
  });
  return { userIds: team.map((u) => u.id) };
}

/** Canal cinza ou vermelho: pausa o pedido e alerta os administradores. */
export async function pauseForChannel(
  user: User,
  order: Order,
  channel: "red" | "grey",
) {
  if (isPaused(order)) return;
  const store = getStore();
  const now = new Date().toISOString();
  await store.update("orders", order.id, {
    pausedAt: now,
    pauseReason: `channel_${channel}`,
  });
  await audit(
    user,
    "order.paused",
    "order",
    order.id,
    `Pedido #${order.number} pausado: canal ${channel === "red" ? "vermelho" : "cinza"}`,
  );
  await notify(await admins(), {
    kind: "alert",
    actor: "recipient",
    link: `/app/orders/${order.id}`,
    text: (t) => ({
      subject: t("delivery.notify.paused.subject", {
        n: String(order.number),
        channel: t(`importFlow.channel.${channel}`),
      }),
      body: t("delivery.notify.paused.body", {
        channel: t(`importFlow.channel.${channel}`),
      }),
    }),
  });
}

/** Só o administrador retoma o pedido pausado. */
export async function resumeOrder(
  user: User,
  orderId: string,
  note: string | null,
) {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new DeliveryError("order_not_found");
  if (!isPaused(order)) return;
  await store.update("orders", orderId, { pausedAt: null, pauseReason: null });
  await audit(
    user,
    "order.resumed",
    "order",
    orderId,
    `Pedido #${order.number} retomado${note ? `: ${note}` : ""}`,
  );
}

/** Nome da transportadora padrão para o porto (Configurações). */
export async function defaultCarrierName(port: string | null | undefined) {
  const s = await getSettings();
  return port === "IOA" ? s.carrierItapoaName : s.carrierDefaultName;
}

const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** A transportadora cadastrada com esse nome (ativa). */
export async function carrierByName(name: string): Promise<Party | null> {
  const wanted = norm(name);
  if (!wanted) return null;
  const carriers = await getStore().list("parties", {
    filter: { type: "carrier", active: true },
  });
  return (
    carriers.find((p) => norm(p.name) === wanted) ??
    carriers.find((p) => norm(p.name).includes(wanted)) ??
    null
  );
}

export interface DeliveryView {
  port: string | null;
  carrierName: string;
  carrier: Party | null;
  /** A transportadora sugerida já é a do pedido. */
  hired: boolean;
}

export async function deliveryView(order: Order): Promise<DeliveryView> {
  const port = order.arrivalPort ?? null;
  const carrierName = await defaultCarrierName(port);
  const carrier = port ? await carrierByName(carrierName) : null;
  return {
    port,
    carrierName,
    carrier,
    hired: !!carrier && order.carrierId === carrier.id,
  };
}

/** A Wellmix informa o porto de chegada do pedido. */
export async function setArrivalPort(
  user: User,
  orderId: string,
  port: ArrivalPort,
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new DeliveryError("order_not_found");
  if (order.arrivalPort === port) return;
  await store.update("orders", orderId, { arrivalPort: port });
  await audit(
    user,
    "order.arrival_port",
    "order",
    orderId,
    `Porto de chegada do pedido #${order.number}: ${order.arrivalPort ?? "—"} → ${port}`,
  );
}
