import Link from "next/link";
import type { ReactNode } from "react";
import {
  PurchaseScheduleTable,
  roundsLine,
} from "@/components/purchase-rounds";
import { BookingItemSuperplan } from "@/components/booking-item-superplan";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import {
  pendingProposal,
  supplierCanAnswer,
  supplierRequestDecisions,
} from "@/lib/supplier-requests";
import {
  getSupplierRequest,
  legacyAnswers,
  linkedApprovalFor,
  linkedSupplierRequests,
  supplierRequestGroup,
} from "@/lib/services/supplier-requests";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  formatMoney,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  answerSupplierRequestAction,
  decideSupplierRequestAction,
  openSupplierRequestAction,
  resolveLinkedRequestAction,
} from "../../actions/supplier-requests";
import { agreedConditions } from "@/lib/services/supplier-request-product";
import { analyzeNegotiatedItem } from "@/lib/services/superplan-analysis";
import { STATUS_TONE, answerText } from "../_components/status";
import {
  RequestProductCard,
  type RequestProductData,
} from "../_components/request-product";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
import { partiesWithoutLogin } from "@/lib/services/portal-access";
import {
  notifyLateSupplierRequests,
  slaOf,
  supplierRequestSlaMinutes,
} from "@/lib/services/supplier-request-negotiation";
import { NegotiationCard, SlaBadge } from "../_components/negotiation";
import { can } from "@/lib/auth/function-access";
import { SupplierRequestTable } from "../_components/supplier-table";
import { RequestTimeline } from "../_components/timeline";
import { RequestChat, type ChatMessage } from "../_components/request-chat";
import { dateTime } from "../_components/negotiation";
import { canPostMessage } from "@/lib/supplier-requests";
import { SamplingCard } from "../_components/sampling";

/*
 * Uma solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md). O fornecedor vê
 * o item, a quantidade e o que a Wellmix precisa, e responde (até a Wellmix
 * decidir). A Wellmix vê também o booking, o Superplan do item e as
 * alternativas e decide (a resposta é só do fornecedor).
 */

export default async function SupplierRequestPage({
  params,
  searchParams,
}: PageProps<"/app/supplier-requests/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/supplier-requests/${id}`);
  requireScreen(user, "quotes");
  const query = await searchParams;
  const one = (k: string) => {
    const v = query[k];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  // SLA estourado: avisa uma vez (Wellmix e fornecedor) ao abrir a tela.
  await notifyLateSupplierRequests().catch((error) =>
    console.error("notifyLateSupplierRequests", error),
  );
  const detail = await getSupplierRequest(user, id).catch((error: unknown) => {
    if (error instanceof Error && error.message === "schema_outdated")
      return "schema" as const;
    throw error;
  });
  if (detail === "schema")
    return (
      <Alert tone="warning">
        {t("supplierRequests.selection.schemaMissing")}
      </Alert>
    );
  if (!detail) notFound();
  const { request: r, supplier, lot, chosen, alternatives } = detail;
  const wellmix = isWellmix(user);
  // Fornecedor sem login (só a Wellmix vê o aviso): enquanto a solicitação
  // está em andamento, ele não vê nem responde até ganhar o acesso.
  const noLoginNow =
    wellmix &&
    !!supplier &&
    (r.status === "open" || r.status === "answered") &&
    (await partiesWithoutLogin([supplier.id])).has(supplier.id);
  const it = r.item;
  const intl = t.intl;
  const num = (n: number | null, digits = 4) =>
    n === null
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const col = (k: string) => t(`bookingLots.item.col.${k}` as DictionaryKey);

  const error = one("error");
  const errorKey = [`supplierRequests.error.${error}`, `common.${error}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);
  const notices: string[] = [];
  if (one("created"))
    notices.push(
      t(
        noLoginNow
          ? "supplierRequests.detail.createdNoLogin"
          : "supplierRequests.detail.created",
      ),
    );
  if (one("answered")) notices.push(t("supplierRequests.detail.answered"));
  const decided = one("decided");
  if (["approved", "declined", "cancelled"].includes(decided))
    notices.push(
      t(`supplierRequests.detail.decided.${decided}` as DictionaryKey),
    );
  const negotiationNotice = one("negotiation");
  if (
    ["proposal", "accept", "counter", "reject", "message"].includes(
      negotiationNotice,
    )
  )
    notices.push(
      t(
        `supplierRequests.negotiation.notice.${negotiationNotice}` as DictionaryKey,
      ),
    );
  const linkedNotice = one("linked");
  if (linkedNotice === "keep" || linkedNotice === "decline")
    notices.push(t(`supplierRequests.detail.linked.notice.${linkedNotice}`));
  const productNotice = one("product");
  if (["created", "linked", "items", "released"].includes(productNotice))
    notices.push(t(`srProduct.notice.${productNotice}` as DictionaryKey));
  const samplingNotice = one("sampling");
  if (
    ["file", "removed", "submitted", "approved", "rejected"].includes(
      samplingNotice,
    )
  )
    notices.push(t(`sampling.notice.${samplingNotice}` as DictionaryKey));
  const erpNotice = one("erp");
  if (["checked", "unchecked", "cleared"].includes(erpNotice))
    notices.push(t(`srProduct.notice.erp.${erpNotice}` as DictionaryKey));

  const noLogin =
    noLoginNow && supplier ? [{ id: supplier.id, name: supplier.name }] : [];

  // Quem abre o link vê primeiro a tabela dos produtos da solicitação
  // (mesmo fornecedor e booking); "Abrir produto" leva à tela completa
  // (view=item).
  const itemView = one("view") === "item";
  const noticeBlock = (
    <div className="mb-3 space-y-2" data-supplier-request-notices>
      <SupplierNoLoginAlert
        suppliers={noLogin}
        canParties={canOpen(user, "parties")}
        t={t}
        title="supplierRequests.noLogin.request"
        hint="supplierRequests.noLogin.requestHint"
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {notices.map((n) => (
        <Alert key={n} tone="success">
          {n}
        </Alert>
      ))}
    </div>
  );
  if (!itemView) {
    const [rows, slaMinutes] = await Promise.all([
      supplierRequestGroup(user, r),
      supplierRequestSlaMinutes(),
    ]);
    const legacy = await legacyAnswers(rows);
    return (
      <>
        <PageHeader
          t={t}
          title={t("supplierRequests.detail.title", { n: r.number })}
          subtitle={[
            wellmix ? supplier?.name : null,
            t(
              wellmix
                ? "supplierRequests.table.subtitleWellmix"
                : "supplierRequests.table.subtitle",
              { n: rows.length },
            ),
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <LinkButton href="/app/supplier-requests">
              {t("supplierRequests.detail.back")}
            </LinkButton>
          }
        />
        {noticeBlock}
        <div data-supplier-table>
          <SupplierRequestTable
            rows={rows}
            currentId={r.id}
            slaMinutes={slaMinutes}
            wellmix={wellmix}
            legacy={legacy}
            t={t}
          />
        </div>
      </>
    );
  }

  // Bloco "Produto": a Wellmix que abre Produtos, na solicitação aprovada.
  let productData: RequestProductData | null = null;
  if (wellmix && r.status === "approved" && canOpen(user, "products")) {
    const svc = await import("@/lib/services/supplier-request-product");
    const store = getStore();
    const q = {
      items: one("iq").slice(0, 80),
      products: one("pq").slice(0, 80),
      erp: one("eq").slice(0, 80),
    };
    const [product, lines, choices, catalog, erp, chosenItem] =
      await Promise.all([
        r.productId ? store.get("products", r.productId) : null,
        store.list("product_lines", {
          filter: { active: true },
          orderBy: "name",
        }),
        svc.requestItemChoices(r, q.items),
        r.productId
          ? Promise.resolve([])
          : q.products
            ? svc.searchCatalogProducts(q.products)
            : svc.suggestCatalogProducts(r),
        r.productId && q.erp ? svc.searchSankhyaProducts(q.erp) : null,
        r.productId ? null : store.get("booking_items", r.bookingItemId),
      ]);
    const linkedCount = product
      ? (
          await store.list("booking_items", {
            filter: { productId: product.id },
          })
        ).length
      : 0;
    const suggestedName = (it.productName ?? it.description ?? "").slice(
      0,
      160,
    );
    productData = {
      request: r,
      product,
      linkedCount,
      lines,
      choices,
      catalog,
      erp,
      query: q,
      suggestedName,
      deal: svc.agreedConditions(r),
      readiness: product ? [] : svc.erpReadiness(r, chosenItem, suggestedName),
    };
  }

  const proposalPending = !!pendingProposal(r.negotiation);
  // Solicitações ligadas (item e alternativas): aprovada uma, as em
  // andamento pedem resposta, continuar negociando ou recusar.
  const [linked, askingMe] = wellmix
    ? await Promise.all([
        linkedSupplierRequests(user, r),
        linkedApprovalFor(user, r),
      ])
    : [[], null];
  const canResolve = wellmix && can(user, "supplierRequest.decide");
  const resolveButtons = (targetId: string) => (
    <form
      action={resolveLinkedRequestAction}
      className="flex flex-wrap gap-2"
      data-linked-resolve-form={targetId}
    >
      <input type="hidden" name="id" value={targetId} />
      <input type="hidden" name="back" value={r.id} />
      <SubmitButton
        name="choice"
        value="keep"
        variant="secondary"
        data-linked-resolve="keep"
      >
        {t("supplierRequests.detail.linked.keep")}
      </SubmitButton>
      <SubmitButton
        name="choice"
        value="decline"
        variant="danger"
        data-linked-resolve="decline"
      >
        {t("supplierRequests.detail.linked.decline")}
      </SubmitButton>
    </form>
  );
  const linkedWaiting = linked.filter((l) => l.askedBy !== null).length;
  // Ficha negociada: com a resposta "faz", os valores combinados (resposta,
  // contraproposta aceita ou nova proposta do responsável) entram na ficha,
  // com o do booking riscado ao lado; a Wellmix vê o Superplan refeito com
  // eles (docs/SUPPLIER_REQUESTS.md, "Ficha negociada").
  const deal = r.supplierCanDo === "yes" ? agreedConditions(r) : null;
  const negotiated =
    wellmix && deal && chosen
      ? await analyzeNegotiatedItem(chosen, deal, user.id).catch(
          (error: unknown) => {
            console.error("analyzeNegotiatedItem", error);
            return null;
          },
        )
      : null;
  const priceText = (
    price: number | null,
    currency: string | null,
    incoterm: string | null,
  ) =>
    price === null
      ? "—"
      : `${num(price)} ${currency ?? ""} ${incoterm ?? ""}`
          .replace(/\s+/g, " ")
          .trim();
  /** Valor negociado, com o do booking riscado ao lado quando mudou. */
  const changed = (now: string, before: string, key: string) =>
    now === before ? (
      now
    ) : (
      <span key={key} className="flex flex-wrap items-baseline gap-2">
        <strong data-negotiated-value={key}>{now}</strong>
        <s className="text-xs text-zinc-400" data-negotiated-before={key}>
          {before}
        </s>
      </span>
    );
  const bookingPrice = priceText(it.price, it.currency, it.incoterm);
  const cheaperThan = negotiated?.costBrl ?? null;
  // Só o fornecedor responde: a resposta é para a Wellmix, que não responde por ele.
  const canAnswer = !wellmix && supplierCanAnswer(r.status) && !proposalPending;
  // Decidir (aprovar, recusar, cancelar): só com a permissão (Equipe → Funções e acessos).
  const decisions =
    wellmix && can(user, "supplierRequest.decide")
      ? supplierRequestDecisions(r.status, r.supplierCanDo, proposalPending)
      : [];
  const sla = slaOf(r, await supplierRequestSlaMinutes());
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);

  // Respostas antigas (antes do histórico de respostas): da auditoria.
  const timelineLegacy = await legacyAnswers([r]);

  // Conversa no chat flutuante: as mensagens livres, de quem é cada uma.
  const mySide = wellmix ? "wellmix" : "supplier";
  const chatMessages: ChatMessage[] = (r.negotiation ?? [])
    .filter((e) => e.kind === "message")
    .map((e) => ({
      id: e.id,
      mine: e.side === mySide,
      sideLabel: t(`supplierRequests.negotiation.side.${e.side}`),
      at: dateTime(e.at, t),
      text: e.text ?? null,
      documentId: e.documentId ?? null,
      fileName: e.fileName ?? null,
    }));

  return (
    <>
      <PageHeader
        t={t}
        title={t("supplierRequests.detail.title", { n: r.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[r.status]}>
              {t(`supplierRequests.status.${r.status}` as DictionaryKey)}
            </Badge>
            <SlaBadge sla={sla} t={t} />
            {wellmix && supplier ? <span>{supplier.name}</span> : null}
          </span>
        }
        actions={
          <LinkButton
            href={`/app/supplier-requests/${r.id}`}
            data-supplier-table-back
          >
            {t("supplierRequests.table.back")}
          </LinkButton>
        }
      />
      {noticeBlock}
      {askingMe && canResolve ? (
        <div className="mb-3" data-linked-ask>
          <Alert tone="warning">
            <span className="flex flex-col gap-2">
              <span>
                {t("supplierRequests.detail.linked.ask", {
                  n: askingMe.number,
                })}{" "}
                <Link
                  href={`/app/supplier-requests/${askingMe.id}?view=item`}
                  className={linkClass}
                >
                  nº {askingMe.number}
                </Link>
              </span>
              {resolveButtons(r.id)}
            </span>
          </Alert>
        </div>
      ) : null}
      {r.status === "approved" && linkedWaiting > 0 ? (
        <div className="mb-3" data-linked-approved-ask>
          <Alert tone="info">
            {t("supplierRequests.detail.linked.approvedAsk")}
          </Alert>
        </div>
      ) : null}

      {/* Amostragem: a etapa depois da aprovação (fotos e vídeos da amostra). */}
      {r.status === "approved" ? (
        <div className="mb-4">
          <SamplingCard
            request={r}
            wellmix={wellmix}
            canValidate={wellmix && can(user, "sampling.validate")}
            t={t}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <Card title={t("supplierRequests.detail.request")}>
            <div className="flex flex-wrap gap-4">
              {it.photoDocumentId ? (
                <a
                  href={`/api/files/${it.photoDocumentId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img
                    src={`/api/files/${it.photoDocumentId}`}
                    alt=""
                    className="h-32 w-32 rounded-lg border border-zinc-200 object-cover"
                  />
                </a>
              ) : null}
              <div className="min-w-60 flex-1">
                <DescriptionList
                  items={[
                    [
                      t("supplierRequests.detail.item"),
                      <span key="i" className="flex flex-col">
                        <span className="font-medium">
                          {it.description ?? it.productName ?? "—"}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {[it.factoryItemCode, it.itemNumber]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>,
                    ],
                    [
                      t("supplierRequests.detail.quantity"),
                      <span key="q" className="flex flex-col">
                        <strong>
                          {t("supplierRequests.detail.pieces", {
                            n: r.quantity.toLocaleString(intl),
                          })}
                        </strong>
                        {r.schedule?.items.length ? (
                          <span className="text-xs text-zinc-600">
                            {roundsLine(r.schedule, t)}
                          </span>
                        ) : null}
                      </span>,
                    ],
                    ...(deal
                      ? ([
                          [
                            t("supplierRequests.detail.negotiatedPrice"),
                            changed(
                              priceText(
                                deal.price,
                                deal.currency,
                                deal.incoterm,
                              ),
                              bookingPrice,
                              "price",
                            ),
                          ],
                          [
                            col("moq"),
                            changed(num(deal.moq, 0), num(it.moq, 0), "moq"),
                          ],
                          ...(deal.leadTimeDays !== null
                            ? [
                                [
                                  t("supplierRequests.detail.answer.leadTime"),
                                  num(deal.leadTimeDays, 0),
                                ] as [string, ReactNode],
                              ]
                            : []),
                        ] as Array<[string, ReactNode]>)
                      : ([
                          [
                            t("supplierRequests.detail.bookingPrice"),
                            bookingPrice,
                          ],
                          [col("moq"), num(it.moq, 0)],
                        ] as Array<[string, ReactNode]>)),
                  ]}
                />
                {deal ? (
                  <p
                    className="mt-1 text-xs text-zinc-500"
                    data-negotiated-hint
                  >
                    {t("supplierRequests.detail.negotiatedHint")}
                  </p>
                ) : null}
              </div>
            </div>
            {negotiated ? (
              <div
                className="mt-4 rounded-lg border border-brand-100 bg-brand-50/40 p-3"
                data-negotiated-superplan
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("supplierRequests.detail.negotiatedSuperplan")}
                </h3>
                <div className="mt-1 flex flex-wrap items-start gap-4">
                  {negotiated.costBrl !== null ? (
                    <span className="flex flex-wrap items-baseline gap-2">
                      <strong
                        className="text-sm text-zinc-900"
                        data-negotiated-cost
                      >
                        {t("supplierRequests.detail.chosenCost", {
                          price: formatMoney(negotiated.costBrl, "BRL", t),
                        })}
                      </strong>
                      {chosen?.analysis?.costBrl != null &&
                      chosen.analysis.costBrl !== negotiated.costBrl ? (
                        <s className="text-xs text-zinc-400">
                          {formatMoney(chosen.analysis.costBrl, "BRL", t)}
                        </s>
                      ) : null}
                    </span>
                  ) : null}
                  <BookingItemSuperplan analysis={negotiated} t={t} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("supplierRequests.detail.negotiatedSuperplanHint")}
                </p>
              </div>
            ) : null}
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("supplierRequests.detail.needs")}
              </h3>
              <p
                className="mt-1 whitespace-pre-wrap text-sm text-zinc-900"
                data-supplier-request-needs
              >
                {r.needs ?? t("supplierRequests.detail.needsNone")}
              </p>
              <PurchaseScheduleTable schedule={r.schedule} t={t} />
            </div>
            <div className="mt-4">
              <DescriptionList
                items={[
                  [col("masterCartonQty"), num(it.masterCartonQty, 0)],
                  [col("innerQty"), num(it.innerQty, 0)],
                  [col("netWeightPcKg"), num(it.netWeightPcKg)],
                  [col("grossWeightPcKg"), num(it.grossWeightPcKg)],
                  [col("cbmPerCarton"), num(it.cbmPerCarton)],
                  [
                    t("supplierRequests.selection.col.size"),
                    [it.lengthCm, it.widthCm, it.heightCm]
                      .map((n) => num(n, 2))
                      .join(" × "),
                  ],
                  [
                    col("capacityMl"),
                    it.capacityMl === null && it.sizeText
                      ? it.sizeText
                      : num(it.capacityMl, 0),
                  ],
                  [col("packageType"), it.packageType ?? "—"],
                  [col("material"), it.material ?? "—"],
                  [col("colorAssortment"), it.colorAssortment ?? "—"],
                  [col("powerDetail"), it.powerDetail ?? "—"],
                ]}
              />
            </div>
          </Card>

          {wellmix ? (
            <Card
              title={t("supplierRequests.detail.alternatives", {
                n: alternatives.length,
              })}
            >
              <p className="mb-2 text-xs text-zinc-500">
                {t("supplierRequests.detail.alternativesHint")}
              </p>
              {alternatives.length ? (
                <ul className="divide-y divide-zinc-100 text-sm">
                  {alternatives.map(({ item, lot: l, supplier: s }) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                      data-supplier-request-alternative={item.id}
                    >
                      <span>
                        <span className="font-medium">
                          {item.description ?? item.productName ?? "—"}
                        </span>{" "}
                        <span className="text-xs text-zinc-500">
                          {[item.factoryItemCode, s?.name, l?.origin]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-zinc-600">
                        <span className="tabular-nums">
                          {num(item.price)} {item.currency ?? ""}
                        </span>
                        {item.analysis?.costBrl != null ? (
                          <span className="font-semibold text-zinc-800">
                            {t("supplierRequests.detail.chosenCost", {
                              price: formatMoney(
                                item.analysis.costBrl,
                                "BRL",
                                t,
                              ),
                            })}
                          </span>
                        ) : null}
                        {item.analysis?.minimumBrl != null ? (
                          <span>
                            {t("bookingLots.item.minimum", {
                              price: formatMoney(
                                item.analysis.minimumBrl,
                                "BRL",
                                t,
                              ),
                            })}
                          </span>
                        ) : null}
                        {l ? (
                          <Link
                            href={`/app/booking/lots/${l.id}`}
                            className={linkClass}
                          >
                            nº {l.number}
                          </Link>
                        ) : null}
                        {cheaperThan !== null &&
                        item.analysis?.costBrl != null &&
                        item.analysis.costBrl < cheaperThan ? (
                          <Badge tone="warning">
                            <span data-alternative-cheaper={item.id}>
                              {t("supplierRequests.detail.alternativeCheaper")}
                            </span>
                          </Badge>
                        ) : null}
                        {deal ? (
                          // Nova referência: abre a solicitação para a
                          // alternativa, com o item atual e as outras de
                          // alternativa (mesma quantidade e necessidade).
                          <form action={openSupplierRequestAction}>
                            <input
                              type="hidden"
                              name="chosen"
                              value={item.id}
                            />
                            {[
                              ...(chosen ? [chosen.id] : []),
                              ...alternatives.map((a) => a.item.id),
                            ]
                              .filter((x) => x !== item.id)
                              .map((x) => (
                                <input
                                  key={x}
                                  type="hidden"
                                  name="alternatives"
                                  value={x}
                                />
                              ))}
                            <input
                              type="hidden"
                              name="quantity"
                              value={String(r.quantity)}
                            />
                            <input
                              type="hidden"
                              name="needs"
                              value={r.needs ?? ""}
                            />
                            <SubmitButton
                              variant="secondary"
                              data-alternative-open={item.id}
                            >
                              {t("supplierRequests.detail.alternativeOpen")}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  {t("supplierRequests.detail.alternativesNone")}
                </p>
              )}
            </Card>
          ) : null}

          {linked.length ? (
            <Card
              title={t("supplierRequests.detail.linked.title", {
                n: linked.length,
              })}
            >
              <p className="mb-2 text-xs text-zinc-500">
                {t("supplierRequests.detail.linked.hint")}
              </p>
              <ul className="divide-y divide-zinc-100 text-sm" data-linked>
                {linked.map(({ request: o, supplier: s, askedBy }) => (
                  <li
                    key={o.id}
                    className="flex flex-col gap-2 py-2"
                    data-linked-request={o.id}
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>
                        <Link
                          href={`/app/supplier-requests/${o.id}?view=item`}
                          className={linkClass}
                        >
                          nº {o.number}
                        </Link>{" "}
                        <span className="font-medium">
                          {o.item.description ?? o.item.productName ?? "—"}
                        </span>{" "}
                        <span className="text-xs text-zinc-500">
                          {[o.item.factoryItemCode, s?.name]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <Badge tone={STATUS_TONE[o.status]}>
                        {t(
                          `supplierRequests.status.${o.status}` as DictionaryKey,
                        )}
                      </Badge>
                    </span>
                    {askedBy !== null && canResolve ? (
                      <span
                        className="flex flex-wrap items-center gap-2 text-xs text-amber-800"
                        data-linked-asked={o.id}
                      >
                        {t("supplierRequests.detail.linked.askShort", {
                          n: askedBy,
                        })}
                        {resolveButtons(o.id)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title={t("supplierRequests.detail.answer.title")} dense>
            {r.supplierCanDo ? (
              <div className="mb-3 space-y-1 text-sm" data-supplier-answer>
                <p className="font-semibold">{answerText(t, r)}</p>
                {r.supplierMoq !== null ? (
                  <p>
                    {t("supplierRequests.detail.answer.moq")}:{" "}
                    {num(r.supplierMoq, 0)}
                  </p>
                ) : null}
                {r.supplierLeadTimeDays !== null ? (
                  <p>
                    {t("supplierRequests.detail.answer.leadTime")}:{" "}
                    {num(r.supplierLeadTimeDays, 0)}
                  </p>
                ) : null}
                {r.supplierIncoterm ? (
                  <p data-supplier-answer-incoterm-value>
                    {t("supplierRequests.detail.answer.incoterm")}:{" "}
                    {r.supplierIncoterm}
                  </p>
                ) : null}
                {r.supplierNote ? (
                  <p className="whitespace-pre-wrap text-zinc-700">
                    {r.supplierNote}
                  </p>
                ) : null}
                {r.respondedAt ? (
                  <p className="text-xs text-zinc-500">
                    {t("supplierRequests.detail.answer.at", {
                      date: dateTime(r.respondedAt, t),
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mb-3 text-sm text-zinc-500">
                {t("supplierRequests.detail.answer.none")}
              </p>
            )}
            {canAnswer ? (
              <form
                action={answerSupplierRequestAction}
                className="space-y-2"
                data-supplier-answer-form
              >
                <input type="hidden" name="id" value={r.id} />
                {r.supplierCanDo ? (
                  <p className="text-xs text-zinc-500">
                    {t("supplierRequests.detail.answer.change")}
                  </p>
                ) : null}
                <Field label={t("supplierRequests.detail.answer.canDo")}>
                  <Select
                    name="canDo"
                    required
                    defaultValue={r.supplierCanDo ?? ""}
                    data-supplier-answer-cando
                  >
                    <option value="" disabled>
                      {t("common.select")}
                    </option>
                    <option value="yes">
                      {t("supplierRequests.detail.answer.yes")}
                    </option>
                    <option value="no">
                      {t("supplierRequests.detail.answer.no")}
                    </option>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("supplierRequests.detail.answer.price")}>
                    <Input
                      name="price"
                      inputMode="decimal"
                      defaultValue={raw(r.supplierPrice)}
                      data-supplier-answer-price
                    />
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.currency")}>
                    <Select
                      name="currency"
                      defaultValue={r.supplierCurrency ?? it.currency ?? "USD"}
                    >
                      {SHEET_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.moq")}>
                    <Input
                      name="moq"
                      inputMode="numeric"
                      defaultValue={raw(r.supplierMoq)}
                    />
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.leadTime")}>
                    <Input
                      name="leadTimeDays"
                      inputMode="numeric"
                      defaultValue={raw(r.supplierLeadTimeDays)}
                    />
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.incoterm")}>
                    <Select
                      name="incoterm"
                      defaultValue={r.supplierIncoterm ?? it.incoterm ?? "FOB"}
                      data-supplier-answer-incoterm
                    >
                      {SHEET_INCOTERMS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label={t("supplierRequests.detail.answer.note")}>
                  <Textarea
                    name="note"
                    rows={3}
                    maxLength={4000}
                    defaultValue={r.supplierNote ?? ""}
                  />
                </Field>
                <SubmitButton
                  pendingText={t("supplierRequests.detail.answer.pending")}
                  data-supplier-answer-submit
                >
                  {t("supplierRequests.detail.answer.submit")}
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          {/* Histórico de interações logo abaixo da resposta do fornecedor. */}
          <RequestTimeline
            request={
              wellmix
                ? r
                : {
                    ...r,
                    // "Continuar negociando" é decisão interna da Wellmix.
                    negotiation: (r.negotiation ?? []).filter(
                      (e) => e.kind !== "keep",
                    ),
                  }
            }
            legacyAnswers={timelineLegacy.get(r.id) ?? []}
            t={t}
          />

          {wellmix ? (
            <Card title={t("supplierRequests.detail.decide.title")} dense>
              {r.decidedAt ? (
                <p className="mb-2 text-sm text-zinc-600">
                  {t("supplierRequests.detail.decide.at", {
                    date: dateTime(r.decidedAt, t),
                  })}
                  {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                </p>
              ) : null}
              {r.status === "open" ? (
                <p
                  className="mb-2 text-xs text-zinc-500"
                  data-supplier-decide-waiting
                >
                  {t("supplierRequests.detail.decide.waiting")}
                </p>
              ) : null}
              {proposalPending ? (
                <p
                  className="mb-2 text-xs text-amber-800"
                  data-supplier-decide-blocked
                >
                  {t("supplierRequests.negotiation.approveBlocked")}
                </p>
              ) : null}
              {decisions.length ? (
                <form
                  action={decideSupplierRequestAction}
                  className="space-y-2"
                  data-supplier-decide-form
                >
                  <input type="hidden" name="id" value={r.id} />
                  <Field label={t("supplierRequests.detail.decide.note")}>
                    <Input name="note" maxLength={500} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {decisions.map((d) => (
                      <SubmitButton
                        key={d}
                        name="decision"
                        value={d}
                        variant={
                          d === "approved"
                            ? "primary"
                            : d === "declined"
                              ? "danger"
                              : "secondary"
                        }
                        data-supplier-decide={d}
                      >
                        {t(
                          `supplierRequests.detail.decide.${d}` as DictionaryKey,
                        )}
                      </SubmitButton>
                    ))}
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          {wellmix ? (
            <Card title={t("supplierRequests.detail.booking")} dense>
              <div className="space-y-1 text-sm">
                {lot ? (
                  <Link
                    href={`/app/booking/lots/${lot.id}`}
                    className={linkClass}
                  >
                    {t("supplierRequests.detail.bookingOf", {
                      n: lot.number,
                      file: lot.fileName,
                    })}
                  </Link>
                ) : null}
                {chosen?.analysis ? (
                  <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("supplierRequests.detail.chosenSuperplan")}
                    </p>
                    <span className="mt-1 flex flex-col gap-1">
                      {chosen.analysis.costBrl !== null ? (
                        <span
                          className="text-sm font-semibold text-zinc-900"
                          data-supplier-request-chosen-cost
                        >
                          {t("supplierRequests.detail.chosenCost", {
                            price: formatMoney(
                              chosen.analysis.costBrl,
                              "BRL",
                              t,
                            ),
                          })}
                        </span>
                      ) : null}
                      <BookingItemSuperplan analysis={chosen.analysis} t={t} />
                    </span>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Contraproposta: na coluna da direita, embaixo do Booking (a
              conversa fica no chat flutuante). */}
          <NegotiationCard request={r} wellmix={wellmix} t={t} />
        </div>
      </div>
      {wellmix && r.orderId ? (
        <div className="mt-4" data-supplier-request-order>
          <Alert tone="info">
            <Link href={`/app/orders/${r.orderId}`} className={linkClass}>
              {t("purchaseOrder.detail.inOrder")}
            </Link>
          </Alert>
        </div>
      ) : wellmix && r.status === "approved" && r.productId ? (
        <div className="mt-4" data-supplier-request-order-pending>
          <Alert tone="info">
            <Link
              href="/app/supplier-requests#pedido-de-compra"
              className={linkClass}
            >
              {t("purchaseOrder.detail.generate")}
            </Link>
          </Alert>
        </div>
      ) : null}
      {productData ? (
        <div className="mt-4" data-request-product>
          <RequestProductCard data={productData} t={t} />
        </div>
      ) : null}
      <RequestChat
        requestId={r.id}
        messages={chatMessages}
        canPost={canPostMessage(r.status)}
        defaultOpen={negotiationNotice === "message"}
        labels={{
          open: t("supplierRequests.chat.open"),
          title: t("supplierRequests.chat.title", { n: r.number }),
          close: t("supplierRequests.chat.close"),
          empty: t("supplierRequests.chat.empty"),
          placeholder: t("supplierRequests.chat.placeholder"),
          attach: t("supplierRequests.negotiation.attach"),
          send: t("supplierRequests.chat.send"),
          sending: t("supplierRequests.negotiation.sending"),
          file: t("supplierRequests.negotiation.file"),
          closed: t("supplierRequests.chat.closed"),
        }}
      />
    </>
  );
}
