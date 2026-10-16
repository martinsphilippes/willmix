"use server";

import { z } from "zod";
import {
  addSheetPhotos,
  removeSheetPhoto,
  saveSheet,
  SHEET_PHOTO_KINDS,
} from "@/lib/services/purchase-sheet";
import { invalidTarget, parseSheet } from "./sheet-form";
import { parseNumberInput } from "@/lib/number-input";
import {
  files,
  requireUser,
  run,
  runInPlace,
  str,
  uploadedPhotoKeys,
} from "./helpers";

/** Opção do seletor para o nome antigo digitado à mão (fornecedor não cadastrado). */
const LEGACY_SUPPLIER = "__legacy__";

/*
 * Ficha de compra (planilha COMPRAS) da Preparação. Só os campos presentes no
 * formulário mudam; o serviço ainda descarta o que o papel não pode editar.
 */

const ORDER_ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function savePurchaseSheetAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  await run(back, async () => {
    ORDER_ID.parse(orderId);
    const { input, invalid } = parseSheet(form);
    const { missing } = await saveSheet(user, orderId, input);
    if (invalid.length) return invalidTarget(back, invalid);
    return `${back}?saved=${missing.length ? `partial&at=${Date.now()}` : "complete"}`;
  });
}

export async function addPurchaseSheetPhotosAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(orderId);
    const kind = z.enum(SHEET_PHOTO_KINDS).parse(str(form, "kind"));
    const photos = [...files(form, "photos"), ...uploadedPhotoKeys(form)];
    if (!photos.length) throw new Error("photo_required");
    await addSheetPhotos(user, orderId, kind, photos);
  });
}

export async function removePurchaseSheetPhotoAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(orderId);
    const photoId = ORDER_ID.parse(str(form, "photoId"));
    await removeSheetPhoto(user, orderId, photoId);
  });
}

/**
 * Resposta da RFQ pela ficha de compra. "Salvar" guarda o rascunho; "Enviar"
 * guarda e, com a ficha completa (fotos opcionais), responde a cotação com o
 * preço e a moeda da própria ficha.
 */
export async function answerQuoteWithSheetAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = `/app/quotes/${encodeURIComponent(quoteId)}`;
  await run(back, async () => {
    ORDER_ID.parse(quoteId);
    const { saveQuoteSheet, saveQuoteTermsDraft } =
      await import("@/lib/services/quote-sheet");
    const { input, invalid } = parseSheet(form);
    const { sheet, missing } = await saveQuoteSheet(user, quoteId, input);
    // Prazo como na ficha ("30", "30 dias") e condições (quebra de linha
    // conta como no navegador); ilegível é apontado, vazio entra no "falta".
    const leadTimeDays = parseNumberInput(str(form, "leadTimeDays"), {
      int: true,
    });
    const conditions = str(form, "conditions").replace(/\r\n/g, "\n");
    const leadOk =
      leadTimeDays === null ||
      (Number.isInteger(leadTimeDays) &&
        leadTimeDays > 0 &&
        leadTimeDays <= 3650);
    const unreadable = [
      ...invalid,
      ...(leadOk ? [] : ["leadTimeDays"]),
      ...(conditions.length > 2000 ? ["conditions"] : []),
    ];
    // Rascunho: prazo e condições ficam guardados na cotação não enviada.
    if (form.has("leadTimeDays") || form.has("conditions"))
      await saveQuoteTermsDraft(user, quoteId, {
        leadTimeDays: leadOk ? leadTimeDays : null,
        conditions: conditions.slice(0, 2000) || null,
      });
    // Campo ilegível: o resto ficou salvo; não envia e aponta o campo.
    if (unreadable.length) return invalidTarget(back, unreadable);
    if (str(form, "intent") !== "send")
      return `${back}?saved=${missing.length ? `partial&at=${Date.now()}` : "complete"}`;
    const noLead = leadTimeDays === null ? "&missing=leadTimeDays" : "";
    // Cada recusa leva de novo até o primeiro campo vazio (token novo).
    if (missing.length)
      return `${back}?error=sheet_incomplete${noLead}&at=${Date.now()}`;
    if (leadTimeDays === null)
      return `${back}?error=lead_time_required${noLead}&at=${Date.now()}`;
    const { answerQuote } = await import("@/lib/services/requests");
    await answerQuote(user, quoteId, {
      price: sheet.price!,
      currency: sheet.currency === "RMB" ? "CNY" : sheet.currency!,
      leadTimeDays,
      conditions: conditions || null,
    });
    // Companhia marítima recebe o pedido de frete com a carga desta ficha.
    const { inviteFreightForQuote } = await import("@/lib/services/freight");
    await inviteFreightForQuote(user, quoteId);
    // Fornecedor segue para as Pendências: confirmação do envio e a próxima
    // cotação a responder. A Wellmix (resposta em nome dele) fica na cotação.
    if (user.role === "supplier")
      return `/app?sent=${encodeURIComponent(quoteId)}`;
    return `${back}?saved=sent`;
  });
}

/*
 * Os botões da resposta ficam fora do <form> (depois do card de fotos) e apontam
 * para ele pelo atributo `form`. O React só leva nome/valor de botão que está
 * dentro do formulário, por isso cada botão tem a própria ação (formAction).
 */
export async function sendQuoteWithSheetAction(form: FormData) {
  form.set("intent", "send");
  return answerQuoteWithSheetAction(form);
}

export async function saveQuoteSheetDraftAction(form: FormData) {
  form.set("intent", "draft");
  return answerQuoteWithSheetAction(form);
}

/** Fotos da ficha na resposta da RFQ (as 5 fotos do produto, obrigatórias para enviar). */
export async function addQuoteSheetPhotosAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = `/app/quotes/${encodeURIComponent(quoteId)}`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(quoteId);
    const kind = z.enum(SHEET_PHOTO_KINDS).parse(str(form, "kind"));
    const photos = [...files(form, "photos"), ...uploadedPhotoKeys(form)];
    if (!photos.length) throw new Error("photo_required");
    const { addQuoteSheetPhotos } = await import("@/lib/services/quote-sheet");
    await addQuoteSheetPhotos(user, quoteId, kind, photos);
  });
}

export async function removeQuoteSheetPhotoAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = `/app/quotes/${encodeURIComponent(quoteId)}`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(quoteId);
    const photoId = ORDER_ID.parse(str(form, "photoId"));
    const { removeQuoteSheetPhoto } =
      await import("@/lib/services/quote-sheet");
    await removeQuoteSheetPhoto(user, quoteId, photoId);
  });
}

/** Ficha de compra mestre do produto (cadastro): só Wellmix. */
export async function saveProductSheetAction(form: FormData) {
  const user = await requireUser();
  const productId = z.string().min(1).max(64).parse(str(form, "productId"));
  await run(`/app/products/${productId}`, async () => {
    const {
      saveProductSheet,
      getProductSheet,
      productSheetDraft,
      withProductColumns,
    } = await import("@/lib/services/product-sheet");
    const { input, invalid } = parseSheet(form);
    // Fornecedor escolhido entre os cadastrados: vira o principal do produto
    // e o nome vem do cadastro (o texto digitado não vale).
    const supplierId = z.string().max(64).parse(str(form, "supplierId"));
    const chosen =
      supplierId && supplierId !== LEGACY_SUPPLIER ? supplierId : null;
    // O bloco Fornecedor salvo é do escolhido? (decide a escrita de volta no cadastro)
    let blockIsChosen = false;
    if (chosen) {
      const { getStore } = await import("@/lib/db");
      const { setMainSupplier } =
        await import("@/lib/services/product-suppliers");
      const store = getStore();
      const product = await store.get("products", productId);
      const [previousParty, previousMaster] = await Promise.all([
        product?.supplierId ? store.get("parties", product.supplierId) : null,
        getProductSheet(productId),
      ]);
      // O que a tela mostrava antes de salvar (ficha mestre ou rascunho do produto).
      const draft = product ? productSheetDraft(product, previousParty) : null;
      const shown =
        previousMaster && draft
          ? withProductColumns(previousMaster, draft)
          : (previousMaster ?? draft);
      const { party, changed, link } = await setMainSupplier(
        user,
        productId,
        chosen,
      );
      input.supplierName = party.name.slice(0, 160);
      if (changed) {
        // Trocou o principal: campo que veio igual ao que a tela mostrava é
        // do fornecedor anterior e passa a ser o do escolhido (cadastro e
        // vínculo dele); o que o usuário digitou fica.
        const own: Record<string, string | number | null> = {
          location: party.city?.slice(0, 80) ?? null,
          supplierStore: party.storeNumber?.slice(0, 60) ?? null,
          supplierPhone: party.phone?.slice(0, 40) ?? null,
          factoryItemCode: link?.supplierSku?.slice(0, 60) ?? null,
          price: link?.price ?? null,
          currency: sheetCurrencyOf(link?.currency),
          moq: link?.moq ?? null,
        };
        const bag = input as Record<string, unknown>;
        // Sem principal antes (e sem nome de outro fornecedor na ficha), o
        // que está no formulário não é de outro fornecedor: fica. Campo vazio
        // é completado pelo vínculo do escolhido (preço e moeda juntos).
        const prevName = previousMaster?.supplierName?.trim() || null;
        const nobodys =
          !product?.supplierId && (!prevName || prevName === party.name);
        if (nobodys) {
          if (!sameValue(bag.price, null) || own.price === null) {
            delete own.price;
            delete own.currency;
          }
          if (!sameValue(bag.moq, null) || own.moq === null) delete own.moq;
          // Bloco digitado sem fornecedor: só o que o cadastro tem substitui.
          for (const key of [
            "location",
            "supplierStore",
            "supplierPhone",
            "factoryItemCode",
          ])
            if (own[key] === null) delete own[key];
        }
        for (const [key, value] of Object.entries(own)) {
          const before = (shown as Record<string, unknown> | null)?.[key];
          if (sameValue(bag[key], before) || bag[key] === undefined)
            bag[key] = value;
        }
        blockIsChosen = true;
      } else {
        blockIsChosen =
          !previousMaster || previousMaster.supplierName === party.name;
      }
    }
    const { sheet, missing } = await saveProductSheet(user, productId, input);
    if (chosen && blockIsChosen) {
      const { syncMainSupplierLink } =
        await import("@/lib/services/product-suppliers");
      const { fillRecordsFromSheet } =
        await import("@/lib/services/sheet-records");
      // Código do principal no vínculo dele; o que faltar no cadastro do
      // fornecedor (cidade, loja, telefone) é gravado nele.
      await syncMainSupplierLink(
        user,
        { supplierId: chosen, supplierSku: null },
        { supplierId: chosen, supplierSku: sheet.factoryItemCode },
        productId,
      );
      await fillRecordsFromSheet(user, chosen, productId, sheet);
    }
    if (invalid.length)
      return invalidTarget(`/app/products/${productId}#product-sheet`, invalid);
    return `/app/products/${productId}?sheet=${missing.length ? `partial&at=${Date.now()}` : "complete"}#product-sheet`;
  });
}

/** Mesmo valor do formulário e do banco (texto vazio = nulo; "CNY" = "RMB"). */
function sameValue(a: unknown, b: unknown) {
  const norm = (v: unknown) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string") {
      const s = v.trim();
      return s === "" ? null : s.toUpperCase() === "CNY" ? "RMB" : s;
    }
    return v;
  };
  return norm(a) === norm(b);
}

function sheetCurrencyOf(c: string | null | undefined) {
  const v = (c ?? "").toUpperCase();
  if (v === "CNY" || v === "RMB") return "RMB";
  return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
}

/** "Atualizar cadastro do produto com esta ficha" (pedido ou cotação): só Wellmix. */
export async function adoptSheetIntoProductAction(form: FormData) {
  const user = await requireUser();
  const ownerId = z.string().min(1).max(64).parse(str(form, "ownerId"));
  // Só volta para telas do portal (nada de redirecionar para fora).
  const rawBack = str(form, "back");
  const back = /^\/app\/[A-Za-z0-9\-_/]*$/.test(rawBack) ? rawBack : "/app";
  await run(back, async () => {
    const { adoptSheetIntoProduct } =
      await import("@/lib/services/product-sheet");
    const { productId } = await adoptSheetIntoProduct(user, ownerId);
    return `${back}${back.includes("?") ? "&" : "?"}adopted=${encodeURIComponent(productId)}`;
  });
}

/** Produto fora do catálogo: cadastra com a ficha deste pedido (só Wellmix). */
export async function registerProductFromSheetAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  await run(back, async () => {
    ORDER_ID.parse(orderId);
    const lineId = ORDER_ID.parse(str(form, "lineId"));
    const { registerProductFromOrderSheet } =
      await import("@/lib/services/product-sheet");
    const productId = await registerProductFromOrderSheet(
      user,
      orderId,
      lineId,
    );
    return `${back}?adopted=${encodeURIComponent(productId)}`;
  });
}

/**
 * Wellmix: aplica as caixas da programação na quantidade do pedido (FOB e
 * valor ao cliente acompanham) quando já há pagamento ao fornecedor e a ficha
 * não muda o pedido sozinha.
 */
export async function applySheetQuantityAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  await run(back, async () => {
    ORDER_ID.parse(orderId);
    const { applySheetQuantity } =
      await import("@/lib/services/purchase-sheet");
    await applySheetQuantity(user, orderId);
    return `${back}?quantityApplied=1`;
  });
}
