"use server";

import { z } from "zod";
import { PACKAGING_ITEM_KEYS, getStore } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  assignPackagingBrief,
  cancelPackagingBrief,
  clearPackagingItem,
  confirmPackagingDims,
  openPackagingBrief,
  saveAgencyNotes,
  savePackagingBriefText,
  savePackagingDims,
  uploadPackagingItem,
} from "@/lib/services/packaging-brief";
import { num, requireUser, run, str, withQuery } from "./helpers";

/*
 * Briefing de embalagem (faca, arte, gráfica, foto): ações da agência (ou do
 * marketing da Wellmix) e da Wellmix. O serviço confere papel e dono.
 */

const briefId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const itemKey = z.enum(PACKAGING_ITEM_KEYS);
const uploadedId = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);

const back = (id: string, hash = "") => `/app/packaging/${id}${hash}`;

/** Volta para a tela de onde a ação partiu (só caminhos do portal). */
function returnTarget(form: FormData, fallback: string): string {
  const returnTo = str(form, "back");
  return /^\/app\/[\w\-./?=&#%]*$/.test(returnTo) ? returnTo : fallback;
}

/** Id do briefing do formulário; inválido volta à lista (o serviço confere o dono). */
function briefFrom(form: FormData): { id: string; back: string } {
  const raw = str(form, "briefId");
  const ok = briefId.safeParse(raw).success;
  return { id: ok ? raw : "", back: ok ? back(raw) : "/app/packaging" };
}

/** Envia um entregável (arquivo no formulário ou já subido direto ao armazenamento). */
export async function uploadPackagingItemAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  await run(brief.back, async () => {
    const id = briefId.parse(brief.id);
    const key = itemKey.parse(str(form, "key"));
    const file = form.get("file");
    const uploadedFileId = str(form, "uploadedFileId");
    const uploadedPhotoId = str(form, "uploadedPhotoId");
    const note = z.string().max(500).parse(str(form, "note")) || null;
    const source =
      file instanceof File && file.size > 0
        ? file
        : uploadedFileId
          ? { fileKey: uploadedId.parse(uploadedFileId) }
          : uploadedPhotoId
            ? { fileKey: uploadedId.parse(uploadedPhotoId), photo: true }
            : null;
    if (!source) throw new Error("document_required");
    await uploadPackagingItem(user, id, key, source, note);
    return `${back(id)}?saved=${key}#item-${key}`;
  });
}

export async function clearPackagingItemAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  await run(brief.back, async () => {
    const id = briefId.parse(brief.id);
    const key = itemKey.parse(str(form, "key"));
    await clearPackagingItem(user, id, key);
    return `${back(id)}#item-${key}`;
  });
}

export async function saveAgencyNotesAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  await run(brief.back, async () => {
    const id = briefId.parse(brief.id);
    const notes = z.string().max(4000).parse(str(form, "agencyNotes"));
    await saveAgencyNotes(user, id, notes || null);
    return `${back(id)}?saved=notes#notes`;
  });
}

/** Wellmix: instruções à agência (texto do briefing). */
export async function savePackagingBriefTextAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  const target = returnTarget(form, brief.back);
  await run(target, async () => {
    const id = briefId.parse(brief.id);
    const text = z.string().max(4000).parse(str(form, "brief"));
    await savePackagingBriefText(user, id, text || null);
    return withQuery(target, "saved", "brief");
  });
}

/** Wellmix: medidas da caixa à mão (sem ficha ou corrigindo). */
export async function savePackagingDimsAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  await run(brief.back, async () => {
    const id = briefId.parse(brief.id);
    const parsed = z
      .object({
        lengthCm: z.number().positive().max(1000),
        widthCm: z.number().positive().max(1000),
        heightCm: z.number().positive().max(1000),
        masterCartonQty: z.number().int().positive().max(100000).nullable(),
        innerQty: z.number().int().positive().max(100000).nullable(),
      })
      .parse({
        lengthCm: num(form, "lengthCm"),
        widthCm: num(form, "widthCm"),
        heightCm: num(form, "heightCm"),
        masterCartonQty: num(form, "masterCartonQty"),
        innerQty: num(form, "innerQty"),
      });
    await savePackagingDims(user, id, parsed);
    return `${back(id)}?saved=dims#dims`;
  });
}

/** Wellmix: troca quem faz a embalagem (agência ou marketing Wellmix). */
export async function assignPackagingBriefAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  const target = returnTarget(form, brief.back);
  await run(target, async () => {
    const id = briefId.parse(brief.id);
    const owner = str(form, "agencyId");
    const agencyId =
      owner === "" || owner === "wellmix"
        ? null
        : z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).parse(owner);
    await assignPackagingBrief(user, id, agencyId);
    return withQuery(target, "saved", "owner");
  });
}

export async function cancelPackagingBriefAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  const target = returnTarget(form, brief.back);
  await run(target, async () => {
    await cancelPackagingBrief(user, briefId.parse(brief.id));
  });
}

/** Wellmix: abre o briefing de uma solicitação cuja RFQ já estava aberta (ou com a configuração "no pedido"). */
export async function openPackagingBriefAction(form: FormData) {
  const user = await requireUser();
  const requestId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .parse(str(form, "requestId"));
  const target = `/app/requests/${requestId}`;
  await run(target, async () => {
    // Papel antes de qualquer leitura: nada da solicitação vaza a quem não é Wellmix.
    assertWellmix(user);
    const request = await getStore().get("requests", requestId);
    if (!request) throw new Error("not_found");
    if (request.status === "CANCELLED" || request.status === "ORDERED")
      throw new Error("brief_closed");
    const owner = str(form, "packagingOwner");
    const agencyId =
      owner === ""
        ? undefined
        : owner === "wellmix"
          ? null
          : z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).parse(owner);
    const brief = z.string().max(2000).parse(str(form, "packagingBrief"));
    await openPackagingBrief(user, request, {
      agencyId,
      brief: brief || null,
      reopen: true,
    });
    return `${target}?saved=packaging#packaging`;
  });
}

/** Dono conferiu faca e arte depois de as medidas mudarem. */
export async function confirmPackagingDimsAction(form: FormData) {
  const user = await requireUser();
  const brief = briefFrom(form);
  await run(brief.back, async () => {
    await confirmPackagingDims(user, briefId.parse(brief.id));
    return `${back(brief.id)}?saved=dims#dims`;
  });
}
