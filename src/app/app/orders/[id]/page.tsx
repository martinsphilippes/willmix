import { OrderProgressCard } from "@/components/order-progress-card";
import { isProgressBlock } from "@/lib/flow-progress";
import { listByIds } from "@/lib/db/lookup";
import { ColorLines } from "@/components/color-lines";
import { registerOrderInvoiceAction } from "../../actions/order-invoice";
import { setPurchaseIncotermAction } from "../../actions/purchase-order";
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
import { dieCutHref, dieCutItemOf } from "@/lib/die-cut-step";
import {
  DOWN_PAYMENT_KEY,
  SKU_APPROVED_KEY,
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  isAutoGateKey,
  isLeadTimeKey,
  isSampleOrderKey,
  itemIdOf,
  laneInputKeys,
  supplierLaneView,
  supplierSeesLaneRequirement,
} from "@/lib/purchase-lanes";
import { canViewDieCut, negotiatedTerms } from "@/lib/services/die-cut-step";
import {
  canActOnLane,
  laneRoute,
  loadRoutingContext,
  routeLabel,
  seesLaneTask,
} from "@/lib/services/cert-art-routing";
import { ASSIGN_HREF, type MissingAssignment } from "@/lib/assign-href";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { OrderRoundsSection } from "./_components/rounds";
import {
  canSeeInternalCosts,
  canSeeSellPrice,
  canSeeSupplier,
  canViewOrder,
  canViewRequest,
  isOrderCertifier,
  isPartner,
  isWellmix,
} from "@/lib/auth/permissions";
import { partRowFor, stageRowFor, stageVisibleTo } from "@/lib/order-view";
import {
  myOrderTimeline,
  myProgress,
  myStageRow,
  timelineMineOnly,
} from "@/lib/services/order-timeline";
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
  ORDER_SIGN_SEND,
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
} from "@/lib/workflow/stages";
import { signSendBlockers } from "@/lib/services/order-signature";
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
import { inspectionReport } from "@/lib/services/inspection-report";
import {
  InspectionResultCard,
  formatDateTime,
} from "@/components/inspection-result-card";
import { getSnapshotForOrder } from "@/lib/services/snapshots";
import { variantSnapshotSummary } from "@/lib/services/variant-sales";
import { getSettings } from "@/lib/settings";
import { quoteSlaDeadline } from "@/lib/sla";
import { getAfterSales } from "@/lib/services/after-sales";
import { getT } from "@/i18n/server";
import { productNameText, requirementLabel, type Translate } from "@/i18n";
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
import { cancelOrderAction } from "../../actions/order-cancel";
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
import { FreightOrderCard } from "@/components/freight-order-card";
import { can } from "@/lib/auth/function-access";

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
    freight: freightNotice,
    freightN,
    rounds: roundsSpawned,
    incoterm: incotermNotice,
    from: fromBlock,
  } = await searchParams;
  // Etapa aberta na tabela de etapas (?stage=CHAVE ou ?stage=all).
  const stageParam = typeof stageQuery === "string" ? stageQuery : null;
  // Pedido de antes da inversão da arte: arte da agência, aprovação do fornecedor.
  await normalizePackaging(id);
  // Pedido de compra: papel das tarefas de arte e certificado coerente com
  // quem as recebe (corrige as abertas antes de 14/11/2026, sem duplicar).
  await (await import("@/lib/services/purchase-order")).normalizeLaneRoles(id);
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
  // Pedido de compra (docs/PURCHASE_ORDER.md): a Preparação traz as três
  // raias e "Arte e embalagem" é o contrato com as duas assinaturas.
  const purchaseFlow = progress.order.flow === "supplier_request";
  const stageName = (key: string) =>
    purchaseFlow && (key === "PREPARATION" || key === "PACKAGING")
      ? t(`purchaseOrder.stage.${key}` as DictionaryKey)
      : t(`stage.${key}` as DictionaryKey);
  // Linha da etapa na tabela "Etapas do pedido" (pedido do dono, 13/11/2026):
  // no pedido de compra a etapa 2 aparece como "Die-Cut, Arte e Certificação";
  // o quadro da etapa e o resto da tela seguem com o nome de sempre.
  const stageRowName = (key: string) =>
    purchaseFlow && key === "PREPARATION"
      ? t("purchaseOrder.stageRow.PREPARATION")
      : stageName(key);
  const store = getStore();
  const wellmix = isWellmix(user);
  /* Certificadora (OCP) do pedido: vê tudo do pedido para gerar o selo
     (decisão do dono, 10/11/2026): cliente, fornecedor, itens com foto e
     preço de compra, a ficha inteira, o documento do pedido, as
     certificações já registradas e os arquivos. Só lê. O financeiro da
     Wellmix (preço de venda, margem, pagamentos) não é do pedido dela. */
  // O despachante do pedido certifica (dono, 13/11/2026): vê o mesmo.
  const certifier = isOrderCertifier(user, progress.order);
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
  /* Visão do fornecedor na Preparação do pedido de compra (pedido do dono,
     13/11/2026): só a faca, a foto em alta e o prazo de produção de cada
     produto, e o campo do prazo já vem com o prazo registrado na solicitação
     ou na negociação. Só traz o valor: ele confere e envia, como antes. */
  const supplierLanes = purchaseFlow && user.role === "supplier";
  const registeredTerms =
    supplierLanes &&
    requirements.some((r) => isLeadTimeKey(r.key) && r.status !== "done")
      ? await negotiatedTerms(order)
      : null;
  // "Enviar para assinatura" (pedidos novos): o que ainda falta (arte, selo).
  const signSend = requirements.find((r) => r.key === ORDER_SIGN_SEND);
  const sendBlockers =
    signSend && signSend.status !== "done"
      ? await signSendBlockers(order.id, signSend.stageId)
      : [];
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
  /* Amostras depois da inspeção (docs/SAMPLE_FLOW.md): passos e divisão. */
  const samplesSteps = purchaseFlow
    ? await importFlow.importFlowView(user, order, "samples")
    : [];
  const samplesSplit =
    samplesSteps.length && (isWellmix(user) || user.role === "supplier")
      ? await (await import("@/lib/services/sample-flow")).samplesSplitOf(order)
      : [];
  const realMediaVisible =
    samplesSteps.length > 0 &&
    (isWellmix(user) || user.role === "marketing_agency");
  /* Fatura ativa em N dias (mapa R24): depois do BL conferido. */
  const invoiceDue =
    purchaseFlow && isWellmix(user) && !order.invoicedAt
      ? await (
          await import("@/lib/services/supplier-invoice")
        ).invoiceDueOf(order)
      : null;
  /* Documentos do embarque: a Wellmix, o fornecedor e a marítima do pedido. */
  const shippingDocsVisible =
    purchaseFlow &&
    [
      "INSPECTION",
      "SHIPPING",
      "CUSTOMS",
      "TRANSPORT",
      "DELIVERED",
      "CLOSED",
    ].includes(order.status) &&
    (await import("@/lib/services/shipping-docs")).canView(user, order);
  /* Container na origem (pedido de compra, mapa R19 a R26). */
  const originSteps =
    purchaseFlow &&
    [
      "INSPECTION",
      "SHIPPING",
      "CUSTOMS",
      "TRANSPORT",
      "DELIVERED",
      "CLOSED",
    ].includes(order.status)
      ? await importFlow.importFlowView(user, order, "origin")
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
  // O memorial (PDF) fica sempre junto do selo, no quadro em destaque.
  const certSteps = certAll.filter(
    (v) => v.template.seal || classicCert || v.template.key === "cert_memorial",
  );
  /* Visão interna: o que falta designar para cada tarefa da certificação ter
     dono (docs/CERTIFICATION.md, "Quem recebe cada tarefa"), e o pedido de
     compra cujos produtos não exigem certificação (nada vira pendência). */
  const certMissingDesigner =
    certSteps.find((v) => v.assignee?.missing === "designer")?.assignee ?? null;
  const certMissingAnalyst = certSteps.some(
    (v) => v.assignee?.missing === "analyst",
  );
  const certNotNeeded =
    wellmix &&
    certSteps.length > 0 &&
    order.flow === "supplier_request" &&
    !(await importFlow.purchaseNeedsCertification(order));
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
    partiesOfOrder,
    storedItems,
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
    // Parceiros do pedido e os das listas de troca (agência, despachante...,
    // poucos). Antes: a tabela inteira, ~32 mil (clientes e fornecedores).
    Promise.all([
      listByIds(store, "parties", [
        order.customerId,
        order.supplierId,
        order.agencyId,
        order.brokerId,
        order.shippingLineId,
        order.carrierId,
        order.comexId,
        order.logisticsId,
        order.ocpId,
      ]),
      store.list("parties", {
        filter: {
          type: [
            "agency",
            "broker",
            "shipping_line",
            "carrier",
            "comex",
            "logistics",
            "ocp",
            "marketing_agency",
          ],
        },
      }),
    ]),
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
  // Responsáveis de multas e fornecedor da compra podem ser outros parceiros.
  const known = new Map(partiesOfOrder.flat().map((p) => [p.id, p]));
  for (const p of await listByIds(
    store,
    "parties",
    [
      ...penalties.map((x) => x.responsiblePartyId),
      snapshot?.supplierId,
    ].filter((id) => id && !known.has(id)),
  ))
    known.set(p.id, p);
  // Nome de exemplo ("Produto novo XPTO") ou vazio: a tela mostra "Produto
  // sem nome" (docs/PURCHASE_ORDER.md, "Nome de exemplo"); o dado não muda.
  const items = storedItems.map((i) => ({
    ...i,
    name: productNameText(t, i.name),
  }));
  const parties = [...known.values()];
  const partyName = (pid: string | null) =>
    (pid && known.get(pid)?.name) || "—";
  /* Arte, validação, certificado e arte final do pedido de compra (dono,
     14/11/2026): cada uma com o login que a recebe. Quem não a recebe não a
     vê, nem na linha do tempo nem nos detalhes da etapa; o administrador vê
     todas, com quem está cada uma e o que falta designar. */
  const laneCtx = purchaseFlow ? await loadRoutingContext() : null;
  const laneInfo = new Map<string, LaneRowInfo>();
  if (laneCtx)
    for (const r of requirements) {
      const route = laneRoute(r.key, order, laneCtx, requirements);
      if (!route) continue;
      const missing =
        route.missing && route.missing !== "ocp" ? route.missing : null;
      laneInfo.set(r.id, {
        sees: seesLaneTask(user, r.key, order, laneCtx, requirements),
        canAct: canActOnLane(user, r.key, order, laneCtx, requirements),
        // Sem a certificadora, ninguém faz o certificado: só falta designar.
        who:
          missing === "certifier"
            ? null
            : route.party
              ? partyName(route.party.partyId)
              : ((await routeLabel(route, laneCtx)) ??
                t("certFlow.assignee.team")),
        missing,
      });
    }
  /** Itens que este login vê (as quatro tarefas, só quem as recebe). */
  const visibleReqs = <T extends { id: string }>(list: T[]) =>
    laneInfo.size ? list.filter((r) => laneInfo.get(r.id)?.sees ?? true) : list;
  /* Os arquivos que a tarefa usa, de tarefas que este login pode não ver:
     a validação traz a arte enviada; a arte final, a arte validada e o
     certificado (o selo). */
  const laneInputsOf = (r: Requirement): LaneInput[] =>
    laneCtx
      ? laneInputKeys(r.key, requirements).flatMap((input) => {
          const doc = docById(input.documentId);
          return doc ? [{ label: input.label, doc }] : [];
        })
      : [];
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
  // Pendente de decisão do dono (docs/PARTNER_ACCESS.md, "Em aberto"): aqui o
  // cliente e o fornecedor ainda veem todas as multas do pedido, com o nome
  // do responsável; a tela Multas já mostra a cada login só as da empresa dele.
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
  /* Cancelamento: o admin e quem tem a permissão "Cancelar pedido" (Equipe →
     Funções e acessos); o acerto financeiro continua só do admin. O cliente
     pede até a produção começar. */
  const isCancelled = order.status === "CANCELLED";
  const admin = user.role === "admin";
  const canCancel = can(user, "order.cancel");
  // Inspeção do pedido de compra: SKU reprovado além do limite de tentativas.
  const maxAttempts = (await getSettings()).purchaseInspectionMaxAttempts;
  const { attemptsExhausted } = await import("@/lib/services/production");
  const exhaustedItems = purchaseFlow
    ? (productionView?.items ?? []).filter((v) =>
        attemptsExhausted(v.latest, maxAttempts),
      )
    : [];
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
  /* Condição de pagamento, Incoterm e câmbio (vêm do Sankhya; só a Wellmix). */
  const paymentCondition =
    wellmix && order.paymentConditionId
      ? await store.get("payment_conditions", order.paymentConditionId)
      : null;
  const commercialItems: Array<[string, ReactNode]> = wellmix
    ? [
        ...(order.incoterm
          ? [[t("orders.incoterm"), order.incoterm] as [string, ReactNode]]
          : []),
        ...(paymentCondition
          ? [
              [
                t("orders.paymentCondition"),
                `${paymentCondition.code} · ${paymentCondition.name}`,
              ] as [string, ReactNode],
            ]
          : []),
        ...(order.fxRate
          ? [
              [
                t("orders.fxRate"),
                new Intl.NumberFormat(t.intl, {
                  maximumFractionDigits: 4,
                }).format(order.fxRate),
              ] as [string, ReactNode],
            ]
          : []),
      ]
    : [];
  /* Resumo do pedido (uma linha): o que este papel pode ver (vazio = não aparece). */
  const orderInfoItems: Array<[ReactNode, ReactNode]> = [
    ...(user.role !== "customer" &&
    (wellmix || user.role === "legal" || certifier)
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
    ...(canSeeInternalCosts(user) || certifier
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
          [
            t("orderInvoice.label"),
            order.invoicedAt ? (
              formatDate(order.invoicedAt, t)
            ) : isCancelled ? (
              "—"
            ) : (
              <form
                key="invoice"
                action={registerOrderInvoiceAction}
                className="inline-flex flex-wrap items-center gap-2"
              >
                {invoiceDue ? (
                  <Badge tone={invoiceDue.late ? "danger" : "warning"}>
                    <span data-invoice-due={invoiceDue.dueAt.slice(0, 10)}>
                      {t("supplierInvoice.due", {
                        date: formatDate(invoiceDue.dueAt, t),
                      })}
                    </span>
                  </Badge>
                ) : null}
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton
                  variant="secondary"
                  pendingText="…"
                  confirmText={t("orderInvoice.confirm")}
                >
                  {t("orderInvoice.register")}
                </SubmitButton>
              </form>
            ),
          ] as [string, ReactNode],
          ...commercialItems,
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
    /* Certificadora: o documento do pedido (itens, preços e condições), para ler. */
    ...(certifier
      ? [
          [
            t("orderSign.link.title"),
            <TextLink
              key="order-document"
              href={`/app/orders/${order.id}/purchase-order`}
            >
              {t("orderSign.link.open")}
            </TextLink>,
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
  /* Login Trading no pedido de compra (pedido do dono, 13/11/2026): a etapa 2
     aparece como "Die-Cut", com o responsável "Fornecedor" (sempre, mesmo
     quando a etapa passa para a Wellmix) e o andamento só das tarefas dele
     (faca, foto em alta e prazo de cada produto), contado do que está
     gravado. A etapa de verdade, o andamento do pedido e a visão da Wellmix
     não mudam. */
  const tradingView =
    supplierLanes && known.get(order.supplierId)?.type === "trading";
  const tradingDieCut = (s: (typeof stages)[number], reqs: Requirement[]) =>
    tradingView && s.key === "PREPARATION" ? supplierLaneView(s, reqs) : null;
  /* Operador da Wellmix (pedido do dono, 14/11/2026): a linha do tempo só
     com as tarefas a fazer que cabem ao login, tarefa a tarefa, inclusive
     dentro das etapas e das partes compartilhadas (regras em
     src/lib/services/order-timeline.ts). As que ainda não estão liberadas
     (esperam outro item ou a etapa começar) aparecem em cinza (decisão do
     dono, 14/11/2026). Situação, andamento e contagem saem das tarefas
     dele; a etapa sai da lista quando ele conclui a última.
     O administrador e os outros papéis veem como antes; o andamento do
     pedido inteiro não muda. */
  const mineOnly = timelineMineOnly(user);
  const myTimeline = mineOnly
    ? await myOrderTimeline(user, {
        order,
        stages: flowStages,
        requirements,
        certSteps,
        importSteps,
        sheetMissing: sheetState ? sheetState.missing.length : null,
        productionOpen: !!productionView && !productionView.allApproved,
        artIssues: artworkView?.items.flatMap((i) => i.issues) ?? [],
        supplierPaymentOpen:
          financeAccess &&
          order.status !== "CLOSED" &&
          order.status !== "CANCELLED",
        receivingOpen: !!receivingView && !receivingView.row?.closedAt,
      })
    : null;
  const myStage = (s: (typeof stages)[number]) =>
    myTimeline?.stages.get(s.id) ?? null;
  /** O operador tem item nesta etapa (liberado ou que vem depois). */
  const myStageOpen = (s: (typeof stages)[number]) => {
    const mine = myStage(s);
    return !!mine && mine.open.length + mine.later.length > 0;
  };
  /* Etapas em linhas: quem vê a etapa abre os detalhes dela; a etapa em
     andamento (ou que ainda aceita dados, como o BL depois do embarque)
     fica aberta sempre. ?stage=CHAVE abre outra; ?stage=all, todas. */
  const stageVisible = (s: (typeof stages)[number]) =>
    stageVisibleTo(
      user,
      s,
      visibleReqs(requirements.filter((r) => r.stageId === s.id)),
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
  // Operador: só as etapas em que ele tem tarefa a fazer abrem (também em
  // "Abrir todas as etapas" e "Ver detalhes").
  const openableStages = flowStages.filter(
    (s) => stageVisible(s) && (!mineOnly || myStageOpen(s)),
  );
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
  // "Comprar de novo" cria uma solicitação: só com a tela Solicitações no
  // perfil (a ação recusa sem ela).
  const showFollowUp =
    customerSide && delivered && !!items[0] && canOpen(user, "requests");
  /* Partes do pedido na tabela de etapas (ordem do negócio): só as que este
     login já vê nos cartões de baixo; cada linha leva ao cartão ou à página. */
  const partsByStage = orderPartsByStage([
    wellmix || (user.role === "supplier" && order.supplierId === user.partyId)
      ? documentPart(
          requirements,
          `/app/orders/${order.id}/purchase-order`,
          stages,
        )
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
  /* Operador: a linha de cada etapa só com tarefa dele dentro dela (nos itens
     da etapa ou numa subetapa); a situação, o andamento e a contagem somam só
     as tarefas dele ali. */
  const myRows = new Map(
    myTimeline
      ? flowStages.map((s) => [
          s.id,
          myStageRow(
            myTimeline,
            s,
            (partsByStage.get(s.key) ?? []).map((part) => part.key),
          ),
        ])
      : [],
  );
  const myRow = (s: (typeof stages)[number]) => myRows.get(s.id) ?? null;
  /** O operador tem alguma tarefa a fazer no pedido (etapa ou subetapa). */
  const myAnything = [...myRows.values()].some((row) => !!row);
  /* Cartões coloridos do alto (como Clientes e Fornecedores): os mesmos
     valores e a mesma regra de quem vê do antigo cartão Financeiro (cliente:
     venda, recebido e a receber; administrador: também compra, pago, a pagar
     e margem). */
  const moneyCards: ColorCard[] =
    finance && (financeAccess || user.role === "customer")
      ? [
          // Valores em dinheiro: o cartão põe a moeda numa linha menor e o
          // número inteiro embaixo (mesmos valores e cálculos de antes).
          {
            key: "sell",
            label: t("orderView.money.sell"),
            money: { amount: finance.sell, currency: finance.sellCurrency },
            tone: "indigo",
          },
          {
            key: "received",
            label: t("orderView.money.received"),
            money: { amount: finance.received, currency: finance.sellCurrency },
            tone: "emerald",
          },
          {
            key: "receivable",
            label: t("orderView.money.receivable"),
            money: {
              amount: finance.receivable,
              currency: finance.sellCurrency,
            },
            tone: "rose",
          },
          ...(wellmix
            ? ([
                {
                  key: "fob",
                  label: t("orderView.money.fob"),
                  money: { amount: finance.fob, currency: finance.fobCurrency },
                  tone: "slate",
                },
                {
                  key: "paid",
                  label: t("orderView.money.paid"),
                  money: {
                    amount: finance.paid,
                    currency: finance.fobCurrency,
                  },
                  // Pago em outra moeda: à parte, na moeda dele.
                  sub: Object.keys(finance.paidOther).length
                    ? Object.entries(finance.paidOther).map(([c, v]) => (
                        <span key={c} className="block" data-paid-other={c}>
                          + {formatMoney(v, c, t)}
                        </span>
                      ))
                    : undefined,
                  tone: "sky",
                },
                {
                  key: "payable",
                  label: t("orderView.money.payable"),
                  money: {
                    amount: finance.payable,
                    currency: finance.fobCurrency,
                  },
                  tone: "orange",
                },
                {
                  key: "margin",
                  label: t("orderView.money.margin"),
                  // Cancelado não é venda: sem margem (como na tela Financeiro).
                  ...(finance.margin !== null && !isCancelled
                    ? {
                        money: {
                          amount: finance.margin,
                          currency: finance.sellCurrency,
                          approx: finance.estimated,
                        },
                      }
                    : { value: "—" }),
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
              {stageName(order.status)}
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
                      ["marketing_agency", order.marketingAgencyId ?? null],
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
      {/* Linha do tempo do pedido entre os blocos (docs/FLOW_MENU.md). */}
      {wellmix ? (
        <OrderProgressCard
          orderId={order.id}
          stages={stages}
          focus={isProgressBlock(fromBlock) ? fromBlock : null}
          t={t}
          locale={t}
        />
      ) : null}
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
      {/* Programação de compra: rodadas do pedido pai ou a rodada deste filho. */}
      {purchaseFlow ? (
        <OrderRoundsSection
          order={order}
          wellmix={wellmix}
          spawned={
            typeof roundsSpawned === "string" && /^\d+$/.test(roundsSpawned)
              ? Number(roundsSpawned)
              : null
          }
          t={t}
        />
      ) : null}
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
        <CancelRequestAlert t={t} order={order} admin={canCancel} />
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
          telas de Clientes, Fornecedores e o pedido em lista). O índice
          "Ir para" saiu por decisão do dono: a tabela Etapas do pedido já
          leva a cada parte. */}

      {moneyCards.length ? (
        <ColorCards name="order" items={moneyCards} intl={t.intl} />
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
                {canSeeInternalCosts(user) || certifier ? (
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
                      {/* Variações de cor: cada cor na própria linha, do
                          mesmo produto (a soma é a quantidade do item). */}
                      <ColorLines
                        colors={i.colors}
                        name={i.name}
                        unit={i.unit}
                        intl={t.intl}
                      />
                    </Td>
                    <Td className="min-w-40">{variantCell(i)}</Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {i.quantity.toLocaleString(t.intl)} {i.unit}
                    </Td>
                    {canSeeInternalCosts(user) || certifier ? (
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
              // Operador: os detalhes da etapa abrem quando há item dele na
              // etapa; a tarefa só de subetapa abre pela linha da subetapa.
              const details = visible && (!mineOnly || myStageOpen(s));
              // Só o que este login vê (arte e certificado: quem recebe).
              const reqs = visibleReqs(
                requirements.filter((r) => r.stageId === s.id),
              );
              // Fornecedor e parceiros: só as linhas que são do próprio
              // login (a numeração continua a do fluxo inteiro).
              // Operador da Wellmix: só as etapas e partes com tarefa dele.
              const mineRow = mineOnly ? myRow(s) : null;
              const ownStage = mineOnly
                ? !!mineRow
                : stageRowFor(user, s, reqs);
              const ownParts = (partsByStage.get(s.key) ?? []).filter((part) =>
                mineOnly
                  ? !!mineRow?.parts.includes(part.key)
                  : partRowFor(user, part.key),
              );
              if (!ownStage && !ownParts.length) return null;
              const open = s.status === "active" || s.status === "blocked";
              const expanded = expandedStageIds.has(s.id);
              // Login Trading: a etapa 2 como "Die-Cut", com o andamento dele.
              const dieCut = tradingDieCut(s, reqs);
              // Operador: situação, andamento e contagem das tarefas dele.
              const mine = mineRow?.progress ?? null;
              const status = mine?.status ?? dieCut?.status ?? s.status;
              const rowName = dieCut
                ? t("purchaseOrder.dieCut.title")
                : stageRowName(s.key);
              const completedAt = mine
                ? null
                : dieCut
                  ? dieCut.completedAt
                  : s.completedAt;
              return (
                <Fragment key={s.id}>
                  {ownStage ? (
                    <tr
                      className={cx(
                        rowClass,
                        status === "active" && "bg-brand-50/60",
                        status === "blocked" && "bg-amber-50/70",
                      )}
                      data-stage-row={s.key}
                      data-stage-status={status}
                    >
                      <Td className="w-10">
                        <StepDot state={status}>{index + 1}</StepDot>
                      </Td>
                      <Td className="min-w-40">
                        <span
                          className={cx(
                            status === "pending"
                              ? "text-zinc-500"
                              : status === "active"
                                ? "font-semibold text-brand-800"
                                : status === "blocked"
                                  ? "font-semibold text-amber-900"
                                  : "font-medium text-zinc-900",
                          )}
                        >
                          {details ? (
                            <a
                              href={stageHref(s)}
                              className="transition hover:text-brand-700"
                            >
                              {rowName}
                            </a>
                          ) : (
                            rowName
                          )}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={stageTone(status)}>
                          {dieCut && status === "done"
                            ? t("purchaseOrder.dieCut.done")
                            : t(`stageStatus.${status}`)}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-zinc-700">
                        {visible ? (
                          <span
                            className="inline-flex items-center gap-1"
                            data-stage-responsible={s.key}
                          >
                            {dieCut
                              ? t("role.supplier")
                              : t(`role.${s.responsibleRole}`)}
                            {(() => {
                              // Mensagem para o responsável da etapa (Wellmix: a
                              // empresa; quem é de fora: a Wellmix), já com a etapa escrita.
                              const chat = stageChat(
                                order,
                                s.responsibleRole,
                                wellmix,
                              );
                              const draft = t("orderView.stage.chatDraft", {
                                stage: dieCut
                                  ? t("purchaseOrder.dieCut.title")
                                  : stageName(s.key),
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
                          visible &&
                            open &&
                            !dieCut?.complete &&
                            isOverdue(s.dueAt)
                            ? "font-semibold text-red-700"
                            : "text-zinc-700",
                        )}
                      >
                        {visible && s.dueAt ? formatDate(s.dueAt, t) : "—"}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums text-zinc-700">
                        {visible && completedAt
                          ? formatDate(completedAt, t)
                          : "—"}
                      </Td>
                      <Td className="w-32">
                        {open || mine ? (
                          <span className="flex items-center gap-2">
                            <span className="w-16">
                              <Progress
                                percent={
                                  mine?.percent ?? dieCut?.percent ?? s.percent
                                }
                              />
                            </span>
                            <span
                              className="text-xs font-semibold tabular-nums text-zinc-600"
                              data-stage-percent={s.key}
                            >
                              {mine?.percent ?? dieCut?.percent ?? s.percent}%
                            </span>
                          </span>
                        ) : status === "done" ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            100%
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums text-zinc-700">
                        {mine
                          ? t("orderView.stage.reqs", {
                              done: mine.done,
                              total: mine.total,
                            })
                          : visible && dieCut
                            ? t("orderView.stage.reqs", {
                                done: dieCut.done,
                                total: dieCut.total,
                              })
                            : visible && reqs.length
                              ? t("orderView.stage.reqs", {
                                  done: reqs.filter((r) => r.status === "done")
                                    .length,
                                  total: reqs.length,
                                })
                              : "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {details ? (
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
                  {ownParts.map((part) => {
                    // Operador: a parte com a situação e a contagem dele.
                    const minePart = mineOnly
                      ? myTimeline?.parts[part.key]
                      : null;
                    const partState = minePart
                      ? myProgress(minePart).status
                      : part.state;
                    // Só o que vem depois: em cinza.
                    const partMuted = !!minePart && minePart.open === 0;
                    const partTotal = minePart
                      ? minePart.open + minePart.later + minePart.done
                      : 0;
                    const partCount =
                      minePart && partTotal > 0
                        ? { done: minePart.done, total: partTotal }
                        : !minePart && part.total
                          ? { done: part.done ?? 0, total: part.total }
                          : null;
                    return (
                      <tr
                        key={part.key}
                        className={cx(rowClass, "bg-zinc-50/60")}
                        data-order-part={part.key}
                        data-order-part-state={partState}
                      >
                        <Td className="w-10 text-center text-zinc-400">↳</Td>
                        <Td className="min-w-40">
                          <a
                            href={part.href}
                            className={cx(
                              "font-medium transition hover:text-brand-700",
                              partMuted ? "text-zinc-500" : "text-zinc-800",
                            )}
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
                              partState === "done"
                                ? "success"
                                : partState === "active"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {t(
                              `orderParts.state.${partState}` as DictionaryKey,
                            )}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-zinc-700">
                          {t(`orderParts.who.${part.key}` as DictionaryKey)}
                        </Td>
                        <Td colSpan={3} className="text-xs text-zinc-600">
                          {part.detail ?? "—"}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums text-zinc-700">
                          {partCount
                            ? t("orderView.stage.reqs", partCount)
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
                    );
                  })}
                </Fragment>
              );
            })}
            {/* Operador sem tarefa neste pedido: diz isso e quem responde. */}
            {mineOnly && !myAnything ? (
              <tr data-stage-mine-empty>
                <Td colSpan={9} className="text-sm text-zinc-600">
                  {t("orderView.mine.empty")}
                  {order.ownerUserId
                    ? ` ${t("orderView.mine.owner", { name: userName(order.ownerUserId) })}`
                    : ""}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        {mineOnly ? (
          <p
            className="mt-1.5 text-xs text-zinc-500 print:hidden"
            data-stage-mine-hint
          >
            {t("orderView.mine.hint")}
          </p>
        ) : null}
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
            // Pedido de compra, fornecedor: só a faca, a foto em alta e o prazo.
            const supplierView = supplierLanes && stage.key === "PREPARATION";
            // Operador da Wellmix: só as tarefas abertas dele na etapa.
            const mine = mineOnly ? (myRow(stage)?.progress ?? null) : null;
            // As que vêm depois ficam em cinza, na ordem da etapa.
            const mineIds = new Set(
              [
                ...(myStage(stage)?.open ?? []),
                ...(myStage(stage)?.later ?? []),
              ].map((r) => r.id),
            );
            const laterIds = new Set(
              (myStage(stage)?.later ?? []).map((r) => r.id),
            );
            const shownReqs = mineOnly
              ? reqs.filter((r) => mineIds.has(r.id))
              : supplierView
                ? reqs.filter(supplierSeesLaneRequirement)
                : visibleReqs(reqs);
            // Login Trading: a etapa 2 como "Die-Cut", com o andamento dele.
            const dieCut = tradingDieCut(stage, reqs);
            const status = mine?.status ?? dieCut?.status ?? stage.status;
            return (
              <Fragment key={stage.id}>
                <Card
                  className={cx(
                    "mt-4",
                    status === "active" &&
                      "border-brand-300! ring-4 ring-brand-50",
                    status === "blocked" &&
                      "border-amber-400! ring-4 ring-amber-50",
                  )}
                  title={
                    <span
                      id={`stage-${stage.id}`}
                      className="flex scroll-mt-24 flex-wrap items-center gap-2"
                      data-stage-card={stage.key}
                      data-stage-status={status}
                    >
                      {dieCut
                        ? t("purchaseOrder.dieCut.title")
                        : stageName(stage.key)}
                      <Badge tone={stageTone(status)}>
                        {dieCut && status === "done"
                          ? t("purchaseOrder.dieCut.done")
                          : t(`stageStatus.${status}`)}
                      </Badge>
                      {open && !dieCut?.complete && stage.dueAt ? (
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
                          <span
                            className="font-semibold text-zinc-700"
                            data-stage-card-responsible={stage.key}
                          >
                            {dieCut
                              ? t("role.supplier")
                              : t(`role.${stage.responsibleRole}`)}
                          </span>
                        </span>
                        <span
                          className="w-24"
                          data-stage-card-percent={
                            mine?.percent ?? dieCut?.percent ?? stage.percent
                          }
                        >
                          <Progress
                            percent={
                              mine?.percent ?? dieCut?.percent ?? stage.percent
                            }
                          />
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
                  <p
                    className="mb-2 text-xs leading-relaxed text-zinc-500"
                    data-stage-help={supplierView ? "supplier" : undefined}
                  >
                    {supplierView
                      ? t("dieCut.stageHelp.supplier")
                      : t(`help.stage.${stage.key}`)}
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
                      {shownReqs.map((r) => requirementLabel(t, r)).join(" · ")}
                    </p>
                  ) : (
                    <ul
                      className="@container divide-y divide-zinc-100"
                      data-stage-tasks={stage.key}
                    >
                      {/* Pedido de compra: os quatro itens do fornecedor também
                          ficam juntos, produto a produto, no quadro Die Cut. */}
                      {purchaseFlow &&
                      !mineOnly &&
                      stage.key === "PREPARATION" &&
                      canViewDieCut(user, progress.order) &&
                      reqs.some((r) => dieCutItemOf(r.key)) ? (
                        <li
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                          data-die-cut-link
                        >
                          <span className="text-sm text-zinc-600">
                            {t(
                              supplierView
                                ? "dieCut.orderHint.supplier"
                                : "dieCut.orderHint",
                            )}
                          </span>
                          <LinkButton
                            href={dieCutHref(order.id)}
                            variant={
                              user.role === "supplier" &&
                              reqs.some(
                                (r) =>
                                  dieCutItemOf(r.key) && r.status !== "done",
                              )
                                ? "primary"
                                : "secondary"
                            }
                          >
                            {reqs.some(
                              (r) => dieCutItemOf(r.key) && r.status !== "done",
                            )
                              ? t("dieCut.open")
                              : t("dieCut.view")}
                          </LinkButton>
                        </li>
                      ) : null}
                      {shownReqs.map((r) => (
                        <RequirementRow
                          key={r.id}
                          requirement={r}
                          order={order}
                          user={user}
                          t={t}
                          lane={laneInfo.get(r.id) ?? null}
                          laneInputs={laneInputsOf(r)}
                          muted={laterIds.has(r.id)}
                          // O prazo registrado para o item só preenche o campo.
                          defaultValue={
                            supplierView && isLeadTimeKey(r.key)
                              ? (r.value ??
                                registeredTerms
                                  ?.get(itemIdOf(r.key) ?? "")
                                  ?.days?.toString() ??
                                null)
                              : null
                          }
                          waiting={
                            r.key === "art_approval" &&
                            reqs.some(
                              (x) => x.key === "art" && x.status !== "done",
                            )
                              ? t("packaging.waitingArt")
                              : r.key === ORDER_SIGN_SEND && sendBlockers.length
                                ? // Só envia com a arte e o selo prontos.
                                  t(`orderSign.send.missing.${sendBlockers[0]}`)
                                : r.key === ORDER_SIGNED_WELLMIX &&
                                    reqs.some(
                                      (x) =>
                                        x.key === ORDER_SIGN_SEND &&
                                        x.status !== "done",
                                    )
                                  ? t("orderSign.send.waitSend")
                                  : r.key === ORDER_SIGNED_SUPPLIER &&
                                      reqs.some(
                                        (x) =>
                                          x.key === ORDER_SIGNED_WELLMIX &&
                                          x.status !== "done",
                                      )
                                    ? t("orderSign.send.waitWellmix")
                                    : ((purchaseFlow
                                        ? laneWaiting(t, r, reqs)
                                        : null) ??
                                      dateWaiting(t, stage.key, r, reqs))
                          }
                          gateHref={
                            purchaseFlow && wellmix
                              ? gateHrefOf(order.id, r, items)
                              : null
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
        {/* Frete marítimo pedido às companhias (só a Wellmix). */}
        {wellmix && order.status !== "CANCELLED" ? (
          <FreightOrderCard
            t={t}
            user={user}
            orderId={order.id}
            notice={typeof freightNotice === "string" ? freightNotice : null}
            count={
              typeof freightN === "string" && /^\d{1,3}$/.test(freightN)
                ? Number(freightN)
                : 0
            }
            error={typeof error === "string" ? error : null}
          />
        ) : null}
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

        {/* Inspeção do pedido de compra (mapa R10): tentativas esgotadas, a
            Wellmix confirma o cancelamento com a mensagem ao fornecedor. */}
        {wellmix && exhaustedItems.length && order.status !== "CANCELLED" ? (
          <div id="inspection-cancel" className="scroll-mt-24">
            <Alert tone="danger">
              <div className="space-y-2" data-inspection-cancel>
                <p className="font-semibold">{t("inspectionCancel.title")}</p>
                <p>
                  {t("inspectionCancel.body", {
                    items: exhaustedItems.map((v) => v.item.name).join(", "),
                    n: String(Math.max(...exhaustedItems.map((v) => v.rounds))),
                    max: String(maxAttempts),
                  })}
                </p>
                {canCancel ? (
                  <form action={cancelOrderAction} className="space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input
                      type="hidden"
                      name="reason"
                      value="quality_rejected"
                    />
                    <Field label={t("inspectionCancel.message")}>
                      <Textarea
                        name="note"
                        required
                        minLength={3}
                        maxLength={1000}
                        rows={3}
                        className="bg-white"
                      />
                    </Field>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="confirm"
                        value="1"
                        required
                        className="mt-0.5"
                      />
                      <span>{t("inspectionCancel.confirm")}</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton variant="danger">
                        {t("inspectionCancel.submit")}
                      </SubmitButton>
                      <LinkButton
                        href="/app/booking/selection"
                        variant="secondary"
                      >
                        {t("inspectionCancel.selection")}
                      </LinkButton>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs">
                    {t("inspectionCancel.noPermission")}
                  </p>
                )}
              </div>
            </Alert>
          </div>
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

        {/* Incoterm do pedido de compra (mapa R17?): EXW abre a transportadora
            e os custos de origem antes do container na fábrica. */}
        {purchaseFlow && isWellmix(user) && originSteps.length ? (
          <Card title={t("exw.title")} dense>
            <p className="mb-3 text-sm text-zinc-600">{t("exw.hint")}</p>
            {incotermNotice === "saved" ? (
              <div className="mb-3">
                <Alert tone="success">{t("exw.saved")}</Alert>
              </div>
            ) : null}
            <form
              action={setPurchaseIncotermAction}
              className="flex flex-wrap items-end gap-2"
              data-incoterm-form
            >
              <input type="hidden" name="orderId" value={order.id} />
              <Select
                name="incoterm"
                defaultValue={order.incoterm === "EXW" ? "EXW" : "FOB"}
                aria-label={t("exw.title")}
              >
                <option value="FOB">FOB</option>
                <option value="EXW">EXW</option>
              </Select>
              <SubmitButton variant="secondary">{t("exw.save")}</SubmitButton>
            </form>
          </Card>
        ) : null}
        {/* Container na origem (mapa R19 a R26): vazio na fábrica, carregamento,
            lacre e número, volta ao porto e o rastreio diário do Comex interno. */}
        {originSteps.length ? (
          <ImportFlowCard
            t={t}
            order={order}
            steps={originSteps}
            names={productionNames}
            title={t("originFlow.title")}
            anchor="container-origin"
            error={stepCard === "container-origin" ? stepError : null}
            notice={
              typeof importNotice === "string" &&
              ["submitted", "validated", "rejected"].includes(importNotice)
                ? t(`importFlow.done.${importNotice}` as DictionaryKey)
                : null
            }
          />
        ) : null}
        {/* Amostras (mapa R12 a R16): retirada, envios ao Brasil (4 × 3 × Nm)
            e à China (1 × 3 × Nm), recebimento, fotos reais e devolução. */}
        {samplesSteps.length ? (
          <div id="samples" className="min-w-0 scroll-mt-24 space-y-3">
            <Card title={t("samplesFlow.title")} dense>
              <p className="mb-3 text-sm text-zinc-600">
                {t("samplesFlow.hint")}
              </p>
              {samplesSplit.length ? (
                <Table tools={false}>
                  <thead>
                    <tr>
                      <Th>{t("samplesFlow.col.product")}</Th>
                      <Th className="text-right">
                        {t("samplesFlow.col.brazil")}
                      </Th>
                      <Th className="text-right">
                        {t("samplesFlow.col.china")}
                      </Th>
                      <Th className="text-right">
                        {t("samplesFlow.col.total")}
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {samplesSplit.map((l) => (
                      <tr key={l.itemId} data-sample-split={l.itemId}>
                        <Td>{productNameText(t, l.name)}</Td>
                        <Td className="text-right" data-split-brazil>
                          {l.brazil}
                        </Td>
                        <Td className="text-right" data-split-china>
                          {l.china}
                        </Td>
                        <Td className="text-right">{l.total}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : null}
              {realMediaVisible ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-600">
                    {t("realMedia.orderHint")}
                  </p>
                  <LinkButton
                    href={`/app/orders/${order.id}/real-media`}
                    variant="secondary"
                    data-real-media-link
                  >
                    {t("realMedia.open")}
                  </LinkButton>
                </div>
              ) : null}
            </Card>
            <ImportFlowCard
              t={t}
              order={order}
              steps={samplesSteps}
              names={productionNames}
              title={t("samplesFlow.title")}
              anchor="samples-flow"
              error={stepCard === "samples-flow" ? stepError : null}
              notice={
                typeof importNotice === "string" &&
                ["submitted", "validated", "rejected"].includes(importNotice)
                  ? t(`importFlow.done.${importNotice}` as DictionaryKey)
                  : null
              }
            />
          </div>
        ) : null}
        {/* Documentos do embarque (docs/SHIPPING_DOCS.md): check list de carga,
            packing list, invoice e BL conferidos pelo sistema. */}
        {shippingDocsVisible ? (
          <Card title={t("shippingDocs.open")} dense>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600">
                {t("shippingDocs.orderHint")}
              </p>
              <LinkButton
                href={`/app/orders/${order.id}/shipping-docs`}
                variant="secondary"
                data-shipping-docs-link
              >
                {t("shippingDocs.open")}
              </LinkButton>
            </div>
          </Card>
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
          // O selo e a arte com o selo vêm primeiro (é o que libera o pedido).
          // Laudo e registro saíram da tela (o PDF do memorial/selo basta,
          // dono 10/11/2026); pedido antigo que já os preencheu continua
          // mostrando, para o dado não sumir.
          steps={[
            ...certSteps.filter((v) => v.template.key.startsWith("cert_seal")),
            ...certSteps.filter(
              (v) =>
                !v.template.key.startsWith("cert_seal") &&
                (v.template.key === "cert_memorial" ||
                  (v.step && v.step.status !== "pending")),
            ),
          ]}
          names={productionNames}
          title={t("certFlow.title")}
          anchor="certification"
          featured={importFlow.CERT_FEATURED_STEPS}
          featuredHint={t("certFlow.featured.hint")}
          error={stepCard === "certification" ? stepError : null}
          hints={[
            ...(certSteps.some((v) => v.template.key === "cert_seal")
              ? [t("certFlow.sealHint")]
              : []),
            // Todo pedido precisa de selo: sem certificadora, a Wellmix designa.
            ...(certNotNeeded
              ? [
                  <span key="no-cert" data-cert-not-needed>
                    {t("certFlow.noCertNeeded")}
                  </span>,
                ]
              : []),
            ...(wellmix && !order.ocpId && certSteps.length && !certNotNeeded
              ? [
                  <span key="no-ocp" data-cert-missing="ocp">
                    {t("certFlow.notify.noOcp.body")}{" "}
                    <a href="#order-partners" className={linkClass}>
                      {t("certFlow.assign.ocp")}
                    </a>
                  </span>,
                ]
              : []),
            // Arte feita pela Wellmix sem designer: quem fica com a aplicação
            // do selo e onde escolher o designer.
            ...(certMissingDesigner && !certNotNeeded
              ? [
                  <span key="no-designer" data-cert-missing="designer">
                    {t("certFlow.missingHint.designer", {
                      who:
                        certMissingDesigner.label ??
                        t("certFlow.assignee.team"),
                    })}{" "}
                    <a href="#artwork" className={linkClass}>
                      {t("certFlow.assign.designer")}
                    </a>
                  </span>,
                ]
              : []),
            ...(certMissingAnalyst && !certNotNeeded
              ? [
                  <span key="no-analyst" data-cert-missing="analyst">
                    {t("certFlow.missingHint.analyst")}{" "}
                    <TextLink href="/app/team#distribute">
                      {t("certFlow.assign.analyst")}
                    </TextLink>
                  </span>,
                ]
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
                  ["marketingAgencyId", "marketing_agency"],
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

      {canCancel || user.role === "customer" ? (
        <div className="mt-6 flex min-w-0 flex-col gap-6">
          {canCancel ? (
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

/** Arte, validação, certificado e arte final: a tarefa vista por este login. */
interface LaneRowInfo {
  /** Este login vê a tarefa (quem a recebe; o administrador, todas). */
  sees: boolean;
  /** Este login pode enviar, trocar o arquivo ou validar. */
  canAct: boolean;
  /** Com quem está (nulo: ninguém faz até designar). */
  who: string | null;
  /** O que falta designar ("Responsável não definido"). */
  missing: MissingAssignment | null;
}

/** Arquivo de outra tarefa que esta usa (ex.: a arte, na validação). */
interface LaneInput {
  label: DictionaryKey;
  doc: { id: string; name: string; version: number };
}

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
  gateHref,
  defaultValue,
  lane,
  laneInputs,
  muted = false,
}: {
  requirement: Requirement;
  /** Arquivos de outras tarefas que esta usa (a arte para validar; a arte e o certificado na arte final). */
  laneInputs?: LaneInput[];
  /**
   * Arte, validação, certificado e arte final do pedido de compra: com quem
   * está, o que falta designar e se este login pode agir (decidido por login).
   */
  lane?: LaneRowInfo | null;
  /**
   * Linha do tempo do operador: tarefa dele que ainda não está liberada
   * (espera outro item ou a etapa começar), em cinza.
   */
  muted?: boolean;
  /**
   * Item conferido pelo sistema (NCM validado, ficha completa, sinal): o
   * atalho para a tela onde a área dona faz a parte dela.
   */
  gateHref?: { href: string; label: DictionaryKey } | null;
  /** Ainda não dá para agir: aguarda outro item (ex.: aprovar a arte antes de ela chegar). */
  waiting?: string | null;
  /** Valor que o campo traz preenchido (quem preenche confere e envia). */
  defaultValue?: string | null;
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
    source: "previous" | "catalog" | "master" | null;
  } | null;
}) {
  const isSheet = r.key === "purchase_sheet";
  // Arte e certificado do pedido de compra: o login que recebe a tarefa.
  const allowed = lane
    ? lane.canAct && canSubmitRequirement(user, order as never, r)
    : canSubmitRequirement(user, order as never, r);
  const canAct = open && !waiting && r.status !== "done" && allowed;
  /* Foto/arquivo enviado: dá para excluir e mandar outro enquanto a etapa está aberta. */
  const canClear =
    open &&
    r.status === "done" &&
    (r.type === "photo" || r.type === "file") &&
    allowed;
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
    <li
      className={cx("flex flex-col gap-2 py-2.5", wide.row)}
      data-requirement-later={muted ? "" : undefined}
    >
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "font-medium",
              muted ? "text-zinc-500" : "text-zinc-900",
            )}
          >
            {requirementLabel(t, r)}
          </span>
          {!r.required ? (
            <span className="text-xs text-zinc-500">
              ({t("reqStatus.optional")})
            </span>
          ) : null}
          <Badge tone={tone}>{t(`reqStatus.${r.status}`)}</Badge>
          {lane ? (
            lane.who ? (
              <span className="text-xs text-zinc-500" data-lane-assignee>
                {t("lane.with", { name: lane.who })}
              </span>
            ) : null
          ) : (
            <span className="text-xs text-zinc-500">{t(`role.${r.role}`)}</span>
          )}
        </div>
        {lane?.missing && wellmix && r.status !== "done" ? (
          <p
            className="mt-0.5 text-xs font-medium text-amber-700"
            data-lane-missing={lane.missing}
          >
            {t("lane.undefined")} · {t(`certFlow.missing.${lane.missing}`)}{" "}
            <TextLink
              href={ASSIGN_HREF[lane.missing](order.id)}
              className="text-brand-700"
            >
              {t(`certFlow.assign.${lane.missing}`)}
            </TextLink>
          </p>
        ) : null}
        {laneInputs?.length ? (
          <div className="mt-0.5 text-xs text-zinc-600" data-lane-inputs>
            {laneInputs.map((input) => (
              <span
                key={input.doc.id}
                className="mr-3 inline-block"
                data-lane-input={input.label}
              >
                {t(input.label)}:{" "}
                <TextLink href={`/api/files/${input.doc.id}`} target="_blank">
                  {input.doc.name} (v{input.doc.version})
                </TextLink>
              </span>
            ))}
          </div>
        ) : null}
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
            {sheetHint.source === "previous" || sheetHint.source === "master"
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
      ) : isSampleOrderKey(r.key) ? (
        // Pedido de amostras: pela página dele (docs/SAMPLE_ORDER.md).
        isWellmix(user) || user.role === "supplier" ? (
          <div className={wide.side}>
            <LinkButton
              href={`/app/orders/${order.id}/samples`}
              variant={
                open &&
                !waiting &&
                r.status !== "done" &&
                canSubmitRequirement(user, order as never, r)
                  ? "primary"
                  : "secondary"
              }
              className="w-full @sm:w-auto"
              data-sample-order-link={r.key}
            >
              {t("sampleOrder.open")}
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
      ) : open && gateHref && !waiting && r.status !== "done" ? (
        <div className={wide.side}>
          <LinkButton
            href={gateHref.href}
            variant="secondary"
            className="w-full @sm:w-auto"
            data-requirement-gate={baseKeyOf(r.key)}
          >
            {t(gateHref.label)}
          </LinkButton>
        </div>
      ) : canAct ? (
        <div className={wide.side}>
          <RequirementForm
            requirement={r}
            orderId={order.id}
            t={t}
            dateBounds={dateBounds}
            defaultValue={defaultValue}
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
 * Pedido de compra: o item espera o anterior da raia ou do contrato (a arte
 * espera a faca e a foto em alta; a arte final, a arte validada e o
 * certificado; o sinal, as duas assinaturas). Diz o que falta.
 */
function laneWaiting(
  t: Translate,
  r: Requirement,
  reqs: Requirement[],
): string | null {
  if (r.status === "done") return null;
  const missing = blockedBy(r.key, reqs);
  if (!missing.length) return null;
  const labels = missing
    .map((k) => reqs.find((x) => x.key === k))
    .filter((x): x is Requirement => !!x)
    .map((x) => requirementLabel(t, x).split(" · ")[0]);
  return t("purchaseSequence.waiting", { items: labels.join(", ") });
}

/** Atalho dos itens que o sistema confere: onde a área dona faz a parte dela. */
function gateHrefOf(
  orderId: string,
  r: Requirement,
  items: Array<{ id: string; productId: string | null }>,
): { href: string; label: DictionaryKey } | null {
  if (!isAutoGateKey(r.key)) return null;
  const base = baseKeyOf(r.key);
  if (base === DOWN_PAYMENT_KEY)
    return {
      href: `/app/orders/${orderId}#supplier-payment`,
      label: "purchaseSequence.gate.downPayment",
    };
  if (base === SKU_APPROVED_KEY)
    return {
      href: `/app/orders/${orderId}#production`,
      label: "purchaseSequence.gate.sku",
    };
  const productId = items.find((i) => i.id === itemIdOf(r.key))?.productId;
  if (!productId) return null;
  return base === LANE_KEYS.ncmValidated
    ? {
        href: `/app/products/${productId}/tax`,
        label: "purchaseSequence.gate.ncm",
      }
    : {
        href: `/app/products/${productId}#photos`,
        label: "purchaseSequence.gate.sheet",
      };
}

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
                    {productNameText(t, r.productName)} · {r.quantity} {r.unit}
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
