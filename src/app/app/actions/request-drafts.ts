"use server";

import { ForbiddenError, assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  deleteRequestDraft,
  saveRequestDraft,
} from "@/lib/services/request-drafts";
import {
  REQUEST_SCREEN,
  REQUEST_SCREEN_FIELD,
  isRequestScreenMode,
} from "@/lib/request-screens";
import { requireUser, run, str } from "./helpers";

/*
 * Rascunho da Nova solicitação (dono, 15/11/2026; docs/ORDER_TERMS.md
 * seção 9): "Salvar rascunho" grava o formulário como está, sem conferir
 * nada (o vendedor completa depois); "Apagar" tira da lista.
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function saveRequestDraftAction(form: FormData) {
  const user = await requireUser();
  const current = str(form, "draftId");
  const draftId = ID.test(current) ? current : null;
  await run(
    `/app/requests/new${draftId ? `?draft=${draftId}` : ""}`,
    async () => {
      assertWellmix(user);
      assertScreen(user, "requests");
      const draft = await saveRequestDraft(user, form, draftId);
      return `/app/requests/new?draft=${encodeURIComponent(draft.id)}&draftSaved=1`;
    },
  );
}

export async function deleteRequestDraftAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "draftId");
  await run("/app/requests/new", async () => {
    assertWellmix(user);
    assertScreen(user, "requests");
    if (ID.test(id)) await deleteRequestDraft(user, id);
    return "/app/requests/new?draftDeleted=1";
  });
}

/*
 * Rascunho das telas TS - Trading Sales e Venda - Encomenda (dono,
 * 16/11/2026; docs/REQUEST_SCREENS.md): o mesmo rascunho, marcado com a tela
 * e listado só nela. O campo diz qual tela; o servidor confere se quem envia
 * abre essa tela (TS ou Venda), e o rascunho de uma não abre na outra.
 */
function screenOf(form: FormData) {
  const mode = str(form, REQUEST_SCREEN_FIELD);
  if (!isRequestScreenMode(mode)) throw new ForbiddenError();
  return mode;
}

export async function saveScreenRequestDraftAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, REQUEST_SCREEN_FIELD);
  const base = isRequestScreenMode(raw) ? REQUEST_SCREEN[raw].path : "/app";
  const current = str(form, "draftId");
  const draftId = ID.test(current) ? current : null;
  await run(`${base}${draftId ? `?draft=${draftId}` : ""}`, async () => {
    assertWellmix(user);
    const mode = screenOf(form);
    assertScreen(user, REQUEST_SCREEN[mode].screen);
    const draft = await saveRequestDraft(user, form, draftId, mode);
    return `${REQUEST_SCREEN[mode].path}?draft=${encodeURIComponent(draft.id)}&draftSaved=1`;
  });
}

export async function deleteScreenRequestDraftAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, REQUEST_SCREEN_FIELD);
  const base = isRequestScreenMode(raw) ? REQUEST_SCREEN[raw].path : "/app";
  const id = str(form, "draftId");
  await run(base, async () => {
    assertWellmix(user);
    const mode = screenOf(form);
    assertScreen(user, REQUEST_SCREEN[mode].screen);
    if (ID.test(id)) await deleteRequestDraft(user, id, mode);
    return `${REQUEST_SCREEN[mode].path}?draftDeleted=1`;
  });
}
