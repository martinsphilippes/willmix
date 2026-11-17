import "server-only";
import { getStore, type User } from "@/lib/db";
import { PARTY_DRAFT_FIELDS, type PartyDraft } from "@/lib/party-draft";

/*
 * Rascunhos de formulário por login (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, D11), na tabela `form_drafts`: o Novo parceiro
 * guarda o que foi digitado enquanto a pessoa preenche, sem o limite de 5
 * minutos do cookie de antes. Um por login e formulário; some ao salvar o
 * cadastro ou em "Descartar rascunho". Cada login só lê o próprio.
 */

/** Os formulários com rascunho (o tipo do Novo parceiro separa os três). */
export const FORM_DRAFT_KEYS = [
  "party-new:partner",
  "party-new:customer",
  "party-new:supplier",
] as const;
export type FormDraftKey = (typeof FORM_DRAFT_KEYS)[number];

export const isFormDraftKey = (value: unknown): value is FormDraftKey =>
  typeof value === "string" &&
  (FORM_DRAFT_KEYS as readonly string[]).includes(value);

/** O formulário do Novo parceiro para o tipo escolhido. */
export const partyDraftKey = (type: string | null | undefined): FormDraftKey =>
  type === "customer"
    ? "party-new:customer"
    : type === "supplier"
      ? "party-new:supplier"
      : "party-new:partner";

/** Só os campos de texto do cadastro, limpos (as notas até 2000 caracteres). */
export function cleanPartyDraft(values: Record<string, unknown>): PartyDraft {
  const out: PartyDraft = {};
  for (const field of PARTY_DRAFT_FIELDS) {
    const value = values[field];
    if (typeof value !== "string") continue;
    const text = value.slice(0, field === "notes" ? 2000 : 255);
    if (text.trim()) out[field] = text;
  }
  return out;
}

async function find(user: User, form: FormDraftKey) {
  const [row] = await getStore().list("form_drafts", {
    filter: { userId: user.id, form },
    limit: 1,
  });
  return row ?? null;
}

/** O rascunho do login (nulo sem rascunho). */
export async function loadFormDraft(
  user: User,
  form: FormDraftKey,
): Promise<{ payload: PartyDraft; updatedAt: string } | null> {
  const row = await find(user, form);
  if (!row) return null;
  const payload = cleanPartyDraft(row.payload ?? {});
  return Object.keys(payload).length
    ? { payload, updatedAt: row.updatedAt }
    : null;
}

/** Guarda (ou apaga, se vazio) o rascunho do login. */
export async function saveFormDraft(
  user: User,
  form: FormDraftKey,
  values: Record<string, unknown>,
): Promise<string | null> {
  const payload = cleanPartyDraft(values);
  const store = getStore();
  const row = await find(user, form);
  if (!Object.keys(payload).length) {
    if (row) await store.remove("form_drafts", row.id);
    return null;
  }
  const saved = row
    ? await store.update("form_drafts", row.id, { payload })
    : await store.create("form_drafts", { userId: user.id, form, payload });
  return saved.updatedAt;
}

/** Apaga o rascunho do login (ao salvar o cadastro ou em "Descartar"). */
export async function clearFormDraft(
  user: User,
  form: FormDraftKey,
): Promise<void> {
  const row = await find(user, form);
  if (row) await getStore().remove("form_drafts", row.id);
}
