import { ArtworkCard } from "@/components/artwork-card";
import { ReceivingCard } from "@/components/receiving-card";
import { ImportFlowCard } from "@/components/import-flow-card";
import { ProductionCard } from "@/components/production-card";
import {
  sheetProgress,
  syncPreparationFromSheet,
} from "@/lib/services/purchase-sheet";
import { ActionError } from "@/components/action-error";
import { Fragment, type ReactNode } from "react";
import { fallbackError } from "@/i18n/error-text";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import {
  canSeeInternalCosts,
  canSeeSellPrice,
  canSeeSupplier,
  canViewOrder,
  canViewRequest,
  isPartner,
  isWellmix,
} from "@/lib/auth/permissions";
import { partRowFor, stageRowFor, stageVisibleTo } from "@/lib/order-view";
import {
  ORDER_PART_PARALLEL,
  documentPart,
  orderPartsByStage,
  plainPart,
  sheetPart,
  stepsPart,
} from "@/lib/order-parts";
import { ChatButtons } from "@/components/chat-buttons";
import { ChatOpenButton } from "@/components/chat-open-button";
import { stageChat } from "@/lib/stage-chat";
import { SupplierDielineCard } from "@/components/supplier-dieline-card";
import type { PartyType } from "@/lib/db/schema";
import { cargoViewForOrder } from "@/lib/services/order-cargo";
import { CargoCard } from "@/components/cargo-card";
import {
  getStore,
  type AfterSales,
  type Document,
  type Order,
  type OrderItem,
  type PurchaseSnapshot,
  type Request as RequestRow,
  type Requirement,
  type User,
} from "@/lib/db";
import {
  canSubmitRequirement,
  dateBoundsFor,
  datePrerequisite,
  loadOrderProgress,
  type DateBounds,
} from "@/lib/workflow/engine";
import { formatMoneyValue, isMoneyRequirement } from "@/lib/workflow/money";
import {
  canCompleteLater,
  isOffFlowStage,
  isOrderSignatureKey,
} from "@/lib/workflow/stages";
import { releaseOffFlowStages } from "@/lib/services/supplier-terms";
import { normalizePackaging } from "@/lib/services/packaging";
import { normalizeShipping } from "@/lib/services/shipping-stage";
import { SupplierPaymentCard } from "@/components/supplier-payment-card";
import { loadOrderFinance } from "@/lib/services/finance";
import {
  approx,
  costEstimateNote,
  fxEffectText,
  fxRateLines,
  fxReferenceText,
  missingFxText,
} from "@/components/finance-fx-text";
import {
  ackedByUser,
  ackTrails,
  recordAck,
  type AckSummary,
} from "@/lib/services/acknowledgements";
import { containersForOrder } from "@/lib/services/containers";
import { isInspectionMeasureKey } from "@/lib/services/inspection";
import {
  inspectionReport,
  type InspectionReport,
} from "@/lib/services/inspection-report";
import { getSnapshotForOrder } from "@/lib/services/snapshots";
import { variantSnapshotSummary } from "@/lib/services/variant-sales";
import { getSettings } from "@/lib/settings";
import { quoteSlaDeadline } from "@/lib/sla";
import { getAfterSales } from "@/lib/services/after-sales";
import { getT } from "@/i18n/server";
import { requirementLabel, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Progress,
  Select,
  StepDot,
  Table,
  Td,
  Textarea,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  isOverdue,
  linkClass,
  rowClass,
  stageTone,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { RequirementForm } from "@/components/requirement-form";
import { PackagingBriefFiles } from "@/components/packaging-brief-files";
import { sheetAccess } from "@/lib/services/purchase-sheet";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  AdminCancelCard,
  CancelRequestAlert,
  CancelledBanner,
  CustomerCancelCard,
} from "@/components/order-cancel";
import { customerCanRequestCancel } from "@/lib/services/order-cancel";
import {
  cancelledOrderIds,
  requestDisplayStatus,
  requestStatusTone,
} from "@/lib/services/order-status";
import {
  assignPartnerAction,
  clearRequirementDocumentAction,
  createPenaltyAction,
  registerCustomerPaymentAction,
  unblockStageAction,
} from "../../actions";
import {
  acknowledgeDocumentAction,
  acknowledgePaymentAction,
  ensureSnapshotAction,
  remeasureAction,
} from "../../actions/orders-extra";
import { setSupplierPaymentFxAction } from "../../actions/supplier-terms";
import {
  answerAfterSalesAction,
  closeAfterSalesAction,
  createFollowUpRequestAction,
  openAfterSalesAction,
} from "../../actions/after-sales";
import { MoneyInput } from "@/components/money-input";
import { ColorCards, type ColorCard } from "@/components/color-cards";
import { PairsTable } from "@/components/pairs-table";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import { productPhotoList } from "@/lib/services/product-list";
import { showcaseOf } from "@/lib/services/documents";
import {
  FreightTariffBox,
  FreightTariffUploadBox,
} from "@/components/freight-tariff-box";
import { myTariffStatus, orderTariffView } from "@/lib/services/freight-tariff";

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id } = await params;
  const {
    error,
    remeasure,
    paid,
    fx: fxSaved,
    cancelled,
    cancelRequested,
    cancelRejected,
    settlementSaved,
    terms: termsNotice,
    fields: invalidFields,
    at: errorToken,
    tariffOrigin,
    production: productionNotice,
    importStep: importNotice,
    certStep: certNotice,
    stepCard,
    receiving: receivingNotice,
    artwork: artworkNotice,
    stage: stageQuery,
    dieline: dielineNotice,
  } = await searchParams;
  // Etapa aberta na tabela de etapas (?stage=CHAVE ou ?stage=all).
  const stageParam = typeof stageQuery === "string" ? stageQuery : null;
  // Pedido de antes da inversão da arte: arte da agência, aprovação do fornecedor.
  await normalizePackaging(id);
  await normalizeShipping(id);
  let progress = await loadOrderProgress(id);
  if (!progress || !canViewOrder(user, progress.order)) notFound();
  /* Pedido parado na etapa de pagamento ao fornecedor (de antes de ela sair do
     fluxo): segue para a próxima etapa agora. */
  if (isOffFlowStage(progress.order.status)) {
    await releaseOffFlowStages(progress.order.id);
    progress = (await loadOrderProgress(id)) ?? progress;
  }
  const t = await getT();
  const store = getStore();
  const wellmix = isWellmix(user);
  /* Certificadora (OCP) do pedido: precisa do pedido completo para gerar o
     selo (decisão do dono): foto e código nos itens, a ficha de compra para
     ler (sem preço), as certificações já registradas e os arquivos. Preço,
     pagamentos e o cliente continuam fora. */
  const certifier = user.role === "ocp";
  // Financeiro é só do administrador: pagamentos, valores e margem do pedido.
  const financeAccess = canOpen(user, "finance");
  /* Nova medição (inspeção bloqueada): só com ?remeasure=1; sem o parâmetro a tela é a de sempre. */
  const remeasureMode = remeasure === "1";
  /* Ficha de compra (Preparação): quem vê ganha o atalho no item do checklist. */
  const sheet = sheetAccess(user, progress.order);
  const sheetHref = sheet.view
    ? `/app/orders/${progress.order.id}/purchase-sheet`
    : null;
  /* O que falta na ficha (o item do checklist diz o quê, em vez de só "Preencher"). */
  let sheetState = sheet.view ? await sheetProgress(progress.order) : null;
  /* Ficha completa com a Preparação ainda parada (ex.: a regra das fotos mudou
     depois de a ficha ser salva): conclui os requisitos agora, como ao salvar a
     ficha, quando quem abre o pedido pode preenchê-los. */
  const stuckSheetReq =
    sheetState &&
    !sheetState.missing.length &&
    progress.order.status === "PREPARATION"
      ? progress.requirements.find(
          (r) => r.key === "purchase_sheet" && r.status === "pending",
        )
      : null;
  if (
    stuckSheetReq &&
    canSubmitRequirement(user, progress.order, stuckSheetReq)
  ) {
    await syncPreparationFromSheet(user, progress.order.id);
    progress = (await loadOrderProgress(id)) ?? progress;
    sheetState = await sheetProgress(progress.order);
  }
  const { order, stages, requirements } = progress;
  /* Produção: Wellmix e o fornecedor do pedido (fora das etapas). */
  const productionView =
    order.status !== "CANCELLED" &&
    (wellmix || (user.role === "supplier" && order.supplierId === user.partyId))
      ? await (await import("@/lib/services/production")).productionView(order)
      : null;
  const productionUserIds = new Set<string>();
  for (const h of productionView?.track?.etdHistory ?? [])
    productionUserIds.add(h.byUserId);
  for (const f of productionView?.track?.followups ?? [])
    productionUserIds.add(f.byUserId);
  /* Embarque e desembaraço (Fase D): passos que o usuário vê. */
  const importFlow = await import("@/lib/services/import-flow");
  const importSteps =
    order.status !== "CANCELLED" && order.status !== "ORDER_CREATED"
      ? await importFlow.importFlowView(user, order)
      : [];
  /* Certificação (Fase F). O selo de certificação vale para todo pedido,
     desde que ele nasce (já está na mão da certificadora). Memorial, laudo
     e registro aparecem com OCP designado, ficha pedindo certificação ou
     passo deles já começado. */
  const certAll =
    order.status !== "CANCELLED"
      ? await importFlow.importFlowView(user, order, "certification")
      : [];
  const [certSheet] = certAll.length
    ? await store.list("purchase_sheets", {
        filter: { orderId: order.id },
        limit: 1,
      })
    : [];
  const classicCert =
    !!order.ocpId ||
    certAll.some((v) => v.step && !v.template.seal) ||
    certSheet?.certificationRequired === "yes";
  const certSteps = certAll.filter((v) => v.template.seal || classicCert);
  for (const v of [...importSteps, ...certSteps]) {
    if (v.step?.submittedByUserId)
      productionUserIds.add(v.step.submittedByUserId);
    if (v.step?.validatedByUserId)
      productionUserIds.add(v.step.validatedByUserId);
  }
  /* Recebimento (Fase E): só a Wellmix, do desembaraço em diante. */
  const receivingSvc = await import("@/lib/services/receiving");
  const receivingView =
    wellmix &&
    (receivingSvc.RECEIVING_STATUSES as readonly string[]).includes(
      order.status,
    )
      ? await receivingSvc.receivingView(order)
      : null;
  /* Artes (Fase F): Wellmix, o designer e a agência do pedido. */
  const artworkSvc = await import("@/lib/services/artwork");
  const artworkView =
    order.status !== "CANCELLED" &&
    order.status !== "ORDER_CREATED" &&
    artworkSvc.canFixArt(user, order)
      ? await artworkSvc.artworkView(user, order)
      : null;
  const productionNames = new Map(
    (productionUserIds.size
      ? await store.list("users", { filter: { id: [...productionUserIds] } })
      : []
    ).map((u) => [u.id, u.name]),
  );
  // Etapas do fluxo (o pagamento ao fornecedor tem card próprio, fora dele).
  const flowStages = stages.filter((s) => !isOffFlowStage(s.key));
  const sheetHint = sheetState
    ? {
        missing: sheetState.missing
          .map((k) => t(`sheet.field.${k}` as DictionaryKey))
          .join(", "),
        count: sheetState.missing.length,
        started: sheetState.saved || sheetState.prefillSource !== "catalog",
        source: sheetState.saved ? null : sheetState.prefillSource,
      }
    : null;

  /* Leituras independentes numa rodada só (cada ida ao banco é uma viagem de rede). */
  const customerSide = wellmix || user.role === "customer";
  const delivered = order.status === "CLOSED" || order.status === "DELIVERED";
  /* Embarque: a Wellmix vê o frete do comparativo para a rota do pedido e o
     botão de importar; a companhia do pedido, o botão de enviar a tabela dela. */
  const shippingStage = stages.find((s) => s.key === "SHIPPING");
  const shippingOpen =
    !!shippingStage &&
    ["pending", "active", "blocked"].includes(shippingStage.status);
  const showTariff = wellmix && shippingOpen;
  const showMyTariff =
    shippingOpen &&
    user.role === "shipping_line" &&
    !!user.partyId &&
    order.shippingLineId === user.partyId;
  const [
    parties,
    items,
    documents,
    payments,
    penalties,
    users,
    finance,
    snapshot,
    inspection,
    containers,
    afterSales,
    sourceRequest,
    derivedRequests,
    tariffView,
    myTariff,
  ] = await Promise.all([
    store.list("parties"),
    store.list("order_items", { filter: { orderId: order.id } }),
    store.list("documents", {
      filter: { orderId: order.id },
      orderBy: "createdAt",
      direction: "desc",
    }),
    store.list("payments", { filter: { orderId: order.id } }),
    store.list("penalties", { filter: { orderId: order.id } }),
    store.list("users"),
    wellmix || user.role === "customer"
      ? // Custo, câmbio e margem só para a Wellmix: o cliente não busca câmbio.
        loadOrderFinance(order, { estimate: wellmix })
      : Promise.resolve(null),
    /* Evolução incremental: snapshot da compra, resultado da inspeção e fila (só Wellmix),
       containers do pedido (todos, filtrado) e trilha visualizado/confirmado. */
    wellmix ? getSnapshotForOrder(order.id) : Promise.resolve(null),
    wellmix ? inspectionReport(order.id) : Promise.resolve(null),
    containersForOrder(order.id),
    /* Módulo cliente 2: pós-venda, "comprar de novo / nova proposta" e origem da solicitação.
       Só cliente (dono) e Wellmix; fornecedor e parceiros não veem avaliação nem preço de venda. */
    customerSide ? getAfterSales(order.id) : Promise.resolve(null),
    store.get("requests", order.requestId),
    customerSide
      ? store.list("requests", {
          filter: { sourceOrderId: order.id },
          orderBy: "createdAt",
          direction: "desc",
        })
      : Promise.resolve([] as RequestRow[]),
    showTariff
      ? orderTariffView(
          user,
          order,
          typeof tariffOrigin === "string" ? tariffOrigin.slice(0, 80) : null,
        ).catch((error: unknown): "failed" => {
          // Tarifário fora do ar: o pedido abre igual, com o aviso no cartão.
          console.error("orderTariffView failed", error);
          return "failed";
        })
      : Promise.resolve(null),
    showMyTariff
      ? myTariffStatus(user).catch((error: unknown): "failed" => {
          console.error("myTariffStatus failed", error);
          return "failed";
        })
      : Promise.resolve(null),
  ]);
  const partyName = (pid: string | null) =>
    parties.find((p) => p.id === pid)?.name ?? "—";
  /* Parceiro (agência, despachante, companhia, transportador): só a parte dele.
     O transportador ganha o cartão "Carga e entrega" no lugar do cartão do pedido. */
  const partner = isPartner(user);
  const cargo =
    user.role === "carrier"
      ? await cargoViewForOrder(user, order, {
          items,
          stages,
          requirements,
          parties,
        })
      : null;
  const visiblePenalties = partner
    ? penalties.filter((p) => p.responsiblePartyId === user.partyId)
    : penalties;
  const userName = (uid: string | null) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  const docById = (did: string | null) =>
    documents.find((d) => d.id === did) ?? null;
  const visibleDocs = documents.filter((d) => canSeeDoc(user, d));
  const currentStage =
    stages.find((s) => s.id === order.currentStageId) ?? null;
  const overdue = isOverdue(currentStage?.dueAt);
  const visiblePayments = payments.filter((p) =>
    wellmix
      ? financeAccess
      : user.role === "customer"
        ? p.direction === "customer_in"
        : user.role === "supplier"
          ? p.direction === "supplier_out"
          : false,
  );

  const showTrail = wellmix || user.role === "supplier";
  /* Trilha: o fornecedor abrindo o pedido registra "visualizado" nos pagamentos a ele
     (o mesmo que a conta corrente faz); confirmar continua sendo o ato explícito do botão. */
  if (user.role === "supplier") {
    await Promise.all(
      visiblePayments.map((p) => recordAck(user, "payment", p.id, "viewed")),
    );
  }
  const origin =
    sourceRequest?.origin && sourceRequest.origin !== "manual"
      ? sourceRequest.origin
      : null;
  const [
    paymentTrails,
    documentTrails,
    confirmedDocs,
    followProduct,
    sourceOrderRow,
  ] = await Promise.all([
    showTrail
      ? ackTrails("payment", visiblePayments, (p) => p.registeredByUserId)
      : Promise.resolve({} as Record<string, AckSummary>),
    ackTrails("document", visibleDocs, (d) => d.uploadedByUserId),
    ackedByUser(
      user.id,
      "document",
      visibleDocs.map((d) => d.id),
      "confirmed",
    ),
    (customerSide || user.role === "broker") && items[0]?.productId
      ? store.get("products", items[0].productId)
      : Promise.resolve(null),
    /* Link ao pedido de origem só para quem pode abri-lo (mesmo isolamento por papel). */
    origin && sourceRequest?.sourceOrderId
      ? store.get("orders", sourceRequest.sourceOrderId)
      : Promise.resolve(null),
  ]);
  const sourceOrder =
    sourceOrderRow && canViewOrder(user, sourceOrderRow)
      ? sourceOrderRow
      : null;
  /* Itens em linhas: foto e código do produto para a Wellmix e para a
     certificadora do pedido (ela vê as fotos de vitrine, as que pode abrir). */
  const itemProductIds = [
    ...new Set(items.map((i) => i.productId).filter(Boolean)),
  ] as string[];
  const itemMedia = wellmix || certifier;
  const [itemProducts, itemPhotos] =
    itemMedia && itemProductIds.length
      ? await Promise.all([
          store.list("products", { filter: { id: itemProductIds } }),
          store
            .list("product_photos", {
              filter: { productId: itemProductIds },
            })
            .then((photos) => (wellmix ? photos : showcaseOf(photos))),
        ])
      : [[], []];
  /* Certificações já registradas do produto e do fornecedor (menos as
     rejeitadas): a certificadora parte delas para gerar o selo. */
  const dossierCerts = certifier
    ? await (async () => {
        const { listCertifications, effectiveStatus } =
          await import("@/lib/services/compliance");
        const lists = await Promise.all([
          ...itemProductIds.map((pid) => listCertifications("product", pid)),
          listCertifications("party", order.supplierId),
        ]);
        return lists
          .flat()
          .map((cert) => ({ cert, status: effectiveStatus(cert) }))
          .filter((c) => c.status !== "rejected");
      })()
    : [];
  /* Certificadora: as fotos enviadas na ficha do pedido entram na galeria do
     item (um pedido, um produto), para o produto não ficar sem foto quando o
     cadastro não tem nenhuma. */
  const sheetItemPhotos =
    certifier && items.length === 1
      ? showcaseOf(
          await store.list("product_photos", {
            filter: { orderId: order.id },
          }),
        )
      : [];
  /* Fotos da linha do item: as do cadastro (para a certificadora, só as de
     vitrine; a principal só entra se for uma delas) e as da ficha do pedido. */
  const itemGallery = (
    product: (typeof itemProducts)[number] | null | undefined,
  ) => {
    const fromCatalog = product
      ? productPhotoList(
          wellmix ||
            itemPhotos.some(
              (ph) => ph.documentId === product.primaryPhotoDocumentId,
            )
            ? product
            : { ...product, primaryPhotoDocumentId: null },
          itemPhotos,
        )
      : [];
    const seen = new Set(fromCatalog.map((ph) => ph.documentId));
    return [
      ...fromCatalog,
      ...sheetItemPhotos
        .filter((ph) => !seen.has(ph.documentId))
        .map((ph) => ({ documentId: ph.documentId, kind: ph.kind })),
    ];
  };
  /* Recusa de um passo (embarque ou certificação): o motivo aparece também
     dentro do cartão de onde a ação veio, que é onde a pessoa está. */
  const stepError =
    typeof error === "string" && typeof stepCard === "string"
      ? t(`importFlow.error.${error}` as DictionaryKey) !==
        `importFlow.error.${error}`
        ? t(`importFlow.error.${error}` as DictionaryKey)
        : t(`orders.error.${error}` as DictionaryKey) !==
            `orders.error.${error}`
          ? t(`orders.error.${error}` as DictionaryKey)
          : fallbackError(t, error)
      : null;
  /* Cancelamento: só o admin cancela; o cliente pede até a produção começar. */
  const isCancelled = order.status === "CANCELLED";
  const admin = user.role === "admin";
  const canRequestCancel =
    user.role === "customer" && !isCancelled
      ? await customerCanRequestCancel(order)
      : false;
  const notice =
    cancelled === "1"
      ? "cancel.done"
      : cancelRequested === "1"
        ? "cancel.request.sent"
        : cancelRejected === "1"
          ? "cancel.request.rejectedOk"
          : settlementSaved === "1"
            ? "cancel.settlementSaved"
            : null;

  /* Cartão do pedido: o que este papel pode ver (vazio = o cartão não aparece). */
  /* Variação pedida (nome para todos; os valores da cópia só para a Wellmix):
     fica na tabela de itens, na linha do produto. */
  const variantCell = (i: OrderItem) => {
    if (!i.variant) return "—";
    const summary = wellmix
      ? variantSnapshotSummary(
          i.variant,
          {
            price: t("productVariants.col.price"),
            moq: t("productVariants.col.moq"),
            box: t("productVariants.col.box"),
            cbm: t("productVariants.col.cbm"),
          },
          t.intl,
        )
      : null;
    return (
      <span data-order-variant>
        {i.variant.name}
        {summary ? (
          <span className="block text-xs text-zinc-500">{summary}</span>
        ) : null}
      </span>
    );
  };
  /* Resumo do pedido (uma linha): o que este papel pode ver (vazio = não aparece). */
  const orderInfoItems: Array<[ReactNode, ReactNode]> = [
    ...(user.role !== "customer" && (wellmix || user.role === "legal")
      ? [
          [t("common.customer"), partyName(order.customerId)] as [
            string,
            string,
          ],
        ]
      : []),
    ...(canSeeSupplier(user) && user.role !== "supplier"
      ? [
          [t("common.supplier"), partyName(order.supplierId)] as [
            string,
            string,
          ],
        ]
      : []),
    ...(canSeeInternalCosts(user)
      ? [
          [
            t("orders.fob"),
            formatMoney(order.fobTotal, order.fobCurrency, t),
          ] as [string, string],
        ]
      : []),
    ...(canSeeSellPrice(user)
      ? [
          [
            t("orders.sell"),
            formatMoney(order.sellPrice, order.sellCurrency, t),
          ] as [string, string],
        ]
      : []),
    ...(wellmix
      ? [
          [
            t("orders.erp"),
            /* Cancelado sem número no ERP: nada a lançar no Sankhya. */
            order.erpNumber ??
              (isCancelled ? (
                "—"
              ) : (
                <Badge tone="warning">
                  {t(`erpStatus.${order.erpSyncStatus}`)}
                </Badge>
              )),
          ] as [string, ReactNode],
        ]
      : []),
    // Parceiro: a data do pedido não diz nada a ele (menos à certificadora).
    ...(partner && !certifier
      ? []
      : [
          [t("common.date"), formatDate(order.createdAt, t)] as [
            string,
            string,
          ],
        ]),
    /* Visão de Produto: modalidade de operação copiada do cliente (importador de registro).
         Wellmix, cliente e despachante; nunca fornecedor, agência, armador ou transportador.
         Pedidos antigos (nulo): nada aparece. */
    ...(order.operationMode &&
    (wellmix ||
      user.role === "customer" ||
      user.role === "broker" ||
      user.role === "legal")
      ? [
          [
            t("operations.mode.title"),
            <span
              key="operationMode"
              className="inline-flex"
              title={t("operations.mode.orderHint")}
            >
              <Badge tone="info">
                {t(
                  `operations.mode.badge.${order.operationMode}` as DictionaryKey,
                )}
              </Badge>
            </span>,
          ] as [string, ReactNode],
        ]
      : []),
    /* Certificadora: a ficha de compra do pedido para ler (dados técnicos e fotos). */
    ...(certifier && sheetHref
      ? [
          [
            t("sheet.title"),
            <TextLink key="sheet" href={sheetHref}>
              {t("sheet.view")}
            </TextLink>,
          ] as [string, ReactNode],
        ]
      : []),
    /* Classificação fiscal (NCM) com validação humana: Wellmix e despachante. */
    ...(followProduct && (wellmix || user.role === "broker")
      ? [
          [
            t("catalog.tax.title"),
            <TextLink key="tax" href={`/app/products/${followProduct.id}/tax`}>
              {followProduct.ncm ?? t("catalog.tax.none")}
            </TextLink>,
          ] as [string, ReactNode],
        ]
      : []),
  ];
  /* Etapas em linhas: quem vê a etapa abre os detalhes dela; a etapa em
     andamento (ou que ainda aceita dados, como o BL depois do embarque)
     fica aberta sempre. ?stage=CHAVE abre outra; ?stage=all, todas. */
  const stageVisible = (s: (typeof stages)[number]) =>
    stageVisibleTo(
      user,
      s,
      requirements.filter((r) => r.stageId === s.id),
    );
  const defaultExpanded = (s: (typeof stages)[number]) =>
    s.status === "active" ||
    s.status === "blocked" ||
    requirements.some(
      (r) =>
        r.stageId === s.id &&
        r.status !== "done" &&
        canCompleteLater(s, r, order),
    );
  const openableStages = flowStages.filter(stageVisible);
  const expandedStageIds = new Set(
    openableStages
      .filter(
        (s) =>
          defaultExpanded(s) || stageParam === "all" || stageParam === s.key,
      )
      .map((s) => s.id),
  );
  const stageHref = (s: (typeof stages)[number]) =>
    `/app/orders/${order.id}?stage=${s.key}#stage-${s.id}`;
  // Pagamento ao fornecedor: o administrador e o fornecedor do pedido.
  const showSupplierPayment =
    financeAccess ||
    (user.role === "supplier" && order.supplierId === user.partyId);
  const showAfterSales =
    customerSide && (!!afterSales || (wellmix && delivered));
  const showFollowUp =
    customerSide &&
    delivered &&
    !!items[0] &&
    (!wellmix || canOpen(user, "requests"));
  /* Partes do pedido na tabela de etapas (ordem do negócio): só as que este
     login já vê nos cartões de baixo; cada linha leva ao cartão ou à página. */
  const partsByStage = orderPartsByStage([
    wellmix || (user.role === "supplier" && order.supplierId === user.partyId)
      ? documentPart(requirements, `/app/orders/${order.id}/purchase-order`)
      : null,
    sheetState
      ? sheetPart(
          {
            missing: sheetState.missing.length,
            started: sheetState.saved || sheetState.prefillSource !== "catalog",
          },
          `/app/orders/${order.id}/purchase-sheet`,
          sheetState.missing.length
            ? t("orderParts.sheet.missing", {
                n: sheetState.missing.length,
              })
            : null,
        )
      : null,
    stepsPart(
      "certification",
      certSteps.map((v) => ({ done: v.done, started: !!v.step })),
      "#certification",
    ),
    artworkView
      ? plainPart(
          "artwork",
          artworkView.open > 0 ? "active" : "pending",
          "#artwork",
          artworkView.open > 0
            ? t("orderParts.artwork.open", { n: artworkView.open })
            : null,
        )
      : null,
    showSupplierPayment
      ? plainPart(
          "supplier_payment",
          order.status === "CLOSED" ? "done" : "active",
          "#supplier-payment",
        )
      : null,
    productionView
      ? plainPart(
          "production",
          productionView.allApproved
            ? "done"
            : productionView.track
              ? "active"
              : "pending",
          "#production",
          productionView.track?.etd
            ? t("orderParts.production.etd", {
                date: formatDate(productionView.track.etd, t),
              })
            : null,
        )
      : null,
    stepsPart(
      "import",
      importSteps.map((v) => ({ done: v.done, started: !!v.step })),
      "#import-flow",
    ),
    receivingView
      ? plainPart(
          "receiving",
          receivingView.row?.closedAt
            ? "done"
            : receivingView.row
              ? "active"
              : "pending",
          "#receiving",
          receivingView.divergences
            ? t("orderParts.receiving.divergences", {
                n: receivingView.divergences,
              })
            : null,
        )
      : null,
  ]);
  /* Cartões coloridos do alto (como Clientes e Fornecedores): os mesmos
     valores e a mesma regra de quem vê do antigo cartão Financeiro (cliente:
     venda, recebido e a receber; administrador: também compra, pago, a pagar
     e margem). */
  const moneyCards: ColorCard[] =
    finance && (financeAccess || user.role === "customer")
      ? [
          {
            key: "sell",
            label: t("orderView.money.sell"),
            value: formatMoney(finance.sell, finance.sellCurrency, t),
            tone: "indigo",
          },
          {
            key: "received",
            label: t("orderView.money.received"),
            value: formatMoney(finance.received, finance.sellCurrency, t),
            tone: "emerald",
          },
          {
            key: "receivable",
            label: t("orderView.money.receivable"),
            value: formatMoney(finance.receivable, finance.sellCurrency, t),
            tone: "rose",
          },
          ...(wellmix
            ? ([
                {
                  key: "fob",
                  label: t("orderView.money.fob"),
                  value: formatMoney(finance.fob, finance.fobCurrency, t),
                  tone: "slate",
                },
                {
                  key: "paid",
                  label: t("orderView.money.paid"),
                  value: (
                    <>
                      {formatMoney(finance.paid, finance.fobCurrency, t)}
                      {/* Pago em outra moeda: à parte, na moeda dele. */}
                      {Object.entries(finance.paidOther).map(([c, v]) => (
                        <span
                          key={c}
                          className="block text-xs font-medium text-white/85"
                          data-paid-other={c}
                        >
                          + {formatMoney(v, c, t)}
                        </span>
                      ))}
                    </>
                  ),
                  tone: "sky",
                },
                {
                  key: "payable",
                  label: t("orderView.money.payable"),
                  value: formatMoney(finance.payable, finance.fobCurrency, t),
                  tone: "orange",
                },
                {
                  key: "margin",
                  label: t("orderView.money.margin"),
                  // Cancelado não é venda: sem margem (como na tela Financeiro).
                  value:
                    finance.margin !== null && !isCancelled
                      ? approx(
                          formatMoney(finance.margin, finance.sellCurrency, t),
                          finance.estimated,
                        )
                      : "—",
                  sub:
                    finance.marginPct !== null &&
                    finance.margin !== null &&
                    !isCancelled
                      ? `${finance.marginPct.toLocaleString(t.intl, { maximumFractionDigits: 1 })}%`
                      : undefined,
                  tone: "violet",
                },
              ] as ColorCard[])
            : []),
        ]
      : [];
  /* Índice: atalhos só para as partes que este login vê. */
  const indexLinks: Array<[string, string]> = [
    ...(!cargo && orderInfoItems.length
      ? [["#order-summary", t("orderView.summary")] as [string, string]]
      : []),
    ...(!cargo
      ? [["#order-items", t("orderView.items")] as [string, string]]
      : []),
    ["#order-stages", t("orderView.stages")],
    ...(showAfterSales
      ? [["#after-sales", t("orders.afterSales.title")] as [string, string]]
      : []),
    ...(showFollowUp
      ? [["#followup", t("orders.followup.title")] as [string, string]]
      : []),
    ...(showSupplierPayment
      ? [["#supplier-payment", t("supplierTerms.card")] as [string, string]]
      : []),
    ...(productionView
      ? [["#production", t("production.title")] as [string, string]]
      : []),
    ...(importSteps.length
      ? [["#import-flow", t("importFlow.title")] as [string, string]]
      : []),
    ...(certSteps.length
      ? [["#certification", t("certFlow.title")] as [string, string]]
      : []),
    ...(receivingView
      ? [["#receiving", t("receiving.title")] as [string, string]]
      : []),
    ...(artworkView
      ? [["#artwork", t("artwork.title")] as [string, string]]
      : []),
    ...(wellmix || containers.length > 0
      ? [
          ["#order-containers", t("orders.containers.title")] as [
            string,
            string,
          ],
        ]
      : []),
    ...(finance && financeAccess
      ? [["#order-finance", t("orderView.finance")] as [string, string]]
      : []),
    ...(visiblePayments.length > 0
      ? [["#payments", t("orders.payments")] as [string, string]]
      : []),
    ["#order-documents", t("orders.documents")],
    ...(wellmix || user.role === "legal" || visiblePenalties.length > 0
      ? [["#order-penalties", t("orders.penalties")] as [string, string]]
      : []),
    ...(wellmix
      ? [
          ["#order-partners", t("orders.partners")] as [string, string],
          ["#snapshot", t("orders.snapshot.title")] as [string, string],
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        help={{ body: "help.order.body", steps: "help.order.steps" }}
        t={t}
        title={t("orders.number", { number: order.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {/* Cada item com o seu ícone de chat: a conversa desce até o produto. */}
            <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
              {items.map((i, index) => (
                <span key={i.id} className="inline-flex items-center">
                  {index > 0 ? <span className="mr-1">;</span> : null}
                  {`${i.name} · ${i.quantity} ${i.unit}`}
                  <ChatOpenButton
                    target={{ orderId: order.id, orderItemId: i.id }}
                    label={`${t("chat.openItem")}: ${i.name}`}
                  />
                </span>
              ))}
            </span>
            <Badge
              tone={
                isCancelled
                  ? "danger"
                  : stageTone(
                      order.status === "CLOSED"
                        ? "done"
                        : currentStage?.status === "blocked"
                          ? "blocked"
                          : "active",
                    )
              }
            >
              {t(`stage.${order.status}`)}
              {currentStage?.status === "blocked"
                ? ` · ${t("stageStatus.blocked")}`
                : ""}
            </Badge>
            {overdue ? (
              <Badge tone="danger">{t("common.overdue")}</Badge>
            ) : null}
            {sourceRequest?.number ? (
              canViewRequest(user, sourceRequest) ? (
                <TextLink
                  href={`/app/requests/${sourceRequest.id}`}
                  className="text-xs"
                  data-request-number
                >
                  {t("requests.numbered", { n: sourceRequest.number })}
                </TextLink>
              ) : (
                <span className="text-xs" data-request-number>
                  {t("requests.numbered", { n: sourceRequest.number })}
                </span>
              )
            ) : null}
            {origin ? (
              <Badge tone="brand">{t(`orders.origin.${origin}`)}</Badge>
            ) : null}
            {sourceOrder ? (
              <TextLink
                href={`/app/orders/${sourceOrder.id}`}
                className="text-xs"
              >
                {t("orders.origin.sourceOrder")}:{" "}
                {t("orders.number", { number: sourceOrder.number })}
              </TextLink>
            ) : null}
          </span>
        }
        actions={
          /* Mensagens: assunto deste pedido na conversa de cada empresa. */
          <ChatButtons
            back={`/app/orders/${order.id}`}
            orderId={order.id}
            prefix={wellmix ? t("messages.chatWith") : undefined}
            targets={
              wellmix
                ? (
                    [
                      ["customer", order.customerId],
                      ["supplier", order.supplierId],
                      ["shipping_line", order.shippingLineId],
                      ["carrier", order.carrierId],
                      ["agency", order.agencyId],
                      ["broker", order.brokerId],
                      ["comex", order.comexId ?? null],
                      ["logistics", order.logisticsId ?? null],
                      ["ocp", order.ocpId ?? null],
                    ] as Array<[PartyType, string | null]>
                  ).flatMap(([type, pid]) =>
                    pid
                      ? [
                          {
                            partyId: pid,
                            label: t(`messages.type.${type}`),
                            title: partyName(pid),
                          },
                        ]
                      : [],
                  )
                : [{ label: t("messages.chatWellmix") }]
            }
          />
        }
      />
      <ActionError
        t={t}
        code={error}
        text={
          !error
            ? null
            : typeof error === "string" &&
                t(`sheet.error.${error}` as DictionaryKey) !==
                  `sheet.error.${error}`
              ? t(`sheet.error.${error}` as DictionaryKey)
              : typeof error === "string" &&
                  t(`orders.error.${error}` as DictionaryKey) !==
                    `orders.error.${error}`
                ? t(`orders.error.${error}` as DictionaryKey)
                : typeof error === "string" &&
                    t(`production.error.${error}` as DictionaryKey) !==
                      `production.error.${error}`
                  ? t(`production.error.${error}` as DictionaryKey)
                  : typeof error === "string" &&
                      t(`importFlow.error.${error}` as DictionaryKey) !==
                        `importFlow.error.${error}`
                    ? t(`importFlow.error.${error}` as DictionaryKey)
                    : typeof error === "string" &&
                        t(`receiving.error.${error}` as DictionaryKey) !==
                          `receiving.error.${error}`
                      ? t(`receiving.error.${error}` as DictionaryKey)
                      : typeof error === "string" &&
                          t(`artwork.error.${error}` as DictionaryKey) !==
                            `artwork.error.${error}`
                        ? t(`artwork.error.${error}` as DictionaryKey)
                        : fallbackError(t, String(error))
        }
        fields={invalidFields}
        token={errorToken}
      />
      {notice ? (
        <div className="mb-3">
          <Alert tone="success">{t(notice)}</Alert>
        </div>
      ) : null}
      <CancelledBanner
        t={t}
        order={order}
        byName={userName(order.cancelledByUserId ?? null)}
        wellmix={wellmix}
        admin={admin}
        customer={user.role === "customer"}
      />
      {wellmix ? (
        <CancelRequestAlert t={t} order={order} admin={admin} />
      ) : null}
      {currentStage?.status === "blocked" ? (
        <div className="mb-3">
          <Alert tone="warning">
            <strong>{t("orders.blocked")}:</strong>{" "}
            {wellmix || currentStage.key !== "INSPECTION"
              ? currentStage.blockReason
              : t("orders.inspection.genericBlock")}
          </Alert>
        </div>
      ) : null}
      {order.status === "CLOSED" ? (
        <Alert tone="success">{t("orders.closed")}</Alert>
      ) : null}

      {/* Tela em linhas: uma coluna só, cada parte numa tabela (como as
          telas de Clientes, Fornecedores e o pedido em lista). Índice com
          atalhos para as partes que este login vê. */}
      <nav
        className="mb-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden"
        data-order-index
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("orderView.index")}
        </span>
        {indexLinks.map(([href, label]) => (
          <a key={href} href={href} className={cx(linkClass, "text-sm")}>
            {label}
          </a>
        ))}
      </nav>

      {moneyCards.length ? (
        <ColorCards name="order" items={moneyCards} />
      ) : null}

      {cargo ? <CargoCard t={t} cargo={cargo} /> : null}

      {/* Resumo do pedido numa linha: o que este papel pode ver (vazio = não
          aparece). Para o parceiro, só se sobrar algo útil. */}
      {cargo || !orderInfoItems.length ? null : (
        <OrderSection id="order-summary" title={t("orderView.summary")}>
          <Table>
            <thead>
              <tr>
                {orderInfoItems.map(([label], i) => (
                  <Th key={i}>{label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={rowClass} data-order-summary>
                {orderInfoItems.map(([, value], i) => (
                  <Td key={i} className="whitespace-nowrap">
                    {value}
                  </Td>
                ))}
              </tr>
            </tbody>
          </Table>
          {wellmix && !isCancelled && order.erpSyncStatus === "pending" ? (
            <p className="mt-2 text-xs text-amber-700">
              {t("orders.erp.pending")}
            </p>
          ) : null}
        </OrderSection>
      )}

      {/* Itens do pedido: um produto por linha (variação, quantidade e,
          para a Wellmix, foto e preço de compra). */}
      {cargo ? null : (
        <OrderSection id="order-items" title={t("orderView.items")}>
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">{t("orderView.col.n")}</Th>
                {itemMedia ? (
                  <Th className="w-14">{t("orderView.col.photo")}</Th>
                ) : null}
                <Th>{t("orderView.col.product")}</Th>
                <Th>{t("orderView.col.variant")}</Th>
                <Th className="text-right">{t("orderView.col.qty")}</Th>
                {canSeeInternalCosts(user) ? (
                  <>
                    <Th className="text-right">
                      {t("orderView.col.unitPrice")}
                    </Th>
                    <Th className="text-right">{t("orderView.col.total")}</Th>
                  </>
                ) : null}
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((i, index) => {
                const product = i.productId
                  ? itemProducts.find((p) => p.id === i.productId)
                  : null;
                return (
                  <tr key={i.id} className={rowClass} data-order-item>
                    <Td className="text-right tabular-nums">{index + 1}</Td>
                    {itemMedia ? (
                      <Td className="w-14">
                        <PhotoGallery
                          name={i.name}
                          {...galleryProps(t, itemGallery(product))}
                        />
                      </Td>
                    ) : null}
                    <Td className="min-w-44 font-medium">
                      {wellmix && i.productId ? (
                        <TextLink
                          href={`/app/products/${i.productId}`}
                          className="text-zinc-900"
                        >
                          {i.name}
                        </TextLink>
                      ) : (
                        i.name
                      )}
                      {product?.sku ? (
                        <span className="block font-mono text-xs font-normal text-zinc-500">
                          {product.sku}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="min-w-40">{variantCell(i)}</Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {i.quantity.toLocaleString(t.intl)} {i.unit}
                    </Td>
                    {canSeeInternalCosts(user) ? (
                      <>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {i.unitPrice !== null
                            ? formatMoney(i.unitPrice, order.fobCurrency, t)
                            : "—"}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {i.unitPrice !== null
                            ? formatMoney(
                                Math.round(i.unitPrice * i.quantity * 100) /
                                  100,
                                order.fobCurrency,
                                t,
                              )
                            : "—"}
                        </Td>
                      </>
                    ) : null}
                    <Td className="w-10 text-right">
                      <ChatOpenButton
                        target={{ orderId: order.id, orderItemId: i.id }}
                        label={`${t("chat.openItem")}: ${i.name}`}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </OrderSection>
      )}

      {/* Etapas: uma linha por etapa (todas, como a linha do tempo). A etapa
          em andamento (e a que ainda aceita dados) aparece aberta embaixo;
          as outras abrem em "Ver detalhes". */}
      <OrderSection
        id="order-stages"
        title={t("orderView.stages")}
        actions={
          openableStages.length > 1 ? (
            stageParam === "all" ? (
              <TextLink
                href={`/app/orders/${order.id}#order-stages`}
                className="text-sm"
                data-stage-show-current
              >
                {t("orderView.stage.current")}
              </TextLink>
            ) : (
              <TextLink
                href={`/app/orders/${order.id}?stage=all#order-stages`}
                className="text-sm"
                data-stage-show-all
              >
                {t("orderView.stage.all")}
              </TextLink>
            )
          ) : null
        }
      >
        <Table>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>{t("orderView.col.stage")}</Th>
              <Th>{t("orderView.col.status")}</Th>
              <Th>{t("orderView.col.responsible")}</Th>
              <Th>{t("orderView.col.due")}</Th>
              <Th>{t("orderView.col.done")}</Th>
              <Th>{t("orderView.col.progress")}</Th>
              <Th className="text-right">{t("orderView.col.reqs")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {flowStages.map((s, index) => {
              const visible = stageVisible(s);
              const reqs = requirements.filter((r) => r.stageId === s.id);
              // Fornecedor e parceiros: só as linhas que são do próprio
              // login (a numeração continua a do fluxo inteiro).
              const ownStage = stageRowFor(user, s, reqs);
              const ownParts = (partsByStage.get(s.key) ?? []).filter((part) =>
                partRowFor(user, part.key),
              );
              if (!ownStage && !ownParts.length) return null;
              const open = s.status === "active" || s.status === "blocked";
              const expanded = expandedStageIds.has(s.id);
              return (
                <Fragment key={s.id}>
                  {ownStage ? (
                    <tr
                      className={cx(
                        rowClass,
                        s.status === "active" && "bg-brand-50/60",
                        s.status === "blocked" && "bg-amber-50/70",
                      )}
                      data-stage-row={s.key}
                    >
                      <Td className="w-10">
                        <StepDot state={s.status}>{index + 1}</StepDot>
                      </Td>
                      <Td className="min-w-40">
                        <span
                          className={cx(
                            s.status === "pending"
                              ? "text-zinc-500"
                              : s.status === "active"
                                ? "font-semibold text-brand-800"
                                : s.status === "blocked"
                                  ? "font-semibold text-amber-900"
                                  : "font-medium text-zinc-900",
                          )}
                        >
                          {visible ? (
                            <a
                              href={stageHref(s)}
                              className="transition hover:text-brand-700"
                            >
                              {t(`stage.${s.key}`)}
                            </a>
                          ) : (
                            t(`stage.${s.key}`)
                          )}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={stageTone(s.status)}>
                          {t(`stageStatus.${s.status}`)}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-zinc-700">
                        {visible ? (
                          <span className="inline-flex items-center gap-1">
                            {t(`role.${s.responsibleRole}`)}
                            {(() => {
                              // Mensagem para o responsável da etapa (Wellmix: a
                              // empresa; quem é de fora: a Wellmix), já com a etapa escrita.
                              const chat = stageChat(
                                order,
                                s.responsibleRole,
                                wellmix,
                              );
                              const draft = t("orderView.stage.chatDraft", {
                                stage: t(`stage.${s.key}`),
                              });
                              if (!chat) return null;
                              if (chat.kind === "unassigned")
                                return (
                                  <a
                                    href="#order-partners"
                                    className="text-xs font-medium text-brand-700 underline underline-offset-2"
                                    title={t(
                                      "orderView.stage.chatAssignTitle",
                                      {
                                        role: t(`role.${s.responsibleRole}`),
                                      },
                                    )}
                                    data-stage-chat-assign={s.key}
                                  >
                                    {t("orderView.stage.chatAssign")}
                                  </a>
                                );
                              return (
                                <span data-stage-chat={s.key}>
                                  <ChatOpenButton
                                    target={
                                      chat.kind === "party"
                                        ? {
                                            orderId: order.id,
                                            partyId: chat.partyId,
                                            draft,
                                          }
                                        : { orderId: order.id, draft }
                                    }
                                    label={
                                      chat.kind === "party"
                                        ? t("orderView.stage.chat", {
                                            who: `${t(`role.${s.responsibleRole}`)} (${partyName(chat.partyId)})`,
                                          })
                                        : t("orderView.stage.chatWellmix")
                                    }
                                  />
                                </span>
                              );
                            })()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td
                        className={cx(
                          "whitespace-nowrap tabular-nums",
                          visible && open && isOverdue(s.dueAt)
                            ? "font-semibold text-red-700"
                            : "text-zinc-700",
                        )}
                      >
                        {visible && s.dueAt ? formatDate(s.dueAt, t) : "—"}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums text-zinc-700">
                        {visible && s.completedAt
                          ? formatDate(s.completedAt, t)
                          : "—"}
                      </Td>
                      <Td className="w-32">
                        {open ? (
                          <span className="flex items-center gap-2">
                            <span className="w-16">
                              <Progress percent={s.percent} />
                            </span>
                            <span className="text-xs font-semibold tabular-nums text-zinc-600">
                              {s.percent}%
                            </span>
                          </span>
                        ) : s.status === "done" ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            100%
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums text-zinc-700">
                        {visible && reqs.length
                          ? t("orderView.stage.reqs", {
                              done: reqs.filter((r) => r.status === "done")
                                .length,
                              total: reqs.length,
                            })
                          : "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {visible ? (
                          expanded && !defaultExpanded(s) ? (
                            <TextLink
                              href={`/app/orders/${order.id}#order-stages`}
                              className="text-sm"
                            >
                              {t("orderView.stage.close")}
                            </TextLink>
                          ) : expanded ? null : (
                            <TextLink
                              href={stageHref(s)}
                              className="text-sm"
                              data-stage-open={s.key}
                            >
                              {t("orderView.stage.open")}
                            </TextLink>
                          )
                        ) : null}
                      </Td>
                    </tr>
                  ) : null}
                  {/* Partes do pedido que acontecem nesta altura do fluxo e têm
                    cartão (ou página) próprio: aparecem aqui, na ordem do
                    negócio, com a situação e o atalho. */}
                  {ownParts.map((part) => (
                    <tr
                      key={part.key}
                      className={cx(rowClass, "bg-zinc-50/60")}
                      data-order-part={part.key}
                      data-order-part-state={part.state}
                    >
                      <Td className="w-10 text-center text-zinc-400">↳</Td>
                      <Td className="min-w-40">
                        <a
                          href={part.href}
                          className="font-medium text-zinc-800 transition hover:text-brand-700"
                        >
                          {t(`orderParts.${part.key}` as DictionaryKey)}
                        </a>
                        {ORDER_PART_PARALLEL.includes(part.key) ? (
                          <span className="ml-1.5 whitespace-nowrap rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
                            {t("orderParts.parallel")}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge
                          tone={
                            part.state === "done"
                              ? "success"
                              : part.state === "active"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {t(`orderParts.state.${part.state}` as DictionaryKey)}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-zinc-700">
                        {t(`orderParts.who.${part.key}` as DictionaryKey)}
                      </Td>
                      <Td colSpan={3} className="text-xs text-zinc-600">
                        {part.detail ?? "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums text-zinc-700">
                        {part.total
                          ? t("orderView.stage.reqs", {
                              done: part.done ?? 0,
                              total: part.total,
                            })
                          : "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        <TextLink
                          href={part.href}
                          className="text-sm"
                          data-order-part-open={part.key}
                        >
                          {t("orderParts.open")}
                        </TextLink>
                      </Td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
        {openableStages.length > 1 ? (
          <p className="mt-1.5 text-xs text-zinc-500 print:hidden">
            {t("orderView.stage.hint")}
          </p>
        ) : null}

        {flowStages
          .filter((s) => stageVisible(s) && expandedStageIds.has(s.id))
          .map((stage) => {
            const reqs = requirements.filter((r) => r.stageId === stage.id);
            // Datas já informadas no pedido (limites: chegada ≥ embarque, entrega ≥ chegada).
            const dateValueOf = (sk: string, key: string) =>
              requirements.find(
                (x) =>
                  x.key === key &&
                  x.status === "done" &&
                  stages.find((st) => st.id === x.stageId)?.key === sk,
              )?.value ?? null;
            const open =
              stage.status === "active" || stage.status === "blocked";
            return (
              <Fragment key={stage.id}>
                <Card
                  className={cx(
                    "mt-4",
                    stage.status === "active" &&
                      "border-brand-300! ring-4 ring-brand-50",
                    stage.status === "blocked" &&
                      "border-amber-400! ring-4 ring-amber-50",
                  )}
                  title={
                    <span
                      id={`stage-${stage.id}`}
                      className="flex scroll-mt-24 flex-wrap items-center gap-2"
                    >
                      {t(`stage.${stage.key}`)}
                      <Badge tone={stageTone(stage.status)}>
                        {t(`stageStatus.${stage.status}`)}
                      </Badge>
                      {open && stage.dueAt ? (
                        <span
                          className={cx(
                            "text-xs",
                            isOverdue(stage.dueAt)
                              ? "font-semibold text-red-700"
                              : "font-normal text-zinc-500",
                          )}
                        >
                          {t("common.due")}: {formatDate(stage.dueAt, t)}
                        </span>
                      ) : null}
                    </span>
                  }
                  actions={
                    open ? (
                      <span className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>
                          {t("common.responsible")}:{" "}
                          <span className="font-semibold text-zinc-700">
                            {t(`role.${stage.responsibleRole}`)}
                          </span>
                        </span>
                        <span className="w-24">
                          <Progress percent={stage.percent} />
                        </span>
                      </span>
                    ) : !defaultExpanded(stage) ? (
                      <TextLink
                        href={`/app/orders/${order.id}#order-stages`}
                        className="text-xs"
                      >
                        {t("orderView.stage.close")}
                      </TextLink>
                    ) : null
                  }
                >
                  <p className="mb-2 text-xs leading-relaxed text-zinc-500">
                    {t(`help.stage.${stage.key}`)}
                  </p>
                  {stage.key === "SHIPPING" && showTariff ? (
                    <FreightTariffBox
                      t={t}
                      orderId={order.id}
                      stageId={stage.id}
                      shippingLineId={order.shippingLineId}
                      view={tariffView}
                      keepParams={remeasureMode ? { remeasure: "1" } : {}}
                    />
                  ) : null}
                  {stage.key === "SHIPPING" && showMyTariff ? (
                    <FreightTariffUploadBox
                      t={t}
                      orderId={order.id}
                      status={myTariff}
                    />
                  ) : null}
                  {stage.key === "PACKAGING" && stage.status !== "pending" ? (
                    <PackagingBriefFiles t={t} user={user} orderId={order.id} />
                  ) : null}
                  {stage.key === "INSPECTION" && user.role === "supplier" ? (
                    <p className="mb-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs leading-relaxed text-brand-800">
                      {t("orders.inspection.blindHint")}
                    </p>
                  ) : null}
                  {stage.key === "INSPECTION" &&
                  open &&
                  (stage.status === "blocked" || stage.status === "active") &&
                  reqs.some((r) => r.status === "done" && isRemeasurable(r)) &&
                  (wellmix || user.role === "supplier") ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      {remeasureMode ? (
                        <>
                          <span className="text-xs text-zinc-600">
                            {t("orders.inspection.remeasureHint")}
                          </span>
                          <TextLink
                            href={`/app/orders/${order.id}#stage-${stage.id}`}
                            className="text-xs"
                          >
                            {t("orders.inspection.remeasureClose")}
                          </TextLink>
                        </>
                      ) : (
                        <TextLink
                          href={`/app/orders/${order.id}?remeasure=1#stage-${stage.id}`}
                        >
                          {t("orders.inspection.remeasure")} →
                        </TextLink>
                      )}
                    </div>
                  ) : null}
                  {stage.status === "pending" ? (
                    <p className="text-sm text-zinc-500">
                      {reqs.map((r) => requirementLabel(t, r)).join(" · ")}
                    </p>
                  ) : (
                    <ul className="@container divide-y divide-zinc-100">
                      {reqs.map((r) => (
                        <RequirementRow
                          key={r.id}
                          requirement={r}
                          order={order}
                          user={user}
                          t={t}
                          waiting={
                            r.key === "art_approval" &&
                            reqs.some(
                              (x) => x.key === "art" && x.status !== "done",
                            )
                              ? t("packaging.waitingArt")
                              : dateWaiting(t, stage.key, r, reqs)
                          }
                          dateBounds={
                            r.type === "date"
                              ? dateBoundsFor(stage.key, r.key, dateValueOf)
                              : undefined
                          }
                          doc={docById(r.documentId)}
                          submittedBy={userName(r.submittedByUserId)}
                          open={
                            open ||
                            // Embarque confirmado: BL, datas e navio ainda podem vir.
                            canCompleteLater(stage, r, order)
                          }
                          wellmix={wellmix}
                          remeasure={
                            remeasureMode &&
                            stage.key === "INSPECTION" &&
                            (stage.status === "blocked" ||
                              stage.status === "active") &&
                            isRemeasurable(r)
                          }
                          sheetHref={sheetHref}
                          sheetEditable={sheet.editSupplier}
                          sheetHint={sheetHint}
                        />
                      ))}
                    </ul>
                  )}
                  {stage.status === "blocked" && wellmix ? (
                    <form action={unblockStageAction} className="mt-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="stageId" value={stage.id} />
                      <SubmitButton variant="secondary">
                        {t("orders.unblock")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </Card>
              </Fragment>
            );
          })}
        {/* Relatório da inspeção (Wellmix): sempre à vista depois que a
            inspeção começa, aberta ou não a etapa. */}
        {inspection &&
        wellmix &&
        stages.some((s) => s.key === "INSPECTION" && s.status !== "pending") ? (
          <div className="mt-4 min-w-0">
            <InspectionResultCard
              t={t}
              report={inspection}
              userName={userName}
            />
          </div>
        ) : null}
      </OrderSection>

      {showAfterSales ? (
        <div id="after-sales" className="mt-6 min-w-0 scroll-mt-24">
          <AfterSalesCard
            t={t}
            afterSales={afterSales}
            orderId={order.id}
            user={user}
            wellmix={wellmix}
            answeredBy={userName(afterSales?.answeredByUserId ?? null)}
          />
        </div>
      ) : null}

      {showFollowUp && items[0] ? (
        <div id="followup" className="mt-6 min-w-0 scroll-mt-24">
          <FollowUpCard
            t={t}
            order={order}
            item={items[0]}
            photoDocumentId={followProduct?.primaryPhotoDocumentId ?? null}
            derived={derivedRequests}
            wellmix={wellmix}
          />
        </div>
      ) : null}

      <div className="mt-6 flex min-w-0 flex-col gap-6">
        {/* Faca (die-cut) da embalagem: o fornecedor do pedido envia (ou troca). */}
        <SupplierDielineCard
          t={t}
          user={user}
          from={{ orderId: order.id }}
          back={`/app/orders/${order.id}`}
          justSent={dielineNotice === "sent"}
        />
        {/* Pagamento ao fornecedor: fora do fluxo das etapas (condição do
            fornecedor, parcelas e, para a Wellmix, o pagamento da vez). */}
        {showSupplierPayment ? (
          <SupplierPaymentCard
            order={order}
            t={t}
            wellmix={financeAccess}
            fxToday={financeAccess ? (finance?.fxToday ?? null) : null}
            notice={
              typeof paid === "string" &&
              [
                "transfer_copied",
                "finance_email",
                "finance_whatsapp",
                "marked",
              ].includes(paid)
                ? t(`supplierPay.done.${paid}` as DictionaryKey)
                : termsNotice === "applied"
                  ? t("supplierTerms.applied")
                  : null
            }
          />
        ) : null}

        {/* Produção (Fase C): ETD, follow 5/15/25, inspeção agendada e por SKU. */}
        {productionView ? (
          <ProductionCard
            t={t}
            user={user}
            order={order}
            view={productionView}
            wellmix={wellmix}
            names={productionNames}
            notice={
              typeof productionNotice === "string" &&
              ["saved", "followup", "scheduled", "inspected", "fixed"].includes(
                productionNotice,
              )
                ? t(`production.done.${productionNotice}` as DictionaryKey)
                : null
            }
          />
        ) : null}

        {/* Embarque e desembaraço (Fase D): booking, BL, invoice, numerário, DI... */}
        <ImportFlowCard
          t={t}
          order={order}
          steps={importSteps}
          names={productionNames}
          error={stepCard === "import-flow" ? stepError : null}
          notice={
            typeof importNotice === "string" &&
            ["submitted", "validated", "rejected"].includes(importNotice)
              ? t(`importFlow.done.${importNotice}` as DictionaryKey)
              : null
          }
        />
        {/* Certificação (Fase F): memorial, laboratório e registro com o OCP,
            e o selo de certificação que a agência aplica na arte. */}
        <ImportFlowCard
          t={t}
          order={order}
          steps={certSteps}
          names={productionNames}
          title={t("certFlow.title")}
          anchor="certification"
          error={stepCard === "certification" ? stepError : null}
          hints={[
            ...(certSteps.some((v) => v.template.key === "cert_seal")
              ? [t("certFlow.sealHint")]
              : []),
            // Todo pedido precisa de selo: sem certificadora, a Wellmix designa.
            ...(wellmix && !order.ocpId && certSteps.length
              ? [t("certFlow.notify.noOcp.body")]
              : []),
            // A certificação pedida na ficha: só para quem abre a ficha
            // aqui (a Wellmix e a certificadora), não para a agência ou o comex.
            ...((wellmix || certifier) && certSheet?.certificationNote?.trim()
              ? [
                  t("certFlow.sheetNote", {
                    note: certSheet.certificationNote.trim(),
                  }),
                ]
              : []),
            // Certificadora: onde está o pedido completo para gerar o selo.
            ...(certifier && certSteps.length
              ? [
                  <span key="dossier" data-certifier-dossier>
                    {t("certFlow.dossier.hint")}{" "}
                    {sheetHref ? (
                      <>
                        <TextLink href={sheetHref}>{t("sheet.view")}</TextLink>
                        {" · "}
                      </>
                    ) : null}
                    <a href="#order-items" className={linkClass}>
                      {t("orderView.items")}
                    </a>
                    {" · "}
                    <a href="#order-documents" className={linkClass}>
                      {t("orders.documents")}
                    </a>
                  </span>,
                ]
              : []),
            ...(certifier && certSteps.length && dossierCerts.length
              ? [
                  <span key="certs" data-certifier-certs>
                    {t("certFlow.dossier.certs")}
                    <span className="mt-1 block space-y-0.5">
                      {dossierCerts.map(({ cert, status }) => (
                        <span key={cert.id} className="block">
                          {[
                            cert.kind,
                            cert.name,
                            cert.number
                              ? `${t("catalog.cert.number")} ${cert.number}`
                              : null,
                            cert.issuer,
                            t(`catalog.cert.status.${status}` as DictionaryKey),
                            cert.validUntil
                              ? `${t("catalog.cert.validUntil")} ${formatDate(cert.validUntil, t)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {cert.documentId ? (
                            <>
                              {" · "}
                              <a
                                href={`/api/files/${cert.documentId}`}
                                className={linkClass}
                              >
                                {t("catalog.cert.open")}
                              </a>
                            </>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  </span>,
                ]
              : []),
          ]}
          notice={
            typeof certNotice === "string" &&
            ["submitted", "validated", "rejected"].includes(certNotice)
              ? t(`importFlow.done.${certNotice}` as DictionaryKey)
              : null
          }
        />

        {/* Recebimento (Fase E): lacre, checklist, divergência por SKU, RIC, fechamento. */}
        {receivingView ? (
          <ReceivingCard
            t={t}
            order={order}
            view={receivingView}
            notice={
              typeof receivingNotice === "string" &&
              ["saved", "counted", "ric", "returned", "closed"].includes(
                receivingNotice,
              )
                ? t(`receiving.done.${receivingNotice}` as DictionaryKey)
                : null
            }
          />
        ) : null}
        {/* Artes (Fase F): designer, não conformidade por SKU, baixar todas. */}
        {artworkView ? (
          <ArtworkCard
            t={t}
            order={order}
            view={artworkView}
            wellmix={wellmix}
            notice={
              typeof artworkNotice === "string" &&
              [
                "designer",
                "reported",
                "fixed",
                "accepted",
                "reopened",
              ].includes(artworkNotice)
                ? t(`artwork.done.${artworkNotice}` as DictionaryKey)
                : null
            }
          />
        ) : null}
      </div>

      {/* Containers em que o pedido está (cliente e parceiros: só código e ETA). */}
      {wellmix || containers.length > 0 ? (
        <OrderSection
          id="order-containers"
          title={t("orders.containers.title")}
        >
          {containers.length === 0 ? (
            <Empty>{t("orders.containers.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("orderView.col.container")}</Th>
                  {wellmix ? (
                    <>
                      <Th>{t("orderView.col.containerType")}</Th>
                      <Th>{t("orders.containers.etd")}</Th>
                    </>
                  ) : null}
                  <Th>{t("orders.containers.eta")}</Th>
                  {wellmix ? <Th>{t("orderView.col.status")}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} className={rowClass} data-order-container>
                    <Td className="whitespace-nowrap font-semibold">
                      {wellmix ? (
                        <TextLink href={`/app/containers/${c.id}`}>
                          {c.code}
                        </TextLink>
                      ) : (
                        c.code
                      )}
                    </Td>
                    {wellmix ? (
                      <>
                        <Td className="whitespace-nowrap">{c.type}</Td>
                        <Td className="whitespace-nowrap tabular-nums">
                          {formatDate(c.etd, t)}
                        </Td>
                      </>
                    ) : null}
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatDate(c.eta, t)}
                    </Td>
                    {wellmix ? (
                      <Td className="whitespace-nowrap">
                        <Badge
                          tone={
                            c.status === "closed" || c.status === "arrived"
                              ? "success"
                              : c.status === "shipped"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {t(`orders.containers.status.${c.status}`)}
                        </Badge>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </OrderSection>
      ) : null}

      {/* Financeiro do pedido (só administrador): custo, câmbio e margem
          detalhados; os valores principais estão nos cartões do alto. */}
      {finance && financeAccess ? (
        <OrderSection id="order-finance" title={t("orderView.finance")}>
          <Table>
            <thead>
              <tr>
                <Th className="text-right">{t("finance.cost")}</Th>
                {!isCancelled &&
                fxRateLines(t, finance) &&
                finance.fxBasis !== "same" ? (
                  <Th>{t("finance.fx")}</Th>
                ) : null}
                <Th className="text-right">{t("finance.margin")}</Th>
              </tr>
            </thead>
            <tbody>
              <tr className={rowClass}>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {finance.cost !== null ? (
                    <span data-finance-cost="">
                      {approx(
                        formatMoney(finance.cost, finance.sellCurrency, t),
                        finance.estimated,
                      )}
                      {costEstimateNote(t, finance) ? (
                        <span className="block text-xs text-zinc-500">
                          {costEstimateNote(t, finance)}
                        </span>
                      ) : null}
                    </span>
                  ) : isCancelled ? (
                    // Cancelado sem nada pago: não há custo a mostrar.
                    "—"
                  ) : (
                    t("finance.fxMissing")
                  )}
                </Td>
                {!isCancelled &&
                fxRateLines(t, finance) &&
                finance.fxBasis !== "same" ? (
                  <Td>
                    <span data-finance-fx="">
                      {fxRateLines(t, finance)!.main}
                      {fxRateLines(t, finance)!.notes.map((n, i) => (
                        <span key={i} className="block text-xs text-zinc-500">
                          {n}
                        </span>
                      ))}
                    </span>
                  </Td>
                ) : null}
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {/* Cancelado não é venda: sem margem (como na tela Financeiro). */}
                  {finance.margin !== null && !isCancelled ? (
                    <span
                      className={
                        finance.margin < 0
                          ? "font-medium text-red-700"
                          : "font-medium text-emerald-700"
                      }
                    >
                      {approx(
                        formatMoney(finance.margin, finance.sellCurrency, t),
                        finance.estimated,
                      )}
                      {finance.marginPct !== null
                        ? ` (${finance.marginPct.toLocaleString(t.intl, { maximumFractionDigits: 1 })}%)`
                        : ""}
                      {fxEffectText(t, finance) ? (
                        <span
                          title={fxEffectText(t, finance)!.title}
                          className={cx(
                            "block text-xs",
                            fxEffectText(t, finance)!.negative
                              ? "text-red-700"
                              : "text-emerald-700",
                          )}
                          data-fx-effect=""
                        >
                          {fxEffectText(t, finance)!.text}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            </tbody>
          </Table>
          {/* Pagamento ao fornecedor feito sem o câmbio do banco: o campo de
              informar fica na tabela de pagamentos, logo abaixo. */}
          {!isCancelled && missingFxText(t, finance) ? (
            <p
              className="mt-2 text-xs font-semibold text-amber-800"
              data-fx-missing={finance.missingFx.length}
            >
              {missingFxText(t, finance)}{" "}
              <a href="#payments" className={cx(linkClass, "text-xs")}>
                {t("finance.fx.setTitle")}
              </a>
            </p>
          ) : null}
          {finance.receivable > 0 ? (
            <details className="mt-3 rounded-xl border border-zinc-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
                {t("orderView.registerReceipt")}
              </summary>
              <form
                action={registerCustomerPaymentAction}
                className="grid gap-2 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-[10rem_8rem_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("orders.value")}>
                  <MoneyInput
                    locale={t.intl}
                    name="amount"
                    watchField="currency"
                    required
                    defaultAmount={finance.receivable}
                    className="w-full"
                  />
                </Field>
                <Field label={t("common.currency")}>
                  <CurrencySelect
                    name="currency"
                    value={finance.sellCurrency}
                    t={t}
                  />
                </Field>
                <Field label={t("finance.method")}>
                  <Input name="method" placeholder={t("ph.finance.method")} />
                </Field>
                <Field label={t("requests.payment.proof")}>
                  <Input name="proof" type="file" />
                </Field>
                <SubmitButton>{t("finance.registerReceipt")}</SubmitButton>
              </form>
            </details>
          ) : null}
        </OrderSection>
      ) : null}

      {/* Pagamentos: um por linha (cliente e fornecedor, conforme o papel). */}
      {visiblePayments.length > 0 ? (
        <OrderSection id="payments" title={t("orders.payments")}>
          {financeAccess && fxSaved === "saved" ? (
            <p className="mb-2 text-xs font-medium text-emerald-700">
              {t("finance.fx.savedNotice")}
            </p>
          ) : null}
          <Table>
            <thead>
              <tr>
                <Th>{t("orderView.col.date")}</Th>
                <Th>{t("orderView.col.from")}</Th>
                <Th className="text-right">{t("orderView.col.amount")}</Th>
                <Th>{t("orderView.col.status")}</Th>
                <Th>{t("orderView.col.note")}</Th>
                <Th>{t("orderView.col.proof")}</Th>
                {wellmix ? <Th>{t("orderView.col.fx")}</Th> : null}
                {showTrail ? <Th>{t("orderView.col.trail")}</Th> : null}
                <Th />
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((p) => (
                <tr key={p.id} className={rowClass} data-order-payment>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatDate(p.confirmedAt ?? p.createdAt, t)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {p.direction === "customer_in"
                      ? t("common.customer")
                      : t("common.supplier")}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {formatMoney(p.amount, p.currency, t)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge
                      tone={p.status === "pending" ? "warning" : "success"}
                    >
                      {t(`paymentStatus.${p.status}`)}
                    </Badge>
                  </Td>
                  <Td>
                    <span
                      className="block max-w-56 truncate"
                      title={p.note ?? undefined}
                    >
                      {p.note ?? "—"}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {p.proofDocumentId &&
                    docById(p.proofDocumentId) &&
                    canSeeDoc(user, docById(p.proofDocumentId)!) ? (
                      <a
                        href={`/api/files/${p.proofDocumentId}`}
                        className={cx(linkClass, "text-xs")}
                        target="_blank"
                      >
                        {t("requests.payment.proof")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                  {wellmix ? (
                    <Td>
                      {/* Câmbio do pagamento ao fornecedor (custo real no
                          financeiro): só a Wellmix vê e informa depois de pago. */}
                      {p.direction === "supplier_out" &&
                      p.currency.toUpperCase() !== "BRL" &&
                      (p.status === "confirmed" || p.status === "received")
                        ? (() => {
                            // Informar (sem câmbio) ou corrigir (câmbio já salvo).
                            const fxForm = (
                              <form
                                action={setSupplierPaymentFxAction}
                                className="mt-1.5 flex flex-wrap items-end gap-2"
                                data-payment-fx-form={p.id}
                              >
                                <input
                                  type="hidden"
                                  name="orderId"
                                  value={order.id}
                                />
                                <input
                                  type="hidden"
                                  name="paymentId"
                                  value={p.id}
                                />
                                <div className="w-36 min-w-0">
                                  <Field
                                    label={t("finance.fx.setTitle")}
                                    hint={
                                      p.fxRate ? undefined : (
                                        <>
                                          <span className="block">
                                            {t("finance.fx.paymentMissing")}
                                          </span>
                                          {/* Cotação automática do dia, só de referência. */}
                                          {fxReferenceText(
                                            t,
                                            finance?.fxToday ?? null,
                                            p.currency,
                                          ) ? (
                                            <span
                                              className="block"
                                              data-fx-reference=""
                                            >
                                              {fxReferenceText(
                                                t,
                                                finance?.fxToday ?? null,
                                                p.currency,
                                              )}
                                            </span>
                                          ) : null}
                                        </>
                                      )
                                    }
                                  >
                                    <Input
                                      name="fxRate"
                                      type="number"
                                      step="any"
                                      min="0"
                                      required
                                      defaultValue={p.fxRate ?? undefined}
                                      placeholder={t("finance.fx.unitHint", {
                                        currency: p.currency,
                                      })}
                                    />
                                  </Field>
                                </div>
                                <SubmitButton variant="secondary">
                                  {t("finance.fx.setSave")}
                                </SubmitButton>
                              </form>
                            );
                            if (!p.fxRate) return fxForm;
                            return (
                              <div data-payment-fx={p.id}>
                                <p className="text-xs text-zinc-500">
                                  {t("finance.fx.paymentRate", {
                                    rate: p.fxRate.toLocaleString(t.intl, {
                                      minimumFractionDigits: 4,
                                      maximumFractionDigits: 4,
                                    }),
                                    currency: p.currency,
                                  })}
                                </p>
                                <details>
                                  <summary className="cursor-pointer text-xs font-medium text-brand-700">
                                    {t("finance.fx.correct")}
                                  </summary>
                                  {fxForm}
                                </details>
                              </div>
                            );
                          })()
                        : "—"}
                    </Td>
                  ) : null}
                  {showTrail ? (
                    <Td className="min-w-40">
                      {paymentTrails[p.id] ? (
                        <AckTrail
                          t={t}
                          summary={paymentTrails[p.id]}
                          showNames={wellmix}
                        />
                      ) : (
                        "—"
                      )}
                    </Td>
                  ) : null}
                  <Td className="whitespace-nowrap text-right">
                    {p.direction === "supplier_out" &&
                    p.status !== "received" &&
                    (user.role === "supplier" || wellmix) ? (
                      <form action={acknowledgePaymentAction}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input
                          type="hidden"
                          name="back"
                          value={`/app/orders/${order.id}`}
                        />
                        <SubmitButton variant="secondary">
                          {t("orders.confirmReceipt")}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </OrderSection>
      ) : null}

      {/* Documentos: um por linha, com a trilha visualizado/confirmado. */}
      <OrderSection id="order-documents" title={t("orders.documents")}>
        {visibleDocs.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t("orderView.col.document")}</Th>
                  <Th>{t("orderView.col.type")}</Th>
                  <Th className="text-right">{t("orderView.col.version")}</Th>
                  <Th>{t("orderView.col.trail")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {visibleDocs.map((d) => (
                  <tr key={d.id} className={rowClass} data-order-document>
                    <Td className="min-w-44">
                      <a
                        href={`/api/files/${d.id}`}
                        className={cx(linkClass, "block max-w-72 truncate")}
                        target="_blank"
                        title={d.name}
                      >
                        {d.name}
                      </a>
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-700">
                      {t(`docType.${d.type}` as DictionaryKey)}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums text-zinc-700">
                      v{d.version}
                    </Td>
                    <Td className="min-w-40">
                      {documentTrails[d.id] ? (
                        <AckTrail
                          t={t}
                          summary={documentTrails[d.id]}
                          showNames={wellmix}
                        />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {documentTrails[d.id] &&
                      d.uploadedByUserId !== user.id ? (
                        confirmedDocs.has(d.id) ? (
                          <span className="text-xs text-emerald-700">
                            ✓ {t("orders.ack.confirmedDoc")}
                          </span>
                        ) : (
                          <form action={acknowledgeDocumentAction}>
                            <input
                              type="hidden"
                              name="documentId"
                              value={d.id}
                            />
                            <input
                              type="hidden"
                              name="back"
                              value={`/app/orders/${order.id}`}
                            />
                            <SubmitTextButton className="min-h-9 text-xs">
                              {t("orders.ack.confirmDoc")}
                            </SubmitTextButton>
                          </form>
                        )
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
              {t("orders.ack.hint")}
            </p>
          </>
        )}
      </OrderSection>

      {/* Multas: uma por linha; nova multa para diretorias e admin (docs/ACCESS.md). */}
      {wellmix || user.role === "legal" || visiblePenalties.length > 0 ? (
        <OrderSection id="order-penalties" title={t("orders.penalties")}>
          {visiblePenalties.length === 0 ? (
            <Empty>{t("penalties.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="text-right">{t("orderView.col.amount")}</Th>
                  <Th>{t("orderView.col.status")}</Th>
                  <Th>{t("orderView.col.reason")}</Th>
                  <Th>{t("orderView.col.partyResponsible")}</Th>
                </tr>
              </thead>
              <tbody>
                {visiblePenalties.map((p) => (
                  <tr key={p.id} className={rowClass} data-order-penalty>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {formatMoney(p.amount, p.currency, t)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={p.status === "open" ? "danger" : "neutral"}>
                        {t(`penaltyStatus.${p.status}`)}
                      </Badge>
                    </Td>
                    <Td className="min-w-56 text-zinc-700">{p.reason}</Td>
                    <Td className="whitespace-nowrap">
                      {partyName(p.responsiblePartyId)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {wellmix && canOpen(user, "penalties") ? (
            <details className="mt-3 rounded-xl border border-zinc-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800 [&::-webkit-details-marker]:hidden">
                {t("orders.penalty.new")}
              </summary>
              <form
                action={createPenaltyAction}
                className="grid gap-2 border-t border-zinc-200 p-3 sm:grid-cols-2"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <div className="sm:col-span-2">
                  <Field label={t("orders.penalty.reason")}>
                    <Textarea name="reason" required rows={2} />
                  </Field>
                </div>
                <Field label={t("orders.value")}>
                  <MoneyInput
                    locale={t.intl}
                    name="amount"
                    watchField="currency"
                    required
                    className="w-full"
                  />
                </Field>
                <Field label={t("common.currency")}>
                  <CurrencySelect name="currency" value="BRL" t={t} />
                </Field>
                <Field label={t("orders.penalty.responsible")}>
                  <Select name="responsiblePartyId" defaultValue="">
                    <option value="">—</option>
                    {[
                      order.supplierId,
                      order.agencyId,
                      order.brokerId,
                      order.shippingLineId,
                      order.carrierId,
                    ]
                      .filter((v): v is string => !!v)
                      .map((pid) => (
                        <option key={pid} value={pid}>
                          {partyName(pid)}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label={t("orders.penalty.evidence")}>
                  <Input name="evidence" type="file" />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton variant="danger">
                    {t("orders.penalty.new")}
                  </SubmitButton>
                </div>
              </form>
            </details>
          ) : null}
        </OrderSection>
      ) : null}

      {/* Parceiros do pedido (Wellmix): um por linha, com quem está
          designado e o campo para trocar. */}
      {wellmix ? (
        <OrderSection id="order-partners" title={t("orders.partners")}>
          <Table>
            <thead>
              <tr>
                <Th>{t("orderView.col.partnerType")}</Th>
                <Th>{t("orderView.col.partnerNow")}</Th>
                <Th>{t("orderView.col.partnerChange")}</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["agencyId", "agency"],
                  ["brokerId", "broker"],
                  ["shippingLineId", "shipping_line"],
                  ["carrierId", "carrier"],
                  ["comexId", "comex"],
                  ["logisticsId", "logistics"],
                  ["ocpId", "ocp"],
                ] as const
              ).map(([field, type]) => (
                <tr key={field} className={rowClass} data-order-partner={type}>
                  <Td className="whitespace-nowrap font-medium">
                    {t(`party.${type}`)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {order[field] ? partyName(order[field] ?? null) : "—"}
                  </Td>
                  <Td>
                    <form
                      action={assignPartnerAction}
                      className="flex min-w-64 items-center gap-2"
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="field" value={field} />
                      <Select
                        name="partyId"
                        defaultValue={order[field] ?? ""}
                        aria-label={t(`party.${type}`)}
                        className="min-w-0 flex-1"
                      >
                        <option value="">—</option>
                        {parties
                          .filter((p) => p.type === type && p.active)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </Select>
                      <SubmitButton variant="secondary">
                        {t("orders.assign")}
                      </SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </OrderSection>
      ) : null}

      {wellmix ? (
        <div id="snapshot" className="mt-6 min-w-0 scroll-mt-24">
          <SnapshotCard
            t={t}
            snapshot={snapshot}
            orderId={order.id}
            supplierName={partyName(snapshot?.supplierId ?? null)}
            createdBy={userName(snapshot?.createdByUserId ?? null)}
          />
        </div>
      ) : null}

      {admin || user.role === "customer" ? (
        <div className="mt-6 flex min-w-0 flex-col gap-6">
          {admin ? (
            <AdminCancelCard
              t={t}
              order={order}
              money={
                finance
                  ? {
                      received: formatMoney(
                        finance.received,
                        finance.sellCurrency,
                        t,
                      ),
                      paid: formatMoney(finance.paid, finance.fobCurrency, t),
                    }
                  : null
              }
            />
          ) : null}
          {user.role === "customer" ? (
            <CustomerCancelCard
              t={t}
              order={order}
              canRequest={canRequestCancel}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/**
 * Parte da tela do pedido em linhas: título na cor da marca (como no pedido em
 * lista) e o conteúdo (tabela) na largura toda. O id é a âncora do índice.
 */
function OrderSection({
  id,
  title,
  actions,
  children,
}: {
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-6 min-w-0 scroll-mt-24"
      data-order-section={id}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-brand-700">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Itens da inspeção que podem ser refeitos numa nova medição: medidas e fotos. */
function isRemeasurable(r: Requirement) {
  return isInspectionMeasureKey(r.key) || r.type === "photo";
}

function canSeeDoc(user: User, d: Document) {
  if (isWellmix(user)) return true;
  if (d.visibility === "all") return true;
  if (d.visibility === "internal") return false;
  if (d.visibility === "customer") return user.role === "customer";
  if (d.visibility === "supplier") return user.role !== "customer";
  return false;
}

/**
 * Linha de um item da etapa: empilhada (rótulo em cima, formulário embaixo) e,
 * quando o cartão é largo (container query no `<ul>`), lado a lado. `row` é o
 * `<li>`; `side` a coluna do formulário; `note` o aviso "aguardando…".
 */
const ROW_WIDE_XL = {
  row: "@xl:flex-row @xl:items-start @xl:justify-between @xl:gap-4",
  side: "min-w-0 @xl:max-w-[65%] @xl:shrink-0",
  note: "@xl:max-w-56 @xl:shrink-0 @xl:text-right",
};
const ROW_WIDE_3XL = {
  row: "@3xl:flex-row @3xl:items-start @3xl:justify-between @3xl:gap-4",
  side: "min-w-0 @3xl:max-w-[65%] @3xl:shrink-0",
  note: "@3xl:max-w-56 @3xl:shrink-0 @3xl:text-right",
};

function RequirementRow({
  requirement: r,
  order,
  user,
  t,
  doc,
  submittedBy,
  open,
  wellmix,
  remeasure,
  sheetHref,
  sheetEditable,
  sheetHint,
  dateBounds,
  waiting,
}: {
  requirement: Requirement;
  /** Ainda não dá para agir: aguarda outro item (ex.: aprovar a arte antes de ela chegar). */
  waiting?: string | null;
  /** Data: limites vindos das outras datas do pedido. */
  dateBounds?: DateBounds;
  order: {
    id: string;
    customerId: string;
    supplierId: string;
    agencyId: string | null;
    brokerId: string | null;
    shippingLineId: string | null;
    carrierId: string | null;
  };
  user: User;
  t: Translate;
  doc: Document | null;
  submittedBy: string;
  open: boolean;
  wellmix: boolean;
  /** Nova medição: reenvio de um requisito de medida já concluído (inspeção bloqueada). */
  remeasure: boolean;
  /** Ficha de compra: link para a ficha (o item não tem formulário próprio). */
  sheetHref: string | null;
  sheetEditable: boolean;
  /** Ficha: o que falta e se já veio preenchida (cotação ou pedido anterior). */
  sheetHint: {
    missing: string;
    count: number;
    started: boolean;
    source: "quote" | "previous" | "catalog" | "master" | null;
  } | null;
}) {
  const isSheet = r.key === "purchase_sheet";
  const canAct =
    open &&
    !waiting &&
    r.status !== "done" &&
    canSubmitRequirement(user, order as never, r);
  /* Foto/arquivo enviado: dá para excluir e mandar outro enquanto a etapa está aberta. */
  const canClear =
    open &&
    r.status === "done" &&
    (r.type === "photo" || r.type === "file") &&
    canSubmitRequirement(user, order as never, r);
  const canRemeasure =
    remeasure &&
    r.status === "done" &&
    canSubmitRequirement(user, order as never, r);
  /* Inspeção cega: a nota da revisão traz os valores esperados; fora da Wellmix vira texto
     genérico enquanto pendente e some quando resolvida (a reprovação mostra a observação da Wellmix). */
  const note =
    r.key === "inspection_review" && !wellmix && r.note
      ? r.status === "pending"
        ? t("orders.inspection.genericBlock")
        : r.status === "done"
          ? null
          : r.note
      : r.note;
  const tone =
    r.status === "done"
      ? "success"
      : r.status === "rejected"
        ? "danger"
        : "neutral";
  // Formulário ao lado do rótulo só quando o cartão é largo o bastante (container
  // query): os dois botões de arquivo, o aprovar/reprovar e o valor com moeda
  // pedem mais espaço; antes disso, o formulário vai embaixo do rótulo, na
  // largura do cartão.
  const wide =
    r.type === "file" || r.type === "approval" || isMoneyRequirement(r)
      ? ROW_WIDE_3XL
      : ROW_WIDE_XL;
  return (
    <li className={cx("flex flex-col gap-2 py-2.5", wide.row)}>
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">
            {requirementLabel(t, r)}
          </span>
          {!r.required ? (
            <span className="text-xs text-zinc-500">
              ({t("reqStatus.optional")})
            </span>
          ) : null}
          <Badge tone={tone}>{t(`reqStatus.${r.status}`)}</Badge>
          <span className="text-xs text-zinc-500">{t(`role.${r.role}`)}</span>
        </div>
        {r.status !== "pending" ? (
          <div className="mt-0.5 text-xs text-zinc-500">
            {r.type !== "file" &&
            r.type !== "photo" &&
            r.type !== "confirm" &&
            r.type !== "approval" &&
            r.value ? (
              <span className="mr-2 text-zinc-800">
                {formatMoneyValue(r.value, t.intl)}
              </span>
            ) : null}
            {doc ? (
              <TextLink
                href={`/api/files/${doc.id}`}
                target="_blank"
                className="mr-2"
              >
                {doc.name} (v{doc.version})
              </TextLink>
            ) : null}
            {doc && canClear ? (
              <form
                action={clearRequirementDocumentAction}
                data-requirement-clear
                className="mr-2 inline-block align-middle"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="requirementId" value={r.id} />
                <ConfirmDeleteButton
                  label={t("requirement.remove")}
                  confirmText={t("requirement.removeConfirm")}
                  className="h-6! w-6!"
                />
              </form>
            ) : null}
            {t("orders.submitted")}: {submittedBy} ·{" "}
            {formatDate(r.submittedAt, t)}
            {note ? ` · ${note}` : ""}
          </div>
        ) : note ? (
          <p className="mt-0.5 text-xs text-amber-700">{note}</p>
        ) : null}
        {isSheet && r.status !== "done" && sheetHint ? (
          <p className="mt-0.5 text-xs text-zinc-600">
            {sheetHint.source === "quote" ||
            sheetHint.source === "previous" ||
            sheetHint.source === "master"
              ? `${t(`sheet.prefilled.${sheetHint.source}`)} `
              : ""}
            {sheetHint.count > 0 ? (
              <span className="text-amber-700">
                {t("sheet.missingShort", { fields: sheetHint.missing })}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {isSheet ? (
        sheetHref ? (
          <div className={wide.side}>
            <LinkButton
              href={sheetHref}
              variant={
                r.status !== "done" && open && sheetEditable
                  ? "primary"
                  : "secondary"
              }
              className="w-full @sm:w-auto"
            >
              {r.status !== "done" && open && sheetEditable
                ? sheetHint?.started && sheetHint.count > 0
                  ? t("sheet.completeCta", { count: String(sheetHint.count) })
                  : t("sheet.open")
                : t("sheet.view")}
            </LinkButton>
          </div>
        ) : null
      ) : isOrderSignatureKey(r.key) ? (
        // Assinatura: pela página do documento do pedido (só a Wellmix e o
        // fornecedor do pedido chegam a ela).
        isWellmix(user) || user.role === "supplier" ? (
          <div className={wide.side}>
            <LinkButton
              href={`/app/orders/${order.id}/purchase-order`}
              variant={canAct ? "primary" : "secondary"}
              className="w-full @sm:w-auto"
              data-order-sign-link={r.key}
            >
              {canAct ? t("orderSign.open") : t("orderSign.view")}
            </LinkButton>
          </div>
        ) : null
      ) : canAct ? (
        <div className={wide.side}>
          <RequirementForm
            requirement={r}
            orderId={order.id}
            t={t}
            dateBounds={dateBounds}
          />
        </div>
      ) : canRemeasure ? (
        <div className={wide.side}>
          <RequirementForm
            requirement={r}
            orderId={order.id}
            t={t}
            action={r.type === "photo" ? undefined : remeasureAction}
            defaultValue={r.value}
          />
        </div>
      ) : open && waiting && r.status !== "done" ? (
        <p
          className={cx("text-xs text-zinc-500", wide.note)}
          data-requirement-waiting
        >
          {waiting}
        </p>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------------ */
/* Evolução incremental: trilha, snapshot, resultado da inspeção, containers  */
/* ------------------------------------------------------------------------ */

/**
 * Data que espera outra da mesma etapa (ex.: a previsão de chegada só depois
 * da data de embarque, para nunca ficar antes dela): o aviso no lugar do campo.
 */
function dateWaiting(
  t: Translate,
  stageKey: string,
  r: Requirement,
  reqs: Requirement[],
): string | null {
  if (r.type !== "date") return null;
  const pre = datePrerequisite(stageKey, r.key);
  if (!pre) return null;
  return reqs.some((x) => x.key === pre.key && x.status !== "done")
    ? t(`orders.waiting.${pre.code}` as DictionaryKey)
    : null;
}

function formatDateTime(value: string | null | undefined, intl = "pt-BR") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo traduzido de um atributo do snapshot (cai no nome técnico se faltar chave). */
function attrLabel(t: Translate, attribute: string) {
  const key = `orders.inspection.attr.${attribute}` as DictionaryKey;
  const translated = t(key);
  return translated === key ? attribute : translated;
}

/** Enviado → visualizado → confirmado. Nomes só para a Wellmix; os demais veem datas. */
function AckTrail({
  t,
  summary,
  showNames,
}: {
  t: Translate;
  summary: AckSummary;
  showNames: boolean;
}) {
  const who = (name: string | null) =>
    showNames && name ? `${t("orders.ack.by")} ${name} ` : "";
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
      <span className="whitespace-nowrap">
        {t("orders.ack.sent")} {formatDateTime(summary.sentAt, t.intl)}
      </span>
      {" · "}
      <span
        className={cx(
          "whitespace-nowrap",
          summary.viewedAt ? "text-zinc-700" : "text-zinc-400",
        )}
      >
        {t("orders.ack.viewed")}{" "}
        {summary.viewedAt
          ? `${who(summary.viewedBy)}${formatDateTime(summary.viewedAt, t.intl)}`
          : t("orders.ack.pending")}
      </span>
      {" · "}
      <span
        className={cx(
          "whitespace-nowrap",
          summary.confirmedAt ? "text-emerald-700" : "text-zinc-400",
        )}
      >
        {t("orders.ack.confirmed")}{" "}
        {summary.confirmedAt
          ? `${who(summary.confirmedBy)}${formatDateTime(summary.confirmedAt, t.intl)}`
          : t("orders.ack.pending")}
      </span>
    </p>
  );
}

const dims = (
  a: number | null | undefined,
  b: number | null | undefined,
  c: number | null | undefined,
) => (a || b || c ? `${a ?? "—"} × ${b ?? "—"} × ${c ?? "—"}` : "—");

const numOrDash = (v: number | null | undefined, intl = "pt-BR") =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString(intl, { maximumFractionDigits: 4 });

/** "Comprado (snapshot)": o que foi negociado, congelado no pedido. Só Wellmix. */
function SnapshotCard({
  t,
  snapshot,
  orderId,
  supplierName,
  createdBy,
}: {
  t: Translate;
  snapshot: PurchaseSnapshot | null;
  orderId: string;
  supplierName: string;
  createdBy: string;
}) {
  if (!snapshot) {
    return (
      <Card title={t("orders.snapshot.title")}>
        <p className="text-sm text-zinc-600">{t("orders.snapshot.missing")}</p>
        <p className="mt-2 text-xs text-amber-700">
          {t("orders.snapshot.retroWarning")}
        </p>
        <form action={ensureSnapshotAction} className="mt-3">
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton variant="secondary">
            {t("orders.snapshot.generate")}
          </SubmitButton>
        </form>
      </Card>
    );
  }
  const retro = !!snapshot.note;
  return (
    <Card
      title={t("orders.snapshot.title")}
      actions={
        retro ? (
          <Badge tone="warning">{t("orders.snapshot.retroactive")}</Badge>
        ) : null
      }
    >
      <p className="mb-2 text-xs leading-relaxed text-zinc-500">
        {t("orders.snapshot.hint")}
      </p>
      <PairsTable
        items={[
          [t("common.name"), snapshot.name],
          [t("common.supplier"), supplierName],
          [
            t("orders.snapshot.unitPrice"),
            snapshot.unitPrice !== null
              ? `${formatMoney(snapshot.unitPrice, snapshot.currency ?? "USD", t)} / ${snapshot.unit}`
              : "—",
          ],
          [t("common.quantity"), `${snapshot.quantity} ${snapshot.unit}`],
          [t("orders.snapshot.moq"), numOrDash(snapshot.moq, t.intl)],
          [t("orders.snapshot.supplierSku"), snapshot.supplierSku ?? "—"],
          [t("orders.snapshot.material"), snapshot.material ?? "—"],
          [t("orders.snapshot.color"), snapshot.color ?? "—"],
          [t("orders.snapshot.pantone"), snapshot.pantone ?? "—"],
          [
            t("orders.snapshot.dimensions"),
            dims(snapshot.lengthCm, snapshot.widthCm, snapshot.heightCm),
          ],
          [
            t("orders.snapshot.netWeight"),
            numOrDash(snapshot.netWeightKg, t.intl),
          ],
          [
            t("orders.snapshot.grossWeight"),
            numOrDash(snapshot.grossWeightKg, t.intl),
          ],
          [
            t("orders.snapshot.masterBox"),
            numOrDash(snapshot.masterBoxQty, t.intl),
          ],
          [
            t("orders.snapshot.innerBox"),
            // 0 = "Sem caixa inner" (escolhido na ficha).
            snapshot.innerBoxQty === 0
              ? t("carton.inner.none")
              : numOrDash(snapshot.innerBoxQty, t.intl),
          ],
          [
            t("orders.snapshot.boxDimensions"),
            dims(
              snapshot.boxLengthCm,
              snapshot.boxWidthCm,
              snapshot.boxHeightCm,
            ),
          ],
          [t("orders.snapshot.cbm"), numOrDash(snapshot.cbm, t.intl)],
          [t("common.conditions"), snapshot.conditions ?? "—"],
          [
            t("orders.snapshot.registeredAt"),
            `${formatDate(snapshot.createdAt, t)} · ${createdBy}`,
          ],
        ]}
      />
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("orders.snapshot.photos")}
        </p>
        {snapshot.photoDocumentIds.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            {t("orders.snapshot.noPhotos")}
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {snapshot.photoDocumentIds.map((docId) => (
              <a
                key={docId}
                href={`/api/files/${docId}`}
                target="_blank"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                <img
                  src={`/api/files/${docId}`}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
      {snapshot.note ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>{t("orders.snapshot.note")}:</strong> {snapshot.note}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Relatório da inspeção (só Wellmix): resultado, medidas × comprado, fotos,
 * decisão da revisão, divergências registradas e linha do tempo.
 */
function InspectionResultCard({
  t,
  report,
  userName,
}: {
  t: Translate;
  report: InspectionReport;
  userName: (id: string | null) => string;
}) {
  const outcomeTone = {
    waiting: "neutral",
    approved: "success",
    accepted: "success",
    divergent: "danger",
    remeasure: "warning",
  } as const;
  const review = report.review;
  const decision = !review
    ? t("inspReport.decision.none")
    : review.status === "pending"
      ? t("inspReport.decision.pending")
      : review.status === "rejected"
        ? t("inspReport.decision.rejected")
        : review.value === "auto"
          ? t("inspReport.decision.auto")
          : t("inspReport.decision.approved");
  const openCount = report.reviews.filter((r) => r.status === "open").length;
  const eventLabel = (action: string) => {
    const key = `inspReport.event.${action}` as DictionaryKey;
    const text = t(key);
    return text === key ? action : text;
  };
  return (
    <Card
      title={t("orders.inspection.title")}
      actions={
        <Badge tone={outcomeTone[report.outcome]}>
          {t(`inspReport.outcome.${report.outcome}`)}
        </Badge>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("inspReport.hint")}
      </p>

      <h3 className="mb-2 text-sm font-semibold text-zinc-900">
        {t("inspReport.measures")}
      </h3>
      {report.rows.length === 0 ? (
        <Empty>{t("inspReport.noMeasures")}</Empty>
      ) : (
        <>
          {!report.hasReference ? (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("inspReport.noReference")}
            </p>
          ) : null}
          <Table>
            <thead>
              <tr>
                <Th>{t("orders.inspection.attribute")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.expected")}
                </Th>
                <Th className="text-right">{t("orders.inspection.found")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.tolerance")}
                </Th>
                <Th>{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => {
                const c = row.comparison;
                return (
                  <tr key={row.requirement.id} className={rowClass}>
                    <Td className="font-medium">
                      {attrLabel(t, row.attribute)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {row.attribute === "innerBoxQty" && c?.expected === 0
                        ? t("carton.inner.none")
                        : typeof c?.expected === "number"
                          ? c.expected.toLocaleString(t.intl, {
                              maximumFractionDigits: 4,
                            })
                          : (c?.expected ?? "—")}
                    </Td>
                    <Td
                      className={cx(
                        "text-right tabular-nums",
                        c && !c.ok && "font-semibold text-red-700",
                      )}
                    >
                      {row.requirement.value}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {c?.tolerancePercent != null
                        ? `${c.tolerancePercent.toLocaleString(t.intl, { maximumFractionDigits: 2 })}%`
                        : "—"}
                    </Td>
                    <Td>
                      {row.awaitingRemeasure ? (
                        <Badge tone="warning">
                          {t("inspReport.awaitingRemeasure")}
                        </Badge>
                      ) : !c ? (
                        <Badge tone="neutral">
                          {t("inspReport.noExpected")}
                        </Badge>
                      ) : (
                        <Badge tone={c.ok ? "success" : "danger"}>
                          {c.ok
                            ? t("orders.inspection.ok")
                            : t("orders.inspection.divergent")}
                        </Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-zinc-500">
            {t("orders.inspection.measuredBy")}:{" "}
            {userName(report.rows[0].requirement.submittedByUserId)} ·{" "}
            {formatDateTime(report.rows[0].requirement.submittedAt, t.intl)}
          </p>
        </>
      )}

      {report.photos.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">
            {t("inspReport.photos")}
          </h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {report.photos.map((p) => (
              <li key={p.id}>
                <a
                  href={`/api/files/${p.documentId}`}
                  target="_blank"
                  className="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition hover:border-brand-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${p.documentId}`}
                    alt={requirementLabel(t, p)}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>
                <p className="mt-1 text-xs text-zinc-600">
                  {requirementLabel(t, p)}
                  {p.status === "rejected" ? (
                    <span className="ml-1 text-amber-700">
                      · {t("inspReport.awaitingRemeasure")}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Decisão da revisão numa linha. */}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">
          {t("inspReport.decision")}
        </h3>
        <Table>
          <thead>
            <tr>
              <Th>{t("inspReport.decision")}</Th>
              <Th>{t("orderView.col.trail")}</Th>
            </tr>
          </thead>
          <tbody>
            <tr className={rowClass} data-inspection-decision>
              <Td className="min-w-56 text-zinc-800">{decision}</Td>
              <Td className="text-xs text-zinc-500">
                {review && review.status !== "pending" ? (
                  <>
                    {review.value !== "auto"
                      ? `${userName(review.submittedByUserId)} · `
                      : ""}
                    {formatDateTime(review.submittedAt, t.intl)}
                    {review.note ? ` · ${review.note}` : ""}
                  </>
                ) : (
                  "—"
                )}
              </Td>
            </tr>
          </tbody>
        </Table>
      </div>

      {/* Divergências: uma por linha. */}
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("inspReport.divergences")}
            {openCount > 0 ? (
              <span className="ml-2">
                <Badge tone="warning">{openCount}</Badge>
              </span>
            ) : null}
          </h3>
          {openCount > 0 ? (
            <TextLink href="/app/reviews" className="text-xs">
              {t("orders.inspection.reviewsLink")} →
            </TextLink>
          ) : null}
        </div>
        {report.reviews.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {t("inspReport.noDivergences")}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("inspReport.col.problem")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.expected")}
                </Th>
                <Th className="text-right">{t("orders.inspection.found")}</Th>
                <Th>{t("inspReport.col.when")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("inspReport.resolvedBy")}</Th>
              </tr>
            </thead>
            <tbody>
              {report.reviews.map((r) => (
                <tr
                  key={r.id}
                  className={cx(
                    rowClass,
                    r.status === "open" && "bg-amber-50/60",
                  )}
                >
                  <Td className="min-w-44 font-medium text-zinc-900">
                    {r.problem}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {r.expected ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium tabular-nums text-red-700">
                    {r.found ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-zinc-600">
                    {formatDateTime(r.createdAt, t.intl)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={r.status === "open" ? "warning" : "success"}>
                      {t(`reviews.status.${r.status}`)}
                    </Badge>
                  </Td>
                  <Td className="min-w-40 text-xs text-zinc-500">
                    {r.status !== "open" ? (
                      <>
                        {userName(r.resolvedByUserId)} ·{" "}
                        {formatDateTime(r.resolvedAt, t.intl)}
                        {r.resolutionNote ? ` · ${r.resolutionNote}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {report.timeline.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
            {t("inspReport.timeline")} ({report.timeline.length})
          </summary>
          <div className="mt-2">
            <Table>
              <thead>
                <tr>
                  <Th>{t("inspReport.col.event")}</Th>
                  <Th>{t("inspReport.col.detail")}</Th>
                  <Th>{t("inspReport.col.who")}</Th>
                </tr>
              </thead>
              <tbody>
                {report.timeline.map((e) => (
                  <tr key={e.id} className={rowClass}>
                    <Td className="whitespace-nowrap font-medium text-zinc-800">
                      {eventLabel(e.action)}
                    </Td>
                    <Td className="min-w-56 text-xs text-zinc-600">
                      {e.summary.replace(/^INSPECTION:\s*/, "")}
                      {e.action === "requirement.submit" &&
                      e.after &&
                      typeof e.after === "object" &&
                      "value" in e.after &&
                      (e.after as { value: unknown }).value
                        ? ` = ${String((e.after as { value: unknown }).value)}`
                        : ""}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-zinc-500">
                      {userName(e.userId)} ·{" "}
                      {formatDateTime(e.createdAt, t.intl)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Módulo cliente 2: pós-venda e "comprar de novo / nova proposta"            */
/* ------------------------------------------------------------------------ */

/** Nota 1–5 como estrelas (texto acessível junto). */
function Stars({ rating, t }: { rating: number | null; t: Translate }) {
  if (rating === null)
    return <span className="text-zinc-500">{t("afterSales.notRated")}</span>;
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${rating}/5`}
      title={`${rating}/5`}
    >
      <span className="tracking-tight text-amber-500" aria-hidden>
        {"★".repeat(filled)}
        <span className="text-zinc-300">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="text-xs font-semibold tabular-nums text-zinc-700">
        {rating}/5
      </span>
    </span>
  );
}

/** Botão grande de escolha única (rádio escondido; visual pelo estado :checked). */
function ChoiceButton({
  name,
  value,
  label,
  defaultChecked,
  required,
  wide,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
          wide ? "min-w-20" : "w-10",
        )}
      >
        {label}
      </span>
    </label>
  );
}

/**
 * Pós-venda do pedido: o cliente (dono) responde enquanto "open"; depois as
 * respostas ficam visíveis para ele e para a Wellmix, que encerra com observação.
 * Pedido entregue/encerrado sem registro (anterior ao recurso): a Wellmix abre.
 */
function AfterSalesCard({
  t,
  afterSales,
  orderId,
  user,
  wellmix,
  answeredBy,
}: {
  t: Translate;
  afterSales: AfterSales | null;
  orderId: string;
  user: User;
  wellmix: boolean;
  answeredBy: string;
}) {
  if (!afterSales) {
    return (
      <Card title={t("orders.afterSales.title")}>
        <p className="text-sm text-zinc-600">
          {t("orders.afterSales.openHint")}
        </p>
        <form action={openAfterSalesAction} className="mt-2">
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton variant="secondary">
            {t("orders.afterSales.open")}
          </SubmitButton>
        </form>
      </Card>
    );
  }
  const status = afterSales.status;
  const tone =
    status === "open" ? "warning" : status === "answered" ? "info" : "success";
  const canAnswer = status === "open" && user.role === "customer";
  const interest = (v: AfterSales["repurchaseInterest"]) =>
    v ? t(`orders.afterSales.repurchase.${v}`) : "—";
  return (
    <Card
      title={t("orders.afterSales.title")}
      actions={
        <Badge tone={tone}>{t(`orders.afterSales.status.${status}`)}</Badge>
      }
    >
      <p className="mb-2 text-xs leading-relaxed text-zinc-500">
        {t("orders.afterSales.hint")}
      </p>

      {canAnswer ? (
        <form action={answerAfterSalesAction} className="space-y-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="afterSalesId" value={afterSales.id} />
          {/* As duas escolhas lado a lado; os textos em 2 colunas. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="text-sm font-medium text-zinc-800">
                {t("orders.afterSales.rating")}
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <ChoiceButton
                    key={n}
                    name="rating"
                    value={String(n)}
                    label={String(n)}
                    required
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {t("orders.afterSales.ratingHint")}
              </p>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="text-sm font-medium text-zinc-800">
                {t("orders.afterSales.repurchase")}
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(["yes", "maybe", "no"] as const).map((v) => (
                  <ChoiceButton
                    key={v}
                    name="repurchaseInterest"
                    value={v}
                    label={t(`orders.afterSales.repurchase.${v}`)}
                    wide
                  />
                ))}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("orders.afterSales.experience")}>
              <Textarea name="experience" rows={2} maxLength={2000} />
            </Field>
            <Field label={t("orders.afterSales.problems")}>
              <Textarea name="problems" rows={2} maxLength={2000} />
            </Field>
            <Field label={t("orders.afterSales.perceivedCosts")}>
              <Textarea name="perceivedCosts" rows={2} maxLength={2000} />
            </Field>
            <Field label={t("orders.afterSales.suggestions")}>
              <Textarea name="suggestions" rows={2} maxLength={2000} />
            </Field>
          </div>
          <div className="border-t border-zinc-100 pt-3">
            <SubmitButton pendingText="...">
              {t("orders.afterSales.submit")}
            </SubmitButton>
          </div>
        </form>
      ) : status === "open" ? (
        <p className="text-sm text-zinc-600">
          {t("orders.afterSales.waitingCustomer")}
        </p>
      ) : (
        <>
          {user.role === "customer" && status === "answered" ? (
            <div className="mb-3">
              <Alert tone="success">{t("orders.afterSales.thanks")}</Alert>
            </div>
          ) : null}
          <PairsTable
            items={[
              [
                t("orders.afterSales.rating"),
                <Stars key="s" rating={afterSales.rating} t={t} />,
              ],
              [
                t("orders.afterSales.repurchase"),
                interest(afterSales.repurchaseInterest),
              ],
              [t("orders.afterSales.experience"), afterSales.experience ?? "—"],
              [t("orders.afterSales.problems"), afterSales.problems ?? "—"],
              [
                t("orders.afterSales.perceivedCosts"),
                afterSales.perceivedCosts ?? "—",
              ],
              [
                t("orders.afterSales.suggestions"),
                afterSales.suggestions ?? "—",
              ],
              [
                t("orders.afterSales.answeredAt"),
                `${formatDateTime(afterSales.answeredAt, t.intl)}${
                  wellmix ? ` · ${answeredBy}` : ""
                }`,
              ],
              ...(status === "closed"
                ? ([
                    [
                      t("orders.afterSales.closedAt"),
                      formatDateTime(afterSales.closedAt, t.intl),
                    ],
                    [t("orders.afterSales.notes"), afterSales.notes ?? "—"],
                  ] as [string, ReactNode][])
                : []),
            ]}
          />
        </>
      )}

      {wellmix && status !== "closed" ? (
        <form
          action={closeAfterSalesAction}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="afterSalesId" value={afterSales.id} />
          <div className="min-w-0 flex-1 basis-64">
            <Field
              label={t("orders.afterSales.notes")}
              hint={t("orders.afterSales.closeHint")}
            >
              <Textarea name="notes" rows={2} maxLength={2000} />
            </Field>
          </div>
          {/* Alinhado à caixa de texto (a dica fica embaixo dela). */}
          <SubmitButton variant="secondary" className="sm:mb-6">
            {t("orders.afterSales.close")}
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}

/**
 * "Comprar de novo" (reposição) e "Quero nova proposta": abre uma solicitação
 * pré-preenchida a partir deste pedido. Mostra só o preço de venda (nunca FOB).
 */
async function FollowUpCard({
  t,
  order,
  item,
  photoDocumentId,
  derived,
  wellmix,
}: {
  t: Translate;
  order: Order;
  item: OrderItem;
  photoDocumentId: string | null;
  derived: RequestRow[];
  wellmix: boolean;
}) {
  /* Solicitação derivada cujo pedido foi cancelado aparece como "Pedido cancelado". */
  const [{ quoteSlaBusinessDays }, cancelledOrders] = await Promise.all([
    getSettings(),
    cancelledOrderIds(derived.map((r) => r.orderId)),
  ]);
  const slaDate = quoteSlaDeadline(quoteSlaBusinessDays);
  const unitSell =
    order.sellPrice !== null && item.quantity > 0
      ? order.sellPrice / item.quantity
      : null;
  return (
    <Card title={t("orders.followup.title")}>
      <p className="mb-2 text-xs leading-relaxed text-zinc-500">
        {t("orders.followup.hint")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {photoDocumentId ? (
          <a
            href={`/api/files/${photoDocumentId}`}
            target="_blank"
            className="block shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={`/api/files/${photoDocumentId}`}
              alt={item.name}
              loading="lazy"
              className="h-20 w-20 rounded-xl border border-zinc-200 bg-zinc-50 object-cover"
            />
          </a>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-1 text-center text-[11px] text-zinc-400">
            {t("orders.followup.noPhoto")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <PairsTable
            items={[
              [t("common.product"), item.name],
              [
                t("orders.followup.lastQuantity"),
                `${item.quantity} ${item.unit}`,
              ],
              [
                t("orders.followup.lastPrice"),
                unitSell !== null
                  ? `${formatMoney(unitSell, order.sellCurrency, t)} / ${item.unit}`
                  : "—",
              ],
              [t("orders.followup.lastDate"), formatDate(order.createdAt, t)],
            ]}
          />
        </div>
      </div>
      {/* Quantidade e prazo do tamanho do que se digita; observações ao lado. */}
      <form
        action={createFollowUpRequestAction}
        className="mt-3 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,9rem)_minmax(0,12rem)_minmax(0,1fr)]"
      >
        <input type="hidden" name="orderId" value={order.id} />
        <Field label={t("orders.followup.newQuantity")}>
          <Input
            name="quantity"
            type="number"
            min="0.01"
            step="any"
            required
            defaultValue={item.quantity}
          />
        </Field>
        {/* Prazo = SLA da Wellmix; o servidor recalcula para o cliente. */}
        <Field
          label={t("requests.deadline")}
          hint={t(wellmix ? "sla.wellmixHint" : "sla.customerHint", {
            days: quoteSlaBusinessDays,
          })}
        >
          {wellmix ? (
            <Input name="deadline" type="date" defaultValue={slaDate} />
          ) : (
            <Input
              type="date"
              value={slaDate}
              readOnly
              aria-readonly="true"
              className="bg-zinc-50 text-zinc-700"
            />
          )}
        </Field>
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <Field label={t("orders.followup.notes")}>
            <Textarea name="notes" rows={2} maxLength={2000} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <SubmitButton name="origin" value="replenishment" pendingText="...">
            {t("orders.followup.buyAgain")}
          </SubmitButton>
          <SubmitButton
            name="origin"
            value="proposal"
            variant="secondary"
            pendingText="..."
          >
            {t("orders.followup.newProposal")}
          </SubmitButton>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500 sm:col-span-2 lg:col-span-3">
          {t("orders.followup.buyAgainHint")}
        </p>
      </form>
      {derived.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("orders.followup.derived")}
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {derived.map((r) => {
              const status = requestDisplayStatus(r, cancelledOrders);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 px-3 py-2"
                >
                  <TextLink href={`/app/requests/${r.id}`} className="min-w-0">
                    {r.productName} · {r.quantity} {r.unit}
                  </TextLink>
                  {r.origin && r.origin !== "manual" ? (
                    <Badge tone="brand">{t(`orders.origin.${r.origin}`)}</Badge>
                  ) : null}
                  <Badge tone={requestStatusTone(status)}>
                    {t(`reqStatusLabel.${status}`)}
                  </Badge>
                  <span className="text-xs text-zinc-500">
                    {formatDate(r.createdAt, t)}
                  </span>
                  {/* O link fica também no pedido cancelado (histórico). */}
                  {r.orderId ? (
                    <TextLink
                      href={`/app/orders/${r.orderId}`}
                      className="text-xs"
                    >
                      {t("requests.viewOrder")} →
                    </TextLink>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
