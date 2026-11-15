"use server";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  deleteRequestDraft,
  saveRequestDraft,
} from "@/lib/services/request-drafts";
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
