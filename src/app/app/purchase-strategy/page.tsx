import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { PORTAL_MIN_PASSWORD } from "@/lib/services/portal-access";
import { canOpen } from "@/lib/auth/screens";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { LOCALE_NAMES, productNameText } from "@/i18n";
import { getStore, type LastPurchase, type Request } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import {
  RECIPIENT_ISSUES,
  RECIPIENT_WARNINGS,
} from "@/lib/purchase-recipients";
import {
  canApproveStrategy,
  canChooseStrategy,
  canCloseStrategy,
  openDecisions,
  recentStrategySends,
  strategyBoard,
} from "@/lib/services/purchase-strategy";
import {
  Alert,
  Badge,
  Empty,
  Field,
  PageHeader,
  Textarea,
  cx,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { DemandTags } from "@/components/demand-tags";
import { partyPickerLabels } from "@/components/party-picker-labels";
import {
  closeStrategyAction,
  decideStrategyAction,
} from "../actions/purchase-demand";
import {
  StrategyQueue,
  type StrategyGroupData,
  type StrategyLineData,
  type StrategyTexts,
} from "./_components/strategy-queue";
import { PackingCells, type PackingTexts } from "./_components/packing-cells";
import { StrategyOrderForm } from "./_components/strategy-order-form";
import {
  CARD_PRODUCTS,
  CompactPack,
  LastLines,
  StrategyGrid,
  cardClass,
  type CardTexts,
  type LastTexts,
} from "./_components/strategy-card";
import { QuickDialog } from "@/components/quick-dialog";
import { HashTab } from "./_components/hash-tab";
import { closedDemands, type ClosedDemandReason } from "@/lib/purchase-demand";
import {
  demandPackings,
  lineTotals,
  linePackings,
  type DemandPacking,
  type LinePacking,
} from "@/lib/services/strategy-packing";

/*
 * Estratégia de Compra (mapa B10?; dono, 15/11/2026 e 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Estratégia de Compra por produto"): um produto
 * por linha, com a encomenda de origem, o cliente, a quantidade, a
 * especificação, a programação de entrega e a última compra. Por produto:
 * cotar com o fornecedor da última compra, cotar com outros parceiros ou o
 * pedido direto. Resumo, confirmação e o resultado por destinatário (envios
 * recentes). Depois, as estratégias em andamento: o pedido direto esperando
 * a aprovação da Diretoria de compras e as aprovadas a gerar pedido.
 */
type StrategyTab = "waiting" | "open" | "sent";

export default async function PurchaseStrategyPage({
  searchParams,
}: PageProps<"/app/purchase-strategy">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "purchaseStrategy");
  if (!isWellmix(user)) redirect("/app");
  const {
    error,
    chosen,
    decided,
    closed,
    reopened,
    tab: tabParam,
  } = await searchParams;
  // Uma aba por estágio (dono, 22/11/2026): esperando estratégia, em
  // andamento e enviadas. Depois de escolher ou decidir, abre "Em andamento".
  const tab: StrategyTab =
    tabParam === "open" || tabParam === "sent" || tabParam === "waiting"
      ? tabParam
      : typeof chosen === "string" || typeof decided === "string"
        ? "open"
        : "waiting";
  const t = await getT();
  const store = getStore();
  const [board, decisions, sends] = await Promise.all([
    strategyBoard(t),
    openDecisions(),
    recentStrategySends(30),
  ]);
  // Enviadas: uma linha por cotação (ou pedido direto) de cada envio, que
  // abre a cotação de fato (dono, 22/11/2026).
  const sentRows = sends.flatMap((send) =>
    send.lines.map((line, index) => ({ send, line, index })),
  );
  const sentQuoteIds = [
    ...new Set(
      sentRows.flatMap((r) => (r.line.quoteId ? [r.line.quoteId] : [])),
    ),
  ];
  const sentDemandIds = [
    ...new Set(sentRows.flatMap((r) => r.line.demandIds ?? [r.line.demandId])),
  ];
  const [sentQuotes, sentDemands] =
    tab === "sent"
      ? await Promise.all([
          sentQuoteIds.length
            ? store.list("purchase_quotes", { filter: { id: sentQuoteIds } })
            : [],
          sentDemandIds.length
            ? store.list("requests", { filter: { id: sentDemandIds } })
            : [],
        ])
      : [[], []];
  const decisionDemandIds = decisions.flatMap((d) => d.demandIds);
  const decisionDemands = decisionDemandIds.length
    ? await store.list("requests", { filter: { id: decisionDemandIds } })
    : [];
  // Embalagem e cubagem (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
  // "Embalagem e cubagem na Estratégia"): as fontes da ficha completa de
  // cada encomenda, numa leitura só para a fila e "Em andamento".
  const queueDemands = board.lines.map((l) => l.demand);
  const [parties, packings] = await Promise.all([
    listByIds(
      store,
      "parties",
      decisionDemands.map((d) => d.customerId),
    ),
    demandPackings(user, [
      ...queueDemands,
      ...decisionDemands.filter(
        (d) => !queueDemands.some((q) => q.id === d.id),
      ),
    ]),
  ]);
  const partyName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const canChoose = canChooseStrategy(user);
  const canApprove = canApproveStrategy(user);
  // Encerrar a estratégia parada: o Comprador e a Diretoria (dono, 19/11/2026).
  const canClose = canCloseStrategy(user);
  const canOrder =
    can(user, "purchaseOrder.generate") && canOpen(user, "orders");
  // Preço da última compra: só com "Ver preço de compra" (dono, 15/11/2026;
  // docs/LINHA_DE_VISAO.md, seção 7). Sem ela, o pedido sai com o preço
  // gravado na decisão.
  const seesPrice = canSeePurchasePrice(user);

  const packingTexts: PackingTexts = {
    pieces: t("strategyPack.pieces"),
    master: t("strategyPack.master"),
    inner: t("strategyPack.inner"),
    cbm: t("strategyPack.cbm"),
    perMaster: t("strategyPack.perMaster"),
    perMasterMissing: t("strategyPack.perMasterMissing"),
    perInner: t("strategyPack.perInner"),
    perInnerMissing: t("strategyPack.perInnerMissing"),
    noInner: t("strategyPack.noInner"),
    cbmPerMaster: t("strategyPack.cbmPerMaster"),
    cbmPerMasterMissing: t("strategyPack.cbmPerMasterMissing"),
    calculated: t("strategyPack.calculated"),
    legend: t("strategyPack.legend"),
    noteMasterExact: t("strategyPack.note.masterExact"),
    noteMasterUp: t("strategyPack.note.masterUp"),
    noteMasterRounds: t("strategyPack.note.masterRounds"),
    noteCbm: t("strategyPack.note.cbm"),
    warnMasterIncomplete: t("strategyPack.warn.masterIncomplete"),
    warnMasterIncompleteRounds: t("strategyPack.warn.masterIncompleteRounds"),
    warnInnerIncomplete: t("strategyPack.warn.innerIncomplete"),
    warnInnerMismatch: t("strategyPack.warn.innerMismatch"),
    warnInnerBigger: t("strategyPack.warn.innerBigger"),
    warnInnerSame: t("strategyPack.warn.innerSame"),
    warnCbmOtherBox: t("strategyPack.warn.cbmOtherBox"),
    warnQtyInvalid: t("strategyPack.warn.qtyInvalid"),
  };
  const cardTexts: CardTexts = {
    pieces: t("strategyCard.pieces"),
    piecesTip: t("strategyCard.piecesTip"),
    master: t("strategyCard.master"),
    inner: t("strategyCard.inner"),
    cbm: t("strategyCard.cbm"),
    perBox: t("strategyCard.perBox"),
    cbmPerBox: t("strategyCard.cbmPerBox"),
  };
  const lastTexts: LastTexts = {
    last: t("strategyCard.last"),
    lastTip: t("strategyCard.lastTip"),
    order: t("strategyCard.order"),
    lead: t("strategyCard.leadShort"),
    leadTip: t("strategy.last.leadTime"),
    incoterm: t("strategyCard.incoterm"),
    incotermTip: t("strategy.last.incoterm"),
    moq: t("strategyCard.moqShort"),
    moqTip: t("strategy.last.moq"),
  };
  /** Avisos do servidor (programação, unidade, embalagens diferentes). */
  const packWarnings = (
    list: readonly (
      DemandPacking["warnings"][number] | LinePacking["warnings"][number]
    )[],
  ) => list.map((w) => t(`strategyPack.warn.${w}` as DictionaryKey));
  /** Quantidade em peças; sem como converter, a gravada com a unidade. */
  const piecesText = (p: DemandPacking | undefined, d: Request) =>
    p?.pieces != null
      ? p.pieces.toLocaleString(t.intl)
      : `${d.quantity.toLocaleString(t.intl)} ${d.unit}`;

  const lines: StrategyLineData[] = board.lines.map((l) => {
    const d = l.demand;
    const n = d.number ?? "—";
    return {
      demandId: d.id,
      origin:
        l.kind === "replenishment"
          ? t("strategy.line.replenishment", { n })
          : t("strategy.line.order", { n }),
      demandHref: `/app/requests/${d.id}`,
      batch:
        d.groupId && l.batchSize > 1
          ? {
              label: t("strategy.line.batch", { n: l.batchSize }),
              href: `/app/requests/batch/${encodeURIComponent(d.groupId)}`,
            }
          : null,
      productName: productNameText(t, d.productName),
      productHref: d.productId ? `/app/products/${d.productId}` : null,
      quantity: `${d.quantity.toLocaleString(t.intl)} ${d.unit}`,
      customerName: l.kind === "replenishment" ? null : l.customerName,
      specification: d.specification?.trim() || null,
      schedule: (d.schedule?.items ?? []).map((i) =>
        t("strategy.line.scheduleItem", {
          index: i.index,
          quantity: i.quantity.toLocaleString(t.intl),
          date: formatDate(i.expectedAt, t),
        }),
      ),
      desiredAt: d.desiredAt ? formatDate(d.desiredAt, t) : null,
      deadline: d.deadline ? formatDate(d.deadline, t) : null,
      // Nome e código (famílias de mesmo nome no Sankhya; docs/PARTNER_FAMILIES.md).
      family: l.family
        ? {
            key: l.family.key,
            name: `${l.family.name} · ${t("partyFamilies.code", { code: l.family.key })}`,
          }
        : null,
      last: l.last
        ? {
            supplierId: l.last.supplierId,
            supplierName: l.last.supplierName ?? "—",
            price:
              seesPrice && l.last.unitPrice !== null
                ? `${l.last.currency ?? ""} ${l.last.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`.trim()
                : null,
            orderHref: `/app/orders/${l.last.orderId}`,
            orderLabel: `#${l.last.orderNumber} · ${formatDate(l.last.date, t)}`,
            leadTime:
              l.last.leadTimeDays !== null
                ? t("strategy.days", { n: l.last.leadTimeDays })
                : null,
            incoterm: l.last.incoterm,
            moq: l.last.moq !== null ? l.last.moq.toLocaleString(t.intl) : null,
          }
        : null,
      linkedIds: l.linkedIds,
      suggestedIds: l.suggestedIds,
      blocked: d.productId
        ? null
        : `${t("strategy.noProduct")}: ${t("strategy.noProductHint")}`,
      packing: (() => {
        const p = packings.get(d.id);
        return p
          ? {
              totals: p.totals,
              basis: p.facts.basis,
              piecesText: piecesText(p, d),
              warnings: packWarnings(p.warnings),
            }
          : null;
      })(),
    };
  });
  // Por solicitação (dono, 18/11/2026): uma escolha para todos os produtos.
  const groups: StrategyGroupData[] = board.groups.map((g) => {
    const members = g.demandIds
      .map((id) => lines.find((l) => l.demandId === id))
      .filter((l): l is StrategyLineData => !!l);
    const first = members[0];
    return {
      key: g.key,
      title: first?.origin ?? "—",
      customerName: first?.customerName ?? null,
      origin:
        g.countryName || g.familyName
          ? `${g.countryName || "—"} › ${g.familyName || "—"}`
          : null,
      demandIds: g.demandIds,
      last: g.last ? (first?.last ?? null) : null,
      lastReason: g.last
        ? null
        : g.missingLast
          ? t("strategy.lastAllProducts")
          : t("strategy.lastSameSupplier"),
      linkedIds: g.linkedIds,
      suggestedIds: g.suggestedIds,
      blocked: members.some((m) => m.blocked)
        ? `${t("strategy.noProduct")}: ${t("strategy.noProductHint")}`
        : null,
    };
  });
  const texts: StrategyTexts = {
    originList: t("strategy.recipients.origin"),
    originNone: t("strategy.recipients.originNone"),
    queueTitle: t("strategyCard.queueTitle", { n: board.groups.length }),
    queueEmpty: t("strategy.queue.empty"),
    customer: t("strategy.line.customer"),
    quantity: t("strategy.line.quantity"),
    spec: t("strategy.line.spec"),
    schedule: t("strategy.line.schedule"),
    desiredAt: t("strategy.line.desiredAt"),
    deadline: t("strategy.line.deadline"),
    family: t("strategy.line.family"),
    noFamily: t("strategy.line.noFamily"),
    choose: t("strategy.line.choose"),
    lastTitle: t("strategy.last.supplier"),
    lastPrice: t("strategy.last.price"),
    lastOrder: t("strategy.last.date"),
    lastLeadTime: t("strategy.last.leadTime"),
    lastIncoterm: t("strategy.last.incoterm"),
    lastMoq: t("strategy.last.moq"),
    noHistory: t("strategy.option.noHistory"),
    choices: {
      skip: t("strategy.option.skip"),
      quote_last: t("strategy.choice.quote_last"),
      quote: t("strategy.choice.quote"),
      last_supplier: t("strategy.choice.last_supplier"),
    },
    lastHint: t("strategy.option.lastHint"),
    directHint: t("strategy.option.directHint"),
    linked: t("strategy.recipients.linked"),
    suggested: t("strategy.recipients.suggested"),
    none: t("strategy.recipients.none"),
    search: t("strategy.recipients.search"),
    added: t("strategy.recipients.added"),
    checking: t("strategy.recipients.checking"),
    allOk: t("strategy.recipients.allOk"),
    clear: t("strategy.recipients.clear"),
    logins: t("strategy.recipients.logins"),
    ok: t("strategy.recipients.ok"),
    lastBadge: t("strategy.recipients.lastBadge"),
    issues: Object.fromEntries(
      RECIPIENT_ISSUES.map((i) => [
        i,
        t(`strategy.issue.${i}` as DictionaryKey),
      ]),
    ),
    warnings: Object.fromEntries(
      RECIPIENT_WARNINGS.map((w) => [
        w,
        t(`strategy.warning.${w}` as DictionaryKey),
      ]),
    ),
    fix: t("strategy.issue.fix"),
    review: t("strategy.review"),
    reviewNone: t("strategy.review.none"),
    chooseOne: t("strategy.card.chooseOne"),
    summaryTitle: t("strategy.summary.title"),
    summaryHint: t("strategy.summary.hint"),
    receives: t("strategy.summary.receives"),
    blockedOut: t("strategy.summary.blocked"),
    direct: t("strategy.summary.direct"),
    noRecipient: t("strategy.summary.noRecipient"),
    missingRecipient: t("strategy.summary.missingRecipient"),
    confirm: t("strategy.summary.confirm"),
    back: t("strategy.summary.back"),
    fixFirst: t("strategy.summary.fixFirst"),
    note: t("strategy.note"),
    working: t("strategy.summary.working"),
    picker: partyPickerLabels(t, true),
    packing: packingTexts,
    card: {
      ...cardTexts,
      waiting: t("strategyCard.waiting"),
      emptyStrip: t("strategyCard.queueEmpty"),
      customer: t("strategyCard.customer"),
      last: lastTexts,
      details: t("strategyCard.details"),
      detailsTitle: t("strategyCard.detailsTitle"),
      close: t("strategyCard.close"),
      more: t("strategyCard.more"),
    },
    intl: t.intl,
  };
  const orderTexts = {
    packing: packingTexts,
    price: t("strategy.last.price"),
    currency: t("strategy.currency"),
    leadTime: t("strategyPack.leadTime"),
    incoterm: t("strategy.last.incoterm"),
    generate: t("strategy.generateOrder"),
  };

  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `strategy.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;

  const reference = (ref: LastPurchase | undefined) =>
    ref ? (
      <dl
        className="grid gap-x-4 gap-y-0.5 text-xs text-zinc-700 sm:grid-cols-3"
        data-last-purchase={ref.orderNumber}
      >
        <div>
          <dt className="text-zinc-500">{t("strategy.last.supplier")}</dt>
          <dd className="font-medium">{ref.supplierName ?? "—"}</dd>
        </div>
        {seesPrice ? (
          <div>
            <dt className="text-zinc-500">{t("strategy.last.price")}</dt>
            <dd className="font-medium tabular-nums">
              {ref.unitPrice !== null
                ? `${ref.currency ?? ""} ${ref.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`
                : "—"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-zinc-500">{t("strategy.last.date")}</dt>
          <dd>
            <Link href={`/app/orders/${ref.orderId}`} className={linkClass}>
              #{ref.orderNumber}
            </Link>{" "}
            · {formatDate(ref.date, t)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.leadTime")}</dt>
          <dd>
            {ref.leadTimeDays !== null
              ? t("strategy.days", { n: ref.leadTimeDays })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.incoterm")}</dt>
          <dd>{ref.incoterm ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.moq")}</dt>
          <dd className="tabular-nums">
            {ref.moq !== null ? ref.moq.toLocaleString(t.intl) : "—"}
          </dd>
        </div>
      </dl>
    ) : (
      <p className="text-xs font-medium text-amber-800" data-no-last-purchase>
        {t("strategy.noLastPurchase")}
      </p>
    );

  /** Última compra no card, em duas linhas (fornecedor, preço, pedido e condições). */
  const compactReference = (ref: LastPurchase | undefined) =>
    ref ? (
      <LastLines
        data={{
          supplierName: ref.supplierName ?? "—",
          price:
            seesPrice && ref.unitPrice !== null
              ? `${ref.currency ?? ""} ${ref.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`.trim()
              : null,
          orderHref: `/app/orders/${ref.orderId}`,
          orderLabel: `#${ref.orderNumber} · ${formatDate(ref.date, t)}`,
          leadTime:
            ref.leadTimeDays !== null
              ? t("strategy.days", { n: ref.leadTimeDays })
              : null,
          incoterm: ref.incoterm,
          moq: ref.moq !== null ? ref.moq.toLocaleString(t.intl) : null,
        }}
        texts={lastTexts}
        data-last-purchase={ref.orderNumber}
        data-strategy-card-last=""
      />
    ) : (
      <p
        className="text-[11px] font-medium text-amber-800"
        data-no-last-purchase
      >
        {t("strategy.noLastPurchase")}
      </p>
    );

  const demandRow = (
    d: Request,
    checkbox: boolean,
    closed?: ClosedDemandReason,
  ) => (
    <li
      key={d.id}
      className="flex flex-wrap items-start gap-x-3 gap-y-1 py-1.5"
      data-strategy-demand={d.id}
      data-strategy-demand-closed={closed}
    >
      {checkbox ? (
        <input
          type="checkbox"
          name="demandIds"
          value={d.id}
          defaultChecked
          className="mt-1 h-4 w-4"
          aria-label={productNameText(t, d.productName)}
        />
      ) : null}
      <span className="min-w-0 flex-1 text-sm">
        <Link href={`/app/requests/${d.id}`} className={linkClass}>
          {d.number ? `nº ${d.number}` : "—"}
        </Link>{" "}
        · {d.quantity.toLocaleString(t.intl)} {d.unit}
        {d.desiredAt
          ? ` · ${t("demand.desiredAt")}: ${formatDate(d.desiredAt, t)}`
          : ""}
        {closed ? (
          <Badge tone="danger" className="ml-2">
            {t(`strategyPack.closed.${closed}` as DictionaryKey)}
          </Badge>
        ) : null}
        <span className="block text-xs text-zinc-600">
          {partyName(d.customerId)}
        </span>
        <DemandTags t={t} request={d} />
      </span>
    </li>
  );

  return (
    <div data-strategy-page={lines.length} data-compact-fields>
      <PageHeader
        t={t}
        title={t("strategy.title")}
        subtitle={t("strategy.subtitle")}
        dense
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {typeof chosen === "string" ? (
        <div className="mb-2" role="status" data-strategy-chosen>
          <Alert tone="success">{t("strategy.chosen", { n: chosen })}</Alert>
        </div>
      ) : null}
      {typeof closed === "string" ? (
        <div className="mb-2" role="status" data-strategy-closed>
          <Alert tone="success">
            {Number(reopened) > 0
              ? t("strategyClose.doneReopened", {
                  n: closed,
                  count: Number(reopened),
                })
              : t("strategyClose.done", { n: closed })}
          </Alert>
        </div>
      ) : null}
      {typeof decided === "string" ? (
        <div className="mb-2" role="status" data-strategy-decided>
          <Alert tone="success">{t("strategy.decided", { n: decided })}</Alert>
        </div>
      ) : null}
      <HashTab />
      <nav
        aria-label={t("strategy.tabs.label")}
        className="mb-3 flex gap-1 overflow-x-auto border-b border-zinc-200 text-sm"
        data-strategy-tabs={tab}
      >
        {(
          [
            ["waiting", board.groups.length],
            ["open", decisions.length],
            ["sent", sentRows.length],
          ] as const
        ).map(([id, n]) => (
          <Link
            key={id}
            href={`/app/purchase-strategy?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            data-strategy-tab={id}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2",
              tab === id
                ? "border-brand-600 font-semibold text-brand-700"
                : "border-transparent text-zinc-600 hover:text-zinc-900",
            )}
          >
            {t(`strategy.tabs.${id}` as DictionaryKey)} ({n})
          </Link>
        ))}
      </nav>

      {tab === "waiting" ? (
        <>
          {board.toSend ? (
            <div className="mb-2" data-strategy-to-send={board.toSend}>
              <Alert tone="info">
                {t("strategy.toSend", { n: board.toSend })}{" "}
                <Link href="/app/requests" className={linkClass}>
                  {t("strategy.toSendLink")}
                </Link>
              </Alert>
            </div>
          ) : null}

          <StrategyQueue
            lines={lines}
            groups={groups}
            checks={Object.fromEntries(board.checks)}
            texts={texts}
            canChoose={canChoose}
            // Gerar o login do parceiro aqui (dono, 20/11/2026): só o
            // administrador (docs/EQUIPE_ACESSOS.md, R5).
            partnerLogin={
              isAdmin(user)
                ? {
                    minPassword: PORTAL_MIN_PASSWORD,
                    texts: {
                      open: t("partnerLogin.open"),
                      loading: t("partnerLogin.loading"),
                      title: t("partnerLogin.title"),
                      login: t("reqFix.customerLogin.login"),
                      loginHint: t("partnerLogin.loginHint"),
                      name: t("reqFix.customerLogin.name"),
                      password: t("reqFix.customerLogin.password"),
                      passwordHint: t("partnerLogin.passwordHint", {
                        n: PORTAL_MIN_PASSWORD,
                      }),
                      locale: t("partnerLogin.locale"),
                      localeNames: LOCALE_NAMES,
                      submit: t("partnerLogin.submit"),
                      working: t("reqFix.customerLogin.working"),
                      cancel: t("partnerLogin.cancel"),
                      done: t("partnerLogin.done"),
                      changeHint: t("partnerLogin.changeHint"),
                      portal: t("reqFix.portal"),
                      loginLabel: t("reqFix.login"),
                      passwordLabel: t("reqFix.customerLogin.password"),
                      copy: t("reqFix.copy"),
                      copied: t("reqFix.copied"),
                      copyFailed: t("reqFix.copyFailed"),
                    },
                  }
                : null
            }
          />
        </>
      ) : null}

      {tab === "open" ? (
        <section data-strategy-open={decisions.length}>
          {decisions.length ? (
            <StrategyGrid marker="open">
              {decisions.map((d) => {
                const demands = decisionDemands.filter((r) =>
                  d.demandIds.includes(r.id),
                );
                const ref = d.reference?.[0];
                // Encomenda cancelada ou já em outro pedido (dono, 18/11/2026):
                // a estratégia não é aprovada nem gera o pedido; fica gravada
                // como está (recusar continua valendo).
                const closed = closedDemands(d, demands);
                const blocked = closed.size > 0;
                // Uma linha por produto da solicitação, com a quantidade somada,
                // a embalagem (fontes da ficha completa) e a última compra de
                // cada um (todos do mesmo fornecedor).
                const packLines = linePackings(demands, packings);
                const nameOf = (productId: string) =>
                  productNameText(
                    t,
                    demands.find((r) => r.productId === productId)
                      ?.productName ?? "",
                  );
                const refOf = (productId: string) =>
                  d.reference?.find((x) => x.productId === productId);
                const leadTimes = packLines
                  .map((l) => refOf(l.productId)?.leadTimeDays)
                  .filter((n): n is number => typeof n === "number");
                const leadTime = leadTimes.length
                  ? Math.max(...leadTimes)
                  : null;
                const orderable =
                  d.status === "approved" &&
                  d.choice === "last_supplier" &&
                  !!ref &&
                  !blocked;
                const showForm = orderable && canOrder;
                const closedList = [...closed.entries()]
                  .map(([id, reason]) =>
                    t("strategyPack.closed.item", {
                      n: demands.find((r) => r.id === id)?.number ?? "—",
                      reason: t(
                        `strategyPack.closed.${reason}` as DictionaryKey,
                      ),
                    }),
                  )
                  .join(", ");
                const title = t("strategy.decision", { n: d.number });
                const customers = [
                  ...new Set(demands.map((r) => partyName(r.customerId))),
                ];
                const schedules = demands.flatMap(
                  (r) => r.schedule?.items ?? [],
                );
                const blockedAlert = blocked ? (
                  <div data-strategy-blocked-alert>
                    <Alert tone="warning">
                      <p className="font-semibold">
                        {t("strategyPack.closed.title")}
                      </p>
                      <p className="mt-0.5 text-xs">
                        {t(
                          d.status === "pending"
                            ? "strategyPack.closed.bodyPending"
                            : "strategyPack.closed.body",
                          { list: closedList },
                        )}
                      </p>
                    </Alert>
                  </div>
                ) : null;
                const approveHere = d.status === "pending" && canApprove;
                // Encerrar a estratégia aprovada que parou (dono, 19/11/2026).
                const closeHere =
                  blocked && d.status === "approved" && canClose;
                // A solicitação de um lote aparece uma vez (mesmo número e situação).
                const requestRows = [
                  ...new Map(
                    demands.map((r) => {
                      const why = closed.get(r.id);
                      return [
                        `${r.number ?? r.id}|${why ?? r.status}`,
                        { r, why },
                      ] as const;
                    }),
                  ).values(),
                ];
                const shownLines = packLines.slice(0, CARD_PRODUCTS);
                const hiddenLines = packLines.length - shownLines.length;
                // Detalhes: tudo o que o card resume (as contas, a explicação da
                // parada, a programação inteira, a última compra completa e a
                // decisão com observação).
                const detailsButton = (
                  <QuickDialog
                    label={t("strategyCard.details")}
                    title={t("strategyCard.detailsTitle", { title })}
                    closeLabel={t("strategyCard.close")}
                    size="lg"
                    data-strategy-details={d.id}
                  >
                    <div className="space-y-3 text-sm">
                      <p className="text-xs text-zinc-600">
                        {t(`strategy.choice.${d.choice}`)} ·{" "}
                        {t(`strategy.status.${d.status}` as DictionaryKey)}
                      </p>
                      {d.note ? (
                        <p className="whitespace-pre-line text-xs text-zinc-700">
                          <span className="font-medium">
                            {t("strategyCard.note")}:
                          </span>{" "}
                          {d.note}
                        </p>
                      ) : null}
                      <ul className="divide-y divide-zinc-100">
                        {demands.map((r) =>
                          demandRow(r, false, closed.get(r.id)),
                        )}
                      </ul>
                      {blockedAlert}
                      {packLines.map((line) => (
                        <div key={line.productId} className="space-y-2">
                          <p className="text-xs font-semibold text-zinc-900">
                            {nameOf(line.productId)}
                          </p>
                          <PackingCells
                            marker={`detail:${d.id}:${line.productId}`}
                            totals={lineTotals(line, line.quantity)}
                            basis={line.basis}
                            texts={packingTexts}
                            intl={t.intl}
                            piecesText={line.quantity.toLocaleString(t.intl)}
                            extraWarnings={packWarnings(line.warnings)}
                          />
                          {d.choice === "last_supplier"
                            ? reference(refOf(line.productId))
                            : null}
                        </div>
                      ))}
                      {schedules.length ? (
                        <div>
                          <p className="text-xs font-medium text-zinc-700">
                            {t("strategy.line.schedule")}
                          </p>
                          <ul className="text-xs text-zinc-700">
                            {demands.flatMap((r) =>
                              (r.schedule?.items ?? []).map((i) => (
                                <li key={`${r.id}:${i.index}`}>
                                  {r.number ? `nº ${r.number} · ` : ""}
                                  {t("strategy.line.scheduleItem", {
                                    index: i.index,
                                    quantity: i.quantity.toLocaleString(t.intl),
                                    date: formatDate(i.expectedAt, t),
                                  })}
                                </li>
                              )),
                            )}
                          </ul>
                        </div>
                      ) : null}
                      {/* Aprovar com observação (opcional) ou recusar com o
                        motivo: o formulário de sempre, fora do card. */}
                      {approveHere ? (
                        <form
                          action={decideStrategyAction}
                          className="grid gap-2 border-t border-zinc-100 pt-3"
                          data-strategy-approve-form
                          data-compact-fields
                        >
                          <input type="hidden" name="id" value={d.id} />
                          <p className="text-xs font-semibold text-zinc-900">
                            {t("strategyCard.decideTitle")}
                          </p>
                          <Field label={t("strategy.approvalNote")}>
                            <Textarea
                              name="note"
                              rows={2}
                              maxLength={2000}
                              className="shadow-none"
                            />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            {blocked ? null : (
                              <SubmitButton
                                name="decision"
                                value="approve"
                                data-strategy-approve-note
                              >
                                {t("strategy.approve")}
                              </SubmitButton>
                            )}
                            <SubmitButton
                              name="decision"
                              value="reject"
                              variant="secondary"
                              data-strategy-reject-note
                            >
                              {t("strategy.reject")}
                            </SubmitButton>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </QuickDialog>
                );
                return (
                  <section
                    key={d.id}
                    id={`decision-${d.id}`}
                    className={cx(
                      cardClass,
                      "gap-1",
                      blocked && "border-amber-300 bg-amber-50/30",
                    )}
                    data-strategy-decision={d.status}
                    data-strategy-decision-choice={d.choice}
                    data-strategy-blocked={blocked ? "1" : undefined}
                  >
                    {/* Número da estratégia e situação; modalidade. */}
                    <div className="flex flex-wrap items-center gap-1">
                      <h3 className="text-[13px] font-semibold text-zinc-900">
                        {title}
                      </h3>
                      <Badge
                        tone={d.status === "pending" ? "warning" : "success"}
                      >
                        {t(`strategy.status.${d.status}` as DictionaryKey)}
                      </Badge>
                      {blocked ? (
                        <span title={t("strategyPack.closed.title")}>
                          <Badge tone="danger">
                            {t("strategyCard.stopped")}
                          </Badge>
                        </span>
                      ) : null}
                    </div>
                    <p
                      className="truncate text-[11px] font-medium text-zinc-800"
                      title={t(`strategy.choice.${d.choice}`)}
                    >
                      {t(`strategy.choice.${d.choice}`)}
                    </p>
                    {/* Solicitação (link) e a situação dela. */}
                    <div
                      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
                      data-strategy-card-requests
                    >
                      {requestRows.map(({ r, why }) => {
                        const statusKey =
                          `reqStatusLabel.${r.status}` as DictionaryKey;
                        return (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1"
                            data-strategy-demand={r.id}
                            data-strategy-demand-closed={why}
                          >
                            <Link
                              href={`/app/requests/${r.id}`}
                              className={cx(linkClass, "font-medium")}
                            >
                              {t("strategyCard.request")}{" "}
                              {r.number ? `nº ${r.number}` : "—"}
                            </Link>
                            {why ? (
                              <Badge tone="danger">
                                {t(
                                  `strategyPack.closed.${why}` as DictionaryKey,
                                )}
                              </Badge>
                            ) : t(statusKey) !== statusKey ? (
                              <Badge tone="neutral">{t(statusKey)}</Badge>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                    {/* Cliente e identificações. */}
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p
                        className="min-w-0 flex-1 truncate font-medium text-zinc-900"
                        title={customers.join(", ")}
                      >
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                          {t("strategyCard.customer")}:{" "}
                        </span>
                        {customers.join(", ") || "—"}
                      </p>
                      {demands[0] ? (
                        <div className="shrink-0 [&_*]:text-[10px] [&>*]:mt-0">
                          <DemandTags t={t} request={demands[0]} />
                        </div>
                      ) : null}
                    </div>
                    {/* Produto e embalagem (os totais da ficha). */}
                    {shownLines.map((line) => (
                      <div
                        key={line.productId}
                        className="space-y-0.5"
                        data-strategy-decision-product={line.productId}
                      >
                        <p
                          className="truncate font-semibold text-zinc-900"
                          title={nameOf(line.productId)}
                        >
                          {nameOf(line.productId)}
                        </p>
                        <CompactPack
                          marker={`${d.id}:${line.productId}`}
                          totals={lineTotals(line, line.quantity)}
                          basis={line.basis}
                          piecesText={line.quantity.toLocaleString(t.intl)}
                          texts={cardTexts}
                          packTexts={packingTexts}
                          intl={t.intl}
                        />
                      </div>
                    ))}
                    {hiddenLines > 0 ? (
                      <p
                        className="text-[11px] text-zinc-600"
                        data-strategy-more={hiddenLines}
                      >
                        {t("strategyCard.more", { n: hiddenLines })}
                      </p>
                    ) : null}
                    {schedules.length ? (
                      <p className="truncate text-[11px] text-zinc-600">
                        {t("strategyCard.schedule")}:{" "}
                        {schedules.length > 1
                          ? t("strategyCard.scheduleCount", {
                              n: schedules.length,
                            })
                          : t("strategy.line.scheduleItem", {
                              index: schedules[0].index,
                              quantity: schedules[0].quantity.toLocaleString(
                                t.intl,
                              ),
                              date: formatDate(schedules[0].expectedAt, t),
                            })}
                      </p>
                    ) : null}
                    {/* Última compra (pedido direto), em duas linhas. */}
                    {d.choice === "last_supplier"
                      ? compactReference(ref)
                      : null}
                    {d.note ? (
                      <p
                        className="truncate text-[11px] text-zinc-600"
                        title={d.note}
                      >
                        {t("strategyCard.note")}: {d.note}
                      </p>
                    ) : null}
                    {blocked ? (
                      <p
                        className="truncate rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                        title={t(
                          d.status === "pending"
                            ? "strategyPack.closed.bodyPending"
                            : "strategyPack.closed.body",
                          { list: closedList },
                        )}
                        data-strategy-blocked-summary
                      >
                        {t("strategyCard.blocked")}
                      </p>
                    ) : null}
                    {d.status === "pending" && !canApprove ? (
                      <p className="text-[11px] text-zinc-500">
                        {t("strategy.waitingApproval")}
                      </p>
                    ) : null}
                    {orderable && !showForm ? (
                      <p className="text-[11px] text-zinc-500">
                        {t("strategy.waitingOrder")}
                      </p>
                    ) : null}
                    {d.status === "approved" &&
                    (d.choice === "quote" || d.choice === "quote_last") ? (
                      <p
                        className="text-[11px] text-zinc-600"
                        data-strategy-quote-pending
                      >
                        {t("strategy.quotePending")}{" "}
                        {d.quoteId ? (
                          <Link
                            href={`/app/purchase-quotes/${d.quoteId}`}
                            className={linkClass}
                            data-strategy-quote-link={d.quoteId}
                          >
                            {t("strategy.openQuote")}
                          </Link>
                        ) : null}
                      </p>
                    ) : null}
                    {/* Ações, numa linha: Aprovar (um toque), Recusar e
                      Encerrar (pedem a observação numa caixa), Gerar pedido
                      (formulário no painel) e Detalhes. */}
                    <div
                      className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-1"
                      data-strategy-card-actions
                    >
                      {approveHere && !blocked ? (
                        <form
                          action={decideStrategyAction}
                          className="contents"
                        >
                          <input type="hidden" name="id" value={d.id} />
                          <SubmitButton
                            name="decision"
                            value="approve"
                            className="px-2.5 py-1 text-xs"
                            data-strategy-approve
                          >
                            {t("strategy.approve")}
                          </SubmitButton>
                        </form>
                      ) : null}
                      {approveHere ? (
                        <QuickDialog
                          label={t("strategy.reject")}
                          title={t("strategyCard.rejectTitle", { n: d.number })}
                          closeLabel={t("strategyCard.close")}
                          data-strategy-reject-open={d.id}
                        >
                          <form
                            action={decideStrategyAction}
                            className="grid gap-2"
                            data-compact-fields
                          >
                            <input type="hidden" name="id" value={d.id} />
                            <input
                              type="hidden"
                              name="decision"
                              value="reject"
                            />
                            <Field label={t("strategyCard.rejectNote")}>
                              <Textarea
                                name="note"
                                rows={3}
                                maxLength={2000}
                                required
                                className="shadow-none"
                              />
                            </Field>
                            <div>
                              <SubmitButton
                                variant="secondary"
                                data-strategy-reject
                              >
                                {t("strategy.reject")}
                              </SubmitButton>
                            </div>
                          </form>
                        </QuickDialog>
                      ) : null}
                      {closeHere ? (
                        <QuickDialog
                          label={t("strategyClose.button")}
                          title={t("strategyCard.closeTitle", { n: d.number })}
                          closeLabel={t("strategyCard.close")}
                          data-strategy-close-open={d.id}
                        >
                          <form
                            action={closeStrategyAction}
                            className="grid gap-2"
                            data-strategy-close-form
                          >
                            <input type="hidden" name="id" value={d.id} />
                            <p className="text-xs text-zinc-600">
                              {t("strategyClose.hint")}
                            </p>
                            <Field label={t("strategyClose.note")}>
                              <Textarea
                                name="note"
                                rows={2}
                                maxLength={2000}
                                className="shadow-none"
                              />
                            </Field>
                            <div>
                              <SubmitButton
                                variant="secondary"
                                confirmText={t("strategyClose.confirm", {
                                  n: d.number,
                                })}
                                data-strategy-close
                              >
                                {t("strategyClose.button")}
                              </SubmitButton>
                            </div>
                          </form>
                        </QuickDialog>
                      ) : null}
                      {showForm && ref ? (
                        <QuickDialog
                          label={t("strategy.generateOrder")}
                          title={t("strategyCard.orderTitle", { title })}
                          closeLabel={t("strategyCard.close")}
                          tone="primary"
                          size="lg"
                          data-strategy-open-order={d.id}
                        >
                          <StrategyOrderForm
                            decisionId={d.id}
                            lines={packLines.map((line) => {
                              const price = refOf(line.productId)?.unitPrice;
                              return {
                                productId: line.productId,
                                productName: nameOf(line.productId),
                                quantity: line.quantity,
                                planned: line.planned,
                                basis: line.basis,
                                // O preço com a precisão gravada (sem arredondar).
                                unitPrice:
                                  seesPrice && price != null
                                    ? String(price)
                                    : "",
                                warnings: packWarnings(line.warnings),
                              };
                            })}
                            seesPrice={seesPrice}
                            currency={ref.currency ?? "USD"}
                            leadTime={leadTime !== null ? String(leadTime) : ""}
                            incoterm={
                              ref.incoterm === "EXW" || ref.incoterm === "FOB"
                                ? ref.incoterm
                                : ""
                            }
                            texts={orderTexts}
                            intl={t.intl}
                          />
                        </QuickDialog>
                      ) : null}
                      {detailsButton}
                    </div>
                  </section>
                );
              })}
            </StrategyGrid>
          ) : (
            <p className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500">
              {t("strategy.openEmpty")}
            </p>
          )}
        </section>
      ) : null}

      {tab === "sent" ? (
        sentRows.length ? (
          <div
            className="overflow-x-auto rounded-xl border border-zinc-200 bg-white"
            data-strategy-sends
          >
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="px-3 py-2">{t("strategy.sent.col.what")}</th>
                  <th className="px-3 py-2">{t("strategy.sent.col.items")}</th>
                  <th className="px-3 py-2">{t("strategy.sent.col.at")}</th>
                  <th className="px-3 py-2">{t("strategy.sent.col.status")}</th>
                  <th className="px-3 py-2">{t("strategy.sent.col.send")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sentRows.map(({ send, line, index }) => {
                  const quote = line.quoteId
                    ? sentQuotes.find((q) => q.id === line.quoteId)
                    : null;
                  const sendHref = `/app/purchase-strategy/sends/${send.id}`;
                  // A linha abre a cotação; o pedido direto, a estratégia em
                  // andamento; a que não saiu, o resultado do envio.
                  const href = line.quoteId
                    ? `/app/purchase-quotes/${line.quoteId}`
                    : line.decisionId
                      ? `/app/purchase-strategy?tab=open#decision-${line.decisionId}`
                      : sendHref;
                  const label = line.quoteId
                    ? quote
                      ? t("strategy.send.quote", { n: quote.number })
                      : t("strategy.sent.col.what")
                    : line.decisionId
                      ? t("strategy.sent.direct")
                      : t("strategy.sent.failed");
                  const demands = (line.demandIds ?? [line.demandId])
                    .map((id) => sentDemands.find((d) => d.id === id))
                    .filter((d): d is Request => !!d);
                  const shown = demands.slice(0, 3);
                  const missing = line.recipients.filter(
                    (r) => r.status === "blocked" || r.status === "failed",
                  ).length;
                  return (
                    <tr
                      key={`${send.id}:${index}`}
                      data-strategy-send={send.id}
                      data-strategy-sent-row={
                        line.quoteId ?? line.decisionId ?? ""
                      }
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={href}
                          className={cx(linkClass, "font-medium")}
                          data-strategy-sent-open
                        >
                          {label}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {shown.length
                          ? shown
                              .map(
                                (d) =>
                                  `${d.number ? `${d.number} · ` : ""}${productNameText(t, d.productName)}`,
                              )
                              .join(", ")
                          : "—"}
                        {demands.length > shown.length
                          ? ` ${t("strategy.sent.more", { n: demands.length - shown.length })}`
                          : ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600">
                        {formatDate(send.createdAt, t)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          tone={
                            line.error
                              ? "danger"
                              : missing
                                ? "warning"
                                : "success"
                          }
                        >
                          {line.error
                            ? t("strategy.sent.failed")
                            : missing
                              ? t("strategy.sends.failures", { n: missing })
                              : line.quoteId
                                ? t("strategy.sends.ok")
                                : t("strategy.tabs.open")}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        <Link href={sendHref} className={linkClass}>
                          {t("strategy.sends.one", { n: send.number })}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("strategy.sends.empty")}</Empty>
        )
      ) : null}
    </div>
  );
}
