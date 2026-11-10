"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import { NEGOTIATION_REPLIES, OFFER_REPLIES } from "@/lib/quote-flow";
import { files, requireUser, run, str } from "./helpers";

/*
 * Cotação: negociação e proposta de embalagem (docs/QUOTE_FLOW.md). Aqui só
 * o formato; o serviço confere papel, dono da cotação e situação.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const text = (form: FormData, key: string, max: number) => {
  const v = str(form, key);
  if (v.length > max) throw new Error("invalid_input");
  return v;
};
/** Preço digitado ("3,42"): nulo quando vazio; recusa o que não é número. */
const price = (form: FormData, key: string): number | null => {
  const raw = str(form, key);
  if (!raw) return null;
  const n = parseNumberInput(raw);
  if (n === null || Number.isNaN(n) || n <= 0) throw new Error("invalid_input");
  return n;
};
const backOf = (quoteId: string, anchor: string) =>
  ID.test(quoteId) ? `/app/quotes/${quoteId}#${anchor}` : "/app";

/** Wellmix: devolve a cotação com o motivo e, se quiser, a contraproposta. */
export async function returnQuoteAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  await run(backOf(quoteId, "negotiation"), async () => {
    assertWellmix(user);
    assertScreen(user, "quotes");
    const id = z.string().regex(ID).parse(quoteId);
    const { returnQuote } = await import("@/lib/services/quote-flow");
    await returnQuote(user, id, {
      comment: text(form, "comment", 1000),
      targetPrice: price(form, "targetPrice"),
    });
    return `/app/quotes/${id}?negotiation=returned#negotiation`;
  });
}

/** Fornecedor (ou a Wellmix por ele): aceita, manda outro preço ou mantém. */
export async function replyNegotiationAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  await run(backOf(quoteId, "negotiation"), async () => {
    assertScreen(user, "quotes");
    const id = z.string().regex(ID).parse(quoteId);
    const decision = z.enum(NEGOTIATION_REPLIES).parse(str(form, "decision"));
    const { replyNegotiation } = await import("@/lib/services/quote-flow");
    await replyNegotiation(user, id, {
      decision,
      price: decision === "counter" ? price(form, "price") : null,
      comment: text(form, "comment", 1000) || null,
    });
    return `/app/quotes/${id}?negotiation=replied#negotiation`;
  });
}

/**
 * Fornecedor (ou a Wellmix por ele): confirma o preço desejado ou manda o
 * dele. O botão apertado diz qual (`decision`).
 */
export async function replyQuoteOfferAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  await run(backOf(quoteId, "offer"), async () => {
    assertScreen(user, "quotes");
    const id = z.string().regex(ID).parse(quoteId);
    const decision = z.enum(OFFER_REPLIES).parse(str(form, "decision"));
    // "Não aceito" não pede prazo (o botão não valida o formulário).
    let days: number | null = null;
    if (decision !== "decline") {
      days = parseNumberInput(str(form, "leadTimeDays"), { int: true });
      if (days === null || !Number.isInteger(days))
        throw new Error("offer_lead_time_required");
    }
    const { replyQuoteOffer } = await import("@/lib/services/quote-flow");
    const quote = await replyQuoteOffer(user, id, {
      decision,
      price: decision === "counter" ? price(form, "price") : null,
      leadTimeDays: days,
      comment: text(form, "comment", 1000) || null,
    });
    const last = quote.negotiation?.at(-1)?.kind;
    if (last === "decline") return `/app/quotes/${id}?offer=declined#offer`;
    return `/app/quotes/${id}?negotiation=${
      last === "confirm" ? "confirmed" : "countered"
    }#negotiation`;
  });
}

/** Wellmix: envia a imagem da proposta de embalagem e o prompt. */
export async function sendPackagingProposalAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  await run(backOf(quoteId, "packaging-proposal"), async () => {
    assertWellmix(user);
    assertScreen(user, "quotes");
    const id = z.string().regex(ID).parse(quoteId);
    const [image] = files(form, "image");
    if (!image) throw new Error("proposal_image_required");
    const { sendPackagingProposal } = await import("@/lib/services/quote-flow");
    await sendPackagingProposal(user, id, {
      prompt: text(form, "prompt", 2000) || null,
      image,
    });
    return `/app/quotes/${id}?proposal=sent#packaging-proposal`;
  });
}

/** Fornecedor (ou a Wellmix por ele): OK ou Não na proposta de embalagem. */
export async function decidePackagingProposalAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  await run(backOf(quoteId, "packaging-proposal"), async () => {
    assertScreen(user, "quotes");
    const id = z.string().regex(ID).parse(quoteId);
    const decision = z.enum(["ok", "no"]).parse(str(form, "decision"));
    const { decidePackagingProposal } =
      await import("@/lib/services/quote-flow");
    await decidePackagingProposal(user, id, {
      decision,
      comment: text(form, "comment", 1000) || null,
    });
    return `/app/quotes/${id}?proposal=${decision}#packaging-proposal`;
  });
}
