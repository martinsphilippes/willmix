import { notFound, redirect } from "next/navigation";
import { isStockCustomer } from "@/lib/services/stock-party";
import { ActionError } from "@/components/action-error";
import {
  RequestInfoTable,
  specificationColumns,
  type InfoColumn,
} from "@/components/request-info-table";
import { fallbackError } from "@/i18n/error-text";
import {
  hasNcmBroker,
  requestNcm,
  scheduleNcmSuggestion,
  suggestionsView,
} from "@/lib/services/request-ncm";
import { hasFiscalTable } from "@/lib/services/fiscal";
import { RequestNcmCard } from "@/components/request-ncm-card";
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
import { variantSnapshotSummary } from "@/lib/services/variant-sales";
import {
  requestDisplayStatus,
  requestStatusTone,
} from "@/lib/services/order-status";
import { getT } from "@/i18n/server";
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
  // Valores da variação pedida (cópia feita na solicitação), só para a Wellmix.
  const variantSummary =
    wellmix && request.variant
      ? variantSnapshotSummary(
          request.variant,
          {
            price: t("productVariants.col.price"),
            moq: t("productVariants.col.moq"),
            box: t("productVariants.col.box"),
            cbm: t("productVariants.col.cbm"),
          },
          t.intl,
        )
      : null;
  const [customer, documents, customerLogins] =
    await Promise.all([
      store.get("parties", request.customerId),
      store.list("documents", { filter: { requestId: request.id } }),
      // Logins deste cliente, para a Wellmix indicar o solicitante.
      wellmix
        ? store.list("users", {
            filter: { role: "customer", partyId: request.customerId },
            orderBy: "name",
          })
        : Promise.resolve([]),
    ]);
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
  /* Cartões de ação da Wellmix (NCM): lado a lado em telas grandes. */
  const actionCards = [!!ncmInfo].filter(Boolean).length;
  return (
    <>
      {fromCart === "1" ? (
        // Veio do carrinho da vitrine: confirma o envio do pedido de orçamento.
        <div className="mb-3" role="status" data-cart-sent>
          <Alert tone="success">{t("explore.sent")}</Alert>
        </div>
      ) : null}
      <PageHeader
        help={{ body: "help.request.body", steps: "help.request.steps" }}
        t={t}
        title={request.productName}
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
            <Badge tone={requestStatusTone(displayStatus)}>
              {t(`reqStatusLabel.${displayStatus}`)}
            </Badge>
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
            {/* Mensagens: assunto desta solicitação na conversa da empresa. */}
            <ChatButtons
              back={`/app/requests/${request.id}`}
              requestId={request.id}
              targets={[
                wellmix
                  ? {
                      partyId: request.customerId,
                      label: t("messages.chatCompany"),
                      title: customer?.name,
                    }
                  : { label: t("messages.chatWellmix") },
              ]}
            />
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
            {request.orderId ? (
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
                  {s.productName}
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

      {/* Dados da solicitação em linha (cada coluna uma informação, como nas
          outras telas), na largura toda; depois os cartões de ação da Wellmix
          lado a lado; cotações e proposta na largura toda. A linha do tempo
          resumida saiu para todos (decisão do dono): a situação fica no
          selo do alto e a Wellmix acompanha pelas Etapas da solicitação. */}
      <div className="mt-4 flex flex-col gap-4">
        <div className="contents">
          <Card title={t("requests.title")}>
            <RequestInfoTable
              rowKey={request.id}
              columns={[
                // Variação pedida: o nome para todos; os valores da cópia
                // (preço, MOQ, caixa, CBM) só para a Wellmix.
                ...(request.variant
                  ? [
                      [
                        t("productVariants.label"),
                        <span key="variant" data-request-variant>
                          {request.variant.name}
                          {wellmix && variantSummary ? (
                            <span className="block text-xs text-zinc-500">
                              {variantSummary}
                            </span>
                          ) : null}
                        </span>,
                      ] as InfoColumn,
                    ]
                  : []),
                [t("common.quantity"), `${request.quantity} ${request.unit}`],
                [t("requests.deadline"), formatDate(request.deadline, t)],
                [t("requests.description"), request.description],
                // Cada item da especificação na sua coluna.
                ...specificationColumns(
                  request.specification,
                  t("requests.specification"),
                ),
                [t("common.note"), request.notes],
              ]}
            />
            <RequestScheduleTable
              schedule={request.schedule}
              unit={request.unit}
              t={t}
            />
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
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2.5"
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

        {actionCards > 0 ? (
          <div
            className={cx(
              "contents md:grid md:grid-cols-2 md:items-start md:gap-4",
            )}
          >
            {/* Classificação fiscal: NCM → II (TEC) e IPI (TIPI) no valor ao cliente.
                Em 2 colunas (md) ocupa duas linhas: RFQ e solicitante ficam
                um abaixo do outro, sem buraco. */}
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
          </div>
        ) : null}

      </div>
    </>
  );
}
