import "server-only";

import { getStore, type Request, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import {
  REQUEST_SCREEN_FIELD,
  draftResumeHref,
  type RequestScreenMode,
} from "@/lib/request-screens";
import { audit } from "./audit";
import { canDraft, draftPayload, DraftError } from "./request-drafts";

/*
 * Editar a encomenda enviada (dono, 19/11/2026; docs/ORDER_TERMS.md 11.19):
 * enquanto o cliente não confirmou ("Aguardando cliente"), a Wellmix reabre
 * a encomenda na tela de onde ela saiu, com o formulário como foi enviado
 * (`requests.sentForm`). A reabertura é um rascunho marcado (`editOf`) com o
 * mesmo número; ao enviar, a encomenda é refeita no lugar: mesmo número,
 * mesmo lote e os mesmos ids nas posições que já existiam (links, conversa
 * e avisos continuam valendo). O que havia antes fica no histórico.
 */

/** Campo do formulário (e do rascunho) com a encomenda que está sendo editada. */
export const EDIT_FIELD = "editOf";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** As solicitações do lote (ou a solicitação sozinha), na ordem em que nasceram. */
export async function batchOfRequest(request: Request): Promise<Request[]> {
  if (!request.groupId) return [request];
  const rows = await getStore().list("requests", {
    filter: { groupId: request.groupId },
    orderBy: "createdAt",
  });
  return rows.filter((r) => r.status !== "CANCELLED");
}

/** Guarda o formulário enviado na 1ª solicitação do lote. */
export async function saveSentForm(
  created: Request[],
  form: FormData,
  screen: RequestScreenMode | null,
): Promise<void> {
  const first = created[0];
  if (!first) return;
  const fields = draftPayload(form).filter(([k]) => k !== EDIT_FIELD);
  await getStore().update("requests", first.id, {
    sentForm: { screen, fields },
  });
}

/** O formulário enviado do lote (o da 1ª que tiver). */
function sentFormOf(batch: Request[]) {
  return batch.find((r) => r.sentForm?.fields?.length)?.sentForm ?? null;
}

/**
 * Dá para reabrir esta encomenda para editar? Wellmix que tem rascunho na
 * tela de onde ela saiu, todas as solicitações aguardando o cliente e o
 * formulário enviado guardado.
 */
export async function canEditSentRequest(
  user: User,
  request: Request,
): Promise<boolean> {
  if (!isWellmix(user) || request.status !== "AWAITING_CUSTOMER") return false;
  const batch = await batchOfRequest(request);
  if (batch.some((r) => r.status !== "AWAITING_CUSTOMER")) return false;
  const form = sentFormOf(batch);
  if (!form) return false;
  return canDraft(user, (form.screen as RequestScreenMode | null) ?? null);
}

/**
 * Reabre a encomenda: um rascunho de quem edita, com o formulário como foi
 * enviado, o mesmo número e a marca da encomenda. Devolve o endereço da tela.
 * Já havendo a reabertura dessa pessoa, volta a ela.
 */
export async function reopenSentRequest(
  user: User,
  requestId: string,
): Promise<string> {
  if (!ID.test(requestId)) throw new DraftError("draft_not_found");
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new DraftError("draft_not_found");
  if (!(await canEditSentRequest(user, request)))
    throw new Error("edit_not_allowed");
  const batch = await batchOfRequest(request);
  const first = batch[0];
  const form = sentFormOf(batch)!;
  const screen = (form.screen as RequestScreenMode | null) ?? null;
  const mine = await store.list("request_drafts", {
    filter: { userId: user.id },
    orderBy: "updatedAt",
    direction: "desc",
    limit: 60,
  });
  const open = mine.find((d) =>
    (d.payload ?? []).some(([k, v]) => k === EDIT_FIELD && v === first.id),
  );
  if (open) return draftResumeHref(open.id, open.payload);
  const payload: Array<[string, string]> = [
    ...form.fields.filter(
      ([k]) => k !== EDIT_FIELD && k !== REQUEST_SCREEN_FIELD,
    ),
    ...(screen
      ? ([[REQUEST_SCREEN_FIELD, screen]] as Array<[string, string]>)
      : []),
    [EDIT_FIELD, first.id],
  ];
  const customer = await store.get("parties", first.customerId);
  const draft = await store.create("request_drafts", {
    userId: user.id,
    customerId: first.customerId,
    customerName: customer?.name ?? null,
    title:
      `${first.productName}${batch.length > 1 ? ` + ${batch.length - 1}` : ""}`.slice(
        0,
        200,
      ),
    itemCount: batch.length,
    payload,
    number: first.number ?? null,
  });
  await audit(
    user,
    "request.reopen",
    "request",
    first.id,
    `Encomenda #${first.number ?? "—"} reaberta para editar (aguardando o cliente)`,
  );
  return draftResumeHref(draft.id, draft.payload);
}

/**
 * Envio de uma encomenda reaberta: confere que ainda dá para editar e refaz
 * o lote no lugar (`create` recebe os ids, o número e o lote de antes). Se a
 * criação falhar, a encomenda de antes volta como estava.
 */
export async function replaceSentRequest(
  user: User,
  editOf: string,
  create: (keep: {
    ids: string[];
    number: number | undefined;
    groupId: string | null;
  }) => Promise<Request[]>,
): Promise<Request[]> {
  if (!ID.test(editOf)) throw new Error("edit_not_allowed");
  const store = getStore();
  const request = await store.get("requests", editOf);
  if (!request || !(await canEditSentRequest(user, request)))
    throw new Error("edit_not_allowed");
  const before = await batchOfRequest(request);
  for (const r of before) await store.remove("requests", r.id);
  let created: Request[];
  try {
    created = await create({
      ids: before.map((r) => r.id),
      number: before[0].number ?? undefined,
      groupId: before[0].groupId ?? null,
    });
  } catch (error) {
    // Volta a encomenda de antes (e tira o que nasceu com os mesmos ids).
    for (const r of before) {
      try {
        if (await store.get("requests", r.id))
          await store.remove("requests", r.id);
        const { id, createdAt: _c, updatedAt: _u, ...rest } = r;
        void _c;
        void _u;
        await store.create("requests", { id, ...rest } as never);
      } catch (restoreError) {
        console.error("[request-edit] restaurar", r.id, restoreError);
      }
    }
    throw error;
  }
  await audit(
    user,
    "request.edited",
    "request",
    created[0]?.id ?? editOf,
    `Encomenda #${before[0].number ?? "—"} editada antes da confirmação do cliente: ${before.length} → ${created.length} produto(s)`,
    { requests: before },
    { requests: created.map((r) => r.id) },
  );
  return created;
}
