"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { MILESTONE_KEYS } from "@/lib/milestones";
import { PRODUCTION_VIDEO_KEY } from "@/lib/purchase-lanes";
import { formatAmount, moneyValue, parseAmount } from "@/lib/workflow/money";
import { CURRENCIES, isCurrency, parseCurrency } from "@/lib/currencies";
import { QUOTE_SLA_MAX_DAYS, QUOTE_SLA_MIN_DAYS } from "@/lib/sla";
import {
  SUPPLIER_REQUEST_SLA_MAX,
  SUPPLIER_REQUEST_SLA_MIN,
} from "@/lib/supplier-requests";
import { getCurrentUser } from "@/lib/auth/session";
import {
  ForbiddenError,
  assertRole,
  assertWellmix,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import { assertAnyScreen, assertScreen, canOpen } from "@/lib/auth/screens";
import { assertCan } from "@/lib/auth/function-access";
import { STOCK_OPTION } from "@/lib/services/stock-party";
import {
  REPLENISHMENT_FROM,
  REPLENISHMENT_QUERY,
  REQUEST_SCREEN,
  isReplenishmentEntry,
  type RequestScreenMode,
} from "@/lib/request-screens";
import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  PAYMENT_EXTRA_DEFAULTS,
  LINE_EXTRA_DEFAULTS,
  ROLES,
  LOCALES,
  type DocumentType,
} from "@/lib/db";
import { isLocale } from "@/i18n";
import { LOCALE_COOKIE, getT } from "@/i18n/server";
import { realName } from "@/lib/placeholder-name";
import {
  productTexts,
  variantSpecificationText,
} from "@/lib/services/request-product-fill";
import { variantsByProduct } from "@/lib/services/product-variants";
import {
  createRequestBatch,
  addProductsToRequest,
  type RequestBatchItem,
} from "@/lib/services/requests";
import {
  assertUploadable,
  discardRequirementUpload,
  registerUploadedDocument,
  registerUploadedPhoto,
  uploadDocument,
} from "@/lib/services/documents";
import {
  canSubmitRequirement,
  decideRequirement,
  submitRequirement,
  unblockMilestone,
} from "@/lib/workflow/engine";
import { audit } from "@/lib/services/audit";
import { requesterTarget, notify } from "@/lib/services/notifications";
import { DEFAULT_SETTINGS, setSetting, type SettingKey } from "@/lib/settings";
import { loginLabel } from "@/lib/auth/login-id";
import { AI_PROMPT_MAX } from "@/lib/ai-references";
import {
  createPortalLogin,
  PORTAL_MIN_PASSWORD,
} from "@/lib/services/portal-access";
import { importCsv } from "@/lib/services/import";
import { confirmSupplierPaymentReceipt } from "@/lib/services/acknowledgements";
import { customerEditHref } from "@/lib/customer-routes";

/* Helpers compartilhados com src/app/app/actions/*.ts */
import {
  field,
  flowReturnTo,
  num,
  requireUser,
  run,
  str,
  withQuery,
} from "./actions/helpers";
import { dieCutHref, dieCutItemOf } from "@/lib/die-cut-step";
import { itemIdOf } from "@/lib/purchase-lanes";
import { assertSameSchedule, parseRequestItems } from "./actions/request-items";
import {
  allContactsBlank,
  contactsFromEntries,
  type CustomerContacts,
  type OrderTerms,
} from "@/lib/order-terms";
import {
  assertScheduleWindow,
  launchDateOf,
  scheduleTotal,
} from "@/lib/workflow/request-schedule";

/* ------------------------------------------------------------------------ */
/* Idioma                                                                    */
/* ------------------------------------------------------------------------ */

export async function setLocaleAction(form: FormData) {
  const locale = str(form, "locale");
  if (isLocale(locale)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    const user = await getCurrentUser();
    if (user) await getStore().update("users", user.id, { locale });
  }
  revalidatePath("/app", "layout");
  // A tela de entrada também troca de idioma (antes do login).
  revalidatePath("/login", "layout");
}

/* ------------------------------------------------------------------------ */
/* Solicitações                                                              */
/* ------------------------------------------------------------------------ */

const requestBaseSchema = z.object({
  customerId: z.string().min(1),
  deadline: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
// Limites iguais às colunas de `requests` (productName 160, unit 20): a validação
// recusa antes de criar qualquer solicitação do lote.
const requestItemSchema = z.object({
  productId: z.string().max(64).optional().nullable(),
  /** Variação escolhida (produto com variações); o serviço confere. */
  variantId: z.string().max(64).optional().nullable(),
  productName: z.string().min(2).max(160),
  description: z.string().min(2).max(10_000),
  specification: z.string().max(10_000).optional().nullable(),
  quantity: z.number().positive().finite(),
  unit: z.string().min(1).max(20),
});

/** Os contatos do cliente do bloco "Cliente" da Nova solicitação (`contact.<área>.*`). */
function contactsFromForm(form: FormData): CustomerContacts {
  return contactsFromEntries((k) => str(form, k), form.keys());
}

/**
 * Nova solicitação com um ou vários produtos (linhas `p<n>.*`). Cada produto
 * vira uma solicitação; com 2 ou mais, todas no mesmo lote.
 */
export async function createRequestAction(form: FormData) {
  await createRequest(form, null);
}

/**
 * TS - Trading Sales (dono, 16/11/2026; docs/REQUEST_SCREENS.md): o mesmo
 * envio, com a tela de TS conferida e o tipo de operação TS gravado (o do
 * formulário é ignorado).
 */
export async function createTsRequestAction(form: FormData) {
  await createRequest(form, "ts");
}

/**
 * Venda - Encomenda (docs/REQUEST_SCREENS.md): o mesmo, com a tela e o tipo
 * Venda. Aberta pelo "+ Adicionar" de Reposição (`from=replenishment`), aceita
 * também a compra para estoque, gravada com a origem reposição.
 */
export async function createSaleRequestAction(form: FormData) {
  await createRequest(form, "sale");
}

/**
 * O envio da Nova solicitação. `screenMode` nulo: a de Encomendas, como
 * sempre. "ts" e "sale": as telas de TS e de Venda, só da Wellmix vendendo
 * ao cliente (sem estoque nem "Adicionar produto"), com a tela conferida e o
 * tipo de operação dela.
 */
async function createRequest(
  form: FormData,
  screenMode: RequestScreenMode | null,
) {
  const user = await requireUser();
  const screenDef = screenMode ? REQUEST_SCREEN[screenMode] : null;
  // Entrada pelo "+ Adicionar" de Reposição (só na tela Venda): a compra para
  // estoque vale e vira reposição (dono, 16/11/2026).
  const replenish =
    screenMode === "sale" &&
    isReplenishmentEntry(str(form, REPLENISHMENT_FROM));
  // "Adicionar produto" numa solicitação existente (Wellmix): mesmo formulário.
  // Só na tela de Encomendas.
  const addToRaw = screenDef ? "" : str(form, "addTo");
  const addTo = /^[A-Za-z0-9_-]{1,64}$/.test(addToRaw) ? addToRaw : "";
  await run(
    screenDef
      ? replenish
        ? `${screenDef.path}?${REPLENISHMENT_QUERY}`
        : screenDef.path
      : addTo
        ? `/app/requests/new?addTo=${addTo}`
        : "/app/requests/new",
    async () => {
      if (screenDef) {
        // TS e Venda: a Wellmix, com a tela marcada no acesso dela.
        if (!isWellmix(user)) throw new ForbiddenError();
        if (replenish && str(form, "customerId") === STOCK_OPTION) {
          // Reposição: a ação "Abrir reposição" e a tela da fila (ou a Venda).
          assertCan(user, "replenishment.open");
          assertAnyScreen(user, ["requests", screenDef.screen]);
        } else assertScreen(user, screenDef.screen);
      } else {
        assertScreen(user, "requests");
        // Só o cliente e a Wellmix criam solicitação: a recusa vem antes de
        // qualquer consulta a produto (a tela pode estar em outro perfil).
        if (!isWellmix(user) && user.role !== "customer")
          throw new ForbiddenError();
      }
      const store = getStore();
      const rows = parseRequestItems(form);
      if (!rows.length) throw new Error("no_products");
      assertSameSchedule(rows);
      // 1ª programação a partir do lançamento + 120 dias e datas em ordem
      // (dono, 15/11/2026), também se a data veio digitada ou trocada na
      // tabela. O lançamento é o gravado: o da solicitação reaberta para
      // acrescentar produtos; na nova, hoje (ela é lançada agora).
      const launch = launchDateOf(
        addTo ? (await store.get("requests", addTo))?.createdAt : null,
      );
      for (const row of rows) assertScheduleWindow(row.schedule, launch);
      const items: RequestBatchItem[] = [];
      // Booking: produtos ainda escondidos do cliente (uma consulta só, e só
      // quando um login de fora da Wellmix manda produto sem nome).
      let hiddenByBooking: Set<string> | null = null;
      // Fichas do catálogo (textos no idioma de quem envia, como na tela).
      const t = await getT();
      for (const row of rows) {
        let productName = row.productName;
        let description = row.description;
        let specification = row.specification;
        const product = row.productId
          ? await store.get("products", row.productId)
          : null;
        if (row.productId && !productName) {
          // Fora da Wellmix, o nome só é copiado de produto que o cliente pode
          // ver (existe, ativo e não escondido pelo Booking). A mesma recusa
          // nos três casos: não dá para descobrir se um produto existe.
          if (!isWellmix(user)) {
            hiddenByBooking ??= await (
              await import("@/lib/services/booking-visibility")
            ).hiddenBookingProductIds();
            if (!product?.active || hiddenByBooking.has(product.id))
              throw new Error("product_unavailable");
          }
          productName = product?.name ?? "";
        }
        // Produto do catálogo (dono, 15/11/2026): nome, descrição e
        // especificação são os da ficha, não editáveis na tela; o que vier
        // diferente no formulário é ignorado. Nome de exemplo ("Produto novo
        // XPTO"): quem pede preenche, como antes.
        if (product && realName(product.name)) {
          const texts = productTexts(t, product);
          productName = texts.productName;
          description = texts.description;
          specification = texts.specification || null;
          if (row.variantId) {
            const variant = (await variantsByProduct([product.id]))
              .get(product.id)
              ?.find((v) => v.id === row.variantId);
            if (variant)
              specification =
                variantSpecificationText(t, product, variant) || null;
          }
        }
        // Os campos de texto saíram da tela do pedido (dono, 16/11/2026):
        // produto do catálogo cuja ficha não tem descrição usa o nome.
        if (product && description.trim().length < 2) description = productName;
        const parsed = requestItemSchema.parse({
          ...row,
          productName,
          description,
          specification,
        });
        items.push({
          productId: parsed.productId ?? null,
          variantId: parsed.productId ? (parsed.variantId ?? null) : null,
          productName: parsed.productName,
          description: parsed.description,
          specification: parsed.specification ?? null,
          quantity: parsed.quantity,
          unit: parsed.unit,
          // Produto fora do catálogo: pede à Wellmix que encontre fornecedores (sourcing sob demanda).
          sourcingDemand: row.sourcingDemand && !parsed.productId,
          // Programação de entregas: a quantidade da solicitação é a soma das entregas.
          schedule: row.schedule,
          ...(row.schedule ? { quantity: scheduleTotal(row.schedule) } : {}),
          companyAllocations: row.companyAllocations,
        });
      }
      // Anexos conferidos antes de criar qualquer solicitação (tipo e tamanho).
      for (const row of rows)
        for (const file of row.attachments) assertUploadable(file);
      if (addTo) {
        const added = await addProductsToRequest(user, addTo, items);
        // Anexos de cada produto fora do catálogo vão para a solicitação dele.
        for (const [i, row] of rows.entries())
          for (const file of row.attachments)
            await uploadDocument(user, file, {
              requestId: added.created[i].id,
              type: "attachment",
              visibility: "internal",
            });
        return `/app/requests/batch/${encodeURIComponent(added.groupId)}?added=${added.created.length}`;
      }
      // Compra para estoque (Wellmix, sem cliente): empresa interna.
      const { ensureStockParty } = await import("@/lib/services/stock-party");
      // TS e Venda vendem ao cliente: a compra para estoque fica em Encomendas
      // (nova solicitação) e na entrada de Reposição da tela Venda.
      if (screenDef && !replenish && str(form, "customerId") === STOCK_OPTION)
        throw new Error("request_screen_stock");
      const forStock =
        isWellmix(user) && str(form, "customerId") === STOCK_OPTION;
      // Reposição é de produto do catálogo (como era o "Abrir reposição").
      if (replenish && forStock && items.some((i) => !i.productId))
        throw new Error("replenishment_product");
      // TS e Venda (dono, 19/11/2026): só produtos da base; o "Produto
      // ainda não está no catálogo" saiu dessas telas.
      if (screenDef && items.some((i) => !i.productId || i.sourcingDemand))
        throw new Error("catalog_only");
      const stockId = forStock ? (await ensureStockParty(user)).id : null;
      const base = requestBaseSchema.parse({
        customerId:
          user.role === "customer"
            ? user.partyId
            : (stockId ?? str(form, "customerId")),
        deadline: str(form, "deadline") || null,
        notes: str(form, "notes") || null,
      });
      // Venda ao cliente pela Wellmix (dono, 15/11/2026; docs/ORDER_TERMS.md):
      // condições do pedido (tipo de operação, formato, entrega, país e
      // grupo), todos os produtos do catálogo do país e do grupo escolhidos,
      // e os contatos do cliente (obrigatórios enquanto o portal nunca os
      // atualizou). Conferido antes de criar qualquer solicitação.
      let orderTerms: OrderTerms | null = null;
      if (isWellmix(user) && !forStock) {
        const {
          resolveOrderTerms,
          assertProductsMatchOrigin,
          resolveRequestPaymentPlan,
        } = await import("@/lib/services/order-terms");
        orderTerms = await resolveOrderTerms(
          {
            operationType: str(form, "operationType"),
            saleFormat: str(form, "saleFormat"),
            wellmixTier: str(form, "wellmixTier"),
            carrierCaller: str(form, "carrierCaller"),
            carrier: str(form, "carrier"),
            redispatchCarrier: str(form, "redispatchCarrier"),
            deliveryFreightBrl: str(form, "deliveryFreightBrl"),
            redispatch: str(form, "redispatch"),
            originCountry: str(form, "originCountry"),
            productFamily: str(form, "productFamily"),
          },
          // TS e Venda: o tipo de operação é o da tela.
          screenDef ? { operationType: screenDef.operation } : {},
        );
        // Forma de pagamento (dono, 16/11/2026): uma das formas ativas.
        orderTerms.paymentPlan = await resolveRequestPaymentPlan(
          str(form, "paymentPlanId"),
        );
        // RCA do pedido (dono, 19/11/2026; docs/CUSTOMER_RCA.md seção 7):
        // o do cliente; sem ele, o que fechou a última venda (30 dias) ou o
        // escolhido pelo vendedor, que entra nos RCAs do cliente.
        const { resolveRequestRca } = await import("@/lib/services/rca");
        orderTerms.rca = await resolveRequestRca(
          user,
          base.customerId,
          field(form, "rcaCode", z.string().max(12)) || null,
        );
        // Login do cliente com acesso: não é mais obrigatório (dono,
        // 18/11/2026). Sem ele, a solicitação vai para todos os logins do
        // cliente (veem, confirmam e recebem o aviso; forAllCustomerLogins).
        await assertProductsMatchOrigin(
          items.map((i) => i.productId),
          orderTerms,
        );
        const { saveCustomerContacts, hasPortalContacts, contactsOptionalFor } =
          await import("@/lib/services/customer-contacts");
        // Solicitante da equipe interna (dono, 18/11/2026): os contatos são
        // opcionais; o que for preenchido continua conferido e gravado.
        const optional = contactsOptionalFor(user);
        const contacts = contactsFromForm(form);
        if (str(form, "contactsEdit") === "1") {
          if (!optional || !allContactsBlank(contacts))
            await saveCustomerContacts(user, base.customerId, contacts);
        } else if (!optional && !(await hasPortalContacts(base.customerId)))
          throw new Error("contacts_required");
      }
      // Pedido para um grupo econômico (dono, 18/11/2026;
      // docs/ECONOMIC_GROUPS.md): as empresas são do grupo que o cliente
      // representa e, em cada produto, a soma delas em cada entrega é a
      // programação. Fora das telas TS e Venda ao cliente, nada vai.
      if (items.some((i) => i.companyAllocations?.length)) {
        if (!screenDef || replenish || forStock || !isWellmix(user))
          for (const i of items) i.companyAllocations = null;
        else {
          const { groupCompanyIds } =
            await import("@/lib/services/economic-groups");
          const { allocationsMatch } = await import("@/lib/economic-group");
          const allowed = await groupCompanyIds(base.customerId);
          for (const i of items) {
            if (!i.companyAllocations?.length) continue;
            const plan = i.schedule?.items.length
              ? i.schedule.items.map((x) => x.quantity)
              : [i.quantity];
            if (!allocationsMatch(i.companyAllocations, plan, allowed))
              throw new Error("allocations");
          }
        }
      }
      // Rascunho enviado: a solicitação nasce com o número reservado nele
      // (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 6). Só o
      // rascunho de quem envia, desta tela; sem ele, um número novo.
      const draftId = str(form, "draftId");
      const draftNumber =
        draftId && isWellmix(user)
          ? ((
              await (
                await import("@/lib/services/request-drafts")
              ).getRequestDraft(user, draftId, screenMode, replenish)
            )?.number ?? undefined)
          : undefined;
      const created = await createRequestBatch(
        user,
        {
          ...base,
          // Wellmix em nome do cliente: o login do cliente que solicitou.
          requestedForUserId:
            isWellmix(user) && !forStock
              ? str(form, "requestedForUserId") || null
              : null,
          orderTerms,
        },
        items,
        {
          // Compra para estoque pela Reposição: a origem é reposição (fila
          // da Reposição); o resto segue como encomenda.
          ...(replenish && forStock ? { origin: "replenishment" } : {}),
          ...(typeof draftNumber === "number" ? { number: draftNumber } : {}),
        },
      );
      // Rascunho enviado (docs/ORDER_TERMS.md seção 9): sai da lista.
      if (draftId && isWellmix(user)) {
        const { deleteRequestDraft } =
          await import("@/lib/services/request-drafts");
        await deleteRequestDraft(user, draftId, screenMode, replenish).catch(
          (error) => console.error("[action] rascunho enviado", error),
        );
      }
      const first = created[0];
      const destination =
        // Reposição aberta pelo "+ Adicionar": volta à fila, com o aviso.
        replenish && forStock && canOpen(user, "requests")
          ? `/app/replenishment?opened=${encodeURIComponent(first.id)}`
          : // TS e Venda: quem não abre Encomendas volta à tela com o aviso.
            screenDef && !canOpen(user, "requests")
            ? `${screenDef.path}?created=${first.number ? String(first.number) : "ok"}`
            : // Sempre a página da solicitação, também com um produto só
              // (dono, 18/11/2026; docs/ORDER_LEVEL_LISTS.md).
              `/app/requests/batch/${encodeURIComponent(first.groupId ?? first.id)}?created=${created.length}`;
      // Só a linha 0 recebe a busca por foto/link e a programação de compra; se
      // o usuário a removeu, não há a que ligar.
      const presetPos = rows.findIndex((r) => r.index === 0);
      const preset = presetPos >= 0 ? created[presetPos] : null;
      try {
        // Programação de compra: a solicitação nasce dela e a programação fica "confirmada".
        const scheduleId = str(form, "scheduleId");
        if (scheduleId && preset && isWellmix(user)) {
          const schedule = await store.get("purchase_schedules", scheduleId);
          // Só a programação do mesmo cliente (a tela preenche o cliente por ela).
          if (
            schedule &&
            !schedule.requestId &&
            (!schedule.customerId || schedule.customerId === preset.customerId)
          )
            await store.update("purchase_schedules", scheduleId, {
              requestId: preset.id,
              status: "confirmed",
            });
        }
        // Anexos de cada produto fora do catálogo vão para a solicitação dele.
        for (const [i, row] of rows.entries()) {
          for (const file of row.attachments) {
            await uploadDocument(user, file, {
              requestId: created[i].id,
              type: "attachment",
              visibility: "internal",
            });
          }
        }
        // Busca por foto/link: a foto enviada vira anexo da solicitação da linha 0.
        const lookupId = str(form, "lookupId");
        if (lookupId && preset) {
          const { attachLookupToRequest } =
            await import("@/lib/services/product-lookup");
          await attachLookupToRequest(user, lookupId, preset.id);
        }
      } catch (error) {
        // As solicitações já existem: leva o usuário até elas com o aviso, em vez
        // de voltar ao formulário vazio (reenviar duplicaria tudo).
        const code =
          error instanceof Error && /^[a-z_]+$/.test(error.message)
            ? error.message
            : "after_create";
        console.error("[action] /app/requests/new (após criar)", error);
        return `${destination}${destination.includes("?") ? "&" : "?"}error=${code}`;
      }
      return destination;
    },
  );
}

/** Wellmix define ou troca o login solicitante (só ele, no cliente, vê a solicitação e o pedido). */
export async function setRequesterAction(form: FormData) {
  const user = await requireUser();
  const requestId = str(form, "requestId");
  await run(`/app/requests/${requestId}`, async () => {
    assertWellmix(user);
    assertScreen(user, "requests");
    const requesterId = z
      .string()
      .max(64)
      .parse(str(form, "requestedForUserId"));
    const { setRequester } = await import("@/lib/services/requests");
    await setRequester(user, requestId, requesterId || null);
    return `/app/requests/${requestId}?saved=requester`;
  });
}

/* ------------------------------------------------------------------------ */
/* Pedidos: requisitos, aprovações, parceiros, pagamentos                    */
/* ------------------------------------------------------------------------ */

export async function submitRequirementAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const requirementId = str(form, "requirementId");
  // Envio feito no quadro Die Cut do pedido: volta para ele (sucesso ou erro).
  const dieCut = str(form, "returnTo") === "die-cut";
  // Tela do passo do menu (docs/FLOW_MENU.md): volta para ela.
  const flow = flowReturnTo(form);
  const back =
    flow ?? (dieCut ? dieCutHref(orderId) : `/app/orders/${orderId}`);
  await run(back, async () => {
    assertScreen(user, "orders");
    const store = getStore();
    const requirement = await store.get("requirements", requirementId);
    if (!requirement || requirement.orderId !== orderId)
      throw new Error("not_found");
    // Confere quem pode preencher antes de subir o arquivo: sem isso, o
    // documento ficaria gravado no pedido mesmo com o envio recusado.
    const order = await store.get("orders", orderId);
    if (!order) throw new Error("not_found");
    if (!canSubmitRequirement(user, order, requirement))
      throw new ForbiddenError();
    // Arte, validação, certificado e arte final do pedido de compra: só o
    // login que recebe a tarefa (antes de subir o arquivo).
    if (order.flow === "supplier_request") {
      const { assertLaneActor } =
        await import("@/lib/services/cert-art-routing");
      await assertLaneActor(user, order, requirement);
    }
    // "Ficha de compra" só se conclui pela própria ficha (campos e foto na balança).
    if (requirement.key === "purchase_sheet")
      throw new Error("use_purchase_sheet");
    let documentId: string | null = null;
    const file = form.get("file");
    const uploadedFileId = str(form, "uploadedFileId");
    // Foto grande (reduzida no aparelho e ainda acima do teto da requisição):
    // já subiu direto ao armazenamento; só imagem vira documento.
    const uploadedPhotoId = str(form, "uploadedPhotoId");
    const type: DocumentType =
      requirement.type === "photo"
        ? "photo"
        : (docTypeForKey(requirement.key) ?? "other");
    if (file instanceof File && file.size > 0) {
      const doc = await uploadDocument(user, file, {
        orderId,
        requirementId,
        type,
        // Vídeo da produção (inspeção do pedido de compra).
        video: requirement.key === PRODUCTION_VIDEO_KEY,
      });
      documentId = doc.id;
    } else if (uploadedFileId) {
      // Arquivo grande: já subiu direto ao armazenamento; aqui só registra.
      z.string()
        .regex(/^[A-Za-z0-9_.-]{1,64}$/)
        .parse(uploadedFileId);
      const doc = await registerUploadedDocument(user, uploadedFileId, {
        orderId,
        requirementId,
        type,
        // Vídeo da produção (inspeção do pedido de compra).
        video: requirement.key === PRODUCTION_VIDEO_KEY,
      });
      documentId = doc.id;
    } else if (uploadedPhotoId) {
      z.string()
        .regex(/^[A-Za-z0-9_.-]{1,64}$/)
        .parse(uploadedPhotoId);
      const doc = await registerUploadedPhoto(user, uploadedPhotoId, {
        orderId,
        requirementId,
        type,
      });
      documentId = doc.id;
    }
    let value =
      requirement.type === "confirm" ? "confirmed" : str(form, "value") || null;
    // Requisito de dinheiro (custos do desembaraço): moeda escolhida + valor.
    if (str(form, "amount") || str(form, "currency")) {
      const amount = parseAmount(str(form, "amount"));
      if (amount === null) throw new Error("money_required");
      value = moneyValue(parseCurrency(str(form, "currency"), "BRL"), amount);
    }
    try {
      await submitRequirement(user, requirementId, {
        value,
        documentId,
        note: str(form, "note") || null,
      });
    } catch (error) {
      // Envio recusado depois de o arquivo subir (etapa fechada, pré-requisito
      // pendente…): o arquivo recém-gravado não fica no pedido como versão nova.
      if (documentId)
        await discardRequirementUpload(requirementId, documentId).catch(
          (cleanupError: unknown) => {
            console.error("submitRequirementAction: limpeza", cleanupError);
          },
        );
      throw error;
    }
    if (flow) return withQuery(flow, "saved", "1");
    if (dieCut) {
      const item = dieCutItemOf(requirement.key);
      return withQuery(
        dieCutHref(orderId, itemIdOf(requirement.key)),
        "saved",
        item === "dieline" || item === "hd" ? item : "terms",
      );
    }
    return orderAnchor(orderId, requirement);
  });
}

/**
 * Volta para o marco do item na tela do pedido (fase 5e: a âncora é do marco,
 * `#milestone-<marco>`; o item sem marco volta para o topo do pedido).
 */
function orderAnchor(
  orderId: string,
  requirement: { milestoneKey?: string | null },
): string {
  const key = requirement.milestoneKey;
  return key && (MILESTONE_KEYS as readonly string[]).includes(key)
    ? `/app/orders/${orderId}#milestone-${key}`
    : `/app/orders/${orderId}#order-stages`;
}

/** Exclui a foto/arquivo de um requisito para enviar outro. */
export async function clearRequirementDocumentAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const requirementId = str(form, "requirementId");
  const dieCut = str(form, "returnTo") === "die-cut";
  const flow = flowReturnTo(form);
  const back =
    flow ?? (dieCut ? dieCutHref(orderId) : `/app/orders/${orderId}`);
  await run(back, async () => {
    assertScreen(user, "orders");
    const requirement = await getStore().get("requirements", requirementId);
    if (!requirement || requirement.orderId !== orderId)
      throw new Error("not_found");
    const { clearRequirementDocument } = await import("@/lib/workflow/engine");
    await clearRequirementDocument(user, requirementId);
    if (flow) return flow;
    if (dieCut) return dieCutHref(orderId, itemIdOf(requirement.key));
    return orderAnchor(orderId, requirement);
  });
}

function docTypeForKey(key: string): DocumentType | null {
  const map: Record<string, DocumentType> = {
    dieline: "dieline",
    label: "label",
    art: "art",
    bl: "bl",
    customs_docs: "customs",
    manual: "manual",
  };
  return map[key] ?? null;
}

export async function decideRequirementAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  // Tela do passo do menu (docs/FLOW_MENU.md): volta para ela.
  const flow = flowReturnTo(form);
  await run(flow ?? `/app/orders/${orderId}`, async () => {
    assertScreen(user, "orders");
    const decision = str(form, "decision") === "approve" ? "approve" : "reject";
    await decideRequirement(
      user,
      str(form, "requirementId"),
      decision,
      str(form, "note") || null,
    );
  });
}

export async function unblockMilestoneAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertScreen(user, "orders");
    const milestone = z.enum(MILESTONE_KEYS).parse(str(form, "milestone"));
    await unblockMilestone(user, orderId, milestone);
  });
}

export async function assignPartnerAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    assertScreen(user, "orders");
    const field = str(form, "field");
    const allowed = [
      "agencyId",
      "brokerId",
      "shippingLineId",
      "carrierId",
      "comexId",
      "logisticsId",
      "ocpId",
      "marketingAgencyId",
    ] as const;
    if (!(allowed as readonly string[]).includes(field))
      throw new Error("invalid_field");
    const partyId = str(form, "partyId") || null;
    const store = getStore();
    const order = await store.get("orders", orderId);
    if (!order) throw new Error("not_found");
    await store.update("orders", orderId, { [field]: partyId });
    // Os itens abertos do Desembaraço, do Embarque e do Transporte que o
    // operador assumiu por falta de parceiro voltam ao papel do parceiro
    // (fase 5g: pelo marco e pela chave do item, sem etapas).
    const roleByField: Record<string, string> = {
      brokerId: "broker",
      shippingLineId: "shipping_line",
      carrierId: "carrier",
    };
    const groupByField: Record<string, string> = {
      brokerId: "CUSTOMS",
      shippingLineId: "SHIPPING",
      carrierId: "TRANSPORT",
    };
    if (groupByField[field]) {
      const { legacyGroupOfItem } = await import("@/lib/milestones");
      const reqs = await store.list("requirements", {
        filter: { orderId, status: "pending" },
      });
      for (const req of reqs) {
        if (req.key === "inspection_review") continue;
        if (legacyGroupOfItem(req, order) !== groupByField[field]) continue;
        await store.update("requirements", req.id, {
          role: (partyId ? roleByField[field] : "operator") as never,
        });
      }
    }
    // Pedido de compra: os itens abertos da arte e do certificado (raias da
    // Preparação) passam para a agência ou o despachante designado (a
    // certificação é dele; dono, 13/11/2026).
    if (field === "agencyId" || field === "brokerId" || field === "ocpId") {
      const updated = await store.get("orders", orderId);
      const { syncLaneRoles } = await import("@/lib/services/purchase-order");
      if (updated) await syncLaneRoles(user, updated);
    }
    if (field === "agencyId") {
      // Arte e embalagem: a arte ainda não enviada passa a ser da agência
      // (ou volta à Wellmix sem agência); a aprovação é sempre do fornecedor.
      const { reassignOrderArt } = await import("@/lib/services/packaging");
      await reassignOrderArt(orderId);
    }
    await audit(
      user,
      "order.assign",
      "order",
      orderId,
      `${field} = ${partyId ?? "—"}`,
    );
    // Selo de certificação: o OCP novo é avisado do selo a emitir; quem
    // passa a fazer a arte, do selo que já chegou. Só quando mudou de fato.
    if (
      (field === "ocpId" || field === "brokerId" || field === "agencyId") &&
      (order[field] ?? null) !== partyId
    ) {
      try {
        const updated = await store.get("orders", orderId);
        const { notifySealPartner } =
          await import("@/lib/services/import-flow");
        if (updated)
          await notifySealPartner(updated, field, order[field] ?? null);
      } catch (error) {
        console.error("[certification] aviso do selo ao parceiro novo", error);
      }
    }
  });
}

export async function registerCustomerPaymentAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = str(form, "back") || `/app/orders/${orderId}`;
  await run(back, async () => {
    assertRole(user, ["admin"]);
    const store = getStore();
    const order = await store.get("orders", orderId);
    if (!order) throw new Error("not_found");
    const parsed = z
      .object({
        amount: z.number().positive(),
        currency: z.enum(CURRENCIES),
        method: z.string().nullable(),
        note: z.string().nullable(),
      })
      .parse({
        amount: num(form, "amount"),
        currency: (
          str(form, "currency") ||
          order.sellCurrency ||
          "BRL"
        ).toUpperCase(),
        method: str(form, "method") || null,
        note: str(form, "note") || null,
      });
    let proofDocumentId: string | null = null;
    const proof = form.get("proof");
    if (proof instanceof File && proof.size > 0) {
      const doc = await uploadDocument(user, proof, {
        orderId,
        type: "proof",
        visibility: "customer",
      });
      proofDocumentId = doc.id;
    }
    const now = new Date().toISOString();
    const payment = await store.create("payments", {
      ...PAYMENT_EXTRA_DEFAULTS,
      orderId,
      requestId: order.requestId,
      direction: "customer_in",
      amount: parsed.amount,
      currency: parsed.currency,
      fxRate: null,
      method: parsed.method ?? "manual",
      status: "confirmed",
      proofDocumentId,
      registeredByUserId: user.id,
      confirmedByUserId: user.id,
      confirmedAt: now,
      note: parsed.note,
    });
    await audit(
      user,
      "payment.customer",
      "payment",
      payment.id,
      `${parsed.currency} ${parsed.amount}`,
    );
    await notify(requesterTarget(order.requestedByUserId), {
      kind: "done",
      link: `/app/orders/${orderId}`,
      text: (t) => ({
        subject: t("notif.customerPayment.subject", { n: order.number }),
        body: t("notif.customerPayment.body", {
          amount: formatAmount(parsed.amount, parsed.currency, t.intl),
        }),
      }),
    });
  });
}

export async function registerSupplierPaymentAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertRole(user, ["admin"]);
    const store = getStore();
    const order = await store.get("orders", orderId);
    if (!order) throw new Error("not_found");
    const parsed = z
      .object({
        amount: z.number().positive(),
        currency: z.enum(CURRENCIES),
        fxRate: z.number().positive().nullable(),
        note: z.string().max(500).nullable(),
        installment: z.number().int().min(1).max(99).nullable(),
      })
      .parse({
        amount: num(form, "amount"),
        currency: (
          str(form, "currency") ||
          order.fobCurrency ||
          "USD"
        ).toUpperCase(),
        fxRate: num(form, "fxRate"),
        note: str(form, "note") || null,
        installment: num(form, "installment"),
      });
    let proofDocumentId: string | null = null;
    const proof = form.get("proof");
    if (proof instanceof File && proof.size > 0) {
      const doc = await uploadDocument(user, proof, {
        orderId,
        type: "proof",
        visibility: "supplier",
      });
      proofDocumentId = doc.id;
    }
    const { registerSupplierPayment } =
      await import("@/lib/services/supplier-payment");
    await registerSupplierPayment(user, orderId, {
      method: "manual",
      ...parsed,
      proofDocumentId,
    });
  });
}

/**
 * Ações rápidas do pagamento ao fornecedor: copiar os dados para o banco ou
 * pedir ao financeiro (e-mail/WhatsApp). O valor é o devido, calculado no
 * servidor (nunca vem do navegador). Conclui "pagamento registrado".
 */
export async function quickSupplierPaymentAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertRole(user, ["admin"]);
    const method = z
      .enum(["transfer_copied", "finance_email", "finance_whatsapp"])
      .parse(str(form, "method"));
    // Parcela que a tela mostrava: clique duplo não paga a seguinte.
    const installment = z
      .number()
      .int()
      .min(1)
      .max(99)
      .nullable()
      .parse(num(form, "installment"));
    const { registerSupplierPayment } =
      await import("@/lib/services/supplier-payment");
    await registerSupplierPayment(user, orderId, { method, installment });
    return `/app/orders/${orderId}?paid=${method}#supplier-payment`;
  });
}

export async function confirmSupplierPaymentAction(form: FormData) {
  const user = await requireUser();
  const paymentId = str(form, "paymentId");
  const back = str(form, "back") || "/app/account";
  await run(back, async () => {
    // Mesma regra de sempre, agora num serviço único que também registra a confirmação ("confirmed").
    await confirmSupplierPaymentReceipt(user, paymentId);
  });
}

export async function createPenaltyAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    assertScreen(user, "penalties");
    const parsed = z
      .object({
        reason: z.string().min(2),
        amount: z.number().nonnegative(),
        currency: z.enum(CURRENCIES),
        responsiblePartyId: z.string().nullable(),
      })
      .parse({
        reason: str(form, "reason"),
        amount: num(form, "amount"),
        currency: (str(form, "currency") || "BRL").toUpperCase(),
        responsiblePartyId: str(form, "responsiblePartyId") || null,
      });
    let evidenceDocumentId: string | null = null;
    const evidence = form.get("evidence");
    if (evidence instanceof File && evidence.size > 0) {
      const doc = await uploadDocument(user, evidence, {
        orderId,
        type: "other",
        visibility: "internal",
      });
      evidenceDocumentId = doc.id;
    }
    const penalty = await getStore().create("penalties", {
      orderId,
      ...parsed,
      evidenceDocumentId,
      status: "open",
      createdByUserId: user.id,
    });
    await audit(user, "penalty.create", "penalty", penalty.id, parsed.reason);
    await notify(
      { role: "legal" },
      {
        kind: "action",
        subject: `Multa registrada no pedido`,
        body: parsed.reason,
        link: `/app/orders/${orderId}`,
      },
    );
  });
}

export async function updatePenaltyStatusAction(form: FormData) {
  const user = await requireUser();
  await run("/app/penalties", async () => {
    assertRole(user, ["admin", "operator", "legal"]);
    assertScreen(user, "penalties");
    const status = str(form, "status");
    if (!["open", "disputed", "paid", "cancelled"].includes(status))
      throw new Error("invalid");
    await getStore().update("penalties", str(form, "penaltyId"), {
      status: status as never,
    });
    await audit(
      user,
      "penalty.status",
      "penalty",
      str(form, "penaltyId"),
      status,
    );
  });
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  // Sem a tela Notificações no perfil, nada a marcar (a tela nem abre).
  if (!canOpen(user, "notifications")) return;
  const store = getStore();
  const unread = await store.list("notifications", {
    filter: { userId: user.id, channel: "inapp", readAt: null },
  });
  const now = new Date().toISOString();
  for (const n of unread)
    await store.update("notifications", n.id, { readAt: now });
  revalidatePath("/app/notifications");
}

/* ------------------------------------------------------------------------ */
/* Cadastros                                                                 */
/* ------------------------------------------------------------------------ */

export async function savePartyAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(id ? `/app/parties/${id}` : "/app/parties/new", async () => {
    assertWellmix(user);
    assertScreen(user, "parties");
    const input = z
      .object({
        // Tipo de fábrica ("agency") ou criado no painel ("custom:<id>").
        type: z.string().regex(/^(custom:)?[A-Za-z0-9_-]{1,64}$/),
        name: z.string().min(2),
        country: z.string().nullable(),
        email: z.string().email().nullable(),
        phone: z.string().nullable(),
        taxId: z.string().nullable(),
        notes: z.string().nullable(),
        active: z.boolean(),
      })
      .parse({
        type: str(form, "type"),
        name: str(form, "name"),
        country: str(form, "country") || null,
        email: str(form, "email") || null,
        phone: str(form, "phone") || null,
        taxId: str(form, "taxId") || null,
        notes: str(form, "notes") || null,
        // Cadastro novo nasce ativo: o formulário de criação não tem a caixa
        // de status, e sem isto todo parceiro novo nascia inativo e ficava
        // fora das listas de escolha (ex.: responsável pelo booking). Na
        // edição vale a caixa (o hidden "off" vem antes do checkbox: só a
        // lista diz se "on" foi enviado).
        active: id ? form.getAll("active").includes("on") : true,
      });
    const store = getStore();
    // O tipo sai do catálogo (docs/PARTNER_TYPES.md): inativo só continua no
    // cadastro que já o tinha.
    const { resolvePartyType } = await import("@/lib/services/partner-types");
    const existing = id ? await store.get("parties", id) : null;
    if (id && !existing) throw new Error("not_found");
    const resolved = await resolvePartyType(input.type, existing);
    // A coluna do tipo criado só vai ao banco quando há o que gravar (o
    // cadastro continua salvando antes de o esquema ser publicado).
    const parsed = {
      ...input,
      type: resolved.type,
      ...(resolved.partnerTypeId || existing?.partnerTypeId
        ? { partnerTypeId: resolved.partnerTypeId }
        : {}),
    };
    // Fornecedor/cliente novo ou alterado vai para o Sankhya (fase 3).
    const { syncSoon } = await import("@/lib/integrations/sankhya-sync");
    // RCA responsável (só no cadastro de cliente; docs/CUSTOMER_RCA.md): o
    // código do vendedor do Sankhya, "0" = sem RCA.
    const rcaCode = form.has("rcaCode")
      ? z
          .string()
          .regex(/^\d{1,10}$/)
          .parse(str(form, "rcaCode"))
      : null;
    if (id) {
      await store.update("parties", id, parsed);
      await audit(user, "party.update", "party", id, parsed.name);
      if (rcaCode !== null && resolved.type === "customer") {
        const { setCustomerRca } = await import("@/lib/services/rca");
        await setCustomerRca(user, id, rcaCode);
      }
      await syncSoon(user, "party", id);
      // Cliente: o cadastro em Cadastros → Clientes (etapa 4).
      return resolved.type === "customer"
        ? `/app/customers/${id}/edit`
        : `/app/parties/${id}`;
    }
    const party = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      ...parsed,
    });
    await audit(user, "party.create", "party", party.id, parsed.name);
    await syncSoon(user, "party", party.id);
    // O rascunho do Novo parceiro (D11) some com o cadastro salvo.
    {
      const { clearFormDraft, isFormDraftKey, partyDraftKey } =
        await import("@/lib/services/form-drafts");
      const sent = str(form, "draftForm");
      await clearFormDraft(user, partyDraftKey(resolved.type));
      if (isFormDraftKey(sent) && sent !== partyDraftKey(resolved.type))
        await clearFormDraft(user, sent);
    }
    // Cadastro novo: abre já no quadro de acesso, para gerar o login.
    return resolved.type === "customer"
      ? `/app/customers/${party.id}/edit#access`
      : `/app/parties/${party.id}#access`;
  });
}

export async function createUserAction(form: FormData) {
  const user = await requireUser();
  const partyId = str(form, "partyId") || null;
  // Veio da tela do fornecedor/cliente (Logins da empresa): volta para ela,
  // na aba de informações. Só esses dois endereços são aceitos.
  const from = str(form, "from");
  const account =
    /^\/app\/(suppliers|customers)\/[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(from)
      ? from
      : null;
  // Cadastro de cliente: volta para o cadastro em Cadastros → Clientes
  // (etapa 4); o de parceiro, para o de sempre.
  const party =
    !account && partyId && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(partyId)
      ? await getStore().get("parties", partyId)
      : null;
  const back = account
    ? `${account}?tab=info`
    : partyId
      ? party?.type === "customer"
        ? customerEditHref(partyId)
        : `/app/parties/${partyId}`
      : "/app/parties";
  await run(`${back}#access`, async () => {
    assertWellmix(user);
    assertScreen(user, "parties");
    // Gerar login de parceiro ou de cliente é dar acesso ao portal: só o
    // administrador (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, R5).
    if (!isAdmin(user)) throw new ForbiddenError();
    const parsed = z
      .object({
        // Nome de usuário ou e-mail: o formato é conferido no serviço.
        email: z.string().min(3).max(254),
        name: z.string().min(2),
        role: z.enum(ROLES),
        locale: z.enum(LOCALES),
        password: z.string().min(PORTAL_MIN_PASSWORD).max(128),
      })
      .parse({
        email: (str(form, "login") || str(form, "email")).toLowerCase(),
        name: str(form, "name"),
        role: str(form, "role"),
        locale: str(form, "locale") || "pt",
        password: str(form, "password"),
      });
    // O login nasce preso ao cadastro (docs/ARQUITETURA.md, "Acesso ao portal").
    const created = await createPortalLogin(user, { ...parsed, partyId });
    // O login (não a senha) volta na confirmação, para conferir o que passar.
    const login = encodeURIComponent(loginLabel(created.email));
    return `${back}${account ? "&" : "?"}saved=user&login=${login}#access`;
  });
}

export async function saveProductAction(form: FormData) {
  const user = await requireUser();
  await run("/app/products", async () => {
    assertWellmix(user);
    assertScreen(user, "products");
    const parsed = z
      .object({
        lineId: z.string().min(1),
        name: z.string().min(2),
        sku: z.string().nullable(),
        specification: z.string().nullable(),
      })
      .parse({
        lineId: str(form, "lineId"),
        name: str(form, "name"),
        sku: str(form, "sku") || null,
        specification: str(form, "specification") || null,
      });
    // "XPTO" é texto de exemplo, não nome (docs/PURCHASE_ORDER.md).
    const { assertRealProductName } = await import("@/lib/placeholder-name");
    assertRealProductName(parsed.name);
    const id = str(form, "id");
    if (!id) {
      // Produto novo (dono, 17/11/2026; docs/NEW_PRODUCT.md): nasce inativo
      // e vai para a aprovação (o do administrador nasce ativo); só vai para
      // o Sankhya depois de aprovado. Abre na própria ficha, com o aviso
      // "Produto criado" (antes voltava à lista e sumia entre os milhares do
      // catálogo). A tela é a de Novo produto (/app/products/new); este
      // caminho curto não tem mais botão, mas segue a mesma regra.
      const { createProductForApproval } =
        await import("@/lib/services/product-approval");
      const created = await createProductForApproval(user, parsed);
      return `/app/products/${created.id}?created=1`;
    }
    const store = getStore();
    const saved = await store.update("products", id, parsed);
    // O nome chega aos pedidos e às tarefas que estavam sem ele.
    const { fillProductNameCopies } =
      await import("@/lib/services/product-name-copies");
    await fillProductNameCopies(user, saved);
    // Produto alterado vai para o Sankhya (fase 3).
    const { syncSoon } = await import("@/lib/integrations/sankhya-sync");
    await syncSoon(user, "product", saved.id);
  });
}

export async function saveLineAction(form: FormData) {
  const user = await requireUser();
  await run("/app/lines", async () => {
    assertWellmix(user);
    assertScreen(user, "lines");
    const name = str(form, "name");
    if (name.length < 2) throw new Error("invalid_name");
    const requirements = str(form, "requirements")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, label, type = "file", required = "1"] = line
          .split("|")
          .map((p) => p.trim());
        return {
          key: key.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          label: label || key,
          type: ([
            "file",
            "photo",
            "text",
            "number",
            "date",
            "confirm",
          ].includes(type)
            ? type
            : "file") as never,
          required: required !== "0",
          role: "supplier" as const,
        };
      });
    const id = str(form, "id");
    const store = getStore();
    let manualDocumentId: string | null = null;
    const manual = form.get("manual");
    if (manual instanceof File && manual.size > 0) {
      manualDocumentId = (
        await uploadDocument(user, manual, {
          type: "manual",
          visibility: "supplier",
        })
      ).id;
    }
    if (id) {
      const existing = await store.get("product_lines", id);
      await store.update("product_lines", id, {
        name,
        requirements,
        manualDocumentId:
          manualDocumentId ?? existing?.manualDocumentId ?? null,
      });
    } else {
      await store.create("product_lines", {
        ...LINE_EXTRA_DEFAULTS,
        name,
        requirements,
        requiredCertifications: null,
        manualDocumentId,
        active: true,
      });
    }
  });
}

export async function importCsvAction(form: FormData) {
  const user = await requireUser();
  const entity = str(form, "entity");
  await run(`/app/import?entity=${entity}`, async () => {
    assertWellmix(user);
    assertScreen(user, "import");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new Error("file_required");
    const result = await importCsv(user, entity, await file.text());
    return `/app/import?entity=${entity}&created=${result.created}&skipped=${result.skipped}`;
  });
}

export async function saveSettingsAction(form: FormData) {
  const user = await requireUser();
  await run("/app/settings", async () => {
    assertRole(user, ["admin"]);
    // Valida tudo antes de gravar: um valor inválido não deixa metade salva.
    const pairs: Array<[SettingKey, unknown]> = [];
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
      const raw = form.get(key);
      // Gravados pelo sistema (PTAX do dia); nunca vêm do formulário.
      if (
        key === "fxPtax" ||
        key === "fxPtaxFailedAt" ||
        key === "fxLastError" ||
        key === "fiscalTable" ||
        key === "fiscalLastError" ||
        // Gravados pelo tarifário de frete (destino escolhido e atualização automática).
        key === "freightTariffDestination" ||
        key === "freightPerCbmAuto" ||
        // Gravado pela tela do Superplan, com validação própria.
        key === "superplan" ||
        // Prazo por etapa (legado, fase 5e): o editor agora é por marco.
        key === "stageDueDays"
      )
        continue;
      if (key === "milestoneDueDays") {
        // Prazo por marco (fase 5e): um campo "milestoneDueDays.<marco>" por
        // marco, em dias inteiros de 0 a 365.
        if (!form.has("milestoneDueDays.__form")) continue;
        const shape = z.coerce.number().int().min(0).max(365);
        const out: Record<string, number> = {};
        for (const k of MILESTONE_KEYS) {
          const text = String(form.get(`milestoneDueDays.${k}`) ?? "").trim();
          if (text === "") continue;
          const parsed = shape.safeParse(text);
          if (!parsed.success) throw new Error("milestone_due_invalid");
          out[k] = parsed.data;
        }
        pairs.push([key, Object.keys(out).length ? out : null]);
        continue;
      }
      if (
        key === "marginByLine" ||
        key === "marginByCustomer" ||
        key === "fxManualRates"
      ) {
        // Montados a partir de campos "chave.id" (um por linha/cliente/moeda).
        if (!form.has(`${key}.__form`)) continue;
        const out: Record<string, number | null> = {};
        for (const [name, v] of form.entries()) {
          if (!name.startsWith(`${key}.`) || name === `${key}.__form`) continue;
          const id = name.slice(key.length + 1);
          const text = String(v).trim().replace(",", ".");
          if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))
            throw new Error("invalid_input");
          const n = text === "" ? null : Number(text);
          if (n !== null && !(Number.isFinite(n) && n >= 0 && n <= 1000))
            throw new Error(
              key === "fxManualRates" ? "fx_invalid" : "margin_invalid",
            );
          if (key === "fxManualRates") out[id] = n;
          else if (n !== null) out[id] = n;
        }
        pairs.push([key, out]);
        continue;
      }
      if (raw === null) continue;
      const current = DEFAULT_SETTINGS[key];
      let value: unknown = raw;
      if (typeof current === "boolean") value = raw === "on" || raw === "true";
      else if (key === "salesTop") {
        // TOP de venda do Sankhya (mapa V7): inteiro ou vazio.
        const text = String(raw).trim();
        const n = text === "" ? null : Number(text);
        if (n !== null && !(Number.isInteger(n) && n > 0 && n < 100_000))
          throw new Error("invalid_input");
        value = n;
      } else if (key === "carrierItapoaName" || key === "carrierDefaultName") {
        // Transportadora padrão pelo porto (mapa E12?): o nome do cadastro.
        value = String(raw).trim().slice(0, 120);
      } else if (key === "lpcoNcmPrefixes") {
        // LPCO (mapa E5): prefixos de NCM, só dígitos, pontos e separadores.
        const text = String(raw).trim();
        if (text.length > 2000 || !/^[\d.,;\s]*$/.test(text))
          throw new Error("invalid_input");
        value = text;
      } else if (key === "productionStartDays" || key === "invoiceDays") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 365)
          throw new Error("invalid_input");
        value = n;
      } else if (key === "marginPercent") {
        const n = Number(String(raw).replace(",", "."));
        if (!(Number.isFinite(n) && n >= 0 && n <= 1000))
          throw new Error("margin_invalid");
        value = n;
      } else if (key === "deliveryFreightDefaultBrl") {
        // Frete de entrega padrão da cotação V2 (R$, total): vazio = pendente.
        const text = String(raw).trim().replace(",", ".");
        const n = text === "" ? null : Number(text);
        if (n !== null && !(Number.isFinite(n) && n >= 0 && n <= 100_000_000))
          throw new Error("freight_invalid");
        value = n;
      } else if (key === "freightPerCbm") {
        const text = String(raw).trim().replace(",", ".");
        const n = text === "" ? null : Number(text);
        if (n !== null && !(Number.isFinite(n) && n >= 0 && n <= 1_000_000))
          throw new Error("freight_invalid");
        value = n;
      } else if (
        key === "insurancePercent" ||
        key === "pisImportPercent" ||
        key === "cofinsImportPercent" ||
        key === "icmsPercent"
      ) {
        const text = String(raw).trim().replace(",", ".");
        const n = text === "" ? null : Number(text);
        if (n === null && key !== "icmsPercent") throw new Error("tax_invalid");
        if (n !== null && !(Number.isFinite(n) && n >= 0 && n < 100))
          throw new Error("tax_invalid");
        value = n;
      } else if (key === "fiscalTecUrl" || key === "fiscalTipiUrl") {
        const v = String(raw).trim();
        if (v && !/^https:\/\/[^\s]+$/i.test(v))
          throw new Error("fiscal_url_invalid");
        value = v.slice(0, 500);
      } else if (key === "freightCurrency") {
        const c = String(raw).toUpperCase();
        if (!isCurrency(c)) throw new Error("invalid_currency");
        value = c;
      } else if (
        key === "purchaseArtSlaDays" ||
        key === "purchaseArtReviewSlaDays" ||
        key === "purchaseDieCutSlaDays" ||
        key === "purchaseCertSlaDays" ||
        key === "purchaseArtFinalSlaDays" ||
        key === "purchaseRegistrationSlaDays" ||
        key === "purchaseSignatureSlaDays" ||
        key === "purchaseDownPaymentSlaDays" ||
        key === "purchaseInspectionMediaSlaDays" ||
        key === "purchaseInspectionReviewSlaDays" ||
        key === "purchaseInspectionMaxAttempts"
      ) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 365)
          throw new Error("purchase_sla_invalid");
        value = n;
      } else if (key === "certificationHorizonDays") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 730)
          throw new Error("certification_horizon_invalid");
        value = n;
      } else if (key === "purchaseQuoteHours") {
        // Horas corridas; aceita fração (0,5 = 30 min; o mínimo, 0,01 h,
        // serve aos testes de ponta a ponta que esperam o prazo vencer).
        const n = Number(String(raw).replace(",", "."));
        if (!Number.isFinite(n) || n < 0.01 || n > 240)
          throw new Error("purchase_quote_hours_invalid");
        value = n;
      } else if (key === "bookingInviteSlaDays") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 30)
          throw new Error("booking_invite_sla_invalid");
        value = n;
      } else if (key === "samplingSlaDays") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 30)
          throw new Error("sampling_sla_invalid");
        value = n;
      } else if (key === "attendanceSlaDays") {
        // Prazo de atendimento ao cliente (docs/TRADE_COMERCIAL.md).
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 365)
          throw new Error("attendance_sla_invalid");
        value = n;
      } else if (key === "supplierRequestSlaMinutes") {
        const n = Number(raw);
        if (
          !Number.isInteger(n) ||
          n < SUPPLIER_REQUEST_SLA_MIN ||
          n > SUPPLIER_REQUEST_SLA_MAX
        )
          throw new Error("supplier_request_sla_invalid");
        value = n;
      } else if (key === "quoteSlaBusinessDays") {
        const days = Number(raw);
        if (
          !Number.isInteger(days) ||
          days < QUOTE_SLA_MIN_DAYS ||
          days > QUOTE_SLA_MAX_DAYS
        )
          throw new Error("quote_sla_invalid");
        value = days;
      } else if (typeof current === "number") value = Number(raw);
      else if (
        key === "aiPromptProduct" ||
        key === "aiPromptDetail" ||
        key === "aiPromptSheet"
      ) {
        const v = String(raw).trim();
        if (!v || v.length > AI_PROMPT_MAX)
          throw new Error("ai_prompt_invalid");
        value = v;
      } else if (key === "openaiImageModel" || key === "openaiTextModel") {
        const v = String(raw).trim();
        if (!/^[A-Za-z0-9._:/-]{1,80}$/.test(v))
          throw new Error("openai_model_invalid");
        value = v;
      } else if (key === "aiMode") {
        if (!["AUTO", "MOCK", "MANUAL"].includes(String(raw)))
          throw new Error("invalid_ai_mode");
        value = String(raw);
      } else if (key === "marketingKitCurrency") {
        if (!isCurrency(String(raw).toUpperCase()))
          throw new Error("invalid_currency");
        value = String(raw).toUpperCase();
      } else if (key === "financeEmail") {
        const v = String(raw).trim();
        if (v && !z.string().email().safeParse(v).success)
          throw new Error("finance_email_invalid");
        value = v;
      } else if (key === "financeWhatsapp") {
        const digits = String(raw).replace(/\D/g, "");
        if (digits && (digits.length < 10 || digits.length > 15))
          throw new Error("finance_whatsapp_invalid");
        value = digits;
      } else if (key === "containerTypes") {
        // Uma linha por tipo ("código;capacidadeCbm;pesoMaxKg"); JSON também é aceito.
        const { parseContainerTypes } =
          await import("@/lib/services/containers");
        value = parseContainerTypes(String(raw));
      } else if (typeof current === "object") {
        try {
          value = JSON.parse(String(raw));
        } catch {
          throw new Error("invalid_json");
        }
      }
      pairs.push([key, value]);
    }
    for (const [key, value] of pairs) await setSetting(key, value as never);
    await audit(
      user,
      "settings.update",
      "settings",
      "global",
      "Configurações atualizadas",
    );
    return "/app/settings?ok=1";
  });
}
