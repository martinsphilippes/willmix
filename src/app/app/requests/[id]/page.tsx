import { notFound, redirect } from "next/navigation";
import { isStockCustomer } from "@/lib/services/stock-party";
import { ActionError } from "@/components/action-error";
import { RequestProductSheet } from "@/components/request-product-sheet";
import { requestChatPreview } from "@/lib/services/request-chat-preview";
import { loadRequestSheet } from "@/lib/services/request-sheet";
import { fallbackError } from "@/i18n/error-text";
import {
  hasNcmBroker,
  requestNcm,
  scheduleNcmSuggestion,
  suggestionsView,
} from "@/lib/services/request-ncm";
import { hasFiscalTable } from "@/lib/services/fiscal";
import { RequestNcmCard } from "@/components/request-ncm-card";
import { RequestOrderTermsView } from "@/components/request-order-terms-view";
import { CustomerOrderConfirm } from "@/components/customer-order-confirm";
import { requestStepFor } from "@/lib/services/request-turns";
import { nextStepText } from "@/lib/services/request-list";
import { turnTone, turnWaitingKey } from "@/lib/turn";
import { customerConfirmLabels } from "@/components/order-terms-labels";
import { canConfirm } from "@/lib/services/customer-confirmation";
import { confirmCustomerOrderAction } from "../../actions/customer-confirmation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import {
  batchSiblings,
  getRequestForUser,
  canAddProducts,
} from "@/lib/services/requests";
import {
  requestDisplayStatus,
  requestStatusTone,
} from "@/lib/services/order-status";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  LinkButton,
  PageHeader,
  Select,
  TextLink,
  cx,
  formatDate,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { setRequesterAction } from "../../actions";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { RequestScheduleTable } from "@/components/request-schedule-table";
import { RequestCompanyAllocations } from "@/components/request-company-allocations";
import { getSettings } from "@/lib/settings";
import {
  loadRequestPacking,
  roundPackingOf,
} from "@/lib/services/request-packing";
import { ChatButtons } from "@/components/chat-buttons";

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "requests");
  const { id } = await params;
  const {
    error,
    saved,
    fields: invalidFields,
    at: errorToken,
    fromCart,
    sale,
    confirmed,
  } = await searchParams;
  const request = await getRequestForUser(user, id);
  if (!request) notFound();
  const t = await getT();
  const store = getStore();
  // Lote: outras solicitações criadas junto com esta (só as que este usuário vê).
  const siblings = (await batchSiblings(request)).filter((r) =>
    canViewRequest(user, r),
  );
  const wellmix = isWellmix(user);
  const [customer, documents, customerLogins, sheet, chat] = await Promise.all([
    store.get("parties", request.customerId),
    store.list("documents", { filter: { requestId: request.id } }),
    // Logins deste cliente, para a Wellmix indicar o solicitante.
    wellmix
      ? store.list("users", {
          filter: { role: "customer", partyId: request.customerId },
          orderBy: "name",
        })
      : Promise.resolve([]),
    /* Só este produto (dono, 23/11/2026): a tela é o detalhamento dele no
       pedido; os outros produtos ficam na página do pedido. A origem de cada
       dado e as permissões são as da ficha (docs/REQUEST_SHEET.md). */
    loadRequestSheet(user, request, [], t),
    // A conversa à vista: as últimas mensagens que o login pode abrir.
    requestChatPreview(user, request.id).catch(() => null),
  ]);
  /* Caixas master, cubagem e containers de cada programação na tabela das
     empresas do grupo econômico e na Programação de compra (dono,
     22/11/2026; docs/ECONOMIC_GROUPS.md): a mesma embalagem da ficha e o
     mesmo container de referência (o maior das Configurações) da página do
     lote. O cliente também vê (decisão do dono). Só quando há uma das duas. */
  const roundsPacking =
    request.companyAllocations?.length || request.schedule?.items.length
      ? await Promise.all([loadRequestPacking([request]), getSettings()]).then(
          ([packing, settings]) => {
            const reference =
              [...settings.containerTypes].sort(
                (a, b) => b.capacityCbm - a.capacityCbm,
              )[0] ?? null;
            return {
              rounds: roundPackingOf(
                request,
                packing.get(request.id),
                reference?.capacityCbm ?? null,
              ),
              container: reference?.code ?? null,
            };
          },
        )
      : null;
  /* Pedido cancelado: a solicitação segue ORDERED (histórico), mas o selo, a
     linha do tempo e o aviso mostram o cancelamento. */
  const order = request.orderId
    ? await store.get("orders", request.orderId)
    : null;
  const orderCancelled = order?.status === "CANCELLED";
  const displayStatus = requestDisplayStatus(
    request,
    new Set(order && orderCancelled ? [order.id] : []),
  );
  // De quem é a vez e o Próximo passo (dono, 18/11/2026; docs/TURNS.md): a
  // mesma regra da lista de Encomendas.
  const step = await requestStepFor(user, request, order);
  /* Segunda Onda: origem (recompra, nova proposta, sourcing sob demanda) e link ao
     pedido de origem só para quem pode abri-lo (mesmo isolamento por papel). */
  const origin =
    request.origin && request.origin !== "manual" ? request.origin : null;
  const sourceOrder = request.sourceOrderId
    ? await store.get("orders", request.sourceOrderId)
    : null;
  const sourceOrderLink =
    sourceOrder && canViewOrder(user, sourceOrder)
      ? `/app/orders/${sourceOrder.id}`
      : null;
  const { ncmConfirmed, ncmSuggested, ncmAi } = await searchParams;
  /* NCM da solicitação (Wellmix): cadastro ou confirmado; sem ele, sugestões. */
  const ncmInfo =
    wellmix && request.status !== "CANCELLED"
      ? await requestNcm(request)
      : null;
  const ncmSuggestionList =
    ncmInfo?.status === "none" ? await suggestionsView(request) : [];
  const ncmPendingAuto =
    ncmInfo?.status === "none" && request.ncmSuggestions == null;
  if (ncmPendingAuto) scheduleNcmSuggestion(request.id);
  const fiscalLoaded = ncmInfo ? await hasFiscalTable() : false;
  /* Quem classifica é o despachante: a Wellmix vê se está na fila dele e quem confirmou. */
  const ncmQueue =
    ncmInfo?.status === "none" && !request.orderId
      ? (await hasNcmBroker())
        ? ("broker" as const)
        : ("none" as const)
      : null;
  const ncmConfirmer =
    ncmInfo?.status === "confirmed" && request.ncmConfirmedByUserId
      ? await store.get("users", request.ncmConfirmedByUserId)
      : null;
  const ncmAiCode =
    typeof ncmAi === "string" ? ncmAi.replace(/^ai_/, "") : null;
  const ncmAiReason = ncmAiCode
    ? ncmAiCode === "not_configured"
      ? t("ncm.ai.not_configured")
      : t(`ai.error.${ncmAiCode}` as DictionaryKey) !== `ai.error.${ncmAiCode}`
        ? t(`ai.error.${ncmAiCode}` as DictionaryKey)
        : ncmAiCode
    : null;
  // Anexos da solicitação.
  const attachments = documents;
  /* Solicitante do cliente: também saiu como cartão. Compra para o estoque
     não tem login de cliente; nas outras, é uma linha do cartão da
     solicitação (o isolamento entre logins do cliente continua valendo). */
  const showRequester =
    wellmix &&
    !isStockCustomer(request.customerId) &&
    (customerLogins.length > 0 || !!request.requestedForUserId);
  return (
    <>
      {fromCart === "1" ? (
        // Veio do carrinho da vitrine: confirma o envio do pedido de orçamento.
        <div className="mb-3" role="status" data-cart-sent>
          <Alert tone="success">
            {t("explore.sent")}
            {typeof sale === "string" && /^\d{1,9}$/.test(sale)
              ? ` ${t("demand.cart.saleSent", { n: sale })}`
              : ""}
          </Alert>
        </div>
      ) : null}
      <PageHeader
        help={{ body: "help.request.body", steps: "help.request.steps" }}
        t={t}
        title={productNameText(t, request.productName)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {request.number ? (
              <span
                className="font-medium tabular-nums text-zinc-700"
                data-request-number
              >
                {t("requests.numbered", { n: request.number })}
              </span>
            ) : null}
            {step.who ? (
              <span
                className="inline-flex flex-wrap items-center gap-2"
                data-request-turn={step.who}
              >
                <span title={t(`reqStatusLabel.${displayStatus}`)}>
                  <Badge tone={turnTone(step.who)}>
                    {user.role === "customer" && step.who === "customer"
                      ? t("turn.waiting.you")
                      : t(turnWaitingKey(step.who))}
                  </Badge>
                </span>
                {step.key !== "none" ? (
                  <span
                    className="text-sm text-zinc-700"
                    data-request-next={step.key}
                  >
                    {t("reqList.col.next")}:{" "}
                    <span className="font-medium text-zinc-900">
                      {nextStepText(t, step)}
                    </span>
                  </span>
                ) : null}
              </span>
            ) : (
              <Badge tone={requestStatusTone(displayStatus)}>
                {t(`reqStatusLabel.${displayStatus}`)}
              </Badge>
            )}
            {wellmix ? (
              <span className="font-medium text-zinc-700">
                {customer?.name}
              </span>
            ) : null}
            {wellmix && isStockCustomer(request.customerId) ? (
              <span data-stock-request>
                <Badge tone="brand">{t("purchaseFlow.stock.badge")}</Badge>
              </span>
            ) : null}
            {origin ? (
              <Badge tone="brand">{t(`orders.origin.${origin}`)}</Badge>
            ) : null}
            {sourceOrderLink ? (
              <TextLink href={sourceOrderLink} className="text-xs">
                {t("orders.origin.sourceOrder")}
                {sourceOrder ? ` #${sourceOrder.number}` : ""} →
              </TextLink>
            ) : null}
          </span>
        }
        actions={
          <>
            {/* O pedido inteiro (dono, 18/11/2026): esta tela é o produto
                neste pedido; a página do pedido lista todos os produtos. */}
            <TextLink
              href={`/app/requests/batch/${encodeURIComponent(request.groupId ?? request.id)}`}
              data-back-to-order
            >
              {t("reqBatch.backToOrder")}
            </TextLink>
            {/* Wellmix: mais produtos nesta solicitação antes do pedido
                (entram no mesmo lote, com o mesmo número). */}
            {canAddProducts(user, request) ? (
              <LinkButton
                href={`/app/requests/new?addTo=${request.id}`}
                variant="secondary"
                data-add-product
              >
                {t("reqAdd.button")}
              </LinkButton>
            ) : null}
            {/* Encomenda comprada pela Wellmix (docs/PURCHASE_DEMAND.md): o
                pedido de compra é da Wellmix; o cliente não o abre. */}
            {request.orderId && order && canViewOrder(user, order) ? (
              <LinkButton
                href={`/app/orders/${request.orderId}`}
                variant="primary"
              >
                {t("requests.viewOrder")}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {order && orderCancelled && canViewOrder(user, order) ? (
        <div className="mb-4" data-order-cancelled>
          <Alert tone="danger">
            {t("reqCancelled.banner", { n: order.number })}{" "}
            <TextLink href={`/app/orders/${order.id}`}>
              {t("reqCancelled.open")}
            </TextLink>
          </Alert>
        </div>
      ) : null}
      {siblings.length > 0 ? (
        <div className="mb-4" data-batch-siblings>
          <Alert tone="info">
            {t("reqBatch.siblings", { n: siblings.length + 1 })}{" "}
            {siblings.map((s, i) => (
              <span key={s.id}>
                {i > 0 ? ", " : null}
                <TextLink href={`/app/requests/${s.id}`}>
                  {productNameText(t, s.productName)}
                </TextLink>
              </span>
            ))}
            {request.groupId ? (
              <>
                {" · "}
                <TextLink
                  href={`/app/requests/batch/${encodeURIComponent(request.groupId)}`}
                  data-batch-link
                >
                  {t("reqBatch.viewBatch")}
                </TextLink>
              </>
            ) : null}
          </Alert>
        </div>
      ) : null}
      <ActionError
        t={t}
        code={error}
        fields={invalidFields}
        token={errorToken}
        text={
          !error
            ? null
            : typeof error === "string" &&
                t(`pricing.error.${error}` as DictionaryKey) !==
                  `pricing.error.${error}`
              ? t(`pricing.error.${error}` as DictionaryKey)
              : typeof error === "string" &&
                  t(`payments.error.${error}` as DictionaryKey) !==
                    `payments.error.${error}`
                ? t(`payments.error.${error}` as DictionaryKey)
                : typeof error === "string" &&
                    t(`access.error.${error}` as DictionaryKey) !==
                      `access.error.${error}`
                  ? t(`access.error.${error}` as DictionaryKey)
                  : typeof error === "string" &&
                      t(`reqBatch.error.${error}` as DictionaryKey) !==
                        `reqBatch.error.${error}`
                    ? t(`reqBatch.error.${error}` as DictionaryKey)
                    : typeof error === "string" &&
                        t(`packBrief.error.${error}` as DictionaryKey) !==
                          `packBrief.error.${error}`
                      ? t(`packBrief.error.${error}` as DictionaryKey)
                      : typeof error === "string" &&
                          t(`approvals.error.${error}` as DictionaryKey) !==
                            `approvals.error.${error}`
                        ? t(`approvals.error.${error}` as DictionaryKey)
                        : typeof error === "string" &&
                            t(
                              `purchaseFlow.error.${error}` as DictionaryKey,
                            ) !== `purchaseFlow.error.${error}`
                          ? t(`purchaseFlow.error.${error}` as DictionaryKey)
                          : fallbackError(t, String(error))
        }
      />
      {saved === "requester" ? (
        <Alert tone="success">{t("access.requesterSaved")}</Alert>
      ) : null}
      {/* Confirmação do pedido pelo cliente (dono, 15/11/2026;
          docs/ORDER_TERMS.md seção 4). */}
      {confirmed === "1" ? (
        <Alert tone="success">{t("customerConfirm.done")}</Alert>
      ) : null}
      {canConfirm(user, request) ? (
        <div className="mt-4">
          <CustomerOrderConfirm
            requestId={request.id}
            // Quem chama o transportador (16/11/2026): o cliente informa a
            // do pedido e, com re-despacho, a segunda; a Wellmix já as
            // escolheu. Nas antigas, só a do re-despacho.
            carrierRequired={request.orderTerms?.carrierCaller === "customer"}
            redispatchRequired={
              !!request.orderTerms?.redispatchRequired &&
              request.orderTerms?.carrierCaller !== "wellmix"
            }
            action={confirmCustomerOrderAction}
            labels={customerConfirmLabels(t)}
          />
        </div>
      ) : request.status === "AWAITING_CUSTOMER" && wellmix ? (
        <div className="mt-4" data-request-awaiting-customer>
          <Alert tone="warning">
            {t("customerConfirm.awaitingWellmix")}
            {/* Lembretes da confirmação (dono, 22/11/2026). */}
            {request.orderTerms?.confirmReminders?.count ? (
              <span
                className="mt-1 block text-xs"
                data-request-confirm-reminders={
                  request.orderTerms.confirmReminders.count
                }
              >
                {t("confirmReminder.status", {
                  count: request.orderTerms.confirmReminders.count,
                  date: formatDate(
                    request.orderTerms.confirmReminders.lastAt,
                    t,
                  ),
                })}
              </span>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {/* O produto neste pedido (dono, 23/11/2026): à esquerda, o produto em
          quadros (sem a tabela da ficha completa) e, embaixo, a programação,
          as condições e os anexos; à direita, sempre à vista, a conversa e a
          classificação fiscal. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <div id="solicitacoes" className="scroll-mt-24" />
          <RequestProductSheet view={sheet} t={t} />
          <Card title={t("requestProduct.details")}>
            {/* Pedido para um grupo econômico (docs/ECONOMIC_GROUPS.md): logo
                abaixo da linha do produto, com as caixas master, a cubagem e
                os containers de cada programação (dono, 22/11/2026). */}
            <RequestCompanyAllocations
              request={request}
              t={t}
              packing={roundsPacking}
            />
            <RequestScheduleTable
              schedule={request.schedule}
              unit={request.unit}
              t={t}
              packing={roundsPacking}
            />
            {/* Condições do pedido (docs/ORDER_TERMS.md): só a Wellmix vê. */}
            {wellmix ? (
              <RequestOrderTermsView terms={request.orderTerms} t={t} />
            ) : null}
            {attachments.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-2.5 text-sm">
                {attachments.map((d) => (
                  <li key={d.id}>
                    <TextLink href={`/api/files/${d.id}`} target="_blank">
                      {d.name}
                    </TextLink>
                  </li>
                ))}
              </ul>
            ) : null}
            {showRequester ? (
              <form
                action={setRequesterAction}
                // Destino do "Escolher o login na encomenda" do balão "Quem
                // pode agir" (docs/ORDER_LEVEL_LISTS.md, seção 10).
                id="requester"
                className="mt-3 flex scroll-mt-24 flex-wrap items-center gap-2 border-t border-zinc-100 pt-2.5"
                data-request-requester
              >
                <input type="hidden" name="requestId" value={request.id} />
                <label
                  htmlFor="requestedForUserId"
                  className="text-sm text-zinc-600"
                  title={t("access.requesterHint")}
                >
                  {t("access.requesterTitle")}
                </label>
                <Select
                  dense
                  id="requestedForUserId"
                  name="requestedForUserId"
                  defaultValue={request.requestedForUserId ?? ""}
                  className="w-auto max-w-64"
                >
                  <option value="">{t("access.requesterNone")}</option>
                  {customerLogins.map((u) => (
                    <option key={u.id} value={u.id} disabled={!u.active}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
                <SubmitButton variant="secondary">
                  {t("common.save")}
                </SubmitButton>
              </form>
            ) : null}
          </Card>
        </div>

        <aside
          className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20"
          data-request-side
        >
          <Card title={t("requestProduct.chat.title")}>
            <div data-request-chat={chat?.total ?? 0}>
              {chat?.messages.length ? (
                <ul className="flex flex-col gap-2">
                  {chat.messages.map((m) => (
                    <li
                      key={m.id}
                      className={cx(
                        "rounded-lg px-3 py-2 text-sm",
                        m.mine
                          ? "ml-6 bg-brand-50 text-zinc-900"
                          : "mr-6 bg-zinc-100 text-zinc-900",
                      )}
                      data-request-chat-message
                    >
                      <span className="block text-[11px] text-zinc-500">
                        {m.mine ? t("requestProduct.chat.you") : m.author}
                        {" · "}
                        {formatDate(m.at, t)}
                      </span>
                      <span className="whitespace-pre-line break-words">
                        {m.body}
                      </span>
                      {m.attachment ? (
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          📎 {t("requestProduct.chat.attachment")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  {t("requestProduct.chat.empty")}
                </p>
              )}
              {chat && chat.total > chat.messages.length ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {t("requestProduct.chat.count", { n: chat.total })}
                </p>
              ) : null}
              <div className="mt-3">
                <ChatButtons
                  back={`/app/requests/${request.id}`}
                  requestId={request.id}
                  targets={[
                    wellmix
                      ? {
                          partyId: request.customerId,
                          label: t("messages.chatCompany"),
                          title: customer?.name,
                          floating: true,
                        }
                      : { label: t("messages.chatWellmix"), floating: true },
                  ]}
                />
              </div>
            </div>
          </Card>
          {ncmInfo ? (
            <div className="min-w-0 md:row-span-2 lg:row-span-1">
              <RequestNcmCard
                t={t}
                requestId={request.id}
                ncm={ncmInfo}
                suggestions={ncmSuggestionList}
                suggestionsPending={ncmPendingAuto}
                hasTable={fiscalLoaded}
                editable={!request.orderId}
                queue={ncmQueue}
                confirmedBy={
                  ncmConfirmer
                    ? `${ncmConfirmer.name} (${t(`role.${ncmConfirmer.role}` as DictionaryKey)})`
                    : null
                }
                notice={
                  ncmConfirmed
                    ? t("ncm.confirmedOk")
                    : typeof ncmSuggested === "string"
                      ? t("ncm.suggestedOk", { count: ncmSuggested })
                      : null
                }
                aiNotice={
                  ncmAiReason
                    ? t("ncm.aiUnavailable", { reason: ncmAiReason })
                    : null
                }
              />
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
