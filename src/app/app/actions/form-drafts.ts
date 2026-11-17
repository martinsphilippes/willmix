"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { isWellmix } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/permissions";
import {
  FORM_DRAFT_KEYS,
  clearFormDraft,
  saveFormDraft,
} from "@/lib/services/form-drafts";
import { requireUser, str } from "./helpers";

/*
 * Rascunho do Novo parceiro no banco, por login (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, D11): o formulário guarda sozinho o que foi
 * digitado; "Descartar rascunho" apaga. Quem abre Parceiros (o mesmo de
 * criar o cadastro); cada login só mexe no próprio.
 */

const FORM = z.enum(FORM_DRAFT_KEYS);

/** Guarda o que está digitado (chamado pelo formulário, sem recarregar). */
export async function savePartyDraftAction(input: {
  form: string;
  values: Record<string, string>;
}): Promise<{ ok: boolean; savedAt: string | null }> {
  const user = await requireUser();
  try {
    if (!isWellmix(user)) throw new ForbiddenError();
    assertScreen(user, "parties");
    const form = FORM.parse(input.form);
    const values = z
      .record(z.string().max(40), z.string().max(4000))
      .parse(input.values ?? {});
    const savedAt = await saveFormDraft(user, form, values);
    return { ok: true, savedAt };
  } catch {
    return { ok: false, savedAt: null };
  }
}

/** Descartar o rascunho e voltar ao formulário vazio. */
export async function discardPartyDraftAction(form: FormData) {
  const user = await requireUser();
  if (!isWellmix(user)) throw new ForbiddenError();
  assertScreen(user, "parties");
  const key = FORM.parse(str(form, "form"));
  await clearFormDraft(user, key);
  const back = str(form, "back");
  redirect(
    /^\/app\/(parties\/new|customers\/new)(\?[^#\s]*)?$/.test(back)
      ? back
      : "/app/parties/new",
  );
}
