import { PARTY_TYPES, type PartyType } from "@/lib/db/schema";

/*
 * Tela "Outros parceiros" (/app/parties): clientes e fornecedores têm telas
 * próprias em Cadastros (Clientes, Fornecedores), com a conta de cada um.
 * Aqui ficam só os demais tipos (agência, despachante, armador,
 * transportadora, jurídico, comex, logística, OCP) e os tipos criados no
 * painel (docs/PARTNER_TYPES.md). Decisão do dono, 11/11/2026.
 */

/** Tipos com tela própria, e o endereço dela. */
export const PARTY_TYPE_SCREEN: Partial<Record<PartyType, string>> = {
  customer: "/app/customers",
  supplier: "/app/suppliers",
};

/**
 * Tipos em destaque de "Outros parceiros" (decisão do dono, 11/11/2026):
 * vêm primeiro nos filtros e no formulário, e o login deles entra com as
 * telas do Fornecedor (docs/PARTNER_TYPES.md).
 */
export const FEATURED_PARTY_TYPES: readonly PartyType[] = [
  "trading",
  "factory",
  "supplier_partner",
  "gp",
];

/** Tipos de fábrica listados em "Outros parceiros" (os em destaque primeiro). */
export const OTHER_PARTY_TYPES: readonly PartyType[] = [
  ...FEATURED_PARTY_TYPES,
  ...PARTY_TYPES.filter(
    (t) =>
      !(t in PARTY_TYPE_SCREEN) &&
      t !== "partner" &&
      !FEATURED_PARTY_TYPES.includes(t),
  ),
];

/** O parceiro aparece em "Outros parceiros" (tipo de fábrica ou criado no painel). */
export const isOtherPartyType = (type: string): type is PartyType =>
  type === "partner" || (OTHER_PARTY_TYPES as readonly string[]).includes(type);
