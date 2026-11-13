import { NextResponse } from "next/server";
import { runReminders } from "@/lib/services/reminders";
import { normalizePackaging } from "@/lib/services/packaging";
import { normalizeShipping } from "@/lib/services/shipping-stage";
import {
  notifyPayablesDue,
  notifySuppliersToConfirm,
  releaseOffFlowStages,
} from "@/lib/services/supplier-terms";

export const dynamic = "force-dynamic";

/**
 * Job de cobrança: procura etapas atrasadas ou perto do prazo e avisa o responsável.
 * Chamado pelo cron da Vercel (vercel.json) ou manualmente. Protegido por CRON_SECRET quando definido.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Pedidos parados na etapa de pagamento ao fornecedor seguem o fluxo.
  const released = await releaseOffFlowStages(undefined, { force: true });
  // Arte e embalagem dos pedidos antigos passa para o fluxo novo.
  const packaging = await normalizePackaging(undefined, { force: true });
  // Embarque dos pedidos antigos: dados opcionais, "Embarque confirmado" conclui.
  const shipping = await normalizeShipping();
  const result = await runReminders();
  // Resumo diário das parcelas a fornecedores vencidas ou vencendo.
  const payablesDue = await notifyPayablesDue();
  // Fornecedor que ainda não confirmou o recebimento de pagamento feito.
  const toConfirm = await notifySuppliersToConfirm();
  // Cadastros e itens de pedido pendentes vão para o Sankhya (fase 3).
  const sankhya = await import("@/lib/integrations/sankhya-sync")
    .then((m) => m.runSankhyaSync(null))
    .catch((error) => {
      console.error("[reminders] sankhya-sync", error);
      return null;
    });
  // Solicitações ao fornecedor que passaram do SLA da negociação.
  const supplierRequestsLate =
    await import("@/lib/services/supplier-request-negotiation")
      .then((m) => m.notifyLateSupplierRequests())
      .catch((error) => {
        console.error("[reminders] supplier-request-sla", error);
        return null;
      });
  // Amostragem que passou do prazo sem as fotos e vídeos (docs/SUPPLIER_SAMPLING.md).
  const samplingLate = await import("@/lib/services/supplier-request-sampling")
    .then((m) => m.notifyLateSampling())
    .catch((error) => {
      console.error("[reminders] sampling-sla", error);
      return null;
    });
  // Programação de compra: rodadas que chegaram ao dia viram pedidos filhos.
  const purchaseRounds = await import("@/lib/services/purchase-rounds")
    .then((m) => m.spawnDueRounds(null))
    .then((orders) => orders.length)
    .catch((error) => {
      console.error("[reminders] purchase-rounds", error);
      return null;
    });
  // Pedido de compra: o que o sistema confere sozinho (NCM validado, ficha
  // completa, certificação válida, sinal pago ou conta corrente).
  const purchaseGates = await import("@/lib/services/purchase-gates")
    .then((m) => m.refreshAllPurchaseGates())
    .catch((error) => {
      console.error("[reminders] purchase-gates", error);
      return null;
    });
  return NextResponse.json({
    ...result,
    purchaseRounds,
    purchaseGates,
    supplierRequestsLate,
    samplingLate,
    released,
    packaging,
    shipping,
    payablesDue,
    toConfirm,
    sankhya,
  });
}
