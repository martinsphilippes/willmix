import "server-only";
import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  type Party,
  type User,
} from "@/lib/db";
import { cnpjDigits, formatCnpj, validCnpj } from "@/lib/order-terms";
import { audit } from "./audit";

/*
 * Cadastro rápido de cliente pelo "+" da Nova solicitação (dono, 21/11/2026;
 * docs/ORDER_TERMS.md, seção 11.25). Decisões do dono:
 * - os dados principais: o CNPJ (obrigatório), que a Receita (BrasilAPI)
 *   completa, e o nome (obrigatório), a razão social, a cidade e UF, o
 *   telefone e o e-mail, que dá para corrigir antes de salvar;
 * - CNPJ que já é de um cliente (do portal ou da carga do Sankhya) não cria
 *   outro: a tela oferece o que existe;
 * - quem lança a solicitação (todo login da Wellmix que abre a Nova
 *   solicitação) cadastra; editar depois continua em Cadastros → Clientes.
 * O cliente nasce como os da carga do Sankhya (CNPJ só com dígitos, país
 * BRASIL, cidade "CIDADE - UF", pessoa jurídica) e vai para o Sankhya como no
 * cadastro completo.
 */

/** Os dados do cadastro rápido (já conferidos pela ação). */
export interface QuickCustomerInput {
  cnpj: string;
  name: string;
  legalName: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

/** O cliente como a busca do pedido mostra (a escolha no campo Cliente). */
export interface QuickCustomerOption {
  id: string;
  name: string;
  /** Código do parceiro no Sankhya (nulo até o envio ao Sankhya). */
  code: string | null;
  /** "12.345.678/0001-90 · SÃO PAULO - SP" */
  hint: string | null;
  active: boolean;
}

export class QuickCustomerError extends Error {}

/** O cliente na forma da escolha do campo Cliente. */
export function quickCustomerOption(party: Party): QuickCustomerOption {
  const doc = cnpjDigits(party.taxId);
  return {
    id: party.id,
    name: party.name,
    code: party.sankhyaCode ?? null,
    hint:
      [doc.length === 14 ? formatCnpj(doc) : party.taxId, party.city]
        .filter(Boolean)
        .join(" · ") || null,
    active: party.active !== false,
  };
}

/**
 * O cliente que já tem este CNPJ (ativo primeiro). A carga do Sankhya grava
 * só os dígitos; o cadastro completo grava como foi digitado: as duas formas.
 */
export async function customerByCnpj(cnpj: string): Promise<Party | null> {
  const digits = cnpjDigits(cnpj);
  if (digits.length !== 14) return null;
  const rows = await getStore().list("parties", {
    filter: { type: "customer", taxId: [digits, formatCnpj(digits)] },
    limit: 20,
  });
  return (
    rows.find((p) => p.active !== false) ??
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ??
    null
  );
}

/**
 * Cadastra o cliente. Com o CNPJ de um cliente que já existe, não cria nada
 * e devolve o que existe (`existing`).
 */
export async function createQuickCustomer(
  user: User,
  input: QuickCustomerInput,
): Promise<{ created: Party } | { existing: Party }> {
  const digits = cnpjDigits(input.cnpj);
  if (!validCnpj(digits)) throw new QuickCustomerError("cnpj_invalid");
  const name = input.name.trim();
  if (name.length < 2) throw new QuickCustomerError("name");
  const existing = await customerByCnpj(digits);
  if (existing) return { existing };
  const city = input.city?.trim().toUpperCase() || null;
  const state = input.state?.trim().toUpperCase().slice(0, 2) || null;
  const party = await getStore().create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "customer",
    name: name.slice(0, 200),
    legalName: input.legalName?.trim().slice(0, 200) || null,
    taxId: digits,
    personType: "J",
    country: "BRASIL",
    // "CIDADE - UF", como a carga do Sankhya grava (e o envio ao Sankhya lê).
    city: city ? (state ? `${city} - ${state}` : city) : null,
    address: input.address?.trim().slice(0, 300) || null,
    phone: input.phone?.trim().slice(0, 40) || null,
    email: input.email?.trim().toLowerCase().slice(0, 200) || null,
    notes: null,
    active: true,
  });
  await audit(
    user,
    "party.create",
    "party",
    party.id,
    `Cadastro rápido na Nova solicitação: ${party.name} (CNPJ ${formatCnpj(digits)})`,
  );
  // Como o cadastro completo: o cliente novo vai para o Sankhya.
  const { syncSoon } = await import("@/lib/integrations/sankhya-sync");
  await syncSoon(user, "party", party.id);
  return { created: (await getStore().get("parties", party.id)) ?? party };
}
