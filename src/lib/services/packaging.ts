import "server-only";

import { getStore, type Order } from "@/lib/db";
import { milestoneTitle } from "@/lib/milestones";
import { getSettings } from "@/lib/settings";
import { artRole } from "@/lib/workflow/templates";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Arte do pedido clássico: a agência (ou a Wellmix, sem agência) faz e envia a
 * arte; o fornecedor confere e aprova. Ao designar ou trocar a agência no
 * pedido, a arte ainda não enviada passa para quem faz a arte agora.
 *
 * Fase 5g (docs/MILESTONES.md): sem etapas. A passada que convertia os
 * pedidos de antes da inversão da arte (arte do fornecedor, aprovação da
 * agência) saiu com o registro das etapas; os pedidos abertos já tinham
 * passado por ela.
 */

/**
 * A arte ainda não enviada do pedido clássico vai para quem faz a arte agora
 * (a agência do pedido ou a Wellmix). Devolve se mudou algo. O pedido de
 * compra tem a arte nas raias (`syncLaneRoles`).
 */
export async function reassignOrderArt(orderId: string): Promise<boolean> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || order.status === "CANCELLED" || order.status === "CLOSED")
    return false;
  if (order.flow === "supplier_request") return false;
  const [art] = await store.list("requirements", {
    filter: { orderId, key: "art" },
    limit: 1,
  });
  if (!art || art.status === "done") return false;
  const settings = await getSettings();
  const want = artRole(order, settings.agencyValidationEnabled);
  if (art.role === want) return false;
  await store.update("requirements", art.id, { role: want });
  await audit(
    null,
    "order.art_role",
    "order",
    order.id,
    `Pedido #${order.number}: arte por ${want === "agency" ? "agência" : "Wellmix"}, aprovação pelo fornecedor`,
  );
  // A arte mudou de dono com o marco dela liberado: o novo dono é avisado.
  const { requirementIsReleased } = await import("./order-milestones");
  if (await requirementIsReleased(art)) await notifyArtOwner(order, want);
  return true;
}

async function notifyArtOwner(order: Order, role: string) {
  await notify(
    role === "agency" && order.agencyId
      ? { role: "agency", partyId: order.agencyId }
      : { role: ["admin", "operator"] },
    {
      kind: "action",
      link: `/app/orders/${order.id}`,
      text: (t) => ({
        subject: t("notif.stage.subject", {
          n: order.number,
          stage: milestoneTitle(t, "art"),
        }),
        body: t("notif.stage.body", { items: t("notif.packaging.item") }),
      }),
    },
  );
}
