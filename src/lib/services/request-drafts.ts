import "server-only";
import { getStore, type RequestDraft, type User } from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import {
  REQUEST_SCREEN,
  REQUEST_SCREEN_FIELD,
  draftScreenOf,
  type RequestScreenMode,
} from "@/lib/request-screens";
import { audit } from "./audit";

/*
 * Rascunho da Nova solicitação (dono, 15/11/2026; docs/ORDER_TERMS.md
 * seção 9): o vendedor salva o formulário como está e completa depois.
 * Guarda os campos de texto como vieram (sem arquivos e sem os campos
 * internos do envio). Só quem criou vê, reabre e apaga; some quando a
 * solicitação é enviada.
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

const canDraft = (user: User, screen: DraftScreen = null) =>
  isWellmix(user) &&
  canOpen(user, screen ? REQUEST_SCREEN[screen].screen : "requests");

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

/** Grava (novo ou por cima do mesmo) o rascunho de quem está no formulário. */
export async function saveRequestDraft(
  user: User,
  form: FormData,
  draftId: string | null,
  screen: DraftScreen = null,
): Promise<RequestDraft> {
  if (!canDraft(user, screen)) throw new ForbiddenError();
  const store = getStore();
  const payload = draftPayload(form);
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
      current.userId !== user.id ||
      draftScreenOf(current.payload) !== screen
    )
      throw new DraftError("draft_not_found");
    return store.update("request_drafts", draftId, data);
  }
  const draft = await store.create("request_drafts", data);
  await audit(
    user,
    "request.draft",
    "request_draft",
    draft.id,
    `Rascunho da Nova solicitação: ${draft.title}`,
  );
  return draft;
}

/** O rascunho de quem pede, desta tela (nulo se não é dele, de outra tela ou não existe). */
export async function getRequestDraft(
  user: User,
  id: string,
  screen: DraftScreen = null,
): Promise<RequestDraft | null> {
  if (!canDraft(user, screen) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const draft = await getStore().get("request_drafts", id);
  return draft &&
    draft.userId === user.id &&
    draftScreenOf(draft.payload) === screen
    ? draft
    : null;
}

/** Os rascunhos de quem pede, desta tela, o mais recente primeiro. */
export async function listRequestDrafts(
  user: User,
  screen: DraftScreen = null,
): Promise<RequestDraft[]> {
  if (!canDraft(user, screen)) return [];
  const rows = await getStore().list("request_drafts", {
    filter: { userId: user.id },
    orderBy: "updatedAt",
    direction: "desc",
    // Folga para os rascunhos das outras telas (o filtro é pelo conteúdo).
    limit: 60,
  });
  return rows.filter((d) => draftScreenOf(d.payload) === screen).slice(0, 20);
}

/** Apaga o rascunho (só o de quem pede, desta tela). */
export async function deleteRequestDraft(
  user: User,
  id: string,
  screen: DraftScreen = null,
): Promise<void> {
  const draft = await getRequestDraft(user, id, screen);
  if (!draft) return;
  await getStore().remove("request_drafts", draft.id);
}
