"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertScreen } from "@/lib/auth/screens";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { parseNumberInput } from "@/lib/number-input";
import { getStore } from "@/lib/db";
import { STRATEGY_LINE_CHOICES } from "@/lib/purchase-recipients";
import { getT } from "@/i18n/server";
import { errorTextFor } from "@/i18n/error-text";
import {
  errorCode,
  field,
  files,
  requireUser,
  run,
  runInPlace,
  str,
  uploadedPhotoKeys,
} from "./helpers";

/*
 * Compra por demanda (mapa B10 e B14; docs/PURCHASE_DEMAND.md). Aqui só o
 * formato; o serviço confere quem pode (ação "Abrir reposição").
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00.000Z`)));

/** Reposição aberta à mão pelo Planner: produto, quantidade e data desejada. */
export async function openReplenishmentAction(form: FormData) {
  const user = await requireUser();
  await run("/app/replenishment", async () => {
    assertScreen(user, "requests");
    const productId = ID.parse(str(form, "productId"));
    const quantity = z
      .number()
      .positive()
      .max(10_000_000)
      .parse(parseNumberInput(str(form, "quantity")));
    const day = str(form, "desiredAt");
    const desiredAt = day ? `${DAY.parse(day)}T12:00:00.000Z` : null;
    const notes = field(form, "notes", z.string().trim().max(2000)) || null;
    const { openReplenishment } =
      await import("@/lib/services/purchase-demand");
    const request = await openReplenishment(user, {
      productId,
      quantity,
      desiredAt,
      notes,
    });
    return `/app/replenishment?opened=${encodeURIComponent(request.id)}`;
  });
}

const CHOICE = z.enum(["last_supplier", "quote"]);

/** Estratégia de compra (mapa B10?): o Comprador escolhe para as demandas marcadas. */
export async function chooseStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "purchaseStrategy");
    const demandIds = z
      .array(ID)
      .min(1)
      .max(200)
      .parse(form.getAll("demandIds").map(String));
    const choice = CHOICE.parse(str(form, "choice"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { chooseStrategy } = await import("@/lib/services/purchase-strategy");
    const decision = await chooseStrategy(user, { demandIds, choice, note });
    return `/app/purchase-strategy?chosen=${decision.number}#decision-${decision.id}`;
  });
}

/**
 * Encerrar a estratégia aprovada que parou (encomenda cancelada ou já em
 * outro pedido; dono, 19/11/2026): o Comprador ou a Diretoria de compras a
 * tira de Em andamento, e as encomendas abertas voltam para a fila.
 */
export async function closeStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "purchaseStrategy");
    const id = ID.parse(str(form, "id"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { closeStrategy } = await import("@/lib/services/purchase-strategy");
    const { decision, reopened } = await closeStrategy(user, id, note);
    return `/app/purchase-strategy?closed=${decision.number}&reopened=${reopened}`;
  });
}

/** A Diretoria de compras aprova ou recusa a estratégia. */
export async function decideStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "purchaseStrategy");
    const id = ID.parse(str(form, "id"));
    const approve = z.enum(["approve", "reject"]).parse(str(form, "decision"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { decideStrategy } = await import("@/lib/services/purchase-strategy");
    const decision = await decideStrategy(user, id, {
      approve: approve === "approve",
      note,
    });
    // "Cotar" aprovada: o sistema abriu a cotação de compra; a tela vai a ela.
    const fresh = await getStore().get("purchase_decisions", decision.id);
    if (fresh?.quoteId) return `/app/purchase-quotes/${fresh.quoteId}?opened=1`;
    return `/app/purchase-strategy?decided=${decision.number}#decision-${decision.id}`;
  });
}

/** Pedido de compra da estratégia "fornecedor da última compra", com as condições conferidas. */
export async function orderFromStrategyAction(form: FormData) {
  const user = await requireUser();
  await run("/app/purchase-strategy", async () => {
    assertScreen(user, "quotes");
    assertScreen(user, "orders");
    const id = ID.parse(str(form, "id"));
    // Sem "Ver preço de compra" a tela não tem preço nem moeda: o serviço
    // usa os da última compra gravados na decisão (dono, 15/11/2026).
    const seesPrice = canSeePurchasePrice(user);
    const QTY = z.number().positive().max(1e9);
    const price = (raw: string) =>
      raw
        ? z.number().nonnegative().max(1e9).parse(parseNumberInput(raw))
        : null;
    // Uma linha por produto da solicitação (todos do mesmo fornecedor da
    // última compra; dono, 18/11/2026).
    const productIds = z
      .array(ID)
      .min(1)
      .max(200)
      .parse(form.getAll("productIds").map(String));
    // Peças: número inteiro, com "526.320" lido como milhar (dono,
    // 18/11/2026), a mesma leitura da tela que mostra os totais.
    const lines = productIds.map((productId) => ({
      productId,
      quantity: QTY.parse(
        parseNumberInput(str(form, `quantity__${productId}`), { int: true }),
      ),
      unitPrice: seesPrice ? price(str(form, `unitPrice__${productId}`)) : null,
    }));
    // O que a tela mostrou (caixas master, inner e cubagem) por produto: o
    // serviço refaz a conta com a embalagem de agora e recusa se mudou.
    const seals = Object.fromEntries(
      productIds
        .map((productId) => [productId, str(form, `seal__${productId}`)])
        .filter(([, seal]) => seal && seal.length <= 120),
    ) as Record<string, string>;
    const currency = seesPrice
      ? z
          .string()
          .trim()
          .regex(/^[A-Z]{3}$/)
          .parse(str(form, "currency").toUpperCase())
      : "USD";
    const leadRaw = str(form, "leadTimeDays");
    const leadTimeDays = leadRaw
      ? z
          .number()
          .int()
          .min(0)
          .max(1000)
          .parse(parseNumberInput(leadRaw, { int: true }))
      : null;
    const incotermRaw = str(form, "incoterm");
    const incoterm = incotermRaw
      ? z.enum(["EXW", "FOB"]).parse(incotermRaw)
      : null;
    const { orderFromStrategy } =
      await import("@/lib/services/purchase-strategy");
    const order = await orderFromStrategy(user, id, {
      currency,
      leadTimeDays,
      incoterm,
      lines,
      seals,
    });
    return `/app/orders/${order.id}?created=1`;
  });
}

/* Cotação de compra (mapa B13; docs/PURCHASE_DEMAND.md). */

const quoteBack = (id: string) =>
  ID.safeParse(id).success
    ? `/app/purchase-quotes/${id}`
    : "/app/purchase-quotes";

/**
 * Tela da Wellmix de onde a ação veio: a Cotação unificada
 * (/app/supplier-requests/<cotação>, campo `home`; dono, 22/11/2026) ou a
 * tela de sempre da cotação de compra.
 */
const quoteHome = (form: FormData, id: string) =>
  ID.safeParse(id).success && str(form, "home") === "quotation"
    ? `/app/supplier-requests/${id}`
    : quoteBack(id);

/** O fornecedor responde (preço por item e condição de envio) ou recusa. */
export async function answerQuoteAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "quoteId");
  await run(quoteBack(id), async () => {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(id);
    const decline = str(form, "decline") === "1";
    const productIds = form.getAll("productId").map(String);
    const prices = decline
      ? []
      : productIds.map((productId) => ({
          productId: ID.parse(productId),
          unitPrice: z
            .number()
            .nonnegative()
            .max(1e9)
            .parse(parseNumberInput(str(form, `price.${productId}`))),
        }));
    const optionalNumber = (key: string, int = false) => {
      const raw = str(form, key);
      return raw
        ? z
            .number()
            .nonnegative()
            .max(1e9)
            .parse(parseNumberInput(raw, { int }))
        : null;
    };
    // Ficha técnica de cada produto (dono, 20/11/2026). Número que não dá
    // para ler fica vazio: o serviço aponta o que falta.
    const sheetNumber = (pid: string, key: string, int = false) => {
      const v = parseNumberInput(str(form, `sheet.${pid}.${key}`), { int });
      return v === null || !Number.isFinite(v) || v < 0 || v > 1e9 ? null : v;
    };
    const sheets = decline
      ? []
      : productIds.map((pid) => ({
          productId: ID.parse(pid),
          confirmed: str(form, `sheet.${pid}.confirm`) === "1",
          // Sem inner (é exigência do cliente, travada na cotação), com
          // "Sem peso" e os materiais pelos ids do catálogo, numa lista
          // separada por vírgula (dono, 21/11/2026). O serviço recusa id
          // fora do catálogo; texto livre não existe mais aqui.
          draft: form.has(`sheet.${pid}.masterBoxQty`)
            ? {
                masterBoxQty: sheetNumber(pid, "masterBoxQty", true),
                boxLengthCm: sheetNumber(pid, "boxLengthCm"),
                boxWidthCm: sheetNumber(pid, "boxWidthCm"),
                boxHeightCm: sheetNumber(pid, "boxHeightCm"),
                cbm: sheetNumber(pid, "cbm"),
                netWeightKg: sheetNumber(pid, "netWeightKg"),
                grossWeightBoxKg: sheetNumber(pid, "grossWeightBoxKg"),
                grossUnknown: str(form, `sheet.${pid}.grossUnknown`) === "1",
                materialIds: str(form, `sheet.${pid}.materialIds`)
                  .split(",")
                  .map((m) => m.trim())
                  .filter(Boolean)
                  .slice(0, 20)
                  .map((m) => ID.parse(m)),
                factoryItemCode: str(
                  form,
                  `sheet.${pid}.factoryItemCode`,
                ).slice(0, 80),
                noFactoryCode: str(form, `sheet.${pid}.noFactoryCode`) === "1",
              }
            : null,
        }));
    const { answerQuote } = await import("@/lib/services/purchase-quote");
    await answerQuote(user, quoteId, {
      decline,
      prices,
      currency: decline ? null : str(form, "currency").toUpperCase() || null,
      incoterm: decline ? null : str(form, "incoterm").toUpperCase() || null,
      leadTimeDays: decline ? null : optionalNumber("leadTimeDays", true),
      port: decline
        ? null
        : field(form, "port", z.string().trim().max(120)) || null,
      moq: decline ? null : optionalNumber("moq"),
      note: field(form, "note", z.string().trim().max(2000)) || null,
      sheets,
    });
    return `/app/purchase-quotes/${quoteId}?answered=${decline ? "declined" : "1"}`;
  });
}

/**
 * Rascunho automático da resposta da cotação (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Rascunho automático da cotação"): o que o
 * fornecedor digita vai para o servidor a cada pausa, sem recarregar a
 * página, e volta quando ela abre de novo. Só o fornecedor convidado, com a
 * cotação aberta (o serviço confere).
 */
export async function saveQuoteDraftAction(input: {
  quoteId: string;
  values: Record<string, string>;
}): Promise<{ ok: boolean; savedAt: string | null }> {
  const user = await requireUser();
  try {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(input.quoteId);
    const values = z
      .record(z.string().max(120), z.string().max(2000))
      .refine((v) => Object.keys(v).length <= 1000)
      .parse(input.values ?? {});
    const { saveQuoteDraft } = await import("@/lib/services/quote-draft");
    const savedAt = await saveQuoteDraft(user, quoteId, values);
    return { ok: true, savedAt };
  } catch {
    return { ok: false, savedAt: null };
  }
}

/** Foto na balança de um produto da cotação (sobe na hora; fica na tela). */
export async function addQuoteScalePhotoAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "quoteId");
  await runInPlace(quoteBack(id), async () => {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(id);
    const productId = ID.parse(str(form, "productId"));
    const [photo] = [...files(form, "photos"), ...uploadedPhotoKeys(form)];
    if (!photo) throw new Error("photo_required");
    const { addQuoteScalePhoto } =
      await import("@/lib/services/purchase-quote");
    await addQuoteScalePhoto(user, quoteId, productId, photo);
  });
}

/**
 * A Wellmix define a caixa inner do produto na cotação (dono, 21/11/2026):
 * pedida sem o número ou diferente entre as demandas. "none" = não exigir.
 */
export async function setQuoteInnerAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "quoteId");
  await run(quoteHome(form, id), async () => {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(id);
    const productId = ID.parse(str(form, "productId"));
    const qty =
      str(form, "mode") === "none"
        ? null
        : z
            .number()
            .int()
            .positive()
            .max(1_000_000)
            .parse(parseNumberInput(str(form, "innerQty"), { int: true }));
    const { setQuoteItemInner } = await import("@/lib/services/purchase-quote");
    await setQuoteItemInner(user, quoteId, productId, qty);
    return `${quoteHome(form, quoteId)}?inner=1`;
  });
}

/** O Comprador escolhe a vencedora. */
export async function chooseQuoteWinnerAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "quoteId");
  await run(quoteHome(form, id), async () => {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(id);
    const responseId = ID.parse(str(form, "responseId"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { chooseWinner } = await import("@/lib/services/purchase-quote");
    await chooseWinner(user, quoteId, responseId, note);
    return `${quoteHome(form, quoteId)}?chosen=1`;
  });
}

/** A Diretoria de compras aprova ou recusa a vencedora. */
export async function decideQuoteWinnerAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "quoteId");
  await run(quoteHome(form, id), async () => {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(id);
    const approve = z.enum(["approve", "reject"]).parse(str(form, "decision"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { decideWinner } = await import("@/lib/services/purchase-quote");
    await decideWinner(user, quoteId, {
      approve: approve === "approve",
      note,
    });
    return `${quoteHome(form, quoteId)}?decided=${approve}`;
  });
}

/** Sem resposta: reabrir, convidar outros ou voltar para a estratégia. */
export async function quoteNoAnswerAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "quoteId");
  await run(quoteHome(form, id), async () => {
    assertScreen(user, "quotes");
    const quoteId = ID.parse(id);
    const what = z
      .enum(["reopen", "invite", "strategy"])
      .parse(str(form, "what"));
    const q = await import("@/lib/services/purchase-quote");
    if (what === "reopen") {
      await q.reopenQuote(user, quoteId);
      return `${quoteHome(form, quoteId)}?reopened=1`;
    }
    if (what === "invite") {
      const supplierIds = z
        .array(ID)
        .min(1)
        .max(30)
        .parse(form.getAll("supplierId").map(String).filter(Boolean));
      await q.inviteMore(user, quoteId, supplierIds);
      return `${quoteHome(form, quoteId)}?invited=1`;
    }
    await q.backToStrategy(user, quoteId);
    return "/app/purchase-strategy?back=1";
  });
}

/** Linhas que o fornecedor atende (Cadastros → fornecedor). */
export async function setSupplierLinesAction(form: FormData) {
  const user = await requireUser();
  const supplierId = str(form, "supplierId");
  const back = ID.safeParse(supplierId).success
    ? `/app/suppliers/${supplierId}?tab=info`
    : "/app/suppliers";
  await run(back, async () => {
    assertScreen(user, "parties");
    const lineIds = z
      .array(ID)
      .max(200)
      .parse(form.getAll("lineId").map(String));
    const { setSupplierLines } = await import("@/lib/services/purchase-quote");
    await setSupplierLines(user, ID.parse(supplierId), lineIds);
    return `${back}&lines=saved`;
  });
}

/* Estratégia de Compra por produto (dono, 18/11/2026; docs/PURCHASE_DEMAND.md). */

/**
 * Encomendas → "Enviar para cotação" (dono, 18/11/2026): as encomendas
 * marcadas (produtos soltos ou o lote) entram na Estratégia de Compra.
 */
export async function sendToStrategyAction(form: FormData) {
  const user = await requireUser();
  const group = str(form, "groupId");
  const back = ID.safeParse(group).success
    ? `/app/requests/batch/${encodeURIComponent(group)}`
    : "/app/requests";
  await run(back, async () => {
    assertScreen(user, "requests");
    const ids = z
      .array(ID)
      .min(1)
      .max(500)
      .parse(form.getAll("ids").map(String));
    const { sendToStrategy } = await import("@/lib/services/purchase-strategy");
    const { sent, skipped } = await sendToStrategy(user, ids);
    if (!sent.length) throw new Error("nothing_sent");
    return `${back}?strategySent=${sent.length}${skipped ? `&strategySkipped=${skipped}` : ""}`;
  });
}

/** Resposta da confirmação do envio (a tela guarda as escolhas se der erro). */
export interface StrategySendState {
  ok: boolean;
  error: string | null;
  message: string | null;
  at: string | null;
}

const STRATEGY_PAYLOAD = z.object({
  lines: z
    .array(
      z
        .object({
          // A solicitação inteira (dono, 18/11/2026); `demandId` = de antes.
          demandIds: z.array(ID).min(1).max(200).optional(),
          demandId: ID.optional(),
          choice: z.enum(STRATEGY_LINE_CHOICES),
          recipientIds: z.array(ID).max(200),
        })
        .refine((l) => !!l.demandIds?.length || !!l.demandId),
    )
    .min(1)
    .max(200),
  note: z.string().trim().max(2000).nullable(),
});

/**
 * Estratégia de Compra → resumo → "Confirmar o envio": por produto, a
 * escolha e os destinatários. Deu certo: o resultado por destinatário.
 */
export async function sendStrategyAction(
  _prev: StrategySendState,
  form: FormData,
): Promise<StrategySendState> {
  const user = await requireUser();
  let target: string;
  try {
    assertScreen(user, "purchaseStrategy");
    const raw = form.get("payload");
    const payload = STRATEGY_PAYLOAD.parse(
      JSON.parse(typeof raw === "string" && raw ? raw : "{}"),
    );
    const { sendStrategy } = await import("@/lib/services/purchase-strategy");
    const send = await sendStrategy(
      user,
      { lines: payload.lines, note: payload.note || null },
      await getT(),
    );
    target = `/app/purchase-strategy/sends/${send.id}?done=1`;
  } catch (error) {
    const code =
      error instanceof SyntaxError
        ? "invalid_input"
        : errorCode("/app/purchase-strategy", error);
    return {
      ok: false,
      error: code,
      message: errorTextFor(await getT(), code, ["strategy.error"]),
      at: new Date().toISOString(),
    };
  }
  revalidatePath("/app", "layout");
  redirect(target);
}

/** Resultado do envio → "Tentar de novo": só quem ficou de fora ou deu erro. */
export async function retryStrategySendAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "sendId");
  const back = ID.safeParse(id).success
    ? `/app/purchase-strategy/sends/${id}`
    : "/app/purchase-strategy";
  await run(back, async () => {
    assertScreen(user, "purchaseStrategy");
    const { retryStrategySend } =
      await import("@/lib/services/purchase-strategy");
    const { sentNow } = await retryStrategySend(
      user,
      ID.parse(id),
      await getT(),
    );
    return `${back}?retried=${sentNow}`;
  });
}
