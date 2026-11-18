import { listByIds, listColumns } from "@/lib/db/lookup";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { requestDisplayStatus } from "@/lib/services/order-status";
import { activeRequests } from "@/lib/services/request-list-data";
import { demandKind, type DemandKind } from "@/lib/purchase-demand";
import {
  awaitingStrategySend,
  inStrategyQueue,
} from "@/lib/services/purchase-strategy";
import {
  LISTED_SITUATIONS,
  inSituation,
  matchesRequest,
  nextStepText,
  nextStepWho,
  requestNextStep,
  todayBrazil,
  type RequestSituation,
} from "@/lib/services/request-list";
import {
  exportMilestoneCell,
  orderMilestonesOf,
  orderNextInfoOf,
} from "@/lib/services/request-export";

export const dynamic = "force-dynamic";

/**
 * Solicitações em CSV ("tabela de fluxo"), com a mesma situação, tipo e
 * busca da tela. Só a Wellmix com a tela Solicitações. Como na lista
 * principal (dono, 16/11/2026), só o que ainda é encomenda: canceladas,
 * excluídas e as que já viraram pedido ficam fora.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await getT();
  const sp = request.nextUrl.searchParams;
  const situation: RequestSituation = (
    LISTED_SITUATIONS as readonly string[]
  ).includes(sp.get("situ") ?? "")
    ? (sp.get("situ") as RequestSituation)
    : "all";
  const q = (sp.get("q") ?? "").slice(0, 120);
  // Encomenda (B14) ou reposição (B10), o mesmo filtro da tela.
  const kind = sp.get("kind");
  const kindFilter: DemandKind | null =
    kind === "order" || kind === "replenishment" ? kind : null;
  const store = getStore();
  // Só as da etapa, pelo banco (src/lib/services/request-list-data.ts).
  const [all, users] = await Promise.all([
    activeRequests(),
    listColumns(store, "users", ["name"]),
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
  // Nenhuma da etapa tem pedido: o selo é a situação gravada.
  const cancelled = new Set<string>();
  const today = todayBrazil();
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const name = (id: string) => partyById.get(id)?.name ?? "";
  const rows = visible.filter(
    (r) =>
      inSituation(r, requestDisplayStatus(r, cancelled), situation, today) &&
      (!kindFilter || demandKind(r) === kindFilter) &&
      matchesRequest(r, name(r.customerId), q),
  );
  const orderIds = rows.map((r) => r.orderId).filter(Boolean) as string[];
  const orders = orderIds.length
    ? await store.list("orders", { filter: { id: orderIds } })
    : [];
  // Próximo passo do pedido (as mesmas regras da tela; fase 5g: quem age e o
  // prazo pelos marcos).
  const nextInfo = await orderNextInfoOf(orders);
  // Marco atual de cada pedido pelo resumo (`facts.m`); sem resumo, pela situação.
  const milestones = await orderMilestonesOf(orderIds);
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
          const info = order ? nextInfo.get(order.id) : undefined;
          const next = requestNextStep({
            status: r.status,
            display: requestDisplayStatus(r, cancelled),
            // Como na tela: a enviar para cotação ou já na Estratégia de Compra.
            strategy: isWellmix(user!)
              ? awaitingStrategySend(r)
                ? "send"
                : inStrategyQueue(r)
                  ? "queue"
                  : null
              : null,
            order: order
              ? {
                  status: order.status,
                  responsibleRole: info?.responsibleRole ?? null,
                  dueAt: info?.dueAt ?? null,
                }
              : null,
            today,
          });
          return [
            nextStepText(t, next),
            nextStepWho(t, next),
            order ? t(`stage.${order.status}` as DictionaryKey) : "",
            // Marco (fase 4d): coluna nova no fim; a "Etapa do pedido" fica.
            order
              ? exportMilestoneCell(t, order.status, milestones.get(order.id))
              : "",
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
