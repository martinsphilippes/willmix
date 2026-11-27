import { EntityTimelineCard } from "@/components/entity-timeline-card";
import { SentMark } from "@/components/sent-mark";
import { requestTimeline } from "@/lib/services/entity-timeline";
import Link from "next/link";
import { RequestColorPlan } from "@/components/color-lines";
import {
  PurchaseScheduleTable,
  roundsLine,
} from "@/components/purchase-rounds";
import {
  BookingItemForecast,
  bookingForecastOf,
} from "@/components/booking-item-forecast";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  pendingProposal,
  supplierCanAnswer,
  supplierRequestDecisions,
} from "@/lib/supplier-requests";
import {
  getSupplierRequest,
  legacyAnswers,
  requestBookSpecs,
  linkedApprovalFor,
  linkedSupplierRequests,
  supplierRequestGroup,
} from "@/lib/services/supplier-requests";
import { productNameText } from "@/i18n";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { errorTextsFor, fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  Field,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  formatMoney,
  cx,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  answerSupplierRequestStateAction,
  decideSupplierRequestStateAction,
  openSupplierRequestAction,
  resolveLinkedRequestAction,
  reviewSamplingAction,
  setSupplierRequestSamplingAction,
} from "../../actions/supplier-requests";
import { ActionForm } from "@/components/action-form";
import { requestItemSpecs } from "@/lib/supplier-request-specs";
import {
  negotiationPeople,
  type NegotiationPerson,
} from "@/lib/services/supplier-request-people";
import {
  FromTo,
  InfoCell,
  InfoGrid,
  ItemSheetGrid,
  NegotiationSection,
  SupplierResponseStrip,
  recipientText,
} from "../_components/negotiation-sections";
import { OfferRowFields } from "../_components/offer-row";
import {
  NegotiationConversation,
  type ConversationMessage,
} from "../_components/negotiation-conversation";
import { agreedConditions } from "@/lib/services/supplier-request-product";
import { forecastNegotiatedItem } from "@/lib/services/booking-price-forecast";
import { STATUS_TONE } from "../_components/status";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
import { partiesWithoutLogin } from "@/lib/services/portal-access";
import {
  notifyLateSupplierRequests,
  slaOf,
  supplierRequestSlaMinutes,
} from "@/lib/services/supplier-request-negotiation";
import { NegotiationForms, SlaBadge } from "../_components/negotiation";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
import { SupplierRequestTable } from "../_components/supplier-table";
import { RequestTimeline } from "../_components/timeline";
import { dateTime } from "../_components/negotiation";
import { canPostMessage, canPropose } from "@/lib/supplier-requests";
import { RequestAiReferences } from "@/components/selection-ai-prompts";
import {
  packLabels,
  RequestVariant,
  VariantRoundsTable,
  variantText,
} from "@/components/request-variant";
import { variantFacts } from "@/lib/selection-packing";
import { QuickDialog } from "@/components/quick-dialog";
import { OpenIcon } from "../_components/icons";
import {
  BoardCounterForm,
  QuotationBoard,
  QuoteHistoryList,
  type BoardReference,
  type BoardRow,
} from "../_components/quotation-board";
import { QuoteChat, RequestChat } from "../_components/board-chat";
import {
  quoteProductHistory,
  quoteProductMessages,
} from "@/lib/quote-negotiation";
import { lastPurchases } from "@/lib/services/purchase-strategy";
import { QuotationQuotePage } from "../_components/quote-pages";
import { SamplingCard } from "../_components/sampling";
import { ItemImagesCard } from "../_components/item-images";
import { samplingSlaDays } from "@/lib/services/supplier-request-sampling";
import { supplierRequestResponsibles } from "@/lib/services/supplier-request-turns";
import {
  samplingApproved,
  samplingFor,
  samplingRequired,
} from "@/lib/supplier-request-sampling";
import { SamplingNeedForm } from "../_components/sampling-need";
import {
  entityLinkAccess,
  linksForSupplierRequest,
  selectionHref,
} from "@/lib/services/entity-links";

/*
 * Uma solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md). O fornecedor vê
 * o item, a quantidade e o que a Wellmix precisa, e responde (até a Wellmix
 * decidir). A Wellmix vê também o booking, a previsão de preço do item e as
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
  await import("@/lib/services/supplier-request-sampling")
    .then((m) => m.notifyLateSampling())
    .catch((error) => console.error("notifyLateSampling", error));
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
  if (!detail) {
    // Cotação unificada (dono, 22/11/2026; docs/QUOTATION.md): o mesmo
    // endereço abre a cotação de compra ainda com os fornecedores (antes de
    // virar a solicitação da vencedora). Só a Wellmix; o fornecedor segue
    // na cotação dele.
    const quote = await getStore()
      .get("purchase_quotes", id)
      .catch(() => null);
    if (!quote) notFound();
    // O fornecedor responde a cotação de compra na tela dele (dono,
    // 27/11/2026: Consultas junta a lista; a cotação segue onde ele responde).
    if (!isWellmix(user)) redirect(`/app/purchase-quotes/${quote.id}`);
    return <QuotationQuotePage user={user} quote={quote} query={query} t={t} />;
  }
  const { request: r, supplier, lot, chosen, alternatives } = detail;
  const wellmix = isWellmix(user);
  // Para a Wellmix, a solicitação é a Cotação (dono, 22/11/2026).
  const pageTitle = t(
    wellmix ? "quotation.detail.title" : "supplierRequests.detail.title",
    { n: r.number },
  );
  // Preço de compra (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seção 7): a
  // Wellmix com "Ver preço de compra"; o fornecedor vê o dele. Sem a
  // permissão, também sem a previsão de preço (o custo sai do preço).
  const seesPrice = !wellmix || canSeePurchasePrice(user);
  // Grupo da seleção de onde a solicitação saiu (fase 4b, docs/MILESTONES.md).
  const selections =
    wellmix && entityLinkAccess(user).book
      ? ((await linksForSupplierRequest(r.id))?.selections ?? []).filter(
          (g) => g.supplierRequestId === r.id,
        )
      : [];
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
  const offerNotice = one("offer");
  if (offerNotice === "confirmed" || offerNotice === "refused")
    notices.push(t(`supplierRequests.detail.offer.${offerNotice}`));
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
  const countered = Number(one("countered"));
  if (Number.isInteger(countered) && countered > 0)
    notices.push(t("quotation.counter.sent", { n: countered }));
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
  const samplingNeedNotice = one("samplingNeed");
  if (samplingNeedNotice === "yes" || samplingNeedNotice === "no")
    notices.push(t(`inquiries.samplingNeed.saved.${samplingNeedNotice}`));
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
        canCreate={isAdmin(user)}
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
  // Linha do tempo da solicitação entre os blocos (docs/FLOW_MENU.md).
  const timelineCard = wellmix ? (
    <EntityTimelineCard timeline={await requestTimeline(r)} t={t} />
  ) : null;
  if (!itemView) {
    const [rows, slaMinutes, samplingDays] = await Promise.all([
      supplierRequestGroup(user, r),
      supplierRequestSlaMinutes(),
      samplingSlaDays(),
    ]);
    // Vez (dono, 24/11/2026): quem age em cada produto, com o login para o
    // administrador, a mesma peça de Encomendas (só a Wellmix).
    const [legacy, bookSpecs, responsible] = await Promise.all([
      legacyAnswers(rows),
      requestBookSpecs(user, rows),
      supplierRequestResponsibles(user, rows, {
        slaMinutes,
        samplingDays,
        trading: supplier?.type === "trading",
        translate: (key) => t(key as DictionaryKey),
      }),
    ]);
    return (
      <>
        <PageHeader
          t={t}
          title={pageTitle}
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
              {t(
                wellmix
                  ? "quotation.detail.back"
                  : "supplierRequests.detail.back",
              )}
            </LinkButton>
          }
        />
        {timelineCard}
        {noticeBlock}
        {/* "Necessita amostragem" da consulta (dono, 27/11/2026). */}
        {wellmix ? (
          <div className="mb-3">
            <SamplingNeedForm
              need={rows.some((p) => samplingRequired(p))}
              canChange={
                can(user, "supplierRequest.decide") &&
                rows.some(
                  (p) =>
                    p.status !== "declined" &&
                    p.status !== "cancelled" &&
                    !p.orderId,
                )
              }
              action={setSupplierRequestSamplingAction}
              fields={
                <>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="view" value="table" />
                </>
              }
              t={t}
            />
          </div>
        ) : null}
        <div data-supplier-table>
          <SupplierRequestTable
            rows={rows}
            currentId={r.id}
            slaMinutes={slaMinutes}
            samplingSlaDays={samplingDays}
            wellmix={wellmix}
            legacy={legacy}
            bookSpecs={bookSpecs}
            showPrice={seesPrice}
            responsible={responsible}
            t={t}
          />
        </div>
      </>
    );
  }

  // Bloco "Produto": a Wellmix que abre Produtos, na solicitação aprovada.
  // O cadastro saiu desta tela (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md):
  // fica em Cadastrar produto, depois da Cotação no menu; aqui, o atalho.
  // Produto (criar ou associar) e pedido de compra só depois da amostra
  // aprovada (decisão do dono, 12/11/2026; docs/SUPPLIER_SAMPLING.md).
  const productWaitsSample =
    wellmix && r.status === "approved" && !r.productId && !samplingApproved(r);
  const registrationProduct =
    wellmix &&
    r.status === "approved" &&
    canOpen(user, "productRegistration") &&
    r.productId
      ? await getStore().get("products", r.productId)
      : null;
  const registrationCard =
    wellmix &&
    r.status === "approved" &&
    canOpen(user, "productRegistration") ? (
      <Card title={t("srProduct.title")}>
        <div
          className="flex flex-wrap items-center gap-2 text-sm"
          data-request-product-registration-card
        >
          {registrationProduct ? (
            <>
              <Badge tone="success">
                {t(
                  r.productAction === "linked"
                    ? "srProduct.done.linked"
                    : "srProduct.done.created",
                )}
              </Badge>
              <Link
                href={`/app/products/${registrationProduct.id}`}
                className={linkClass}
                data-request-product-open
              >
                {productNameText(t, registrationProduct.name)}
              </Link>
              <span className="text-zinc-600" data-request-product-erp-code>
                {registrationProduct.sankhyaCode
                  ? `CODPROD ${registrationProduct.sankhyaCode}`
                  : "CODPROD —"}
              </span>
            </>
          ) : (
            <span className="text-zinc-700">
              {t("productRegistration.quoteCard.pending")}
            </span>
          )}
          <LinkButton
            href={`/app/product-registration/${r.id}`}
            variant={registrationProduct ? "secondary" : "primary"}
            data-request-product-registration
          >
            {t("productRegistration.goRegistration")}
          </LinkButton>
        </div>
      </Card>
    ) : null;

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
  // contraproposta aceita ou nova proposta do responsável) entram no resumo,
  // com o do booking riscado ao lado; a Wellmix vê a previsão de preço do
  // Sankhya refeita com eles (docs/SUPPLIER_REQUESTS.md, "Ficha negociada").
  const deal = r.supplierCanDo === "yes" ? agreedConditions(r) : null;
  const negotiated =
    wellmix && seesPrice && deal && chosen
      ? await forecastNegotiatedItem(chosen, deal, user.id).catch(
          (error: unknown) => {
            console.error("forecastNegotiatedItem", error);
            return null;
          },
        )
      : null;
  /** Valor negociado, com o do booking riscado ao lado quando mudou. */
  const changed = (now: string, before: string, key: string) =>
    now === before ? (
      now
    ) : (
      <span key={key} className="flex flex-wrap items-baseline gap-x-2">
        <strong data-negotiated-value={key}>{now}</strong>
        <s
          className="text-xs font-normal text-zinc-400"
          data-negotiated-before={key}
        >
          {before}
        </s>
      </span>
    );
  const cheaperThan = negotiated?.costBrl ?? null;
  // Contraproposta: a Wellmix pergunta a previsão de preço do item ao
  // Sankhya pela tela (/api/price-forecast/booking-item).
  const simulation =
    wellmix && seesPrice && chosen && canPropose(r)
      ? {
          itemId: chosen.id,
          bookingMinimum:
            bookingForecastOf(chosen.analysis)?.salePriceBrl ?? null,
        }
      : null;
  // Só o fornecedor responde: a resposta é para a Wellmix, que não responde por ele.
  const canAnswer = !wellmix && supplierCanAnswer(r.status) && !proposalPending;
  // Decidir (aprovar, recusar, cancelar): só com a permissão (Equipe → Funções e acessos).
  const decisions =
    wellmix && can(user, "supplierRequest.decide")
      ? supplierRequestDecisions(r.status, r.supplierCanDo, proposalPending)
      : [];
  const sla = slaOf(r, await supplierRequestSlaMinutes());

  // Respostas antigas (antes do histórico de respostas): da auditoria.
  const timelineLegacy = await legacyAnswers([r]);

  // Tela da negociação reorganizada (docs/SUPPLIER_REQUESTS.md): quem fala
  // (nome e login, com a regra de privacidade de 18/11/2026) e a ficha do
  // produto pela mesma regra da tabela (cópia da solicitação + item do Book).
  const [people, bookSpecs] = await Promise.all([
    negotiationPeople(user, r),
    requestBookSpecs(user, [r]),
  ]);
  const book = bookSpecs.get(r.id) ?? null;
  const specs = requestItemSpecs(r, book);
  const supplierName =
    supplier?.name ?? t("supplierRequests.negotiation.side.supplier");
  // Erro de envio na própria tela, sem recarregar (o que foi digitado fica).
  const errorTexts = errorTextsFor(t, ["supplierRequests.error", "common"]);
  const errorFallback = `${t("common.error")} ({code})`;
  const fromTo = <FromTo people={people} supplierName={supplierName} t={t} />;
  const nameOf = (p: NegotiationPerson | null | undefined) =>
    !p
      ? "—"
      : p.userId === user.id
        ? `${p.name} · ${t("negotiationScreen.you")}`
        : p.name;
  const loginOf = (p: NegotiationPerson | null | undefined) =>
    p ? (p.login ? `${p.name} (${p.login})` : p.name) : "—";

  // Conversa: as mensagens livres, de quem é cada uma e para quem foi o aviso.
  const mySide = wellmix ? "wellmix" : "supplier";
  const conversation: ConversationMessage[] = (r.negotiation ?? [])
    .filter((e) => e.kind === "message")
    .map((e) => {
      const author = people.byId[e.byUserId];
      const sideLabel = t(`supplierRequests.negotiation.side.${e.side}`);
      return {
        id: e.id,
        mine: e.side === mySide,
        side: e.side,
        sideLabel,
        author: author ? nameOf(author) : sideLabel,
        login: author?.login ?? null,
        to: recipientText(e.side, people, supplierName, t),
        at: dateTime(e.at, t),
        text: e.text ?? null,
        documentId: e.documentId ?? null,
        fileName: e.fileName ?? null,
      };
    });
  const decidedBy = r.decidedByUserId ? people.byId[r.decidedByUserId] : null;
  // Seções numeradas na ordem do dono; as da Wellmix não aparecem para o
  // fornecedor, e a numeração segue sem buracos.
  let sectionNo = 0;
  const nextSection = () => ++sectionNo;

  // Peças por embalagem da cotação de um SKU (1 = a unitária).
  const packUnits = Math.max(1, r.variant?.units ?? 1);
  const summarySection = (
    <NegotiationSection
      n={nextSection()}
      title={t("negotiationScreen.s.summary")}
      mark="summary"
    >
      <div className="flex gap-3">
        {/* A Wellmix vê a foto no card Imagens, à direita (um lugar só). O
            fornecedor vê a foto e, desde 27/11/2026, a arte da variação
            aqui no alto (o quadro "Variação e embalagem" saiu da tela dele). */}
        {!wellmix && (it.photoDocumentId || r.variant?.artDocumentId) ? (
          <span className="flex shrink-0 gap-2">
            {[
              { id: it.photoDocumentId, label: null, mark: "photo" },
              {
                id: r.variant?.artDocumentId ?? null,
                label: t("supplierRequests.variant.art"),
                mark: "art",
              },
            ]
              .filter(
                (x): x is { id: string; label: string | null; mark: string } =>
                  !!x.id,
              )
              .map((x) => (
                <figure
                  key={x.mark}
                  className="space-y-0.5"
                  data-negotiation-image={x.mark}
                >
                  <a
                    href={`/api/files/${x.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                    <img
                      src={`/api/files/${x.id}`}
                      alt={x.label ?? ""}
                      className={`h-20 w-20 rounded-lg border border-zinc-200 bg-white ${
                        x.mark === "art" ? "object-contain" : "object-cover"
                      }`}
                    />
                  </a>
                  {x.label ? (
                    <figcaption className="max-w-20 text-[10px] leading-tight text-zinc-500">
                      {x.label}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="min-w-0" data-negotiation-product>
            <span className="block break-words text-sm font-semibold text-zinc-900">
              {it.description ?? it.productName ?? "—"}
            </span>
            <span className="block text-xs text-zinc-500">
              {[it.factoryItemCode, it.itemNumber].filter(Boolean).join(" · ")}
            </span>
            {/* A variação e a embalagem, numa linha (dono, 27/11/2026). */}
            {!wellmix && r.variant ? (
              <span
                className="mt-0.5 block text-xs font-medium text-brand-800"
                data-negotiation-variant
              >
                {variantText(r.variant, t)}
              </span>
            ) : null}
          </p>
          <InfoGrid>
            <InfoCell
              label={t("negotiationScreen.f.quantity")}
              mark="quantity"
              wide
            >
              <span className="flex flex-col">
                <strong>
                  {packUnits > 1
                    ? `${t("supplierRequests.variant.packs", {
                        n: r.quantity.toLocaleString(intl),
                      })} ${t("supplierRequests.variant.piecesParen", {
                        n: (r.quantity * packUnits).toLocaleString(intl),
                      })}`
                    : t("supplierRequests.detail.pieces", {
                        n: r.quantity.toLocaleString(intl),
                      })}
                </strong>
                {r.schedule?.items.length && packUnits === 1 ? (
                  <span className="text-xs font-normal text-zinc-600">
                    {roundsLine(r.schedule, t)}
                  </span>
                ) : null}
              </span>
            </InfoCell>
            {seesPrice ? (
              <>
                {/* Moeda à esquerda do preço (dono, 27/11/2026). */}
                <InfoCell
                  label={t("negotiationScreen.f.currency")}
                  mark="currency"
                >
                  {deal
                    ? changed(
                        deal.currency ?? "—",
                        it.currency ?? "—",
                        "currency",
                      )
                    : (it.currency ?? "—")}
                </InfoCell>
                <InfoCell label={packLabels(packUnits, t).price} mark="price">
                  {deal
                    ? changed(num(deal.price), num(it.price), "price")
                    : num(it.price)}
                </InfoCell>
              </>
            ) : null}
            <InfoCell label={t("negotiationScreen.f.incoterm")} mark="incoterm">
              {deal
                ? changed(deal.incoterm ?? "—", it.incoterm ?? "—", "incoterm")
                : (it.incoterm ?? "—")}
            </InfoCell>
            <InfoCell label={packLabels(packUnits, t).moq} mark="moq">
              {deal
                ? changed(num(deal.moq, 0), num(it.moq, 0), "moq")
                : num(it.moq, 0)}
            </InfoCell>
            <InfoCell label={t("negotiationScreen.f.leadTime")} mark="leadTime">
              {deal ? num(deal.leadTimeDays, 0) : "—"}
            </InfoCell>
          </InfoGrid>
          <p
            className="text-[11px] text-zinc-500"
            data-negotiated-hint={deal ? "" : undefined}
          >
            {deal
              ? t("supplierRequests.detail.negotiatedHint")
              : t("negotiationScreen.f.sourceBook")}
          </p>
        </div>
      </div>
      {negotiated ? (
        <div
          className="mt-3 rounded-lg border border-brand-100 bg-brand-50/40 p-2.5"
          data-negotiated-forecast
        >
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {t("bookingForecast.negotiated")}
          </h4>
          <div className="mt-1 flex flex-wrap items-start gap-4">
            {negotiated.costBrl !== null ? (
              <span className="flex flex-wrap items-baseline gap-2">
                <strong className="text-sm text-zinc-900" data-negotiated-cost>
                  {t("supplierRequests.detail.chosenCost", {
                    price: formatMoney(negotiated.costBrl, "BRL", t),
                  })}
                </strong>
                {bookingForecastOf(chosen?.analysis)?.costBrl != null &&
                chosen!.analysis!.costBrl !== negotiated.costBrl ? (
                  <s className="text-xs text-zinc-400">
                    {formatMoney(chosen!.analysis!.costBrl!, "BRL", t)}
                  </s>
                ) : null}
              </span>
            ) : null}
            <BookingItemForecast analysis={negotiated} t={t} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {t("bookingForecast.negotiatedHint")}
          </p>
        </div>
      ) : null}
      <div className="mt-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {t("supplierRequests.detail.needs")}
        </h4>
        <p
          className="mt-1 whitespace-pre-wrap text-[13px] text-zinc-900"
          data-supplier-request-needs
        >
          {r.needs ?? t("supplierRequests.detail.needsNone")}
        </p>
        {/* Com variação × embalagem, as entregas ficam no quadro da
            variação, em embalagens, peças e caixas. Para o fornecedor, a
            programação tem a seção própria, a 3 (dono, 27/11/2026). */}
        {r.variant || !wellmix ? null : (
          <PurchaseScheduleTable schedule={r.schedule} t={t} />
        )}
        {/* Variações de cor: cada cor na própria linha, por data. */}
        <RequestColorPlan
          plan={r.colorPlan}
          schedule={r.schedule}
          name={
            it.description ??
            it.productName ??
            it.factoryItemCode ??
            t("productName.unnamed")
          }
          t={t}
        />
      </div>
    </NegotiationSection>
  );

  const sheetSection = (
    <NegotiationSection
      n={nextSection()}
      title={t("negotiationScreen.s.sheet")}
      mark="sheet"
    >
      <ItemSheetGrid
        specs={specs}
        item={it}
        ncm={wellmix ? (book?.ncm ?? null) : null}
        units={packUnits}
        // Só quando a cotação veio de um book (dono, 22/11/2026).
        bookHref={
          wellmix && r.bookingLotId
            ? `/app/booking/lots/${r.bookingLotId}`
            : null
        }
        t={t}
      />
    </NegotiationSection>
  );

  // Programação (dono, 27/11/2026): na tela do fornecedor, a seção 3, com
  // as entregas (em embalagens, peças e caixas na variação × embalagem).
  const hasRounds = r.variant
    ? (variantFacts(r, book)?.rounds.length ?? 0) > 0
    : !!r.schedule?.items.length;
  const scheduleSection = wellmix ? null : (
    <NegotiationSection
      n={nextSection()}
      title={t("inquiries.schedule.title")}
      mark="schedule"
    >
      {hasRounds ? (
        r.variant ? (
          <VariantRoundsTable request={r} book={book} t={t} />
        ) : (
          <PurchaseScheduleTable schedule={r.schedule} t={t} />
        )
      ) : (
        <p
          className="text-[13px] text-zinc-600"
          data-negotiation-schedule-single
        >
          {t("inquiries.schedule.single", {
            n:
              packUnits > 1
                ? t("supplierRequests.variant.packs", {
                    n: r.quantity.toLocaleString(intl),
                  })
                : t("supplierRequests.detail.pieces", {
                    n: r.quantity.toLocaleString(intl),
                  }),
          })}
        </p>
      )}
    </NegotiationSection>
  );

  // Resposta do fornecedor e "Negociação e conversa": seções da tela do
  // fornecedor. Para a Wellmix, o quadro comparativo mostra a proposta de
  // cada um, com a conversa e o histórico nos modais e a contraproposta no
  // bloco à direita (dono, 22/11/2026; docs/QUOTATION.md).
  // Tela do fornecedor (dono, 27/11/2026): a resposta dele (oferta recebida,
  // contraproposta e rodadas) abre num modal pelo ícone do Histórico de
  // interações, e o quadro para responder fica fixo na coluna da direita,
  // acima da Conversa.
  const answerDetail = wellmix ? null : (
    <QuickDialog
      label={<OpenIcon className="h-3.5 w-3.5" />}
      hint={t("inquiries.answer.detail")}
      title={t("inquiries.answer.detailTitle")}
      closeLabel={t("quotation.close")}
      size="lg"
      className="h-6 w-6 px-0 py-0"
      data-negotiation-answer-detail=""
    >
      <SupplierResponseStrip
        request={r}
        people={people}
        supplierName={supplierName}
        seesPrice={seesPrice}
        t={t}
      />
    </QuickDialog>
  );
  const answerSection = wellmix ? null : (
    <div data-negotiation-section="answer">
      {canAnswer ? (
        <ActionForm
          action={answerSupplierRequestStateAction}
          errors={errorTexts}
          fallbackError={errorFallback}
          pendingLabel={t("supplierRequests.detail.answer.pending")}
          // Resposta gravada: o formulário renasce com os valores novos.
          key={`answer-${r.respondedAt ?? "none"}`}
          className="@container"
          data-supplier-answer-form
        >
          <input type="hidden" name="id" value={r.id} />
          <div className="space-y-2">
            {r.supplierCanDo ? (
              <p className="text-xs text-zinc-500">
                {t("supplierRequests.detail.answer.change")}
              </p>
            ) : null}
            <div className="max-w-xs">
              <Field label={t("supplierRequests.detail.answer.canDo")}>
                <Select
                  name="canDo"
                  className="min-h-9"
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
            </div>
            <OfferRowFields
              t={t}
              values={{
                price: r.supplierPrice,
                currency: r.supplierCurrency ?? it.currency ?? "USD",
                moq: r.supplierMoq,
                leadTimeDays: r.supplierLeadTimeDays,
                incoterm: r.supplierIncoterm ?? it.incoterm ?? "FOB",
              }}
              marks={{
                price: "data-supplier-answer-price",
                incoterm: "data-supplier-answer-incoterm",
              }}
              labels={packLabels(packUnits, t)}
            />
            <Field label={t("supplierRequests.detail.answer.note")}>
              <Textarea
                name="note"
                rows={2}
                maxLength={4000}
                defaultValue={r.supplierNote ?? ""}
                className="max-h-48 min-h-9 resize-y"
              />
            </Field>
            {fromTo}
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton
                className="min-h-9"
                pendingText={t("supplierRequests.detail.answer.pending")}
                data-supplier-answer-submit
              >
                {t("supplierRequests.detail.answer.submit")}
              </SubmitButton>
              {/* "✓ Enviado" (dono, 14/11/2026): há resposta gravada e
                  nenhum campo mudou desde então. A chave refaz o
                  componente a cada envio gravado. */}
              <SentMark
                key={r.respondedAt ?? "none"}
                saved={!!r.supplierCanDo}
                label={t("supplierRequests.detail.answer.sent")}
              />
            </div>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );

  const decisionSection = wellmix ? (
    <NegotiationSection
      n={nextSection()}
      title={t("negotiationScreen.s.decision")}
      mark="decision"
    >
      <div className="space-y-2">
        {r.decidedAt ? (
          <p className="text-[13px] text-zinc-600" data-supplier-decided>
            {decidedBy
              ? t("negotiationScreen.decision.by", {
                  date: dateTime(r.decidedAt, t),
                  name: loginOf(decidedBy),
                })
              : t("supplierRequests.detail.decide.at", {
                  date: dateTime(r.decidedAt, t),
                })}
            {r.decisionNote ? ` · ${r.decisionNote}` : ""}
          </p>
        ) : null}
        {r.status === "open" ? (
          <p className="text-xs text-zinc-500" data-supplier-decide-waiting>
            {t("supplierRequests.detail.decide.waiting")}
          </p>
        ) : null}
        {proposalPending ? (
          <p className="text-xs text-amber-800" data-supplier-decide-blocked>
            {t("supplierRequests.negotiation.approveBlocked")}
          </p>
        ) : null}
        {decisions.length ? (
          <ActionForm
            action={decideSupplierRequestStateAction}
            errors={errorTexts}
            fallbackError={errorFallback}
            pendingLabel={t("supplierRequests.negotiation.sending")}
            key={`decide-${r.status}-${r.decidedAt ?? ""}`}
            data-supplier-decide-form
          >
            <input type="hidden" name="id" value={r.id} />
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="min-w-56 flex-1">
                <Field label={t("supplierRequests.detail.decide.note")}>
                  <Textarea
                    name="note"
                    rows={1}
                    maxLength={500}
                    className="max-h-32 min-h-9 resize-y"
                    aria-describedby="decide-note-hint"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                {decisions.map((d) => (
                  <SubmitButton
                    key={d}
                    className="min-h-9"
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
                    {t(`supplierRequests.detail.decide.${d}` as DictionaryKey)}
                  </SubmitButton>
                ))}
              </div>
            </div>
            {/* Opção A do dono (21/11/2026): a regra de sempre, agora dita
                na tela: o fornecedor vê esta observação no Histórico de
                interações (o aviso a ele não leva a observação). */}
            <p
              id="decide-note-hint"
              className="mt-1 text-[11px] text-zinc-500"
              data-supplier-decide-note-hint
            >
              {t("negotiationScreen.decision.noteHint")}
            </p>
          </ActionForm>
        ) : null}
      </div>
    </NegotiationSection>
  ) : null;

  // Conversa da cotação fixa na coluna da direita, abaixo do histórico,
  // sempre aberta (dono, 26/11/2026).
  const chatBlock = (
    <div id="chat" className="min-w-0 scroll-mt-20" data-negotiation-chat>
      <NegotiationConversation
        requestId={r.id}
        messages={conversation}
        canPost={canPostMessage(r.status)}
        defaultOpen
        sendingAs={loginOf(people.me)}
        sendingTo={recipientText(people.me.side, people, supplierName, t)}
        errors={errorTexts}
        fallbackError={errorFallback}
        labels={{
          title: t("negotiationScreen.chat.title", {
            n: conversation.length,
          }),
          who: t("negotiationScreen.chat.who"),
          empty: t("supplierRequests.chat.empty"),
          placeholder: t("supplierRequests.chat.placeholder"),
          attach: t("negotiationScreen.chat.attach"),
          send: t("negotiationScreen.chat.send"),
          sending: t("supplierRequests.negotiation.sending"),
          file: t("supplierRequests.negotiation.file"),
          closed: t("supplierRequests.chat.closed"),
          sendingAs: t("negotiationScreen.chat.sendingAs"),
          sendingTo: t("negotiationScreen.chat.sendingTo"),
          to: t("negotiationScreen.to"),
          login: t("negotiationScreen.login"),
        }}
      />
    </div>
  );

  const negotiationSection = wellmix ? null : (
    <div
      className="@container space-y-3"
      data-negotiation-section="negotiation"
    >
      <NegotiationForms
        request={r}
        wellmix={wellmix}
        t={t}
        simulation={simulation}
        showPrice={seesPrice}
        fromTo={fromTo}
        errors={errorTexts}
        fallbackError={errorFallback}
      />
    </div>
  );
  // O quadro para responder (fornecedor): a resposta ou, com contraproposta
  // da Wellmix esperando, a resposta a ela; sem nada a responder, o aviso.
  const respondCard = wellmix ? null : (
    <Card title={t("inquiries.answer.title")} dense>
      <div className="space-y-3" data-negotiation-respond>
        {canAnswer ? answerSection : null}
        {proposalPending ? negotiationSection : null}
        {!canAnswer && !proposalPending ? (
          <p
            className="text-[13px] text-zinc-600"
            data-negotiation-respond-none
          >
            {t("inquiries.answer.none")}
          </p>
        ) : null}
      </div>
    </Card>
  );

  const alternativesSection = wellmix ? (
    <NegotiationSection
      n={nextSection()}
      title={`${t("negotiationScreen.s.alternatives")} (${alternatives.length})`}
      mark="alternatives"
    >
      <p className="mb-1 text-xs text-zinc-500">
        {t("supplierRequests.detail.alternativesHint")}
      </p>
      {alternatives.length ? (
        <ul className="divide-y divide-zinc-100 text-[13px]">
          {alternatives.map(({ item, lot: l, supplier: s }) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              data-supplier-request-alternative={item.id}
            >
              <span className="min-w-0">
                <span className="font-medium">
                  {item.description ?? item.productName ?? "—"}
                </span>{" "}
                <span className="text-xs text-zinc-500">
                  {[item.factoryItemCode, s?.name, l?.origin]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                {seesPrice ? (
                  <span className="tabular-nums">
                    {num(item.price)} {item.currency ?? ""}
                  </span>
                ) : null}
                {seesPrice &&
                bookingForecastOf(item.analysis)?.costBrl != null ? (
                  <span className="font-semibold text-zinc-800">
                    {t("supplierRequests.detail.chosenCost", {
                      price: formatMoney(item.analysis!.costBrl!, "BRL", t),
                    })}
                  </span>
                ) : null}
                {seesPrice &&
                bookingForecastOf(item.analysis)?.salePriceBrl != null ? (
                  <span>
                    {t("bookingForecast.sale", {
                      price: formatMoney(
                        item.analysis!.salePriceBrl!,
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
                bookingForecastOf(item.analysis)?.costBrl != null &&
                item.analysis!.costBrl! < cheaperThan ? (
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
                    <input type="hidden" name="chosen" value={item.id} />
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
                    <input type="hidden" name="needs" value={r.needs ?? ""} />
                    <SubmitButton
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
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
        <p className="text-[13px] text-zinc-500">
          {t("supplierRequests.detail.alternativesNone")}
        </p>
      )}
    </NegotiationSection>
  ) : null;

  // Quadro comparativo (dono, 22/11/2026; docs/QUOTATION.md), só da Wellmix:
  // esta cotação, as ligadas (o item e as alternativas, com os outros
  // fornecedores) e, quando ela nasceu de uma cotação de compra, o que os
  // outros convidados responderam. Cada linha com a conversa e o histórico
  // do par fornecedor × produto num modal e a caixa da contraproposta.
  let boardRows: BoardRow[] = [];
  let boardReference: BoardReference | null = null;
  if (wellmix) {
    const boardRequests = [
      { request: r, supplier },
      ...linked.map((l) => ({ request: l.request, supplier: l.supplier })),
    ];
    const boardLegacy = await legacyAnswers(
      boardRequests.map((x) => x.request),
    );
    const chatOpen = one("chat");
    boardRows = boardRequests.map(({ request: o, supplier: s }) => {
      const name = s?.name ?? t("supplierRequests.negotiation.side.supplier");
      const offer =
        o.supplierCanDo === "yes"
          ? agreedConditions(o)
          : {
              price: o.item.price ?? null,
              currency: o.item.currency ?? null,
              incoterm: o.item.incoterm ?? null,
              moq: o.item.moq ?? null,
              leadTimeDays: null,
            };
      const waiting = !!pendingProposal(o.negotiation);
      const key = `request:${o.id}`;
      return {
        key,
        target: canPropose(o) && !waiting ? key : null,
        checked: o.id === r.id,
        supplierName: name,
        current: o.id === r.id,
        state: (
          <>
            <Badge tone={STATUS_TONE[o.status]}>
              {t(`supplierRequests.status.${o.status}` as DictionaryKey)}
            </Badge>
            {o.supplierCanDo === "no" ? (
              <Badge tone="danger">
                {t("supplierRequests.detail.answer.no")}
              </Badge>
            ) : null}
          </>
        ),
        price: seesPrice ? offer.price : null,
        currency: offer.currency,
        incoterm: offer.incoterm,
        moq: offer.moq,
        leadTimeDays: offer.leadTimeDays,
        conditions:
          [
            o.id === r.id
              ? null
              : (o.item.description ?? o.item.productName ?? null),
            o.supplierNote,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        pending: waiting,
        href: o.id === r.id ? null : `/app/supplier-requests/${o.id}?view=item`,
        chat: (
          <>
            <RequestChat
              user={user}
              request={o}
              supplierName={name}
              board={r.id}
              errors={errorTexts}
              fallbackError={errorFallback}
              t={t}
            />
          </>
        ),
        messages: (o.negotiation ?? []).filter((e) => e.kind === "message")
          .length,
        history: (
          <RequestTimeline
            request={o}
            legacyAnswers={boardLegacy.get(o.id) ?? []}
            showPrice={seesPrice}
            t={t}
          />
        ),
        chatOpen: chatOpen === key,
      };
    });
    // Da cotação de compra: os outros convidados, só para comparar (a
    // cotação já foi decidida; a conversa com eles fica só para leitura).
    const store = getStore();
    const won = r.quoteResponseId
      ? await store
          .get("purchase_quote_responses", r.quoteResponseId)
          .catch(() => null)
      : null;
    if (won && r.productId) {
      const productId = r.productId;
      const responses = await store.list("purchase_quote_responses", {
        filter: { quoteId: won.quoteId },
      });
      const others = responses.filter((x) => x.id !== won.id);
      const parties = others.length
        ? await store.list("parties", {
            filter: { id: [...new Set(others.map((x) => x.supplierId))] },
          })
        : [];
      if (boardRows[0]) boardRows[0].winner = true;
      boardRows.push(
        ...others.map((x): BoardRow => {
          const messages = quoteProductMessages(x, productId);
          const state = x.status === "invited" ? "expired" : x.status;
          return {
            key: `response:${x.id}`,
            target: null,
            supplierName:
              parties.find((p) => p.id === x.supplierId)?.name ?? x.supplierId,
            state: (
              <Badge tone={state === "answered" ? "success" : "neutral"}>
                {t(`quote.response.${state}` as DictionaryKey)}
              </Badge>
            ),
            price: seesPrice
              ? (x.prices?.find((p) => p.productId === productId)?.unitPrice ??
                null)
              : null,
            currency: x.currency,
            incoterm: x.incoterm,
            moq: x.moq,
            leadTimeDays: x.leadTimeDays,
            conditions: [x.port, x.note].filter(Boolean).join(" · ") || null,
            chat: messages.length ? (
              <QuoteChat
                quoteId={won.quoteId}
                responseId={x.id}
                productId={productId}
                messages={messages}
                mySide="wellmix"
                names={{}}
                canPost={false}
                errors={errorTexts}
                fallbackError={errorFallback}
                t={t}
              />
            ) : null,
            messages: messages.length,
            history: (
              <QuoteHistoryList
                entries={quoteProductHistory(x, productId)}
                showPrice={seesPrice}
                t={t}
              />
            ),
          };
        }),
      );
    }
    const last = r.productId
      ? (await lastPurchases([r.productId]).catch(() => null))?.get(r.productId)
      : null;
    if (last)
      boardReference = {
        label: t("quote.lastPurchase"),
        price: last.unitPrice,
        currency: last.currency,
        incoterm: last.incoterm,
        moq: last.moq,
        leadTimeDays: last.leadTimeDays,
        note: last.supplierName,
      };
  }
  const counterTargets = boardRows
    .map((x) => x.target)
    .filter((x): x is string => !!x);

  const linkedCard = linked.length ? (
    <Card
      dense
      title={t("supplierRequests.detail.linked.title", {
        n: linked.length,
      })}
    >
      <p className="mb-2 text-xs text-zinc-500">
        {t("supplierRequests.detail.linked.hint")}
      </p>
      <ul className="divide-y divide-zinc-100 text-[13px]" data-linked>
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
                {t(`supplierRequests.status.${o.status}` as DictionaryKey)}
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
  ) : null;

  const bookCard =
    wellmix && (lot || selections.length || (seesPrice && chosen?.analysis)) ? (
      <Card title={t("supplierRequests.detail.booking")} dense>
        <div className="space-y-1 text-[13px]" data-negotiation-book>
          {lot ? (
            <Link href={`/app/booking/lots/${lot.id}`} className={linkClass}>
              {t("supplierRequests.detail.bookingOf", {
                n: lot.number,
                file: lot.fileName,
              })}
            </Link>
          ) : null}
          {selections.map((g) => (
            <Link
              key={g.id}
              href={selectionHref(g)}
              className={cx(linkClass, "block")}
              data-supplier-request-selection
            >
              {t("entityLinks.selection")}
            </Link>
          ))}
          {wellmix && seesPrice && chosen?.analysis ? (
            <div className="pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {t("bookingForecast.chosen")}
              </p>
              <span className="mt-1 flex flex-col gap-1">
                {bookingForecastOf(chosen.analysis)?.costBrl != null ? (
                  <span
                    className="text-sm font-semibold text-zinc-900"
                    data-supplier-request-chosen-cost
                  >
                    {t("supplierRequests.detail.chosenCost", {
                      price: formatMoney(chosen.analysis.costBrl!, "BRL", t),
                    })}
                  </span>
                ) : null}
                <BookingItemForecast analysis={chosen.analysis} t={t} />
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    ) : null;

  const samplingDays = await samplingSlaDays();
  const samplingCard = samplingFor(r) ? (
    <div className="mb-4">
      <SamplingCard
        request={r}
        wellmix={wellmix}
        canValidate={wellmix && can(user, "sampling.validate")}
        slaDays={samplingDays}
        t={t}
      />
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        t={t}
        title={pageTitle}
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
      {timelineCard}
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

      {/* Amostragem (fotos e vídeos da amostra): depois da aprovação, no
          alto, com o prazo; antes dela, o fornecedor já pode adiantar e o
          cartão fica abaixo da negociação (dono, 22/11/2026). */}
      {/* Só para o fornecedor: a Wellmix vê e valida a amostra no card
          Imagens, à direita (um lugar só). */}
      {!wellmix && r.status === "approved" ? samplingCard : null}

      {wellmix ? (
        /* Wellmix (dono, 22/11/2026; docs/QUOTATION.md): no centro, o
           produto da cotação e o quadro comparativo; à direita, fixos, o
           Book (quando a cotação veio de um), "Devolver com contraproposta"
           e o histórico desta cotação. */
        <div
          className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)] xl:items-start"
          data-negotiation-layout
          data-quotation-item
        >
          <div className="min-w-0 space-y-4" data-negotiation-center>
            <Card title={t("quotation.item.product")} dense>
              <div className="space-y-3" data-negotiation-main>
                {summarySection}
                <RequestVariant
                  request={r}
                  book={book}
                  showPrice={seesPrice}
                  t={t}
                />
                {sheetSection}
              </div>
            </Card>
            <QuotationBoard
              rows={boardRows}
              reference={boardReference}
              showPrice={seesPrice}
              units={packUnits}
              t={t}
            />
            <Card dense>
              <div className="space-y-3">
                {decisionSection}
                {alternativesSection}
              </div>
            </Card>
            <RequestAiReferences assets={r.aiAssets} t={t} />
            {linkedCard}
          </div>
          <aside
            className="grid min-w-0 gap-4 md:grid-cols-2 md:items-start xl:sticky xl:top-[calc(var(--wm-header)+1rem)] xl:max-h-[calc(100vh-var(--wm-header)-2rem)] xl:grid-cols-1 xl:overflow-y-auto xl:px-1 xl:pb-1"
            data-negotiation-aside
          >
            {/* "Necessita amostragem" da consulta (dono, 27/11/2026). */}
            <SamplingNeedForm
              need={samplingRequired(r)}
              canChange={
                can(user, "supplierRequest.decide") &&
                r.status !== "declined" &&
                r.status !== "cancelled" &&
                !r.orderId
              }
              action={setSupplierRequestSamplingAction}
              fields={<input type="hidden" name="id" value={r.id} />}
              t={t}
            />
            {/* Imagens sempre à vista enquanto se negocia: a referência da
                Wellmix e a amostra de cada fornecedor (dono, 22/11/2026). */}
            <ItemImagesCard
              reference={[
                it.photoDocumentId,
                // A arte da variação × embalagem, ao lado da foto do Book.
                r.variant?.artDocumentId,
              ].filter((d): d is string => !!d)}
              referenceFrom={r.bookingLotId ? "book" : "product"}
              samples={[
                { request: r, supplier },
                ...linked.map((l) => ({
                  request: l.request,
                  supplier: l.supplier,
                })),
              ].map(({ request: o, supplier: s }) => ({
                key: `request:${o.id}`,
                supplierName:
                  s?.name ?? t("supplierRequests.negotiation.side.supplier"),
                sampling: samplingFor(o),
                skipped: !!o.sampling?.skipped,
                // O prazo conta depois da aprovação da solicitação.
                slaDays: o.status === "approved" ? samplingDays : null,
                anchor: o.id === r.id ? "amostragem" : undefined,
                review: can(user, "sampling.validate")
                  ? {
                      action: reviewSamplingAction,
                      fields: (
                        <>
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="board" value={r.id} />
                        </>
                      ),
                    }
                  : null,
              }))}
              t={t}
            />
            {bookCard}
            <div id="conversa" className="min-w-0 scroll-mt-20">
              <BoardCounterForm
                kind="request"
                boardId={r.id}
                units={packUnits}
                targets={counterTargets}
                values={{
                  price: r.supplierPrice,
                  currency: r.supplierCurrency ?? r.item.currency ?? "USD",
                  moq: r.supplierMoq,
                  leadTimeDays: r.supplierLeadTimeDays,
                  incoterm: r.supplierIncoterm ?? r.item.incoterm ?? "FOB",
                }}
                simulation={simulation}
                showPrice={seesPrice}
                errors={errorTexts}
                fallbackError={errorFallback}
                formKey={`counter-${boardRows
                  .map((x) => (x.pending ? "1" : "0"))
                  .join("")}-${(r.negotiation ?? []).length}`}
                t={t}
              />
            </div>
            <div id="historico" className="min-w-0 scroll-mt-20">
              <RequestTimeline
                request={r}
                legacyAnswers={timelineLegacy.get(r.id) ?? []}
                showPrice={seesPrice}
                t={t}
              />
            </div>
            {chatBlock}
          </aside>
        </div>
      ) : (
        /* Fornecedor (dono, 27/11/2026): no centro, 1. resumo (com a foto
           e a arte), 2. ficha e 3. programação, sem o quadro "Variação e
           embalagem" (informação repetida); à direita, fixos, o Histórico
           (o ícone de cada resposta abre a resposta detalhada), o quadro
           para responder e a Conversa. */
        <div
          className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)] xl:items-start"
          data-negotiation-layout
        >
          <div className="min-w-0 space-y-4" data-negotiation-center>
            <Card title={t("supplierRequests.detail.request")} dense>
              <div className="space-y-3" data-negotiation-main>
                {summarySection}
                {sheetSection}
                {scheduleSection}
              </div>
            </Card>
            <RequestAiReferences assets={r.aiAssets} t={t} />
          </div>
          <aside
            className="grid min-w-0 gap-4 xl:sticky xl:top-[calc(var(--wm-header)+1rem)] xl:max-h-[calc(100vh-var(--wm-header)-2rem)] xl:overflow-y-auto xl:px-1 xl:pb-1"
            data-negotiation-aside
          >
            <div
              id="historico"
              className="min-w-0 scroll-mt-20 xl:max-h-[40vh] xl:overflow-y-auto"
            >
              <RequestTimeline
                request={{
                  ...r,
                  // "Continuar negociando" é decisão interna da Wellmix.
                  negotiation: (r.negotiation ?? []).filter(
                    (e) => e.kind !== "keep",
                  ),
                }}
                legacyAnswers={timelineLegacy.get(r.id) ?? []}
                showPrice={seesPrice}
                answerDetail={answerDetail}
                t={t}
              />
            </div>
            <div id="conversa" className="min-w-0 scroll-mt-20">
              {respondCard}
            </div>
            {chatBlock}
          </aside>
        </div>
      )}
      {!wellmix && r.status !== "approved" && samplingCard ? (
        <div className="mt-4" data-sampling-early>
          {samplingCard}
        </div>
      ) : null}
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
              href={`/app/supplier-requests?tab=closed&pick=${r.id}#pedido-de-compra`}
              className={linkClass}
            >
              {t("purchaseOrder.detail.generate")}
            </Link>
          </Alert>
        </div>
      ) : null}
      {productWaitsSample ? (
        <div className="mt-4" data-request-product-waits-sample>
          <Alert tone="info">{t("sampling.productBlocked")}</Alert>
        </div>
      ) : null}
      {registrationCard ? (
        <div className="mt-4" data-request-product>
          {registrationCard}
        </div>
      ) : null}
    </>
  );
}
