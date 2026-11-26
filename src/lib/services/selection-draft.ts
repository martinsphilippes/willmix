import "server-only";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { getStore, type User } from "@/lib/db";
import { parseGroupIds } from "@/lib/booking-selection";

/*
 * Seleção em andamento (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Trabalho na Seleção"): o que se mexe na aba Seleção (o escolhido, as
 * embalagens e variações, a quantidade, a programação, o que a Wellmix
 * precisa) vai sozinho para o servidor, por login, na tabela `form_drafts`
 * (chave "selection"), e volta quando a aba abre de novo. Enquanto houver
 * rascunho, o login não começa outra seleção: conclui ("Gravar escolha",
 * que apaga o rascunho) ou cancela. As imagens de exemplo (artes) também
 * ficam no rascunho (dono, 26/11/2026): ao serem escolhidas, viram um
 * documento do portal (`registerSelectionArt`) e o rascunho guarda o id
 * (`artKeep.<combinação>`).
 */

const KEY = "selection";
/** Campos do formulário, só texto, no tamanho de cada um. */
const MAX_FIELDS = 400;
const MAX_VALUE = 20_000;
const MAX_TOTAL = 60_000;

const DOC_ID = /^[A-Za-z0-9_-]{1,64}$/;

export class SelectionDraftError extends Error {}

export interface SelectionDraft {
  ids: string[];
  values: Record<string, string[]>;
  savedAt: string;
}

/** Os campos do formulário que entram no rascunho (sem arquivos). */
export function cleanSelectionValues(
  values: Record<string, unknown>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let total = 0;
  for (const [key, raw] of Object.entries(values)) {
    if (Object.keys(out).length >= MAX_FIELDS) break;
    if (!key || key.length > 120) continue;
    // Arquivos e chaves de armazenamento não voltam; a arte já registrada
    // (o id do documento, `artKeep.*`) volta.
    if (/^(art|artUploaded)\./.test(key)) continue;
    if (key === "filters" || key === "group") continue;
    const list = (Array.isArray(raw) ? raw : [raw]).filter(
      (v): v is string => typeof v === "string",
    );
    if (!list.length) continue;
    if (key.startsWith("artKeep.") && !list.every((v) => DOC_ID.test(v)))
      continue;
    const kept = list.map((v) => v.slice(0, MAX_VALUE)).slice(0, 50);
    total += key.length + kept.reduce((n, v) => n + v.length, 0);
    if (total > MAX_TOTAL) break;
    out[key] = kept;
  }
  return out;
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

async function find(user: User) {
  const [row] = await getStore()
    .list("form_drafts", { filter: { userId: user.id, form: KEY }, limit: 1 })
    .catch(() => []);
  return row ?? null;
}

/** Os ids e os valores guardados (o `payload` da tabela é texto por chave). */
function readPayload(payload: Record<string, string> | null | undefined): {
  ids: string[];
  values: Record<string, string[]>;
} {
  const ids = parseGroupIds(payload?.ids ?? "");
  let values: Record<string, string[]> = {};
  try {
    const raw = JSON.parse(payload?.values ?? "{}") as unknown;
    if (raw && typeof raw === "object")
      values = cleanSelectionValues(raw as Record<string, unknown>);
  } catch {
    values = {};
  }
  return { ids, values };
}

/** A seleção em andamento do login (nula sem rascunho). */
export async function loadSelectionDraft(
  user: User,
): Promise<SelectionDraft | null> {
  const row = await find(user);
  if (!row) return null;
  const { ids, values } = readPayload(row.payload);
  if (!ids.length) return null;
  return { ids, values, savedAt: row.updatedAt };
}

/**
 * Guarda o que está na aba Seleção. Outra seleção em andamento (outros
 * itens) recusa: o login conclui ou cancela aquela antes.
 */
export async function saveSelectionDraft(
  user: User,
  input: { ids: string[]; values: Record<string, unknown> },
): Promise<string> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const ids = parseGroupIds(input.ids.join(","));
  if (!ids.length) throw new SelectionDraftError("invalid_input");
  const row = await find(user);
  const current = row ? readPayload(row.payload).ids : [];
  if (row && current.length && !sameIds(current, ids))
    throw new SelectionDraftError("selection_draft_other");
  const payload = {
    ids: ids.join(","),
    values: JSON.stringify(cleanSelectionValues(input.values)),
  };
  const store = getStore();
  const saved = row
    ? await store.update("form_drafts", row.id, { payload })
    : await store.create("form_drafts", {
        userId: user.id,
        form: KEY,
        payload,
      });
  return saved.updatedAt;
}

/** Conclui ou cancela: o rascunho some e o login pode começar outra. */
export async function clearSelectionDraft(user: User): Promise<void> {
  const row = await find(user);
  if (row) await getStore().remove("form_drafts", row.id);
}

/**
 * Pode gravar a escolha destes itens? Com outra seleção em andamento,
 * não (`selection_draft_other`).
 */
export async function assertSelectionFree(
  user: User,
  ids: readonly string[],
): Promise<void> {
  const draft = await loadSelectionDraft(user);
  // O grupo gravado é o que a tela mostrou (pode faltar item de book que
  // não está travado para o login): basta estar dentro do rascunho.
  if (draft && !ids.every((id) => draft.ids.includes(id)))
    throw new SelectionDraftError("selection_draft_other");
}

/**
 * A arte de uma combinação (variação × embalagem) escolhida na aba Seleção
 * vira um documento do portal na hora (foto interna, só a Wellmix vê), para
 * ficar no rascunho e voltar com ele (dono, 26/11/2026). O arquivo vem no
 * pedido ou já subiu direto ao armazenamento (`uploaded`, a chave).
 */
export async function registerSelectionArt(
  user: User,
  input: { file?: File | null; uploaded?: string | null },
): Promise<string> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const { registerUploadedPhoto, uploadDocument } = await import("./documents");
  const target = { type: "photo" as const, visibility: "internal" as const };
  if (input.uploaded)
    return (await registerUploadedPhoto(user, input.uploaded, target)).id;
  const file = input.file;
  if (!file || !file.size) throw new SelectionDraftError("invalid_input");
  if (!(file.type ?? "").startsWith("image/"))
    throw new SelectionDraftError("mime");
  return (await uploadDocument(user, file, target)).id;
}
