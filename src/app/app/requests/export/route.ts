import { listByIds } from "@/lib/db/lookup";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewRequest, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore, type Request } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { requestDisplayStatus } from "@/lib/services/order-status";
import { listedRequests } from "@/lib/services/request-list-data";
import { demandKind, type DemandKind } from "@/lib/purchase-demand";
import {
  awaitingStrategySend,
  inStrategyQueue,
} from "@/lib/services/purchase-strategy";
import {
  LISTED_SITUATIONS,
  nextStepText,
  nextStepWho,
  requestNextStep,
  todayBrazil,
  type NextStep,
  type RequestSituation,
} from "@/lib/services/request-list";
import {
  exportMilestoneCell,
  orderMilestonesOf,
  orderNextInfoOf,
} from "@/lib/services/request-export";
import { requestTurnContext } from "@/lib/services/request-turns";
import { turnFilterOf, turnNameKey, turnWithKey } from "@/lib/turn";
import { canSeeMoney } from "@/lib/auth/function-access";
import {
  loadRequestPacking,
  packingTotalsLine,
} from "@/lib/services/request-packing";
import { groupRequestRows } from "@/lib/services/request-groups";
import { listDraftsForList } from "@/lib/services/request-drafts";
import { listCards, type CardEntry } from "@/lib/services/request-list-cards";
import {
  responsibleLine,
  responsibleOf,
  stepDue,
  stepOwner,
  stepPartners,
  type Person,
  type Responsible,
  type StepDue,
} from "@/lib/request-responsible";
import { peopleDirectory } from "@/lib/services/request-responsible";

export const dynamic = "force-dynamic";

/**
 * Solicitações em CSV ("tabela de fluxo"), com a mesma situação, tipo e
 * busca da tela. Só a Wellmix com a tela Solicitações. Como na lista
 * principal (dono, 16/11/2026), só o que ainda é encomenda: canceladas,
 * excluídas e as que já viraram pedido ficam fora.
 *
 * Dono, 19/11/2026 (docs/ORDER_LEVEL_LISTS.md, seção 6): os mesmos cards e
 * filtros da tela, por solicitação (a solicitação inteira entra quando
 * passa), os rascunhos de quem exporta, e depois de "Com quem" o
 * Responsável (a mesma regra das Pendências) e o Prazo da ação; o login do
 * responsável, só para o administrador. Os totais continuam no fim.
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
    listedRequests(),
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
  // Nenhuma da etapa tem pedido: o selo é a situação gravada.
  const cancelled = new Set<string>();
  const today = todayBrazil();
  const now = new Date();
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const name = (id: string) => partyById.get(id)?.name ?? "";
  // De quem é a vez (docs/TURNS.md): a mesma regra e o mesmo filtro da tela.
  const turnCtx = await requestTurnContext(visible);
  const strategyOf = (r: Request) =>
    awaitingStrategySend(r)
      ? ("send" as const)
      : inStrategyQueue(r)
        ? ("queue" as const)
        : null;
  const turnFilter = turnFilterOf(sp.get("vez"));
  const orderIds = visible.map((r) => r.orderId).filter(Boolean) as string[];
  const orders = orderIds.length
    ? await store.list("orders", { filter: { id: orderIds } })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  // Próximo passo do pedido (as mesmas regras da tela; fase 5g: quem age e o
  // prazo pelos marcos).
  const nextInfo = await orderNextInfoOf(orders);
  const steps = new Map<string, NextStep>();
  const stepOf = (r: Request): NextStep => {
    const cached = steps.get(r.id);
    if (cached) return cached;
    const order = r.orderId ? orderById.get(r.orderId) : null;
    const info = order ? nextInfo.get(order.id) : undefined;
    const step = requestNextStep({
      status: r.status,
      display: requestDisplayStatus(r, cancelled),
      // Como na tela: a enviar para cotação ou já na Estratégia de Compra,
      // a compra da encomenda e o login que confirma.
      strategy: strategyOf(r),
      purchase: turnCtx.purchaseOf(r),
      customerLogin: turnCtx.customerLoginOf(r),
      order: order
        ? {
            status: order.status,
            responsibleRole: info?.responsibleRole ?? null,
            dueAt: info?.dueAt ?? null,
          }
        : null,
      today,
    });
    steps.set(r.id, step);
    return step;
  };
  const dueOf = (r: Request) => stepDue(stepOf(r), r, turnCtx.purchaseOf(r));
  // Por solicitação, como os cards e os filtros da tela.
  const entries = groupRequestRows(visible);
  const rowsOf = (e: (typeof entries)[number]) =>
    e.kind === "batch"
      ? [...e.rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : [e.row];
  type Item = CardEntry & { requests: Request[] };
  const items: Item[] = entries.map((e) => {
    const list = rowsOf(e);
    return {
      requests: list,
      customerName: name(list[0].customerId),
      rows: list.map((r) => ({
        number: r.number ?? null,
        productName: r.productName,
        description: r.description,
        kind: demandKind(r),
        step: stepOf(r),
        due: dueOf(r),
      })),
    };
  });
  const drafts = (await listDraftsForList(user, "requests", 500)).map((d) => ({
    ...d,
    number: d.draft.number ?? null,
    title: d.draft.title,
    customerName: d.draft.customerName,
  }));
  const cards = listCards(items, drafts, {
    situation,
    q,
    kind: kindFilter,
    turn: turnFilter,
    now,
    today,
  });
  const rows = cards.entries.flatMap((e) => e.requests);
  const orderMilestones = await orderMilestonesOf(
    rows.map((r) => r.orderId).filter(Boolean) as string[],
  );
  // Quem age (a mesma regra da tela e das Pendências).
  const directory = await peopleDirectory(user, {
    users,
    requests: rows,
    ctx: turnCtx,
    partnerIds: rows.flatMap((r) => {
      const step = stepOf(r);
      return stepOwner(step.key)?.kind === "partners"
        ? stepPartners(step.key, turnCtx.purchaseOf(r)).map((p) => p.supplierId)
        : [];
    }),
    customerName: (id) => name(id) || null,
    translate: (key) => t(key as DictionaryKey),
  });
  const admin = isAdmin(user);
  const labels = {
    undefined: t("reqList.resp.undefined"),
    people: (n: number) => t("reqList.resp.people", { n }),
    partners: (n: number) => t("reqList.resp.partners", { n }),
    party: (p: Parameters<typeof turnNameKey>[0]) => t(turnNameKey(p)),
  };
  /** Os nomes de quem pode agir (no CSV, todos), com a parte. */
  const responsibleText = (r: Responsible | null) => {
    if (!r) return "";
    const line = responsibleLine(r, labels);
    const names = (list: Person[]) => list.map((p) => p.name).join(", ");
    const who = r.partners.length
      ? r.partners
          .map(
            (p) =>
              `${p.name} (${names(p.people) || t("reqList.resp.noLogin")})`,
          )
          .join("; ")
      : r.people.length
        ? names(r.people)
        : line.who;
    return line.where ? `${who} · ${line.where}` : who;
  };
  const loginText = (r: Responsible | null) =>
    !r
      ? ""
      : [...r.people, ...r.partners.flatMap((p) => p.people)]
          .map((p) => p.login)
          .filter(Boolean)
          .join(", ");
  const dueText = (due: StepDue | null) =>
    !due
      ? ""
      : due.day
        ? due.at
        : new Intl.DateTimeFormat("sv-SE", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(due.at));
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  /* Totais de Encomendas (dono, 18/11/2026): no fim de cada linha, os
     valores daquele produto pela mesma embalagem da tela (somando as linhas
     de um Nº dá o total da lista, sem contar nada duas vezes). O preço
     previsto só para quem vê valores e margem. Número sem milhar e com a
     vírgula decimal da planilha em pt. */
  const packing = await loadRequestPacking(rows);
  const seeSale = canSeeMoney(user);
  const decimal = (n: number | null, digits: number) => {
    if (n === null || !Number.isFinite(n)) return "";
    const text = String(Math.round(n * 10 ** digits) / 10 ** digits);
    return t.locale === "pt" ? text.replace(".", ",") : text;
  };
  // Depois de "Com quem": Responsável, Prazo da ação e (administrador) o login.
  const header = t("reqList.csv.header").split(";");
  header.splice(
    12,
    0,
    ...t("reqList.csv.responsible").split(";"),
    ...(admin ? [t("reqList.csv.login")] : []),
  );
  const totalsCount = t("reqList.csv.totals").split(";").length;
  const lines = [
    [
      header.join(";"),
      t("reqList.csv.totals"),
      ...(seeSale ? [t("reqList.csv.price")] : []),
    ].join(";"),
  ];
  // Rascunhos (como na lista: os de quem exporta; o administrador, os de
  // todos): a ação do fluxo de rascunho, com quem salvou.
  for (const { draft, owner } of cards.drafts)
    lines.push(
      [
        draft.number ?? "",
        draft.createdAt.slice(0, 10),
        draft.title,
        draft.customerName ?? "",
        "",
        "",
        "",
        t("requestDraft.status"),
        "",
        "",
        t("reqList.draft.next"),
        t(turnWithKey("wellmix")),
        `${owner?.name ?? "—"} · ${t(turnNameKey("wellmix"))}`,
        "",
        ...(admin ? [owner?.email ?? ""] : []),
        "",
        "",
        ...Array.from({ length: totalsCount + (seeSale ? 1 : 0) }, () => ""),
      ]
        .map(cell)
        .join(";"),
    );
  for (const r of rows) {
    const order = r.orderId ? orderById.get(r.orderId) : null;
    const next = stepOf(r);
    const resp = responsibleOf(next, r, turnCtx.purchaseOf(r), directory);
    const line = packingTotalsLine(r, packing.get(r.id), r.productName);
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
        order ? `#${order.number}` : "",
        nextStepText(t, next),
        nextStepWho(t, next),
        responsibleText(resp),
        dueText(dueOf(r)),
        ...(admin ? [loginText(resp)] : []),
        order ? t(`stage.${order.status}` as DictionaryKey) : "",
        // Marco (fase 4d): coluna nova no fim; a "Etapa do pedido" fica.
        order
          ? exportMilestoneCell(t, order.status, orderMilestones.get(order.id))
          : "",
        decimal(line.pieces, 4),
        decimal(line.boxes, 4),
        decimal(line.innerBoxes, 4),
        decimal(line.cbm, 4),
        decimal(line.moq, 4),
        ...(seeSale ? [decimal(line.sale?.amount ?? null, 2)] : []),
      ]
        .map(cell)
        .join(";"),
    );
  }
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solicitacoes-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
