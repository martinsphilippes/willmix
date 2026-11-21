"use server";

import { z } from "zod";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { validCnpj } from "@/lib/order-terms";
import {
  QuickCustomerError,
  createQuickCustomer,
  customerByCnpj,
  quickCustomerOption,
  type QuickCustomerOption,
} from "@/lib/services/quick-customer";
import { requireUser } from "./helpers";

/*
 * Cadastro rápido de cliente pelo "+" da Nova solicitação (dono, 21/11/2026;
 * docs/ORDER_TERMS.md, seção 11.25): na própria tela, sem ir a Cadastros.
 * Quem lança a solicitação (login da Wellmix que abre a Nova solicitação)
 * cadastra; CNPJ que já é de um cliente não cria outro.
 */

export type QuickCustomerResult =
  | { ok: true; customer: QuickCustomerOption }
  | { ok: false; existing: QuickCustomerOption }
  | {
      ok: false;
      error: "forbidden" | "cnpj_invalid" | "name" | "email" | "failed";
    };

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const schema = z.object({
  cnpj: z.string().trim().max(30),
  name: z.string().trim().max(200),
  legalName: text(200),
  city: text(120),
  state: text(2),
  address: text(300),
  phone: text(40),
  email: text(200),
});

/** Quem pode usar o "+": a Wellmix que abre a Nova solicitação. */
async function quickUser() {
  const user = await requireUser();
  return isWellmix(user) && canOpenNewRequest(user) ? user : null;
}

/** O cliente que já tem este CNPJ (para avisar antes de preencher tudo). */
export async function findCustomerByCnpjAction(
  cnpj: string,
): Promise<{ existing: QuickCustomerOption | null }> {
  const user = await quickUser();
  if (!user || typeof cnpj !== "string" || !validCnpj(cnpj.slice(0, 30)))
    return { existing: null };
  const found = await customerByCnpj(cnpj.slice(0, 30));
  return { existing: found ? quickCustomerOption(found) : null };
}

/** Cadastra o cliente e devolve a escolha para o campo Cliente. */
export async function quickCustomerAction(
  input: unknown,
): Promise<QuickCustomerResult> {
  const user = await quickUser();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };
  const data = parsed.data;
  if (!validCnpj(data.cnpj)) return { ok: false, error: "cnpj_invalid" };
  if (data.name.length < 2) return { ok: false, error: "name" };
  if (data.email && !z.string().email().safeParse(data.email).success)
    return { ok: false, error: "email" };
  try {
    const out = await createQuickCustomer(user, data);
    return "existing" in out
      ? { ok: false, existing: quickCustomerOption(out.existing) }
      : { ok: true, customer: quickCustomerOption(out.created) };
  } catch (error) {
    if (error instanceof QuickCustomerError)
      return {
        ok: false,
        error: error.message === "name" ? "name" : "cnpj_invalid",
      };
    console.error("[quick-customer]", error);
    return { ok: false, error: "failed" };
  }
}
