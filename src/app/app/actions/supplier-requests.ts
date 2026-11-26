"use server";

import { z } from "zod";
import { SHEET_CURRENCIES, SHEET_INCOTERMS, YES_NO } from "@/lib/db/schema";
import type { AiReferencePrompts } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import type { User } from "@/lib/db";
import type { FormActionState } from "@/lib/form-action-state";
import { requireUser, run, runState, str, withQuery } from "./helpers";

/*
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md):
 * abrir (Wellmix, tela Booking), responder (o fornecedor dono, ou a Wellmix
 * em nome dele; tela Cotações) e decidir (Wellmix). O serviço confere papel,
 * tela e dono de novo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const SELECTION = "/app/booking/selection";
/**
 * Detalhe da solicitação. Quem abre o link vê primeiro a tabela dos
 * produtos; as ações rápidas dela (`view=table`) voltam para a tabela e as
 * da tela do produto voltam para o produto (`view=item`).
 */
const detail = (id: string, form?: FormData) =>
  form && str(form, "view") === "table"
    ? `/app/supplier-requests/${id}`
    : `/app/supplier-requests/${id}?view=item`;

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

/**
 * Volta para uma aba da Seleção de itens (a Seleção, por padrão) com os
 * filtros que a tela tinha. Os blocos e a abertura das solicitações ficam na
 * aba Blocos Sugeridos (dono, 14/11/2026).
 */
async function selectionBack(
  form: FormData,
  tab: "selection" | "blocks" | "requested" = "selection",
) {
  const { filtersToParams, parseSelectionFilters } =
    await import("@/lib/booking-selection");
  const raw = new URLSearchParams(str(form, "filters").slice(0, 2000));
  const query: Record<string, string[]> = {};
  for (const [k, v] of raw) (query[k] ??= []).push(v);
  const p = filtersToParams(
    parseSelectionFilters(query),
    (raw.get("q") ?? "").slice(0, 200),
  );
  p.set("tab", tab);
  return `${SELECTION}?${p.toString()}`;
}

/** Grava a escolha do grupo comparado (o ganhador e a quantidade); nada vai ao fornecedor. */
export async function saveSelectionGroupAction(form: FormData) {
  const user = await requireUser();
  const back = await selectionBack(form);
  const group = str(form, "group");
  await run(group ? withQuery(back, "ids", group) : back, async () => {
    const chosen = str(form, "chosen");
    if (!chosen) throw new Error("supplier_request_choose");
    const input = z
      .object({
        chosenItemId: ID,
        itemIds: z.array(ID).max(200),
        needs: z.string().max(4000).nullable(),
      })
      .parse({
        chosenItemId: chosen,
        itemIds: [
          ...group.split(",").filter(Boolean),
          ...form
            .getAll("alternatives")
            .filter((v): v is string => typeof v === "string"),
        ],
        needs: str(form, "needs") || null,
      });
    const { saveSelectionGroup } =
      await import("@/lib/services/selection-groups");
    // Programação de compra (rodadas, peças por rodada e intervalo): a mesma
    // do pedido do cliente (RequestScheduleFields), até 12 rodadas.
    const { parseRequestSchedule } =
      await import("@/lib/workflow/request-schedule");
    const { MAX_PURCHASE_ROUNDS } = await import("@/lib/purchase-rounds");
    const schedule = parseRequestSchedule(form, "", MAX_PURCHASE_ROUNDS);
    // Prompts de IA do painel ao lado (docs/SUPPLIER_REQUESTS.md,
    // "Referências por IA"): só o que difere do padrão é gravado.
    let aiPrompts: AiReferencePrompts | null | undefined;
    if (form.has("aiPrompt.product")) {
      const {
        AI_PROMPT_MAX,
        AI_REFERENCE_KINDS,
        defaultPrompts,
        promptsToSave,
      } = await import("@/lib/ai-references");
      const typed = z
        .record(z.string(), z.string().max(AI_PROMPT_MAX * 2))
        .parse(
          Object.fromEntries(
            AI_REFERENCE_KINDS.map((k) => [
              k,
              String(form.get(`aiPrompt.${k}`) ?? ""),
            ]),
          ),
        );
      const { getSettings } = await import("@/lib/settings");
      aiPrompts = promptsToSave(typed, defaultPrompts(await getSettings()));
    }
    // Variações do vencedor: as cores marcadas no card dele (o card vai no
    // formulário com a marca `colorsSent.<item>`; sem ela, todas as cores).
    const colors = form.has(`colorsSent.${chosen}`)
      ? z
          .array(z.string().trim().min(1).max(60))
          .max(30)
          .parse(
            form
              .getAll(`colors.${chosen}`)
              .filter((v): v is string => typeof v === "string"),
          )
      : undefined;
    // Caixas digitadas por cor (o gerador manda só quando valem): JSON
    // { cor: caixas }.
    const typedCartons = str(form, `colorCartons.${chosen}`);
    const colorCartons = typedCartons
      ? z
          .record(z.string().min(1).max(80), z.number().int().min(0).max(1e7))
          .parse(JSON.parse(typedCartons))
      : null;
    // Embalagens e variações do vencedor (dono, 26/11/2026): JSON
    // `packing.<item>`; com ele, as caixas digitadas são de cada combinação
    // (o mesmo campo `colorCartons.<item>`, com as chaves `variação|N`).
    const packing = packingOf(form, chosen);
    const input2 = {
      ...input,
      quantity: schedule ? null : number(form, "quantity", true),
      schedule,
      colors: packing ? undefined : colors,
      colorCartons: packing ? null : colorCartons,
      aiPrompts,
      ...(packing
        ? {
            packing,
            packCartons: colorCartons,
            arts: packingArts(form),
          }
        : {}),
    };
    // "Gravar escolha" no book da Wellmix abre as cotações na hora, uma por
    // variação × embalagem, direto com o Supplier do book.
    if (str(form, "generate") !== "1") {
      const { saveAndOpenSelectionGroup } =
        await import("@/lib/services/selection-groups");
      const { group, opened } = await saveAndOpenSelectionGroup(user, input2);
      const { groupRequests } = await import("@/lib/supplier-requests");
      const count = groupRequests(opened.opened).length;
      const strategy = opened.strategy.reduce(
        (n, g) => n + g.demandIds.length,
        0,
      );
      if (count === 1 && !strategy && !opened.failed.length)
        return withQuery(detail(opened.opened[0].id), "created", "1");
      // Book do parceiro: as demandas foram para a Estratégia de compra.
      let to = await selectionBack(
        form,
        count || strategy ? "requested" : "selection",
      );
      if (count || !strategy) to = withQuery(to, "opened", String(count));
      if (strategy) to = withQuery(to, "strategy", String(strategy));
      if (!count && !strategy)
        to = withQuery(to, "ids", group.itemIds.join(","));
      if (opened.failed.length) {
        to = withQuery(to, "failed", String(opened.failed.length));
        to = withQuery(to, "why", opened.failed[0].error);
      }
      return to;
    }
    const saved = await saveSelectionGroup(user, input2);
    // "Gravar e gerar com IA": grava e gera as imagens e a ficha. A escolha
    // fica gravada mesmo se a IA falhar; a tela diz o motivo.
    if (str(form, "generate") === "1") {
      const { generateGroupReferences } =
        await import("@/lib/services/ai-references");
      const ai = await generateGroupReferences(user, saved.id);
      let to = withQuery(
        withQuery(back, "ids", saved.itemIds.join(",")),
        "saved",
        "1",
      );
      to = withQuery(to, "ai", String(ai.generated));
      if (ai.error) to = withQuery(to, "aiError", ai.error);
      return `${to}#ai-references`;
    }
    const blocks = await selectionBack(form, "blocks");
    return `${withQuery(blocks, "saved", "1")}#blocks`;
  });
}

/** Embalagens e variações da tela (JSON `packing.<item>`); sem ele, nulo. */
function packingOf(form: FormData, chosen: string) {
  const raw = str(form, `packing.${chosen}`);
  if (!raw) return null;
  return z
    .object({
      carton: z.number().int().min(1).max(1e6).nullable(),
      packs: z.array(z.number().int().min(1).max(1e6)).max(20),
      parentOption: z.boolean(),
      mix: z.boolean(),
      variations: z
        .array(
          z.object({
            label: z.string().trim().min(1).max(60),
            custom: z.boolean(),
          }),
        )
        .max(40),
    })
    .parse(JSON.parse(raw.slice(0, 20000)));
}

/**
 * Imagens de exemplo das combinações: o arquivo novo (`art.<chave>`), o que
 * já subiu direto ao armazenamento (`artUploaded.<chave>`) e a gravada antes
 * (`artKeep.<chave>`). A chave é `variação|N` (ou `|N` com o Mix de cores).
 */
function packingArts(form: FormData) {
  const files: Record<string, File> = {};
  const uploaded: Record<string, string> = {};
  const keep: Record<string, string> = {};
  const KEY = /^[^\n]{0,61}\|\d{1,7}$/;
  for (const [name, value] of form.entries()) {
    const m = /^(art|artUploaded|artKeep)\.(.+)$/.exec(name);
    if (!m || !KEY.test(m[2])) continue;
    if (m[1] === "art") {
      if (value instanceof File && value.size > 0) files[m[2]] = value;
    } else if (typeof value === "string" && ID.safeParse(value).success)
      (m[1] === "artUploaded" ? uploaded : keep)[m[2]] = value;
  }
  return { files, uploaded, keep };
}

/** Abre a solicitação ao fornecedor dos grupos resolvidos (os marcados ou todos). */
export async function openGroupRequestsAction(form: FormData) {
  const user = await requireUser();
  const back = await selectionBack(form, "blocks");
  await run(`${back}#blocks`, async () => {
    const all = str(form, "scope") === "all";
    const ids = z
      .array(ID)
      .max(500)
      .parse(
        form.getAll("groups").filter((v): v is string => typeof v === "string"),
      );
    if (!all && !ids.length) throw new Error("selection_group_pick");
    const { openGroupRequests } =
      await import("@/lib/services/selection-groups");
    const result = await openGroupRequests(user, all ? "all" : ids);
    const strategy = result.strategy.reduce(
      (n, g) => n + g.demandIds.length,
      0,
    );
    // Uma solicitação só (um fornecedor), sem falha: direto nela.
    const { groupRequests } = await import("@/lib/supplier-requests");
    if (
      groupRequests(result.opened).length === 1 &&
      !strategy &&
      !result.failed.length
    )
      return withQuery(detail(result.opened[0].id), "created", "1");
    let to = withQuery(
      back,
      "opened",
      String(groupRequests(result.opened).length),
    );
    // Book do parceiro: as demandas que foram para a Estratégia de compra.
    if (strategy) to = withQuery(to, "strategy", String(strategy));
    if (result.failed.length) {
      to = withQuery(to, "failed", String(result.failed.length));
      to = withQuery(to, "why", result.failed[0].error);
    }
    return `${to}#blocks`;
  });
}

/** Tela de volta de uma solicitação (a tabela ou o produto). */
const backFor = (form: FormData) => {
  const raw = str(form, "id");
  return ID.safeParse(raw).success
    ? detail(raw, form)
    : "/app/supplier-requests";
};

/** Resposta do fornecedor: grava e diz para onde voltar. */
async function answerDo(user: User, form: FormData, back: string) {
  const raw = str(form, "id");
  const input = z
    .object({
      id: ID,
      canDo: z.enum(YES_NO),
      currency: z.enum(SHEET_CURRENCIES).nullable(),
      incoterm: z.enum(SHEET_INCOTERMS).nullable(),
      note: z.string().max(4000).nullable(),
    })
    .parse({
      id: raw,
      canDo: str(form, "canDo"),
      currency: str(form, "currency") || null,
      incoterm: str(form, "incoterm") || null,
      note: str(form, "note") || null,
    });
  const { answerSupplierRequest } =
    await import("@/lib/services/supplier-requests");
  await answerSupplierRequest(user, input.id, {
    canDo: input.canDo,
    currency: input.currency,
    incoterm: input.incoterm,
    note: input.note,
    price: number(form, "price"),
    moq: number(form, "moq", true),
    leadTimeDays: number(form, "leadTimeDays", true),
  });
  return withQuery(back, "answered", "1");
}

export async function answerSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const back = backFor(form);
  await run(back, () => answerDo(user, form, back));
}

/**
 * A mesma resposta, pela tela da negociação: com erro, o que foi digitado
 * fica nos campos (docs/SUPPLIER_REQUESTS.md, "Tela da negociação
 * reorganizada").
 */
export async function answerSupplierRequestStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const back = backFor(form);
  return runState(back, () => answerDo(user, form, back));
}

/** Decisão da Wellmix (aprovar, recusar, cancelar): grava e diz para onde voltar. */
async function decideDo(user: User, form: FormData, back: string) {
  const input = z
    .object({
      id: ID,
      decision: z.enum(["approved", "declined", "cancelled"]),
      note: z.string().max(500).nullable(),
    })
    .parse({
      id: str(form, "id"),
      decision: str(form, "decision"),
      note: str(form, "note") || null,
    });
  const { decideSupplierRequest } =
    await import("@/lib/services/supplier-requests");
  await decideSupplierRequest(user, input.id, input.decision, input.note);
  return withQuery(back, "decided", input.decision);
}

export async function decideSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  const back = backFor(form);
  await run(back, () => decideDo(user, form, back));
}

/** A mesma decisão, pela tela da negociação (com erro, a observação fica). */
export async function decideSupplierRequestStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const back = backFor(form);
  return runState(back, () => decideDo(user, form, back));
}

/**
 * Depois de aprovar uma solicitação ligada: continuar negociando esta ou
 * recusá-la. Volta para a tela de onde veio (`back`: a aprovada ou esta).
 */
export async function resolveLinkedRequestAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "id");
  const backRaw = str(form, "back");
  const back = ID.safeParse(backRaw).success
    ? detail(backRaw)
    : ID.safeParse(raw).success
      ? detail(raw)
      : "/app/supplier-requests";
  await run(back, async () => {
    const input = z
      .object({ id: ID, choice: z.enum(["keep", "decline"]) })
      .parse({ id: raw, choice: str(form, "choice") });
    const { resolveLinkedRequest } =
      await import("@/lib/services/supplier-requests");
    await resolveLinkedRequest(user, input.id, input.choice);
    return withQuery(back, "linked", input.choice);
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
  const incoterm = z
    .enum(SHEET_INCOTERMS)
    .nullable()
    .parse(str(form, "incoterm") || null);
  return {
    price: number(form, "price"),
    currency,
    moq: number(form, "moq", true),
    leadTimeDays: number(form, "leadTimeDays", true),
    incoterm,
    text,
  };
}

function backOf(form: FormData) {
  const raw = str(form, "id");
  const ok = ID.safeParse(raw).success;
  // Quadro comparativo (dono, 22/11/2026; docs/QUOTATION.md): a ação de uma
  // solicitação ligada volta para a tela do produto de onde ela foi feita.
  const board = str(form, "board");
  return {
    id: raw,
    back: !ok
      ? "/app/supplier-requests"
      : ID.safeParse(board).success
        ? `/app/supplier-requests/${board}?view=item`
        : detail(raw, form),
    ok,
    board: ok && ID.safeParse(board).success,
  };
}

/** Contraproposta da Wellmix (comentário obrigatório): grava e diz para onde voltar. */
async function proposeDo(user: User, form: FormData) {
  const { id, back, ok } = backOf(form);
  if (!ok) throw new Error("invalid_input");
  const { proposeCounter } =
    await import("@/lib/services/supplier-request-negotiation");
  await proposeCounter(user, id, offerOf(form));
  return withQuery(back, "negotiation", "proposal");
}

/** A Wellmix devolve com contraproposta (comentário obrigatório). */
export async function proposeSupplierRequestAction(form: FormData) {
  const user = await requireUser();
  await run(backOf(form).back, () => proposeDo(user, form));
}

/**
 * A mesma contraproposta, pela tela da negociação: com erro, os valores e o
 * comentário ficam nos campos para corrigir e enviar de novo.
 */
export async function proposeSupplierRequestStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  return runState(backOf(form).back, () => proposeDo(user, form));
}

/** Resposta do fornecedor à contraproposta: grava e diz para onde voltar. */
async function respondDo(user: User, form: FormData) {
  const { id, back, ok } = backOf(form);
  if (!ok) throw new Error("invalid_input");
  const action = z
    .enum(["accept", "counter", "reject"])
    .parse(str(form, "action"));
  const { respondToProposal } =
    await import("@/lib/services/supplier-request-negotiation");
  await respondToProposal(user, id, action, offerOf(form));
  return withQuery(back, "negotiation", action);
}

/** O fornecedor (ou a Wellmix por ele) aceita, responde com outra proposta ou recusa. */
export async function respondProposalAction(form: FormData) {
  const user = await requireUser();
  await run(backOf(form).back, () => respondDo(user, form));
}

/** A mesma resposta à contraproposta, pela tela da negociação (com erro, os campos ficam). */
export async function respondProposalStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  return runState(backOf(form).back, () => respondDo(user, form));
}

/**
 * O fornecedor confirma ou recusa a oferta vigente do produto, direto da
 * tabela (sem formulário). `offer` é o retrato da oferta que a tela mostrou.
 */
export async function respondOfferAction(form: FormData) {
  const user = await requireUser();
  const { id, back, ok } = backOf(form);
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const input = z
      .object({
        action: z.enum(["confirm", "refuse"]),
        offer: z.string().min(1).max(200),
      })
      .parse({ action: str(form, "action"), offer: str(form, "offer") });
    const { respondToOffer } =
      await import("@/lib/services/supplier-request-negotiation");
    await respondToOffer(user, id, input.action, input.offer);
    return withQuery(
      back,
      "offer",
      input.action === "confirm" ? "confirmed" : "refused",
    );
  });
}

/** Mensagem livre da conversa, com ou sem arquivo (foto, PDF ou Excel). */
/** Mensagem da conversa (texto e, se houver, o arquivo): grava e diz para onde voltar. */
async function messageDo(user: User, form: FormData) {
  const { id, back, ok, board } = backOf(form);
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
  // No quadro comparativo, o modal da conversa desse fornecedor reabre.
  return (
    withQuery(
      board ? withQuery(back, "chat", `request:${id}`) : back,
      "negotiation",
      "message",
    ) + "#conversa"
  );
}

export async function postSupplierRequestMessageAction(form: FormData) {
  const user = await requireUser();
  await run(backOf(form).back, () => messageDo(user, form));
}

/** A mesma mensagem, pela conversa da negociação (com erro, o texto e o arquivo ficam). */
export async function postSupplierRequestMessageStateAction(
  _prev: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  return runState(backOf(form).back, () => messageDo(user, form));
}

/* ------------------------------------------------------------------------ */
/* Amostragem (docs/SUPPLIER_SAMPLING.md)                                    */
/* ------------------------------------------------------------------------ */

const sampling = (id: string) => `/app/supplier-requests/${id}?view=item`;
const samplingBack = (url: string, notice: string) =>
  withQuery(url, "sampling", notice) + "#amostragem";

/** O responsável adiciona uma foto ou um vídeo da amostra. */
export async function addSamplingFileAction(form: FormData) {
  const user = await requireUser();
  const { id, ok } = backOf(form);
  const back = ok ? sampling(id) : "/app/supplier-requests";
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
    const { addSamplingFile } =
      await import("@/lib/services/supplier-request-sampling");
    await addSamplingFile(user, id, { file, uploadedFileId });
    return samplingBack(back, "file");
  });
}

/** O responsável tira da rodada um arquivo ainda não enviado. */
export async function removeSamplingFileAction(form: FormData) {
  const user = await requireUser();
  const { id, ok } = backOf(form);
  const back = ok ? sampling(id) : "/app/supplier-requests";
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const documentId = ID.parse(str(form, "documentId"));
    const { removeSamplingFile } =
      await import("@/lib/services/supplier-request-sampling");
    await removeSamplingFile(user, id, documentId);
    return samplingBack(back, "removed");
  });
}

/** O responsável envia a rodada para a validação da Wellmix. */
export async function submitSamplingAction(form: FormData) {
  const user = await requireUser();
  const { id, ok } = backOf(form);
  const back = ok ? sampling(id) : "/app/supplier-requests";
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const note = z
      .string()
      .max(2000)
      .nullable()
      .parse(str(form, "note") || null);
    const { submitSampling } =
      await import("@/lib/services/supplier-request-sampling");
    await submitSampling(user, id, note);
    return samplingBack(back, "submitted");
  });
}

/** A Wellmix aprova ou reprova a amostra (motivo obrigatório para reprovar). */
export async function reviewSamplingAction(form: FormData) {
  const user = await requireUser();
  // Validada pelo card Imagens de outra solicitação (a ligada): volta para a
  // tela em que a Wellmix está (`board`).
  const { id, ok, board, back: home } = backOf(form);
  const back = !ok ? "/app/supplier-requests" : board ? home : sampling(id);
  await run(back, async () => {
    if (!ok) throw new Error("invalid_input");
    const decision = z.enum(["approve", "reject"]).parse(str(form, "decision"));
    const note = z
      .string()
      .max(2000)
      .nullable()
      .parse(str(form, "note") || null);
    const { reviewSampling } =
      await import("@/lib/services/supplier-request-sampling");
    await reviewSampling(user, id, decision, note);
    return samplingBack(back, decision === "approve" ? "approved" : "rejected");
  });
}
