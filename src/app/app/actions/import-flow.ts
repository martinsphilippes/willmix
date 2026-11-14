"use server";

import { z } from "zod";
import { IMPORT_STEP_KEYS } from "@/lib/db/schema";
import { assertScreen } from "@/lib/auth/screens";
import { field, files, flowReturnTo, requireUser, run, str } from "./helpers";

/*
 * Embarque e desembaraço (docs/IMPORT_FLOW.md): enviar um passo (número,
 * data, canal, valor e/ou arquivo) e validar/recusar. O serviço confere quem
 * pode; o arquivo só sobe depois de conferido que o usuário faz o passo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
/** Arquivo que o navegador já subiu direto ao armazenamento (acima do teto da requisição). */
const UPLOADED_ID = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);

/** Cartão de onde veio (embarque ou certificação). */
const anchorOf = (form: FormData) => {
  const a = str(form, "anchor");
  return a === "certification" ||
    a === "container-origin" ||
    a === "samples-flow"
    ? a
    : "import-flow";
};

/** Aviso de "feito" no cartão de onde a ação veio (cada cartão lê o seu). */
const doneParam = (form: FormData) =>
  anchorOf(form) === "certification" ? "certStep" : "importStep";

/** Volta da recusa: o cartão de onde veio mostra o motivo (?stepCard=). */
const errorBack = (form: FormData, to: string) =>
  `${to}?stepCard=${anchorOf(form)}#${anchorOf(form)}`;

/**
 * Substituir o arquivo do selo ou do memorial (quadro do alto da
 * Certificação): o documento que está sendo trocado, para o quadro dele dizer
 * se deu certo ou não. Nulo fora da substituição.
 */
const replacedKey = (form: FormData) => {
  if (str(form, "replace") !== "1") return null;
  const key = z.enum(IMPORT_STEP_KEYS).safeParse(str(form, "key"));
  return key.success ? key.data : null;
};

function back(form: FormData) {
  // Tela do passo do menu de onde a ação veio (docs/FLOW_MENU.md).
  const flow = flowReturnTo(form);
  if (flow) return flow;
  const orderId = ID.safeParse(str(form, "orderId"));
  return orderId.success ? `/app/orders/${orderId.data}` : "/app/orders";
}

export async function submitImportStepAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  const replace = replacedKey(form);
  // Falha na substituição: volta ao quadro do documento, com o arquivo
  // anterior valendo e o motivo ali mesmo.
  const failBack = replace
    ? `${to}?stepCard=${anchorOf(form)}&replaceFailed=${replace}#${anchorOf(form)}-featured`
    : errorBack(form, to);
  await run(failBack, async () => {
    const orderId = ID.parse(str(form, "orderId"));
    const key = z.enum(IMPORT_STEP_KEYS).parse(str(form, "key"));
    const value = field(form, "value", z.string().trim().max(200)) || null;
    const amountRaw = str(form, "amount").replace(",", ".");
    const amount = amountRaw
      ? z.coerce.number().positive().max(1e12).parse(amountRaw)
      : null;
    const currency = str(form, "currency")
      ? z
          .string()
          .regex(/^[A-Z]{3}$/)
          .parse(str(form, "currency"))
      : null;
    const svc = await import("@/lib/services/import-flow");
    const { getStore } = await import("@/lib/db");
    const order = await getStore().get("orders", orderId);
    if (!order) throw new Error("not_found");
    // Confere antes de subir o arquivo: quem não faz o passo não grava nada.
    if (!(await svc.canSubmitStep(user, order, key)))
      throw new Error("forbidden");
    assertScreen(user, "orders");
    const [file] = files(form, "file");
    const uploadedFileId = str(form, "uploadedFileId");
    const target = {
      orderId,
      type: "import_step",
      visibility: "internal",
      // Container na origem: fotos e vídeos do container vazio e do carregamento.
      video: key === "container_empty" || key === "container_loaded",
    } as const;
    let documentId: string | null = null;
    if (file) {
      const { uploadDocument } = await import("@/lib/services/documents");
      documentId = (await uploadDocument(user, file, target)).id;
    } else if (uploadedFileId) {
      // Arquivo grande (ex.: a arte com o selo): já está no armazenamento.
      const { registerUploadedDocument } =
        await import("@/lib/services/documents");
      documentId = (
        await registerUploadedDocument(
          user,
          UPLOADED_ID.parse(uploadedFileId),
          target,
        )
      ).id;
    }
    await svc.submitStep(user, orderId, key, {
      value,
      amount,
      currency,
      documentId,
      replace: !!replace,
    });
    // Arquivo substituído: o quadro do documento diz ali mesmo.
    if (replace)
      return `${to}?certReplaced=${replace}#${anchorOf(form)}-featured`;
    return `${to}?${doneParam(form)}=submitted#${anchorOf(form)}`;
  });
}

export async function validateImportStepAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(errorBack(form, to), async () => {
    assertScreen(user, "orders");
    const orderId = ID.parse(str(form, "orderId"));
    const key = z.enum(IMPORT_STEP_KEYS).parse(str(form, "key"));
    const decision = z
      .enum(["validated", "rejected"])
      .parse(str(form, "decision"));
    const reason = field(form, "reason", z.string().trim().max(1000)) || null;
    const { validateStep } = await import("@/lib/services/import-flow");
    await validateStep(user, orderId, key, decision, reason);
    return `${to}?${doneParam(form)}=${decision}#${anchorOf(form)}`;
  });
}
