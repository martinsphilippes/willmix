"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { PAYMENT_TERM_BASES } from "@/lib/db";
import { parseNumberInput } from "@/lib/number-input";
import { MAX_TERM_DAYS, MAX_TERM_INSTALLMENTS } from "@/lib/supplier-terms";
import {
  applySupplierTermsToOrder,
  saveSupplierPaymentTerms,
} from "@/lib/services/supplier-terms";
import { num, requireUser, run, str } from "./helpers";

/*
 * Condição de pagamento ao fornecedor (só a Wellmix): parcelas no cadastro do
 * fornecedor e "usar a condição atual" num pedido. O servidor confere tudo
 * (soma 100%, marcos conhecidos, dias de 0 a 720).
 */

const termSchema = z.object({
  percent: z.number().gt(0).max(100),
  base: z.enum(PAYMENT_TERM_BASES),
  days: z.number().int().min(0).max(MAX_TERM_DAYS),
});

/** Parcelas do formulário: termPercent/termBase/termDays repetidos, uma por linha. */
export async function saveSupplierTermsAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(`/app/parties/${id}#payment-terms`, async () => {
    assertWellmix(user);
    const text = (v: FormDataEntryValue) =>
      typeof v === "string" ? v.trim() : "";
    const percents = form.getAll("termPercent").map(text);
    const bases = form.getAll("termBase").map(text);
    const days = form.getAll("termDays").map(text);
    const rows = percents
      .map((percent, i) => ({
        percent,
        base: bases[i] ?? "",
        days: days[i] ?? "",
      }))
      // Linha sem % e sem dias é linha vazia (ex.: a última, ainda não usada).
      .filter((row) => row.percent !== "" || row.days !== "");
    if (rows.length > MAX_TERM_INSTALLMENTS) throw new Error("terms_too_many");
    const terms = rows.map((row) => {
      const parsed = termSchema.safeParse({
        percent: parseNumberInput(row.percent),
        base: row.base,
        days: row.days === "" ? 0 : parseNumberInput(row.days, { int: true }),
      });
      // Código próprio: o aviso aparece no card da condição, com o motivo.
      if (!parsed.success) throw new Error("terms_invalid");
      return parsed.data;
    });
    const note = z
      .string()
      .max(500)
      .nullable()
      .parse(str(form, "paymentTermsNote") || null);
    try {
      await saveSupplierPaymentTerms(user, id, { terms, note });
    } catch (error) {
      // Coluna nova ainda não publicada: o aviso vai para o card da condição.
      if (error instanceof Error && /unknown attribute/i.test(error.message))
        throw new Error("terms_schema_outdated");
      throw error;
    }
    return `/app/parties/${id}?saved=terms#payment-terms`;
  });
}

/** No pedido: troca a condição copiada pela atual do cadastro do fornecedor. */
export async function applySupplierTermsAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  // Erro volta para o topo do pedido, onde o aviso aparece.
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    await applySupplierTermsToOrder(user, orderId);
    return `/app/orders/${orderId}?terms=applied#supplier-payment`;
  });
}

/**
 * "Marcar como pago" no pagamento pedido ao banco/financeiro: vira pago (com
 * câmbio e comprovante opcionais), sem criar outro pagamento.
 */
export async function markSupplierPaymentPaidAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const paymentId = str(form, "paymentId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    const fxRate = z.number().positive().nullable().parse(num(form, "fxRate"));
    const proof = form.get("proof");
    const { markSupplierPaymentPaid } =
      await import("@/lib/services/supplier-payment");
    await markSupplierPaymentPaid(user, orderId, paymentId, {
      fxRate,
      proof: proof instanceof File ? proof : null,
    });
    return `/app/orders/${orderId}?paid=marked#supplier-payment`;
  });
}
