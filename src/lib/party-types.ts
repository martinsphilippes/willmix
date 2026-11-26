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
 * Chaves antigas que valem como outro tipo. Supplier e Trading são o mesmo
 * tipo, "Supplier/Trading" (dono, 26/11/2026; docs/PARTNER_TYPES.md, seção
 * "Supplier/Trading"): a chave que fica é `trading`, que já tinha tudo o que
 * o Supplier tinha e mais (a vez, o convite de book). `supplier_partner`
 * continua legível (planilha, rascunho, auditoria) e vale como `trading`,
 * mas não é mais oferecida.
 */
export const LEGACY_PARTY_TYPES: Partial<Record<PartyType, PartyType>> = {
  supplier_partner: "trading",
};

/** O tipo que vale: a chave antiga vira a de hoje (`supplier_partner` → `trading`). */
export const canonicalPartyType = <T extends string>(type: T): T =>
  ((LEGACY_PARTY_TYPES as Record<string, string>)[type] as T | undefined) ??
  type;

/**
 * Tipos em destaque de "Outros parceiros" (decisão do dono, 11/11/2026):
 * vêm primeiro nos filtros e no formulário, e o login deles entra com as
 * telas do Fornecedor (docs/PARTNER_TYPES.md). Supplier/Trading, Factory e
 * GP (o Supplier entrou no Trading em 26/11/2026).
 */
export const FEATURED_PARTY_TYPES: readonly PartyType[] = [
  "trading",
  "factory",
  "gp",
];

/** Tipos de fábrica listados em "Outros parceiros" (os em destaque primeiro). */
export const OTHER_PARTY_TYPES: readonly PartyType[] = [
  ...FEATURED_PARTY_TYPES,
  ...PARTY_TYPES.filter(
    (t) =>
      !(t in PARTY_TYPE_SCREEN) &&
      t !== "partner" &&
      !(t in LEGACY_PARTY_TYPES) &&
      !FEATURED_PARTY_TYPES.includes(t),
  ),
];

/** O parceiro aparece em "Outros parceiros" (tipo de fábrica ou criado no painel). */
export const isOtherPartyType = (type: string): type is PartyType =>
  type === "partner" ||
  (OTHER_PARTY_TYPES as readonly string[]).includes(canonicalPartyType(type));
