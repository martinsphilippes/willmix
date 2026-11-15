import { NextResponse } from "next/server";
import { runReminders } from "@/lib/services/reminders";
import {
  notifyPayablesDue,
  notifySuppliersToConfirm,
} from "@/lib/services/supplier-terms";

export const dynamic = "force-dynamic";

/**
 * Job de cobrança: procura marcos atrasados ou perto do prazo e avisa o responsável.
 * Chamado pelo cron da Vercel (vercel.json) ou manualmente. Protegido por CRON_SECRET quando definido.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { normalizeLaneRoles } = await import("@/lib/services/purchase-order");
  const laneRoles = await normalizeLaneRoles(undefined, { force: true });
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
  // Fotos do Sankhya: recomeça a passada (só baixa o NUVERSAOIMG que mudou).
  const sankhyaImages = await import("@/lib/integrations/sankhya-images")
    .then((m) => m.scheduleImageRefresh())
    .catch((error) => {
      console.error("[reminders] sankhya-images", error);
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
  // Boletos do Sankhya: busca diária dos títulos a receber dos pedidos com
  // forma de pagamento (o boleto pago destrava o pedido; docs/CUSTOMER_PAYMENT.md).
  const chargesSynced = await import("@/lib/services/customer-payment")
    .then((m) => m.syncAllSankhyaCharges())
    .catch((error) => {
      console.error("[reminders] customer-charges-sync", error);
      return null;
    });
  // Forma de pagamento do cliente: parcela que chegou ao momento sem boleto
  // avisa o financeiro (gerar no Sankhya) e o vendedor (docs/CUSTOMER_PAYMENT.md).
  const chargesToIssue = await import("@/lib/services/customer-payment")
    .then((m) => m.notifyChargesToIssue())
    .catch((error) => {
      console.error("[reminders] customer-charges", error);
      return null;
    });
  // Cotação de compra (docs/PURCHASE_DEMAND.md): lembrete antes de vencer e
  // o aviso de "sem resposta" (também correm a cada abertura das telas).
  const purchaseQuotes = await import("@/lib/services/purchase-quote")
    .then((m) => m.sweepQuotes())
    .catch((error) => {
      console.error("[reminders] purchase-quotes", error);
      return null;
    });
  return NextResponse.json({
    ...result,
    purchaseQuotes,
    chargesToIssue,
    chargesSynced,
    purchaseRounds,
    purchaseGates,
    supplierRequestsLate,
    samplingLate,
    laneRoles,
    payablesDue,
    toConfirm,
    sankhya,
    sankhyaImages,
  });
}
