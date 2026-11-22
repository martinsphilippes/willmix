"use server";

import { z } from "zod";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import type { FormActionState } from "@/lib/form-action-state";
import { assertScreen } from "@/lib/auth/screens";
import { isWellmix } from "@/lib/auth/permissions";
import { requireUser, run, runState, str, withQuery } from "./helpers";

/*
 * Cotação unificada (dono, 22/11/2026; docs/QUOTATION.md): a contraproposta
 * em massa do quadro comparativo (para as solicitações ao fornecedor ligadas
 * ou para as respostas de uma cotação de compra) e a conversa do par
 * fornecedor × produto dentro da cotação de compra. Aqui só o formato; os
 * serviços conferem quem pode.
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);

/** Número digitado (vírgula ou ponto); vazio = nulo; ilegível recusa. */
function number(form: FormData, key: string, int = false): number | null {
  const n = parseNumberInput(str(form, key), { int });
  if (n === null) return null;
  if (!Number.isFinite(n) || n <= 0 || n > 1e9)
    throw new Error("invalid_input");
  return int ? Math.round(n) : n;
}

/** Tela do produto na cotação: a solicitação ou a cotação de compra. */
function boardHref(form: FormData): string {
  const board = str(form, "board");
  if (!ID.safeParse(board).success) return "/app/supplier-requests";
  const product = str(form, "product");
  return `/app/supplier-requests/${board}?view=item${
    ID.safeParse(product).success ? `&product=${product}` : ""
  }`;
}

/**
 * "Devolver com contraproposta" do quadro comparativo: vai para os marcados
 * (`targets`) ou para todos os que podem receber (`scope=all`).
 */
export async function boardCounterStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const back = boardHref(form);
  return runState(back, async () => {
    assertScreen(user, "quotes");
    const kind = z.enum(["request", "quote"]).parse(str(form, "kind"));
    const board = ID.parse(str(form, "board"));
    const raw = form
      .getAll(str(form, "scope") === "all" ? "allTargets" : "targets")
      .filter((v): v is string => typeof v === "string");
    const targets = [...new Set(raw)].slice(0, 60).map((value) => {
      const [type, id] = value.split(":");
      return {
        type: z.enum(["request", "response"]).parse(type),
        id: ID.parse(id),
      };
    });
    if (!targets.length) throw new Error("quote_counter_none");
    const offer = {
      price: number(form, "price"),
      currency: z
        .enum(SHEET_CURRENCIES)
        .nullable()
        .parse(str(form, "currency") || null),
      moq: number(form, "moq", true),
      leadTimeDays: number(form, "leadTimeDays", true),
      incoterm: z
        .enum(SHEET_INCOTERMS)
        .nullable()
        .parse(str(form, "incoterm") || null),
      text: z
        .string()
        .max(4000)
        .nullable()
        .parse(str(form, "text") || null),
    };
    if (kind === "quote") {
      if (targets.some((x) => x.type !== "response"))
        throw new Error("invalid_input");
      const { proposeQuoteCounter } =
        await import("@/lib/services/quote-negotiation");
      await proposeQuoteCounter(user, board, {
        ...offer,
        responseIds: targets.map((x) => x.id),
        productId: ID.parse(str(form, "product")),
      });
    } else {
      if (targets.some((x) => x.type !== "request"))
        throw new Error("invalid_input");
      const { proposeCounterMany } =
        await import("@/lib/services/supplier-request-negotiation");
      await proposeCounterMany(
        user,
        targets.map((x) => x.id),
        offer,
      );
    }
    return withQuery(back, "countered", String(targets.length));
  });
}

/** Mensagem da conversa do par fornecedor × produto na cotação de compra. */
export async function postQuoteMessageStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const quote = str(form, "quoteId");
  const product = str(form, "product");
  const okQuote = ID.safeParse(quote).success;
  // O fornecedor volta para a cotação dele; a Wellmix, para o produto.
  const back = !okQuote
    ? "/app/supplier-requests"
    : isWellmix(user)
      ? `/app/supplier-requests/${quote}?view=item${
          ID.safeParse(product).success ? `&product=${product}` : ""
        }`
      : `/app/purchase-quotes/${quote}`;
  return runState(back, async () => {
    assertScreen(user, "quotes");
    const responseId = str(form, "responseId");
    const { postQuoteMessage } =
      await import("@/lib/services/quote-negotiation");
    const updated = await postQuoteMessage(user, ID.parse(quote), {
      responseId: responseId ? ID.parse(responseId) : null,
      productId: product ? ID.parse(product) : null,
      text: z.string().max(4000).parse(str(form, "text")),
      file: (() => {
        const raw = form.get("file");
        return raw instanceof File && raw.size > 0 ? raw : null;
      })(),
    });
    return isWellmix(user)
      ? withQuery(back, "chat", `response:${updated.id}`) + "#conversa"
      : withQuery(back, "message", "1") + "#negociacao";
  });
}

/* ---- Amostragem dentro da cotação de compra (docs/SUPPLIER_SAMPLING.md) ---- */

/** De quem é a amostragem (cotação, produto e, para a Wellmix, a resposta) e para onde voltar. */
function quoteSamplingOf(form: FormData, wellmix: boolean) {
  const quoteId = str(form, "quoteId");
  const productId = str(form, "product");
  const ok = ID.safeParse(quoteId).success && ID.safeParse(productId).success;
  const back = !ok
    ? "/app/supplier-requests"
    : wellmix
      ? `/app/supplier-requests/${quoteId}?view=item&product=${productId}`
      : `/app/purchase-quotes/${quoteId}`;
  return { quoteId, productId, ok, back };
}

const samplingDone = (back: string, notice: string) =>
  withQuery(back, "sampling", notice) + "#amostragem";

/** O fornecedor adiciona uma foto ou um vídeo da amostra do produto. */
export async function addQuoteSamplingFileAction(form: FormData) {
  const user = await requireUser();
  const { quoteId, productId, ok, back } = quoteSamplingOf(
    form,
    isWellmix(user),
  );
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const raw = form.get("file");
    const file = raw instanceof File && raw.size > 0 ? raw : null;
    const uploaded = str(form, "uploadedFileId");
    const uploadedFileId = uploaded
      ? z
          .string()
          .regex(/^[A-Za-z0-9_.-]{1,64}$/)
          .parse(uploaded)
      : null;
    const { addQuoteSamplingFile } =
      await import("@/lib/services/quote-sampling");
    await addQuoteSamplingFile(user, quoteId, productId, {
      file,
      uploadedFileId,
    });
    return samplingDone(back, "file");
  });
}

/** O fornecedor tira da rodada um arquivo ainda não enviado. */
export async function removeQuoteSamplingFileAction(form: FormData) {
  const user = await requireUser();
  const { quoteId, productId, ok, back } = quoteSamplingOf(
    form,
    isWellmix(user),
  );
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const { removeQuoteSamplingFile } =
      await import("@/lib/services/quote-sampling");
    await removeQuoteSamplingFile(
      user,
      quoteId,
      productId,
      ID.parse(str(form, "documentId")),
    );
    return samplingDone(back, "removed");
  });
}

/** O fornecedor envia a rodada para a validação da Wellmix. */
export async function submitQuoteSamplingAction(form: FormData) {
  const user = await requireUser();
  const { quoteId, productId, ok, back } = quoteSamplingOf(
    form,
    isWellmix(user),
  );
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const note = z
      .string()
      .max(2000)
      .nullable()
      .parse(str(form, "note") || null);
    const { submitQuoteSampling } =
      await import("@/lib/services/quote-sampling");
    await submitQuoteSampling(user, quoteId, productId, note);
    return samplingDone(back, "submitted");
  });
}

/** A Wellmix aprova ou reprova a amostra de um fornecedor na cotação. */
export async function reviewQuoteSamplingAction(form: FormData) {
  const user = await requireUser();
  const { quoteId, productId, ok, back } = quoteSamplingOf(
    form,
    isWellmix(user),
  );
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const decision = z.enum(["approve", "reject"]).parse(str(form, "decision"));
    const note = z
      .string()
      .max(2000)
      .nullable()
      .parse(str(form, "note") || null);
    const { reviewQuoteSampling } =
      await import("@/lib/services/quote-sampling");
    await reviewQuoteSampling(
      user,
      quoteId,
      productId,
      ID.parse(str(form, "responseId")),
      decision,
      note,
    );
    return withQuery(
      back,
      "sampling",
      decision === "approve" ? "approved" : "rejected",
    );
  });
}
