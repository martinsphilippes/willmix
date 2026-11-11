import { PARTY_TYPES, type PartyType } from "@/lib/db/schema";

/*
 * Tela "Outros parceiros" (/app/parties): clientes e fornecedores têm telas
 * próprias em Cadastros (Clientes, Fornecedores), com a conta de cada um.
 * Aqui ficam só os demais tipos (agência, despachante, armador,
 * transportadora, jurídico, comex, logística, OCP). Decisão do dono,
 * 11/11/2026.
 */

/** Tipos com tela própria, e o endereço dela. */
export const PARTY_TYPE_SCREEN: Partial<Record<PartyType, string>> = {
  customer: "/app/customers",
  supplier: "/app/suppliers",
};

/** Tipos listados em "Outros parceiros". */
export const OTHER_PARTY_TYPES: readonly PartyType[] = PARTY_TYPES.filter(
  (t) => !(t in PARTY_TYPE_SCREEN),
);

export const isOtherPartyType = (type: string): type is PartyType =>
  (OTHER_PARTY_TYPES as readonly string[]).includes(type);
