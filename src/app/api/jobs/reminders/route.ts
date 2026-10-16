import { NextResponse } from "next/server";
import { runReminders } from "@/lib/services/reminders";
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
  const result = await runReminders();
  // Resumo diário das parcelas a fornecedores vencidas ou vencendo.
  const payablesDue = await notifyPayablesDue();
  // Fornecedor que ainda não confirmou o recebimento de pagamento feito.
  const toConfirm = await notifySuppliersToConfirm();
  return NextResponse.json({ ...result, released, payablesDue, toConfirm });
}
