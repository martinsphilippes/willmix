"use server";

import { z } from "zod";
import { SHEET_CURRENCIES, YES_NO } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md):
 * abrir (Wellmix, tela Booking), responder (o fornecedor dono, ou a Wellmix
 * em nome dele; tela Cotações) e decidir (Wellmix). O serviço confere papel,
 * tela e dono de novo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const SELECTION = "/app/booking/selection";
/**
 * Detalhe da solicitação. O fornecedor abre primeiro a tabela dos produtos;
 * o formulário da tela do produto (`view=item`) volta para ela mesma.
 */
const detail = (id: string, form?: FormData) =>
  form && str(form, "view") === "item"
    ? `/app/supplier-requests/${id}?view=item`
    : `/app/supplier-requests/${id}`;

/** Número digitado (vírgula ou ponto); vazio = nulo; ilegível recusa. */
function number(form: FormData, key: string, int = false): number | null {
  const n = parseNumberInput(str(form, key), { int });
  if (n === null) return null;
  if (!Number.isFinite(n) || n <= 0 || n > 1e9)
    throw new Error("invalid_input");
  return int ? Math.round(n) : n;
}

export async function openSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const q = str(form, "q").slice(0, 200);
  const back = q ? `${SELECTION}?q=${encodeURIComponent(q)}` : SELECTION;
  await run(back, async () => {
    const chosen = str(form, "chosen");
    if (!chosen) throw new Error("supplier_request_choose");
    const input = z
      .object({
        itemId: ID,
        alternativeIds: z.array(ID).max(60),
        needs: z.string().max(4000).nullable(),
      })
      .parse({
        itemId: chosen,
        alternativeIds: form
          .getAll("alternatives")
          .filter((v): v is string => typeof v === "string"),
        needs: str(form, "needs") || null,
      });
    const { openSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    const request = await openSupplierRequest(user, {
      ...input,
      quantity: number(form, "quantity", true),
      searchQuery: q || null,
    });
    return withQuery(detail(request.id), "created", "1");
  });
}

export async function answerSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw, form)
    : "/app/supplier-requests";
  await run(back, async () => {
    const input = z
      .object({
        id: ID,
        canDo: z.enum(YES_NO),
        currency: z.enum(SHEET_CURRENCIES).nullable(),
        note: z.string().max(4000).nullable(),
      })
      .parse({
        id: raw,
        canDo: str(form, "canDo"),
        currency: str(form, "currency") || null,
        note: str(form, "note") || null,
      });
    const { answerSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    await answerSupplierRequest(user, input.id, {
      canDo: input.canDo,
      currency: input.currency,
      note: input.note,
      price: number(form, "price"),
      moq: number(form, "moq", true),
      leadTimeDays: number(form, "leadTimeDays", true),
    });
    return withQuery(back, "answered", "1");
  });
}

export async function decideSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw, form)
    : "/app/supplier-requests";
  await run(back, async () => {
    const input = z
      .object({
        id: ID,
        decision: z.enum(["approved", "declined", "cancelled"]),
        note: z.string().max(500).nullable(),
      })
      .parse({
        id: raw,
        decision: str(form, "decision"),
        note: str(form, "note") || null,
      });
    const { decideSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    await decideSupplierRequest(user, input.id, input.decision, input.note);
    return withQuery(back, "decided", input.decision);
  });
}

/* ---- Produto da solicitação aprovada (docs/SUPPLIER_REQUESTS.md, "Produto") ---- */

/** Itens marcados no formulário (ids). */
function itemIds(form: FormData): string[] {
  return z
    .array(ID)
    .max(60)
    .parse(
      form.getAll("itemIds").filter((v): v is string => typeof v === "string"),
    );
}

/** Um formulário, dois botões: criar o produto novo ou associar ao escolhido. */
export async function requestProductAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw)
    : "/app/supplier-requests";
  await run(back, async () => {
    const id = ID.parse(raw);
    const mode = z.enum(["create", "link"]).parse(str(form, "mode"));
    const svc = await import("@/lib/services/supplier-request-product");
    if (mode === "create") {
      const input = z
        .object({ name: z.string().max(160), lineId: ID })
        .parse({ name: str(form, "name"), lineId: str(form, "lineId") });
      await svc.createProductFromRequest(user, id, {
        ...input,
        itemIds: itemIds(form),
      });
      return withQuery(back, "product", "created");
    }
    const productId = str(form, "productId");
    if (!productId) throw new Error("request_product_choose");
    await svc.linkRequestToProduct(user, id, {
      productId: ID.parse(productId),
      itemIds: itemIds(form),
    });
    return withQuery(back, "product", "linked");
  });
}

export async function linkMoreRequestItemsAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw)
    : "/app/supplier-requests";
  await run(back, async () => {
    const svc = await import("@/lib/services/supplier-request-product");
    await svc.linkMoreItems(user, ID.parse(raw), itemIds(form));
    return withQuery(back, "product", "items");
  });
}

export async function releaseRequestProductAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw)
    : "/app/supplier-requests";
  await run(back, async () => {
    const svc = await import("@/lib/services/supplier-request-product");
    await svc.releaseRequestProduct(user, ID.parse(raw));
    return withQuery(back, "product", "released");
  });
}

export async function setRequestErpCodeAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const back = ID.safeParse(raw).success
    ? detail(raw)
    : "/app/supplier-requests";
  await run(back, async () => {
    const code = z.string().max(20).parse(str(form, "erpCode"));
    const svc = await import("@/lib/services/supplier-request-product");
    const { checked } = await svc.setRequestProductErpCode(
      user,
      ID.parse(raw),
      code,
    );
    return withQuery(
      back,
      "erp",
      code ? (checked ? "checked" : "unchecked") : "cleared",
    );
  });
}

/* ---- Negociação (docs/SUPPLIER_REQUESTS.md, "Negociação") ---- */

function offerOf(form: FormData) {
  const currency = z
    .enum(SHEET_CURRENCIES)
    .nullable()
    .parse(str(form, "currency") || null);
  const text = z
    .string()
    .max(4000)
    .nullable()
    .parse(str(form, "text") || null);
  return {
    price: number(form, "price"),
    currency,
    moq: number(form, "moq", true),
    leadTimeDays: number(form, "leadTimeDays", true),
    text,
  };
}

function backOf(form: FormData) {
  const raw = str(form, "id");
  const ok = ID.safeParse(raw).success;
  return {
    id: raw,
    back: ok ? detail(raw, form) : "/app/supplier-requests",
    ok,
  };
}

/** A Wellmix devolve com contraproposta (comentário obrigatório). */
export async function proposeSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const { id, back, ok } = backOf(form);
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const { proposeCounter } =
      await import("@/lib/services/supplier-request-negotiation");
    await proposeCounter(user, id, offerOf(form));
    return withQuery(back, "negotiation", "proposal");
  });
}

/** O fornecedor (ou a Wellmix por ele) aceita, responde com outra proposta ou recusa. */
export async function respondProposalAction(form: FormData) {
  const user = await requireUser();
  const { id, back, ok } = backOf(form);
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const action = z
      .enum(["accept", "counter", "reject"])
      .parse(str(form, "action"));
    const { respondToProposal } =
      await import("@/lib/services/supplier-request-negotiation");
    await respondToProposal(user, id, action, offerOf(form));
    return withQuery(back, "negotiation", action);
  });
}

/** Mensagem livre da conversa, com ou sem arquivo (foto, PDF ou Excel). */
export async function postSupplierRequestMessageAction(form: FormData) {
  const user = await requireUser();
  const { id, back, ok } = backOf(form);
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const text = z
      .string()
      .max(4000)
      .nullable()
      .parse(str(form, "text") || null);
    const raw = form.get("file");
    const file = raw instanceof File && raw.size > 0 ? raw : null;
    const { postRequestMessage } =
      await import("@/lib/services/supplier-request-negotiation");
    await postRequestMessage(user, id, { text, file });
    return withQuery(back, "negotiation", "message") + "#conversa";
  });
}
