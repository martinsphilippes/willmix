"use server";

import { z } from "zod";
import { ForbiddenError } from "@/lib/auth/permissions";
import { PAYMENT_PLAN_EVENTS } from "@/lib/customer-payment";
import {
  canManagePaymentPlans,
  chargeCustomer,
  chooseOrderPaymentPlan,
  decideOrderPaymentPlan,
  saveManualCharge,
  savePaymentPlan,
  syncSankhyaCharges,
} from "@/lib/services/customer-payment";
import { uploadDocument } from "@/lib/services/documents";
import { field, requireUser, run, str } from "./helpers";

/*
 * Forma de pagamento do cliente (dono, 15/11/2026; docs/CUSTOMER_PAYMENT.md):
 * configuração das formas (administrador), escolha no pedido com o vendedor
 * (quem grava a venda ao cliente), alçada (quem responde), boletos do Sankhya
 * e à mão (financeiro) e a cobrança ao cliente. O serviço confere cada
 * permissão de novo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const OPTIONAL_ID = z.union([z.literal(""), ID]);
const DAY = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const NUNOTA = z.union([z.literal(""), z.string().regex(/^\d{1,10}$/)]);

const numberOf = (text: string) =>
  text === "" ? null : Number(text.replace(",", "."));

/** Configurações → Formas de pagamento: cria ou altera uma forma. */
export async function savePaymentPlanAction(form: FormData) {
  const user = await requireUser();
  const back = "/app/settings/payment-plans";
  await run(back, async () => {
    if (!canManagePaymentPlans(user)) throw new ForbiddenError();
    const id = field(form, "id", OPTIONAL_ID);
    const installments: Array<{
      percent: number;
      event: (typeof PAYMENT_PLAN_EVENTS)[number];
      days: number;
    }> = [];
    for (let i = 1; i <= 12; i++) {
      const percent = str(form, `percent.${i}`);
      if (percent === "") continue;
      installments.push({
        percent: z.number().min(0).max(100).parse(numberOf(percent)),
        event: z.enum(PAYMENT_PLAN_EVENTS).parse(str(form, `event.${i}`)),
        days: z
          .number()
          .int()
          .min(0)
          .max(720)
          .parse(numberOf(str(form, `days.${i}`) || "0")),
      });
    }
    const interest = str(form, "monthlyInterestPercent");
    await savePaymentPlan(user, id || null, {
      name: field(form, "name", z.string().min(2).max(160)),
      installments,
      requiresApproval: form.get("requiresApproval") === "on",
      approverUserId: field(form, "approverUserId", OPTIONAL_ID) || null,
      monthlyInterestPercent:
        interest === ""
          ? null
          : z.number().min(0).max(20).parse(numberOf(interest)),
      active: form.get("active") === "on",
      sortOrder:
        str(form, "sortOrder") === ""
          ? null
          : z
              .number()
              .int()
              .min(0)
              .max(999)
              .parse(numberOf(str(form, "sortOrder"))),
    });
    return `${back}?saved=1`;
  });
}

const orderBack = (orderId: string) =>
  `/app/orders/${encodeURIComponent(orderId)}`;

/** Pedido: escolhe a forma de pagamento, o vendedor e o NUNOTA da venda. */
export async function chooseOrderPaymentPlanAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = orderBack(orderId);
  await run(`${back}#customer-payment`, async () => {
    ID.parse(orderId);
    await chooseOrderPaymentPlan(user, orderId, {
      planId: field(form, "planId", ID),
      sellerUserId: field(form, "sellerUserId", OPTIONAL_ID) || null,
      saleNunota: field(form, "saleNunota", NUNOTA) || null,
    });
    return `${back}?payment=saved#customer-payment`;
  });
}

/** Alçada: aprova ou recusa a forma escolhida. */
export async function decideOrderPaymentPlanAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = orderBack(orderId);
  await run(`${back}#customer-payment`, async () => {
    ID.parse(orderId);
    const decision = field(form, "decision", z.enum(["approve", "reject"]));
    const note = field(form, "note", z.string().max(500));
    await decideOrderPaymentPlan(
      user,
      orderId,
      decision === "approve",
      note || null,
    );
    return `${back}?payment=${decision}#customer-payment`;
  });
}

/** Financeiro: busca os boletos (títulos a receber) do pedido de venda no Sankhya. */
export async function syncOrderChargesAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = orderBack(orderId);
  await run(`${back}#customer-payment`, async () => {
    ID.parse(orderId);
    const { titles } = await syncSankhyaCharges(user, orderId);
    return `${back}?charges=${titles}#customer-payment`;
  });
}

/** Financeiro: registra o boleto de uma parcela à mão (PDF opcional). */
export async function saveManualChargeAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = orderBack(orderId);
  await run(`${back}#customer-payment`, async () => {
    ID.parse(orderId);
    const index = z
      .number()
      .int()
      .min(1)
      .max(12)
      .parse(Number(str(form, "index")));
    const amount = str(form, "amount");
    const file = form.get("file");
    const doc =
      file instanceof File && file.size > 0
        ? await uploadDocument(user, file, {
            orderId,
            type: "attachment",
            visibility: "customer",
          })
        : null;
    await saveManualCharge(user, orderId, index, {
      dueDate: field(form, "dueDate", DAY) || null,
      amount:
        amount === ""
          ? null
          : z.number().positive().max(1e12).parse(numberOf(amount)),
      nossoNumero: field(form, "nossoNumero", z.string().max(40)) || null,
      barcode: field(form, "barcode", z.string().max(120)) || null,
      documentId: doc?.id ?? null,
      paid: form.get("paid") === "on",
    });
    return `${back}?charge=saved#customer-payment`;
  });
}

/** Vendedor ou financeiro: cobra o cliente de uma parcela com boleto. */
export async function chargeCustomerAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = orderBack(orderId);
  await run(`${back}#customer-payment`, async () => {
    ID.parse(orderId);
    const index = z
      .number()
      .int()
      .min(1)
      .max(12)
      .parse(Number(str(form, "index")));
    await chargeCustomer(user, orderId, index);
    return `${back}?charge=sent#customer-payment`;
  });
}
