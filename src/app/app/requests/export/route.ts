import { listByIds } from "@/lib/db/lookup";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  cancelledOrderIds,
  requestDisplayStatus,
} from "@/lib/services/order-status";
import {
  REQUEST_SITUATIONS,
  inSituation,
  matchesRequest,
  nextStepText,
  nextStepWho,
  requestNextStep,
  todayBrazil,
  type RequestSituation,
} from "@/lib/services/request-list";

export const dynamic = "force-dynamic";

/**
 * Solicitações em CSV ("tabela de fluxo"), com a mesma situação e busca da
 * tela. Só a Wellmix com a tela Solicitações. Canceladas e excluídas ficam fora, como na lista principal.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const sp = request.nextUrl.searchParams;
  const situation: RequestSituation = (
    REQUEST_SITUATIONS as readonly string[]
  ).includes(sp.get("situ") ?? "")
    ? (sp.get("situ") as RequestSituation)
    : "all";
  const q = (sp.get("q") ?? "").slice(0, 120);
  const store = getStore();
  const [all, users] = await Promise.all([
    store.list("requests", { orderBy: "createdAt", direction: "desc" }),
    store.list("users"),
  ]);
  const visible = all.filter((r) => canViewRequest(user, r));
  // Só os clientes das solicitações (antes: todos, ~26 mil).
  const parties = (
    await listByIds(
      store,
      "parties",
      visible.map((r) => r.customerId),
    )
  ).filter((p) => p.type === "customer");
  const cancelled = await cancelledOrderIds(visible.map((r) => r.orderId));
  const today = todayBrazil();
  const name = (id: string) => parties.find((p) => p.id === id)?.name ?? "";
  const rows = visible.filter((r) => {
    const display = requestDisplayStatus(r, cancelled);
    if (r.status === "CANCELLED" || display === "ORDER_CANCELLED") return false;
    return (
      inSituation(r, display, situation, today) &&
      matchesRequest(r, name(r.customerId), q)
    );
  });
  const orderIds = rows.map((r) => r.orderId).filter(Boolean) as string[];
  const orders = orderIds.length
    ? await store.list("orders", { filter: { id: orderIds } })
    : [];
  // Próximo passo e etapa do pedido (as mesmas regras da tela).
  const stageIds = orders
    .map((o) => o.currentStageId)
    .filter(Boolean) as string[];
  const stages = stageIds.length
    ? await store.list("stages", { filter: { id: stageIds } })
    : [];
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [t("reqList.csv.header")];
  for (const r of rows)
    lines.push(
      [
        r.number ?? "",
        r.createdAt.slice(0, 10),
        r.productName,
        name(r.customerId),
        users.find((u) => u.id === r.ownerUserId)?.name ?? "",
        r.quantity,
        r.unit,
        t(
          `reqStatusLabel.${requestDisplayStatus(r, cancelled)}` as DictionaryKey,
        ),
        r.deadline?.slice(0, 10) ?? "",
        r.orderId
          ? `#${orders.find((o) => o.id === r.orderId)?.number ?? "?"}`
          : "",
        ...(() => {
          const order = r.orderId
            ? orders.find((o) => o.id === r.orderId)
            : null;
          const stage = order?.currentStageId
            ? stages.find((st) => st.id === order.currentStageId)
            : null;
          const next = requestNextStep({
            status: r.status,
            display: requestDisplayStatus(r, cancelled),
            order: order
              ? {
                  status: order.status,
                  responsibleRole: stage?.responsibleRole ?? null,
                  dueAt: stage?.dueAt ?? null,
                }
              : null,
            today,
          });
          return [
            nextStepText(t, next),
            nextStepWho(t, next),
            order ? t(`stage.${order.status}` as DictionaryKey) : "",
          ];
        })(),
      ]
        .map(cell)
        .join(";"),
    );
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solicitacoes-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
