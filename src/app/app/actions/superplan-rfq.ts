"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import { files, requireUser, run, str, uploadedPhotoKeys } from "./helpers";

/*
 * Do Superplan à faca e à RFQ (docs/SUPERPLAN.md, seção 11). Abrir: só o
 * administrador, na tela do Superplan. Enviar faca, MOQ, prazo e foto em
 * alta: o fornecedor ganho (ou a Wellmix no lugar dele), na cotação. O
 * serviço confere papel, dono e situação; aqui só o formato.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const uploadedId = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);

/** Viabilidade feita: abre a solicitação e a RFQ com o fornecedor ganho. */
export async function openSuperplanRfqAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  const back = ID.test(productId)
    ? `/app/superplan?product=${encodeURIComponent(productId)}&rfq=1#superplan-rfq`
    : "/app/superplan?rfq=1";
  await run(back, async () => {
    assertRole(user, ["admin"]);
    assertScreen(user, "superplan");
    const supplierId = z.string().regex(ID).parse(str(form, "supplierId"));
    const customer = str(form, "customerId");
    const customerId =
      customer && customer !== "__stock"
        ? z.string().regex(ID).parse(customer)
        : null;
    const quantity = parseNumberInput(str(form, "quantity"), { int: true });
    if (quantity === null || Number.isNaN(quantity) || quantity < 1)
      throw new Error("invalid_quantity");
    // A simulação da tela, no mesmo formato do "Gravar no Booking"; o
    // serviço refaz a conta com os parâmetros do sistema.
    let raw: unknown;
    try {
      raw = JSON.parse(str(form, "input"));
    } catch {
      throw new Error("simulation_incomplete");
    }
    const { superplanInputSchema } = await import("@/lib/superplan-defaults");
    const input = superplanInputSchema.parse(raw);
    const meta = z
      .object({
        businessType: z.string().trim().max(120),
        container: z.string().trim().max(40),
      })
      .parse({
        businessType: str(form, "businessType"),
        container: str(form, "container"),
      });
    const { openSuperplanRfq } = await import("@/lib/services/superplan-rfq");
    const { request } = await openSuperplanRfq(user, {
      productId: z.string().regex(ID).parse(productId),
      supplierId,
      customerId,
      quantity,
      input,
      businessType: meta.businessType || null,
      container: meta.container || null,
    });
    return `/app/requests/${request.id}?superplan=opened`;
  });
}

/**
 * O fornecedor envia um dos itens: a faca (arquivo ou foto), a foto em alta
 * ou o MOQ e o prazo (confirmados ou corrigidos).
 */
export async function sendSuperplanItemsAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId");
  const ok = ID.test(quoteId);
  const back = ok ? `/app/quotes/${quoteId}#superplan` : "/app";
  await run(back, async () => {
    assertScreen(user, "quotes");
    if (!ok) throw new Error("not_found");
    const item = z.enum(["dieline", "hd", "terms"]).parse(str(form, "item"));
    const number = (key: string, code: string) => {
      const v = parseNumberInput(str(form, key), { int: true });
      if (v === null) return null;
      if (Number.isNaN(v)) throw new Error(code);
      return v;
    };
    let dieline: File | { fileKey: string; photo?: boolean } | null = null;
    let hdPhotos: (File | string)[] = [];
    let moq: number | null = null;
    let leadTimeDays: number | null = null;
    if (item === "dieline") {
      const file = form.get("file");
      const uploadedFileId = str(form, "uploadedFileId");
      const uploadedPhotoId = str(form, "uploadedPhotoId");
      dieline =
        file instanceof File && file.size > 0
          ? file
          : uploadedFileId
            ? { fileKey: uploadedId.parse(uploadedFileId) }
            : uploadedPhotoId
              ? { fileKey: uploadedId.parse(uploadedPhotoId), photo: true }
              : null;
      if (!dieline) throw new Error("document_required");
    } else if (item === "hd") {
      hdPhotos = [...files(form, "hd"), ...uploadedPhotoKeys(form)];
      if (!hdPhotos.length) throw new Error("photo_required");
    } else {
      moq = number("moq", "invalid_moq");
      leadTimeDays = number("leadTimeDays", "invalid_lead_time");
      if (moq === null || leadTimeDays === null)
        throw new Error("terms_required");
    }
    const { sendSuperplanItems } = await import("@/lib/services/superplan-rfq");
    const { missing } = await sendSuperplanItems(user, quoteId, {
      dieline,
      hdPhotos,
      moq,
      leadTimeDays,
    });
    return `/app/quotes/${quoteId}?superplan=${missing.length ? "saved" : "done"}#superplan`;
  });
}
