import "server-only";
import { getStore, type RequestDraft, type User } from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { can } from "@/lib/auth/function-access";
import {
  REPLENISHMENT_FROM,
  REQUEST_SCREEN,
  REQUEST_SCREEN_FIELD,
  draftIsReplenishment,
  draftResumeHref,
  draftScreenOf,
  type RequestScreenMode,
} from "@/lib/request-screens";
import { audit } from "./audit";

/*
 * Rascunho da Nova solicitação (dono, 15/11/2026; docs/ORDER_TERMS.md
 * seção 9): o vendedor salva o formulário como está e completa depois.
 * Guarda os campos de texto como vieram (sem arquivos e sem os campos
 * internos do envio). Some quando a solicitação é enviada. Ver: quem criou
 * e, em Encomendas, o administrador (os de todos os logins; dono,
 * 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 9). Continuar (reabrir,
 * salvar, enviar e apagar): quem criou e, desde 21/11/2026, o administrador
 * (`canContinueDraft`), que completa sem tomar o rascunho de quem o salvou.
 */

export class DraftError extends Error {}

/**
 * De qual tela é o rascunho (docs/REQUEST_SCREENS.md): a Nova solicitação de
 * Encomendas (nulo, todos os de antes de 16/11/2026) ou a de TS ou de Venda.
 * Cada tela lista, reabre e apaga só os dela.
 */
export type DraftScreen = RequestScreenMode | null;

/** Teto de campos e de tamanho (o formulário não chega perto). */
const MAX_FIELDS = 2000;
const MAX_VALUE = 10_000;

/**
 * Quem tem rascunho na tela. A entrada da Reposição (tela Venda com
 * `?from=replenishment`; dono, 17/11/2026) vale para quem abre a fila: a
 * ação "Abrir reposição" e a tela Encomendas, como a própria entrada.
 */
export const canDraft = (
  user: User,
  screen: DraftScreen = null,
  replenish = false,
) =>
  isWellmix(user) &&
  (replenish
    ? screen === "sale" &&
      can(user, "replenishment.open") &&
      canOpen(user, "requests")
    : canOpen(user, screen ? REQUEST_SCREEN[screen].screen : "requests"));

/**
 * Quem continua o rascunho (abre no formulário, completa, salva e envia):
 * quem o salvou e, desde 21/11/2026 (dono; docs/ORDER_LEVEL_LISTS.md, seção
 * 9), o administrador, que já vê em Encomendas os rascunhos de todos os
 * logins, para o "Concluir e enviar" da lista levar ao envio. Só enquanto a
 * pessoa abre a tela de onde o rascunho veio. O da entrada da Reposição fica
 * com quem o salvou (a fila de Reposição só lista os de quem vê).
 */
export function canContinueDraft(
  user: User,
  draft: Pick<RequestDraft, "userId" | "payload">,
): boolean {
  if (!isWellmix(user)) return false;
  const screen = draftScreenOf(draft.payload);
  const replenish = screen === "sale" && draftIsReplenishment(draft.payload);
  if (draft.userId === user.id) return canDraft(user, screen, replenish);
  return isAdmin(user) && !replenish && canDraft(user, screen, false);
}

/** O rascunho é desta tela (e desta entrada: Reposição ou não)? */
const sameEntry = (
  draft: Pick<RequestDraft, "payload">,
  screen: DraftScreen,
  replenish: boolean,
) =>
  draftScreenOf(draft.payload) === screen &&
  draftIsReplenishment(draft.payload) === replenish;

/** Os campos do formulário que vão para o rascunho. */
export function draftPayload(form: FormData): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    if (
      key.startsWith("$ACTION") ||
      key === "draftId" ||
      // A tela vem de quem grava (o servidor), não do formulário.
      key === REQUEST_SCREEN_FIELD
    )
      continue;
    out.push([key.slice(0, 120), value.slice(0, MAX_VALUE)]);
    if (out.length >= MAX_FIELDS) break;
  }
  return out;
}

/** O rascunho de volta como os campos de um formulário. */
export function draftForm(draft: Pick<RequestDraft, "payload">): FormData {
  const form = new FormData();
  for (const [key, value] of draft.payload ?? []) form.append(key, value);
  return form;
}

function titleOf(payload: Array<[string, string]>): {
  title: string;
  itemCount: number;
} {
  const names = payload
    .filter(([k, v]) => /^p\d+\.productName$/.test(k) && v.trim())
    .map(([, v]) => v.trim());
  const rows = new Set(
    payload
      .map(([k]) => /^p(\d+)\./.exec(k)?.[1])
      .filter((v): v is string => !!v),
  );
  const first = names[0] ?? "";
  return {
    title: (
      first + (rows.size > 1 ? ` + ${rows.size - 1}` : "") || "Sem produto"
    ).slice(0, 200),
    itemCount: rows.size,
  };
}

/** Reserva o próximo número de solicitação (sequência `request_number`). */
async function reserveNumber(): Promise<number> {
  const { nextRequestNumber } = await import("./requests");
  return nextRequestNumber();
}

/** Grava (novo ou por cima do mesmo) o rascunho de quem está no formulário. */
export async function saveRequestDraft(
  user: User,
  form: FormData,
  draftId: string | null,
  screen: DraftScreen = null,
): Promise<RequestDraft> {
  const store = getStore();
  const payload = draftPayload(form);
  // Entrada da Reposição: o campo do formulário diz; a permissão confere.
  const replenish = screen === "sale" && draftIsReplenishment(payload);
  if (!canDraft(user, screen, replenish)) throw new ForbiddenError();
  // Fora da tela Venda, o campo da Reposição não vale no rascunho.
  if (!replenish)
    for (let i = payload.length - 1; i >= 0; i--)
      if (payload[i][0] === REPLENISHMENT_FROM) payload.splice(i, 1);
  // A tela de TS ou de Venda fica marcada no rascunho (a de Encomendas, não).
  if (screen) payload.push([REQUEST_SCREEN_FIELD, screen]);
  const customerId =
    payload.find(([k]) => k === "customerId")?.[1]?.trim() || null;
  const customer =
    customerId && /^[A-Za-z0-9_-]{1,64}$/.test(customerId)
      ? await store.get("parties", customerId)
      : null;
  const data = {
    userId: user.id,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? null,
    ...titleOf(payload),
    payload,
  };
  if (draftId) {
    const current = await store.get("request_drafts", draftId);
    if (
      !current ||
      !sameEntry(current, screen, replenish) ||
      !canContinueDraft(user, current)
    )
      throw new DraftError("draft_not_found");
    // Rascunho de antes da numeração: ganha o número no próximo salvamento.
    return store.update("request_drafts", draftId, {
      ...data,
      // O administrador completando o rascunho de outro login (dono,
      // 21/11/2026): o rascunho continua de quem o salvou, que segue vendo
      // e continuando o dele.
      userId: current.userId,
      ...(typeof current.number === "number"
        ? {}
        : { number: await reserveNumber() }),
    });
  }
  // Número da solicitação desde o rascunho (dono, 19/11/2026): a mesma
  // sequência das enviadas; ao enviar, a solicitação repete este número.
  const draft = await store.create("request_drafts", {
    ...data,
    number: await reserveNumber(),
  });
  await audit(
    user,
    "request.draft",
    "request_draft",
    draft.id,
    `Rascunho da Nova solicitação: ${draft.title}`,
  );
  return draft;
}

/**
 * O rascunho que quem pede continua, desta tela (nulo se não pode continuar,
 * é de outra tela ou não existe): o dele ou, para o administrador, o de
 * outro login (`canContinueDraft`). É o que o formulário reabre, o envio
 * aproveita (número, conversa) e apaga.
 */
export async function getRequestDraft(
  user: User,
  id: string,
  screen: DraftScreen = null,
  replenish = false,
): Promise<RequestDraft | null> {
  if (!canDraft(user, screen, replenish) || !/^[A-Za-z0-9_-]{1,64}$/.test(id))
    return null;
  const draft = await getStore().get("request_drafts", id);
  return draft &&
    sameEntry(draft, screen, replenish) &&
    canContinueDraft(user, draft)
    ? draft
    : null;
}

/**
 * O rascunho de Encomendas que esta pessoa pode ver (os detalhes e a conversa
 * dele; dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seções 7 e 9): quem o
 * salvou, da Wellmix, ou o administrador (o de qualquer login), e só se ainda
 * abre a tela de onde ele veio (a regra de "Continuar"). O da entrada da
 * Reposição é da fila de Reposição. Nulo: não existe ou a pessoa não pode
 * ver (a tela responde 404, sem dizer qual). Ver não é continuar: o
 * formulário só reabre o rascunho de quem o salvou (`getRequestDraft`).
 */
export async function getListedDraft(
  user: User,
  id: string,
): Promise<RequestDraft | null> {
  if (!isWellmix(user) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const draft = await getStore()
    .get("request_drafts", id)
    .catch(() => null);
  if (!draft) return null;
  if (draft.userId !== user.id && !isAdmin(user)) return null;
  const screen = draftScreenOf(draft.payload);
  if (screen === "sale" && draftIsReplenishment(draft.payload)) return null;
  return canDraft(user, screen, false) ? draft : null;
}

/** Quem salvou o rascunho (o nome na lista e nos detalhes; o login só para o administrador). */
export interface DraftOwner {
  id: string;
  name: string;
  email: string | null;
}

/** Quem salvou cada rascunho, pelo id do login (fora: o login não existe mais). */
export async function draftOwners(
  drafts: Pick<RequestDraft, "userId">[],
): Promise<Map<string, DraftOwner>> {
  const ids = [...new Set(drafts.map((d) => d.userId).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await getStore().list("users", { filter: { id: ids } });
  return new Map(
    users.map((u) => [
      u.id,
      { id: u.id, name: u.name, email: u.email ?? null },
    ]),
  );
}

/** Os rascunhos de quem pede, desta tela, o mais recente primeiro. */
export async function listRequestDrafts(
  user: User,
  screen: DraftScreen = null,
  replenish = false,
): Promise<RequestDraft[]> {
  if (!canDraft(user, screen, replenish)) return [];
  const rows = await getStore().list("request_drafts", {
    filter: { userId: user.id },
    orderBy: "updatedAt",
    direction: "desc",
    // Folga para os rascunhos das outras telas (o filtro é pelo conteúdo).
    limit: 60,
  });
  return rows.filter((d) => sameEntry(d, screen, replenish)).slice(0, 20);
}

/** Apaga o rascunho desta tela que quem pede continua (`getRequestDraft`). */
export async function deleteRequestDraft(
  user: User,
  id: string,
  screen: DraftScreen = null,
  replenish = false,
): Promise<void> {
  const draft = await getRequestDraft(user, id, screen, replenish);
  if (!draft) return;
  await getStore().remove("request_drafts", draft.id);
}

/** Um rascunho na lista de Encomendas ou de Reposição, com o endereço para continuar. */
export interface ListedDraft {
  draft: RequestDraft;
  href: string;
  /** Quem salvou (nulo: o login não existe mais). */
  owner: DraftOwner | null;
  /** Quem vê é quem salvou. */
  mine: boolean;
  /**
   * Quem vê continua o rascunho (o "Concluir e enviar" da lista leva ao
   * formulário): quem salvou ou o administrador (`canContinueDraft`).
   */
  canContinue: boolean;
}

/**
 * Os rascunhos de quem pede nas listas (dono, 17/11/2026): Encomendas
 * (/app/requests) mostra os da Nova solicitação, de TS e de Venda; Reposição
 * (/app/replenishment), os da entrada da Reposição. Só os das telas que a
 * pessoa abre, o mais recente primeiro.
 *
 * O administrador vê em Encomendas os rascunhos de todos os logins (dono,
 * 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 9), com quem salvou cada um.
 * A Reposição continua só com os de quem vê: o rascunho dela abre direto no
 * formulário, que só reabre o de quem o salvou.
 */
export async function listDraftsForList(
  user: User,
  list: "requests" | "replenishment",
  /**
   * Quantos no máximo. Encomendas lê todos os de quem vê (o card Rascunhos
   * conta todos, dono 19/11/2026); a Reposição segue com os 20 mais novos.
   */
  max = 20,
): Promise<ListedDraft[]> {
  if (!isWellmix(user)) return [];
  const everyone = list === "requests" && isAdmin(user);
  const rows = await getStore().list("request_drafts", {
    ...(everyone ? {} : { filter: { userId: user.id } }),
    orderBy: "updatedAt",
    direction: "desc",
    // Folga para os rascunhos das outras telas (o filtro é pelo conteúdo).
    limit: Math.max(60, max * 3),
  });
  const shown = rows
    .filter((d) => {
      const screen = draftScreenOf(d.payload);
      const replenish = screen === "sale" && draftIsReplenishment(d.payload);
      if ((list === "replenishment") !== replenish) return false;
      return canDraft(user, screen, replenish);
    })
    .slice(0, max);
  const owners = await draftOwners(shown);
  return shown.map((draft) => ({
    draft,
    href: draftResumeHref(draft.id, draft.payload),
    owner: owners.get(draft.userId) ?? null,
    mine: draft.userId === user.id,
    canContinue: canContinueDraft(user, draft),
  }));
}
